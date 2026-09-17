import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import { createApprovedTestRegistry } from "../test-support/editorial-fixtures.js";
import { createTopicStore } from "../src/topic-store.js";

// Run only against the disposable database provided by the integration workflow.
const connection = process.env.DATABASE_URL;
if (!connection) throw new Error("DATABASE_URL is required (disposable test database)");
const registry = createApprovedTestRegistry(CATALOG.map(person => person.id));
const store = createTopicStore(connection, { candidateRegistry: registry, clock: () => new Date("2032-09-17T15:00:00Z"), collectionEnabled: true });
const audit = new pg.Pool({ connectionString: connection });
await store.init();
const player = await store.createPlayer({ networkHash: "e".repeat(64) });
const other = await store.createPlayer({ networkHash: "f".repeat(64) });
let version = 0;
try {
  const first = await store.pairRound(player.recoveryKey, "eleicoes-2026", "warmup");
  assert.equal(first.remaining, 3);
  assert.deepEqual(await store.pairRound(player.recoveryKey, "eleicoes-2026", "warmup"), first);
  const request = { recoveryKey: player.recoveryKey, roundId: first.round.id, winnerId: first.round.candidateIds[0], playerVersion: version };
  await assert.rejects(store.pairVote({ ...request, recoveryKey: other.recoveryKey }), /não emitida/);
  const [created, replay] = await Promise.all([store.pairVote(request), store.pairVote(request)]);
  assert.equal(created.round.comparisons, 1);
  assert.equal(replay.round.status, "alreadyProcessed");
  assert.deepEqual(created.round.personalFeedback, replay.round.personalFeedback);
  version = created.player.version;
  const beforeDiscard = await store.playerRanking(player.recoveryKey, "eleicoes-2026");
  await assert.rejects(store.discard({ ...request, candidateId: request.winnerId }), /fora da rodada/);
  const discard = { ...request, candidateId: first.round.candidateIds[1] };
  assert.equal((await store.discard(discard)).status, "created");
  assert.equal((await store.discard(discard)).status, "alreadyProcessed");
  await assert.rejects(store.discard({ ...discard, candidateId: null }), /outra decisão/);
  assert.deepEqual(await store.playerRanking(player.recoveryKey, "eleicoes-2026"), beforeDiscard);
  for (let i = 0; i < 2; i++) {
    const pair = await store.pairRound(player.recoveryKey, "eleicoes-2026", "warmup");
    const result = await store.pairVote({ recoveryKey: player.recoveryKey, roundId: pair.round.id, winnerId: pair.round.candidateIds[0], playerVersion: version });
    version = result.player.version;
    if (i === 0) await store.discard({ recoveryKey: player.recoveryKey, roundId: pair.round.id, candidateId: null });
  }
  assert.equal((await store.pairRound(player.recoveryKey, "eleicoes-2026", "warmup")).status, "completed");
  assert.deepEqual(await store.discardMetrics(player.recoveryKey), { editionId: null, rounds: 3, completed: 1, skipped: 1, pending: 1, completionRate: 1 / 3 });
  assert.equal((await store.discardMetrics(other.recoveryKey)).rounds, 0);
  assert.equal((await store.collection(player.recoveryKey)).items.length, 0);
  let session = await store.dailySession(player.recoveryKey, "eleicoes-2026");
  for (let i = 0; i < 10; i++) {
    // Test-only minute reset; no daily quota or production database is touched.
    await audit.query("DELETE FROM abuse_quota_counters WHERE scope='player-round-minute'");
    const result = await store.dailyVote({ recoveryKey: player.recoveryKey, topicId: "eleicoes-2026", editionId: session.edition.id,
      slot: session.round.slot, winnerId: session.round.candidateIds[0], answerId: randomUUID(), playerVersion: version });
    session = result.dailySession; version = result.player.version;
  }
  assert.equal(session.status, "completed");
  const rewards = await Promise.all([store.collection(player.recoveryKey), store.collection(player.recoveryKey)]);
  assert.equal(rewards[0].items.length, 1);
  assert.deepEqual(rewards[0], rewards[1]);
  assert.equal((await store.collection(other.recoveryKey)).items.length, 0);
  const restarted = createTopicStore(connection, { candidateRegistry: registry, collectionEnabled: true });
  try { await restarted.init(); assert.equal((await restarted.collection(player.recoveryKey)).items.length, 1); }
  finally { await restarted.close(); }
  console.log("Game PostgreSQL: pair issuance/replay/ownership, three-round opening, separate discard, 10/10 reward, concurrency and restart passed.");
} finally { await store.close(); await audit.end(); }
