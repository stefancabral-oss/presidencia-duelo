import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
import { createTopicStore, recoveryKeyHash, VOTE_ABUSE_LIMITS } from "../src/topic-store.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL é obrigatória para o smoke de abuso");

const store = createTopicStore(connectionString);
await store.init();

async function expectCode(operation, code) {
  await assert.rejects(operation, (error) => {
    assert.equal(error.status, code === "PLAYER_SESSION_REQUIRED" ? 401 : 429);
    assert.equal(error.code, code);
    return true;
  });
}

// The integration workflow intentionally runs the broader store smoke first in
// the same database. Use per-run network subjects so this abuse proof measures
// its own quota window instead of inheriting counters from another smoke.
const networkSubject = (label) => createHash("sha256")
  .update(`${label}:${randomUUID()}`)
  .digest("hex");

const issuanceNetwork = networkSubject("issuance-limit");
for (let index = 0; index < VOTE_ABUSE_LIMITS.anonymousPlayersPerNetworkPerDay; index += 1) {
  const issued = await store.createPlayer({ networkHash: issuanceNetwork });
  assert.match(issued.recoveryKey, /^pm2_/);
}
await expectCode(() => store.createPlayer({ networkHash: issuanceNetwork }), "PLAYER_ISSUANCE_LIMIT");

const { recoveryKey } = await store.createPlayer({ networkHash: networkSubject("round-limits") });
const candidateIds = ["lula", "jair-bolsonaro", "anitta", "neymar-jr"];
await assert.rejects(
  () => store.roundVote({
    topicId: "eleicoes-2026",
    winnerId: "lula",
    candidateIds,
    roundId: randomUUID(),
    recoveryKey: "",
    playerVersion: 0,
  }),
  (error) => error.status === 401,
);

let lastRound;
for (let version = 0; version < VOTE_ABUSE_LIMITS.roundsPerPlayerPerMinute; version += 1) {
  lastRound = {
    topicId: "eleicoes-2026",
    winnerId: candidateIds[version % candidateIds.length],
    candidateIds,
    roundId: randomUUID(),
    recoveryKey,
    playerVersion: version,
  };
  const result = await store.roundVote(lastRound);
  assert.equal(result.round.status, "created");
  assert.equal(result.round.winnerId, lastRound.winnerId);
  assert.deepEqual(result.round.candidateIds, lastRound.candidateIds);
  assert.equal(result.player.version, version + 1);
}

const replay = await store.roundVote(lastRound);
assert.equal(replay.round.status, "alreadyProcessed");
assert.equal(replay.round.winnerId, lastRound.winnerId);
assert.deepEqual(replay.round.candidateIds, lastRound.candidateIds);
assert.equal(replay.player.version, VOTE_ABUSE_LIMITS.roundsPerPlayerPerMinute);

const blockedRound = {
  ...lastRound,
  roundId: randomUUID(),
  playerVersion: VOTE_ABUSE_LIMITS.roundsPerPlayerPerMinute,
};
await expectCode(() => store.roundVote(blockedRound), "VOTE_RATE_LIMITED");

const audit = new pg.Pool({ connectionString });
const player = await audit.query("SELECT id FROM anonymous_players WHERE recovery_hash = $1", [recoveryKeyHash(recoveryKey)]);
assert.equal(player.rowCount, 1);
const playerId = player.rows[0].id;
await audit.query(
  `UPDATE abuse_quota_counters
   SET window_start = window_start - interval '2 minutes'
   WHERE scope = 'player-round-minute' AND subject_hash = $1`,
  [playerId],
);
await audit.query(
  `UPDATE abuse_quota_counters
   SET used = $2
   WHERE scope = 'player-choice-editorial-day-v2' AND subject_hash = $1`,
  [playerId, VOTE_ABUSE_LIMITS.editorialChoicesPerPlayerPerDay],
);
await expectCode(() => store.roundVote(blockedRound), "VOTE_DAILY_LIMIT");

const persisted = await audit.query(
  `SELECT scope, used FROM abuse_quota_counters WHERE subject_hash = $1 ORDER BY scope`,
  [playerId],
);
assert.deepEqual(
  persisted.rows.map(({ scope, used }) => [scope, Number(used)]),
  [
    ["player-choice-editorial-day-v2", VOTE_ABUSE_LIMITS.editorialChoicesPerPlayerPerDay],
    ["player-free-editorial-day-v2", VOTE_ABUSE_LIMITS.roundsPerPlayerPerMinute],
    ["player-round-minute", VOTE_ABUSE_LIMITS.roundsPerPlayerPerMinute],
  ],
);
const personal = await store.playerRanking(recoveryKey, "eleicoes-2026");
assert.equal(personal.version, VOTE_ABUSE_LIMITS.roundsPerPlayerPerMinute);

await audit.end();
await store.close();

console.log("Abuso bloqueado: sessão obrigatória, emissão 3/dia/rede, 8 rodadas/minuto, 30 rodadas/dia e retry idempotente sem consumo.");
