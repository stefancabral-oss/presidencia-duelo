import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createTopicStore, recoveryKeyHash } from "../src/topic-store.js";
import { candidatesForTopic } from "../src/candidates.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL é obrigatória para o smoke de integração");

const seed = new pg.Pool({ connectionString });
await seed.query(`
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  CREATE TABLE ranking_pools (mode text PRIMARY KEY, duels bigint NOT NULL DEFAULT 0);
  INSERT INTO ranking_pools (mode, duels) VALUES ('presidentes', 37);
  CREATE TABLE votes (id bigserial PRIMARY KEY, winner_id text, loser_id text);
  INSERT INTO votes (winner_id, loser_id) VALUES ('legacy-a', 'legacy-b');
`);
await seed.end();

const firstStore = createTopicStore(connectionString);
const firstMigration = await firstStore.init();
assert.equal(firstMigration.resetApplied, true);

const initial = await firstStore.ranking("eleicoes-2026");
assert.equal(initial.duels, 0);
assert.equal(initial.ranking.length, 54);

const { recoveryKey } = await firstStore.createPlayer({ networkHash: "a".repeat(64) });
const personalBefore = await firstStore.playerRanking(recoveryKey, "eleicoes-2026");
assert.equal(personalBefore.version, 0);
assert.equal(personalBefore.duels, 0);
assert.equal(personalBefore.rankingPolicy.id, "pairwise-majority-scc-v1");

const voteId = randomUUID();
const created = await firstStore.vote({
  topicId: "eleicoes-2026",
  winnerId: "lula",
  loserId: "jair-bolsonaro",
  voteId,
  recoveryKey,
  playerVersion: 0,
});
assert.equal(created.vote.status, "created");
assert.equal(created.duels, 1);
assert.equal(created.player.version, 1);
assert.equal(created.player.duels, 1);

const repeated = await firstStore.vote({
  topicId: "eleicoes-2026",
  winnerId: "lula",
  loserId: "jair-bolsonaro",
  voteId,
  recoveryKey,
  playerVersion: 0,
});
assert.equal(repeated.vote.status, "alreadyProcessed");
assert.equal(repeated.duels, 1);
await firstStore.close();

const legacyPlayer = new pg.Pool({ connectionString });
await legacyPlayer.query("DELETE FROM player_stats WHERE candidate_id IN ('anitta', 'neymar-jr')");
await legacyPlayer.end();

const restartedStore = createTopicStore(connectionString);
const secondMigration = await restartedStore.init();
assert.equal(secondMigration.resetApplied, false);
const afterRestart = await restartedStore.ranking("eleicoes-2026");
assert.equal(afterRestart.duels, 1);
const influencerVote = await restartedStore.vote({
  topicId: "eleicoes-2026",
  winnerId: "anitta",
  loserId: "neymar-jr",
  voteId: randomUUID(),
  recoveryKey,
  playerVersion: 1,
});
assert.equal(influencerVote.vote.status, "created");
assert.equal(influencerVote.player.version, 2);
assert.equal(influencerVote.player.ranking.length, 54);

const roundId = randomUUID();
const round = await restartedStore.roundVote({
  topicId: "eleicoes-2026",
  winnerId: "anitta",
  candidateIds: ["lula", "jair-bolsonaro", "anitta", "neymar-jr"],
  roundId,
  recoveryKey,
  playerVersion: 2,
});
assert.equal(round.round.status, "created");
assert.equal(round.round.winnerId, "anitta");
assert.deepEqual(round.round.candidateIds, ["lula", "jair-bolsonaro", "anitta", "neymar-jr"]);
assert.equal(round.round.comparisons, 3);
assert.equal(round.duels, 3);
assert.equal(round.player.version, 3);
assert.equal(round.player.duels, 3);
assert.equal(round.player.rankingPolicy.id, "pairwise-majority-scc-v1");
assert.equal(round.ranking.find(({ id }) => id === "anitta").wins, 4);
assert.equal(round.round.feedbackScope, "personal");
assert.deepEqual(round.round.personalFeedback, round.round.feedback);
assert.equal(round.round.feedback.outcomes.length, 4);
assert.equal(round.round.feedback.outcomes.filter(({ result }) => result === "winner").length, 1);
assert.equal(round.round.feedback.outcomes.filter(({ result }) => result === "loser").length, 3);
assert.ok(round.round.feedback.outcomes.every(({ delta, tier }) => Number.isInteger(delta) && tier?.id));
assert.ok(round.round.globalEvent?.feedback?.outcomes.length === 4);

const repeatedRound = await restartedStore.roundVote({
  topicId: "eleicoes-2026",
  winnerId: "anitta",
  candidateIds: ["neymar-jr", "anitta", "jair-bolsonaro", "lula"],
  roundId,
  recoveryKey,
  playerVersion: 2,
});
assert.equal(repeatedRound.round.status, "alreadyProcessed");
assert.equal(repeatedRound.round.winnerId, "anitta");
assert.deepEqual(repeatedRound.round.candidateIds, ["neymar-jr", "anitta", "jair-bolsonaro", "lula"]);
assert.equal(repeatedRound.duels, 3);
assert.deepEqual(repeatedRound.round.feedback, round.round.feedback);
assert.deepEqual(repeatedRound.round.personalFeedback, round.round.personalFeedback);
assert.deepEqual(repeatedRound.round.globalEvent, round.round.globalEvent);

const firstGoogleSession = await restartedStore.signInWithGoogle({
  identity: { subject: "google-sub-integration", displayName: "Bia", avatarUrl: "https://example.com/bia.jpg" },
  currentToken: recoveryKey,
  topicId: "eleicoes-2026",
});
assert.match(firstGoogleSession.sessionToken, /^pms_/);
assert.equal(firstGoogleSession.player.duels, 3);
assert.deepEqual(firstGoogleSession.account, { displayName: "Bia", avatarUrl: "https://example.com/bia.jpg" });
assert.equal(Object.hasOwn(firstGoogleSession.account, "email"), false);
await assert.rejects(restartedStore.playerRanking(recoveryKey, "eleicoes-2026"), /expirada/);
const recoveredWithSession = await restartedStore.playerRanking(firstGoogleSession.sessionToken, "eleicoes-2026");
assert.equal(recoveredWithSession.duels, 3);
assert.equal(recoveredWithSession.account.displayName, "Bia");
await restartedStore.signOut(firstGoogleSession.sessionToken);
await assert.rejects(restartedStore.playerRanking(firstGoogleSession.sessionToken, "eleicoes-2026"), /expirada/);
const returningGoogleSession = await restartedStore.signInWithGoogle({
  identity: { subject: "google-sub-integration", displayName: "Bia", avatarUrl: "" },
  currentToken: "",
  topicId: "eleicoes-2026",
});
assert.equal(returningGoogleSession.player.duels, 3);

const auditPool = new pg.Pool({ connectionString });
const audit = await auditPool.query(
  `SELECT
    (SELECT count(*) FROM votes) AS comparisons,
    (SELECT count(*) FROM choice_rounds) AS rounds,
    (SELECT count(*) FROM votes WHERE round_id = $1) AS linked_comparisons,
    (SELECT count(DISTINCT winner_rating_before) FROM votes WHERE round_id = $1) AS winner_snapshots,
    (SELECT jsonb_array_length(feedback->'outcomes') FROM choice_rounds WHERE round_id = $1) AS feedback_outcomes,
    (SELECT feedback_scope FROM choice_rounds WHERE round_id = $1) AS feedback_scope,
    (SELECT jsonb_array_length(global_feedback->'outcomes') FROM choice_rounds WHERE round_id = $1) AS global_feedback_outcomes,
    (SELECT count(*) FROM player_identities WHERE provider = 'google') AS google_identities,
    (SELECT count(*) FROM player_sessions) AS active_sessions`,
  [roundId],
);
assert.equal(Number(audit.rows[0].comparisons), 5);
assert.equal(Number(audit.rows[0].rounds), 1);
assert.equal(Number(audit.rows[0].linked_comparisons), 3);
assert.equal(Number(audit.rows[0].winner_snapshots), 1);
assert.equal(Number(audit.rows[0].feedback_outcomes), 4);
assert.equal(audit.rows[0].feedback_scope, "personal");
assert.equal(Number(audit.rows[0].global_feedback_outcomes), 4);
assert.equal(Number(audit.rows[0].google_identities), 1);
assert.equal(Number(audit.rows[0].active_sessions), 1);
await auditPool.end();
await restartedStore.close();

const precedingRelease = new pg.Pool({ connectionString });
await precedingRelease.query("ALTER TABLE votes DROP COLUMN round_id");
await precedingRelease.query("DROP INDEX IF EXISTS votes_player_topic_pair_idx");
await precedingRelease.query(`ALTER TABLE choice_rounds
  DROP COLUMN feedback_scope,
  DROP COLUMN global_ranking_event,
  DROP COLUMN global_feedback`);
await precedingRelease.query("DELETE FROM schema_migrations WHERE id = '2026-09-15-link-four-card-comparisons'");
await precedingRelease.end();

const upgradedStore = createTopicStore(connectionString);
await upgradedStore.init();
const upgradedAuditPool = new pg.Pool({ connectionString });
const upgradedAudit = await upgradedAuditPool.query("SELECT count(*) AS linked_comparisons FROM votes WHERE round_id = $1", [roundId]);
assert.equal(Number(upgradedAudit.rows[0].linked_comparisons), 3);
const legacyReplay = await upgradedStore.roundVote({
  topicId: "eleicoes-2026",
  winnerId: "anitta",
  candidateIds: ["lula", "jair-bolsonaro", "anitta", "neymar-jr"],
  roundId,
  recoveryKey: returningGoogleSession.sessionToken,
  playerVersion: 3,
});
assert.equal(legacyReplay.round.status, "alreadyProcessed");
assert.equal(legacyReplay.round.winnerId, "anitta");
assert.deepEqual(legacyReplay.round.candidateIds, ["lula", "jair-bolsonaro", "anitta", "neymar-jr"]);
assert.equal(legacyReplay.round.feedbackScope, "legacy-global");
assert.deepEqual(legacyReplay.round.personalFeedback, {
  rankingEvent: "confirm",
  primaryEvent: "confirm",
  zebra: false,
  outcomes: [],
});
assert.deepEqual(legacyReplay.round.personalFeedback.outcomes, []);
assert.ok(legacyReplay.round.globalEvent?.feedback?.outcomes.length === 4);
const migrationAudit = await upgradedAuditPool.query("SELECT count(*) AS applied FROM schema_migrations WHERE id = '2026-09-15-link-four-card-comparisons'");
assert.equal(Number(migrationAudit.rows[0].applied), 1);
await upgradedAuditPool.end();
await upgradedStore.close();

// Contrato SQL da #179. O clock é injetado; timestamps de auditoria continuam
// vindo do PostgreSQL, mas edição e fechamento obedecem ao dia editorial que a
// aplicação recebeu. A limpeza abaixo atinge somente a cota por minuto para o
// smoke conseguir percorrer 10 slots sem esperar fisicamente dois minutos.
let dailyNow = new Date("2026-09-16T12:00:00.000Z");
let mutableCatalog = candidatesForTopic("eleicoes-2026").map((candidate) => structuredClone(candidate));
const dailyStore = createTopicStore(connectionString, {
  clock: () => dailyNow,
  candidateCatalog: () => mutableCatalog.map((candidate) => structuredClone(candidate)),
});
await dailyStore.init();
const firstDailyPlayer = await dailyStore.createPlayer({ networkHash: "b".repeat(64) });
const secondDailyPlayer = await dailyStore.createPlayer({ networkHash: "c".repeat(64) });
const [firstDailySession, secondDailySession] = await Promise.all([
  dailyStore.dailySession(firstDailyPlayer.recoveryKey, "eleicoes-2026"),
  dailyStore.dailySession(secondDailyPlayer.recoveryKey, "eleicoes-2026"),
]);
assert.equal(firstDailySession.progress.answered, 0);
assert.deepEqual(firstDailySession.edition, secondDailySession.edition);
assert.deepEqual(firstDailySession.round, secondDailySession.round);
assert.equal(new Set(firstDailySession.round.candidateIds).size, 4);
assert.equal(Object.hasOwn(firstDailySession, "completedPlayers"), false);

await assert.rejects(
  dailyStore.dailyVote({
    topicId: "eleicoes-2026",
    editionId: firstDailySession.edition.id,
    slot: 2,
    winnerId: firstDailySession.round.candidateIds[0],
    answerId: randomUUID(),
    recoveryKey: firstDailyPlayer.recoveryKey,
    playerVersion: 0,
  }),
  (error) => error.code === "DAILY_SLOT_OUT_OF_ORDER" && error.current === 1,
);

const firstAnswerId = randomUUID();
const firstWinnerId = firstDailySession.round.candidateIds[0];
const identicalConcurrentVotes = await Promise.all([
  dailyStore.dailyVote({
    topicId: "eleicoes-2026",
    editionId: firstDailySession.edition.id,
    slot: 1,
    winnerId: firstWinnerId,
    answerId: firstAnswerId,
    recoveryKey: firstDailyPlayer.recoveryKey,
    playerVersion: 0,
  }),
  dailyStore.dailyVote({
    topicId: "eleicoes-2026",
    editionId: firstDailySession.edition.id,
    slot: 1,
    winnerId: firstWinnerId,
    answerId: firstAnswerId,
    recoveryKey: firstDailyPlayer.recoveryKey,
    playerVersion: 0,
  }),
]);
assert.deepEqual(identicalConcurrentVotes.map(({ round }) => round.status).sort(), ["alreadyProcessed", "created"]);
assert.deepEqual(identicalConcurrentVotes[0].dailySession, identicalConcurrentVotes[1].dailySession);
assert.equal(identicalConcurrentVotes[0].dailySession.progress.answered, 1);

await assert.rejects(
  dailyStore.dailyVote({
    topicId: "eleicoes-2026",
    editionId: firstDailySession.edition.id,
    slot: 1,
    winnerId: firstDailySession.round.candidateIds[1],
    answerId: firstAnswerId,
    recoveryKey: firstDailyPlayer.recoveryKey,
    playerVersion: 0,
  }),
  (error) => error.code === "DAILY_REPLAY_DIVERGENT",
);

const competingAnswerIds = [randomUUID(), randomUUID()];
const competingVotes = await Promise.allSettled(competingAnswerIds.map((answerId) => dailyStore.dailyVote({
  topicId: "eleicoes-2026",
  editionId: secondDailySession.edition.id,
  slot: 1,
  winnerId: secondDailySession.round.candidateIds[0],
  answerId,
  recoveryKey: secondDailyPlayer.recoveryKey,
  playerVersion: 0,
})));
assert.equal(competingVotes.filter(({ status }) => status === "fulfilled").length, 1);
assert.equal(competingVotes.filter(({ status, reason }) => status === "rejected" && reason.code === "DAILY_SLOT_OUT_OF_ORDER").length, 1);

const quotaMaintenance = new pg.Pool({ connectionString });
async function clearMinuteQuota() {
  await quotaMaintenance.query("DELETE FROM abuse_quota_counters WHERE scope = 'player-round-minute'");
}
async function playerIdFor(recoveryKeyValue) {
  const result = await quotaMaintenance.query(
    "SELECT id FROM anonymous_players WHERE recovery_hash = $1",
    [recoveryKeyHash(recoveryKeyValue)],
  );
  assert.equal(result.rowCount, 1);
  return result.rows[0].id;
}

// A data editorial, e não o ruleset ativo, é a identidade única da edição.
await assert.rejects(
  quotaMaintenance.query(
    `INSERT INTO daily_editions (
       id, edition_date, topic_id, ruleset_id, ruleset_version, catalog_hash, catalog_ids,
       catalog_schema, catalog_snapshot, catalog_snapshot_hash, candidate_count, total_rounds, cards_per_round,
       opens_at, closes_at
     )
     SELECT $1, edition_date, topic_id, ruleset_id, ruleset_version, catalog_hash, catalog_ids,
            catalog_schema, catalog_snapshot, catalog_snapshot_hash, candidate_count, total_rounds, cards_per_round,
            opens_at, closes_at
     FROM daily_editions WHERE id = $2`,
    [`duplicate-${randomUUID()}`, firstDailySession.edition.id],
  ),
  (error) => error.code === "23505",
);

// Um contador legado cheio e sobreposto é carregado de forma conservadora:
// o deploy do v2 não concede mais 30 escolhas no mesmo dia editorial.
const legacyQuotaPlayer = await dailyStore.createPlayer({ networkHash: "e".repeat(64) });
const legacyQuotaSession = await dailyStore.dailySession(legacyQuotaPlayer.recoveryKey, "eleicoes-2026");
const legacyQuotaPlayerId = await playerIdFor(legacyQuotaPlayer.recoveryKey);
await quotaMaintenance.query(
  `INSERT INTO abuse_quota_counters (scope, subject_hash, window_start, used)
   VALUES ('player-round-day', $1, '2026-09-16T00:00:00.000Z', 30)`,
  [legacyQuotaPlayerId],
);
await assert.rejects(
  dailyStore.dailyVote({
    topicId: "eleicoes-2026",
    editionId: legacyQuotaSession.edition.id,
    slot: 1,
    winnerId: legacyQuotaSession.round.candidateIds[0],
    answerId: randomUUID(),
    recoveryKey: legacyQuotaPlayer.recoveryKey,
    playerVersion: 0,
  }),
  (error) => error.code === "VOTE_DAILY_LIMIT",
);

// O modo livre recebe a janela editorial calculada pela aplicação. Os dois
// lados da meia-noite de São Paulo precisam cair em buckets diferentes.
const windowPlayer = await dailyStore.createPlayer({ networkHash: "f".repeat(64) });
const windowPlayerId = await playerIdFor(windowPlayer.recoveryKey);
const freeCandidates = mutableCatalog.slice(0, 4).map(({ id }) => id);
const beforeEditorialMidnight = new Date("2026-09-17T02:59:59.900Z");
const afterEditorialMidnight = new Date("2026-09-17T03:00:00.100Z");
await dailyStore.roundVote({
  topicId: "eleicoes-2026",
  winnerId: freeCandidates[0],
  candidateIds: freeCandidates,
  roundId: randomUUID(),
  recoveryKey: windowPlayer.recoveryKey,
  playerVersion: 0,
  now: beforeEditorialMidnight,
});
await clearMinuteQuota();
await dailyStore.roundVote({
  topicId: "eleicoes-2026",
  winnerId: freeCandidates[1],
  candidateIds: freeCandidates,
  roundId: randomUUID(),
  recoveryKey: windowPlayer.recoveryKey,
  playerVersion: 1,
  now: afterEditorialMidnight,
});
const explicitFreeWindows = await quotaMaintenance.query(
  `SELECT window_start FROM abuse_quota_counters
   WHERE scope = 'player-free-editorial-day-v2' AND subject_hash = $1
   ORDER BY window_start`,
  [windowPlayerId],
);
assert.deepEqual(
  explicitFreeWindows.rows.map(({ window_start }) => new Date(window_start).toISOString()),
  ["2026-09-16T03:00:00.000Z", "2026-09-17T03:00:00.000Z"],
);
await clearMinuteQuota();
let firstProgress = identicalConcurrentVotes[0].dailySession;
for (let slot = 2; slot <= 10; slot += 1) {
  const next = firstProgress.round;
  assert.equal(next.slot, slot);
  const response = await dailyStore.dailyVote({
    topicId: "eleicoes-2026",
    editionId: firstDailySession.edition.id,
    slot,
    winnerId: next.candidateIds[0],
    answerId: randomUUID(),
    recoveryKey: firstDailyPlayer.recoveryKey,
    playerVersion: slot - 1,
  });
  firstProgress = response.dailySession;
  if (slot === 4) {
    const reloaded = await dailyStore.dailySession(firstDailyPlayer.recoveryKey, "eleicoes-2026");
    assert.deepEqual(reloaded, firstProgress);
  }
  await clearMinuteQuota();
}
assert.equal(firstProgress.status, "completed");
assert.deepEqual(firstProgress.progress, { answered: 10, total: 10 });
assert.equal(firstProgress.round, null);
assert.match(firstProgress.cut.methodology, /entre quem concluiu a rodada de 16\/09/);

const freeRound = await dailyStore.roundVote({
  topicId: "eleicoes-2026",
  winnerId: "lula",
  candidateIds: ["lula", "jair-bolsonaro", "anitta", "neymar-jr"],
  roundId: randomUUID(),
  recoveryKey: firstDailyPlayer.recoveryKey,
  playerVersion: 10,
});
assert.equal(freeRound.round.status, "created");
assert.equal(freeRound.player.version, 11);

// A edição guarda a ficha completa usada na materialização. Retirar alguém do
// catálogo corrente não apaga a carta histórica nem impede um jogador novo de
// terminar os dez slots daquele dia.
const removedCandidate = firstDailySession.catalog[0];
mutableCatalog = mutableCatalog.filter(({ id }) => id !== removedCandidate.id);
assert.equal(mutableCatalog.some(({ id }) => id === removedCandidate.id), false);
const snapshotPlayer = await dailyStore.createPlayer({ networkHash: "7".repeat(64) });
let snapshotProgress = await dailyStore.dailySession(snapshotPlayer.recoveryKey, "eleicoes-2026");
assert.equal(snapshotProgress.edition.id, firstDailySession.edition.id);
assert.equal(snapshotProgress.catalog.length, 40);
assert.deepEqual(snapshotProgress.catalog, firstDailySession.catalog);
assert.ok(snapshotProgress.catalog.some(({ id }) => id === removedCandidate.id));
let removedCandidateWasVoted = false;
await clearMinuteQuota();
for (let slot = 1; slot <= 10; slot += 1) {
  const winnerId = snapshotProgress.round.candidateIds.includes(removedCandidate.id)
    ? removedCandidate.id
    : snapshotProgress.round.candidateIds[0];
  removedCandidateWasVoted ||= winnerId === removedCandidate.id;
  const response = await dailyStore.dailyVote({
    topicId: "eleicoes-2026",
    editionId: snapshotProgress.edition.id,
    slot,
    winnerId,
    answerId: randomUUID(),
    recoveryKey: snapshotPlayer.recoveryKey,
    playerVersion: slot - 1,
  });
  snapshotProgress = response.dailySession;
  await clearMinuteQuota();
}
assert.equal(removedCandidateWasVoted, true);
assert.equal(snapshotProgress.status, "completed");
assert.deepEqual(snapshotProgress.progress, { answered: 10, total: 10 });
const currentPublicRanking = await dailyStore.ranking("eleicoes-2026");
assert.equal(currentPublicRanking.ranking.some(({ id }) => id === removedCandidate.id), false);

dailyNow = new Date("2026-09-17T12:00:00.000Z");
const nextDay = await dailyStore.dailySession(firstDailyPlayer.recoveryKey, "eleicoes-2026");
assert.notEqual(nextDay.edition.id, firstDailySession.edition.id);
assert.notDeepEqual(nextDay.round.candidateIds, firstDailySession.round.candidateIds);
assert.deepEqual(nextDay.progress, { answered: 0, total: 10 });
assert.equal(nextDay.catalog.some(({ id }) => id === removedCandidate.id), false);
const replayAfterMidnight = await dailyStore.dailyVote({
  topicId: "eleicoes-2026",
  editionId: firstDailySession.edition.id,
  slot: 1,
  winnerId: firstWinnerId,
  answerId: firstAnswerId,
  recoveryKey: firstDailyPlayer.recoveryKey,
  playerVersion: 0,
});
assert.equal(replayAfterMidnight.round.status, "alreadyProcessed");
assert.deepEqual(
  { ...replayAfterMidnight.round, status: "created" },
  identicalConcurrentVotes.find(({ round }) => round.status === "created").round,
);
assert.deepEqual(replayAfterMidnight.dailySession, firstProgress);
await assert.rejects(
  dailyStore.dailyVote({
    topicId: "eleicoes-2026",
    editionId: firstDailySession.edition.id,
    slot: 10,
    winnerId: firstProgress.answers.at(-1).winnerId,
    answerId: randomUUID(),
    recoveryKey: firstDailyPlayer.recoveryKey,
    playerVersion: 11,
  }),
  (error) => error.code === "DAILY_EDITION_CLOSED",
);

const publishedCut = await dailyStore.dailyCut("eleicoes-2026", "2026-09-16");
assert.equal(publishedCut.completedPlayers, 2);
assert.equal(publishedCut.completedAnswers, 20);
assert.match(publishedCut.methodology, /entre quem concluiu a rodada de 16\/09/);
assert.match(publishedCut.sampleNotice, /baixa participação/);
assert.equal(publishedCut.catalog.length, 40);
assert.equal(publishedCut.catalog.some(({ id }) => id === removedCandidate.id), true);
assert.equal(publishedCut.catalog.find(({ id }) => id === removedCandidate.id).name, removedCandidate.name);
assert.match(publishedCut.catalogSnapshotHash, /^[a-f0-9]{64}$/);
const cutReaderStore = createTopicStore(connectionString, {
  clock: () => dailyNow,
  candidateCatalog: () => mutableCatalog.map((candidate) => structuredClone(candidate)),
});
await cutReaderStore.init();
const repeatedCut = await cutReaderStore.dailyCut("eleicoes-2026", "2026-09-16");
assert.deepEqual(repeatedCut, publishedCut);
await cutReaderStore.close();

// Barreira voto final × corte. O voto admitido antes do fechamento mantém o
// mesmo advisory lock até o COMMIT; o corte iniciado depois da meia-noite deve
// esperar e incluir a conclusão. Uma admissão realmente tardia é recusada.
const beforeMidnight = new Date("2026-09-19T02:59:59.900Z");
const afterMidnight = new Date("2026-09-19T03:00:00.100Z");
const barrierAnswerIds = new Set();
let releaseVoteCommit;
let announceBothVotesAdmitted;
let admittedVotes = 0;
const voteCommitGate = new Promise((resolve) => { releaseVoteCommit = resolve; });
const bothVotesAdmitted = new Promise((resolve) => { announceBothVotesAdmitted = resolve; });
let cutFirstEditionId = "";
let releaseCutFirstCommit;
let announceCutFirstCommit;
const cutFirstCommitGate = new Promise((resolve) => { releaseCutFirstCommit = resolve; });
const cutFirstReachedCommit = new Promise((resolve) => { announceCutFirstCommit = resolve; });
const crossingStore = createTopicStore(connectionString, {
  clock: () => afterMidnight,
  candidateCatalog: () => mutableCatalog.map((candidate) => structuredClone(candidate)),
  hooks: {
    async afterDailyVoteAdmission({ answerId, slot }) {
      if (slot !== 10 || !barrierAnswerIds.has(answerId)) return;
      admittedVotes += 1;
      if (admittedVotes === 2) announceBothVotesAdmitted();
      await voteCommitGate;
    },
    async beforeDailyCutCommit({ editionId }) {
      if (!cutFirstEditionId || editionId !== cutFirstEditionId) return;
      announceCutFirstCommit();
      await cutFirstCommitGate;
    },
  },
});
await crossingStore.init();
const crossingPlayers = await Promise.all([
  crossingStore.createPlayer({ networkHash: "8".repeat(64) }),
  crossingStore.createPlayer({ networkHash: "0".repeat(64) }),
]);
const crossingProgresses = await Promise.all(crossingPlayers.map((player) => crossingStore.dailySession(
  player.recoveryKey,
  "eleicoes-2026",
  { now: beforeMidnight },
)));
assert.ok(crossingProgresses.every(({ edition }) => edition.date === "2026-09-18"));
for (let playerIndex = 0; playerIndex < crossingPlayers.length; playerIndex += 1) {
  await clearMinuteQuota();
  for (let slot = 1; slot <= 9; slot += 1) {
    const progress = crossingProgresses[playerIndex];
    const response = await crossingStore.dailyVote({
      topicId: "eleicoes-2026",
      editionId: progress.edition.id,
      slot,
      winnerId: progress.round.candidateIds[0],
      answerId: randomUUID(),
      recoveryKey: crossingPlayers[playerIndex].recoveryKey,
      playerVersion: slot - 1,
      now: beforeMidnight,
    });
    crossingProgresses[playerIndex] = response.dailySession;
    await clearMinuteQuota();
  }
}
const finalVotePromises = crossingPlayers.map((player, playerIndex) => {
  const progress = crossingProgresses[playerIndex];
  const answerId = randomUUID();
  barrierAnswerIds.add(answerId);
  return crossingStore.dailyVote({
    topicId: "eleicoes-2026",
    editionId: progress.edition.id,
    slot: 10,
    winnerId: progress.round.candidateIds[0],
    answerId,
    recoveryKey: player.recoveryKey,
    playerVersion: 9,
    now: beforeMidnight,
  });
});
await bothVotesAdmitted;
let cutSettled = false;
const crossingCutPromise = crossingStore.dailyCut("eleicoes-2026", "2026-09-18", { now: afterMidnight })
  .then((value) => {
    cutSettled = true;
    return value;
  }, (error) => {
    cutSettled = true;
    throw error;
  });
await new Promise((resolve) => setTimeout(resolve, 100));
assert.equal(cutSettled, false, "o corte passou à frente de um voto já admitido");
releaseVoteCommit();
const settledBarrier = await Promise.all([...finalVotePromises, crossingCutPromise]);
const crossingFinalVotes = settledBarrier.slice(0, 2);
const crossingCut = settledBarrier[2];
assert.ok(crossingFinalVotes.every(({ dailySession }) => dailySession.status === "completed"));
assert.equal(crossingCut.completedPlayers, 2);
assert.equal(crossingCut.completedAnswers, 20);
const finalWinnerId = crossingProgresses[0].round.candidateIds[0];
assert.equal(
  crossingCut.rounds.find(({ slot }) => slot === 10).choices.find(({ candidateId }) => candidateId === finalWinnerId).count,
  2,
);

// Corrida inversa: o corte obtém o lock exclusivo primeiro. Mesmo que o voto
// carregue um instante de admissão anterior ao closesAt, ao acordar ele encontra
// o snapshot publicado e não pode escrever depois dele.
const cutFirstBefore = new Date("2026-09-20T02:59:59.900Z");
const cutFirstAfter = new Date("2026-09-20T03:00:00.100Z");
const cutFirstPlayer = await crossingStore.createPlayer({ networkHash: "9".repeat(64) });
const cutFirstSession = await crossingStore.dailySession(
  cutFirstPlayer.recoveryKey,
  "eleicoes-2026",
  { now: cutFirstBefore },
);
cutFirstEditionId = cutFirstSession.edition.id;
const cutFirstPromise = crossingStore.dailyCut("eleicoes-2026", "2026-09-19", { now: cutFirstAfter });
await cutFirstReachedCommit;
let cutFirstVoteSettled = false;
const cutFirstVotePromise = crossingStore.dailyVote({
    topicId: "eleicoes-2026",
    editionId: cutFirstSession.edition.id,
    slot: 1,
    winnerId: cutFirstSession.round.candidateIds[0],
    answerId: randomUUID(),
    recoveryKey: cutFirstPlayer.recoveryKey,
    playerVersion: 0,
    now: cutFirstBefore,
  }).then(
    (value) => {
      cutFirstVoteSettled = true;
      return { value };
    },
    (error) => {
      cutFirstVoteSettled = true;
      return { error };
    },
  );
await new Promise((resolve) => setTimeout(resolve, 100));
assert.equal(cutFirstVoteSettled, false, "o voto não esperou o corte que venceu a corrida");
releaseCutFirstCommit();
const [cutFirstCut, cutFirstVote] = await Promise.all([cutFirstPromise, cutFirstVotePromise]);
assert.equal(cutFirstCut.completedPlayers, 0);
assert.equal(cutFirstVote.error?.code, "DAILY_EDITION_CLOSED");

const dailyAudit = await quotaMaintenance.query(`
  SELECT
    (SELECT count(*) FROM choice_rounds WHERE choice_mode = 'daily' AND daily_edition_id = $1) AS daily_rounds,
    (SELECT count(*) FROM choice_rounds WHERE choice_mode = 'free' AND player_id = (
      SELECT id FROM anonymous_players WHERE recovery_hash = $2
    )) AS player_free_rounds,
    (SELECT count(*) FROM daily_completions WHERE edition_id = $1) AS completions,
    (SELECT count(*) FROM daily_publication_cuts WHERE edition_id = $1) AS cuts,
    (SELECT used FROM abuse_quota_counters
      WHERE scope = 'player-daily-editorial-day-v2'
        AND subject_hash = (SELECT id::text FROM anonymous_players WHERE recovery_hash = $2)
        AND window_start = $3::timestamptz) AS daily_quota_used,
    (SELECT window_start FROM abuse_quota_counters
      WHERE scope = 'player-daily-editorial-day-v2'
        AND subject_hash = (SELECT id::text FROM anonymous_players WHERE recovery_hash = $2)
        AND window_start = $3::timestamptz) AS daily_window_start,
    (SELECT used FROM abuse_quota_counters
      WHERE scope = 'player-free-editorial-day-v2'
        AND subject_hash = (SELECT id::text FROM anonymous_players WHERE recovery_hash = $2)
        AND window_start = $3::timestamptz) AS free_quota_used,
    (SELECT window_start FROM abuse_quota_counters
      WHERE scope = 'player-free-editorial-day-v2'
        AND subject_hash = (SELECT id::text FROM anonymous_players WHERE recovery_hash = $2)
        AND window_start = $3::timestamptz) AS free_window_start
`, [firstDailySession.edition.id, recoveryKeyHash(firstDailyPlayer.recoveryKey), firstDailySession.edition.opensAt]);
assert.equal(Number(dailyAudit.rows[0].daily_rounds), 21);
assert.equal(Number(dailyAudit.rows[0].player_free_rounds), 1);
assert.equal(Number(dailyAudit.rows[0].completions), 2);
assert.equal(Number(dailyAudit.rows[0].cuts), 1);
assert.equal(Number(dailyAudit.rows[0].daily_quota_used), 10);
assert.equal(Number(dailyAudit.rows[0].free_quota_used), 1);
assert.equal(new Date(dailyAudit.rows[0].daily_window_start).toISOString(), firstDailySession.edition.opensAt);
assert.equal(new Date(dailyAudit.rows[0].free_window_start).toISOString(), firstDailySession.edition.opensAt);
const persistedDailyRound = await quotaMaintenance.query(
  "SELECT * FROM choice_rounds WHERE choice_mode = 'daily' AND daily_edition_id = $1 ORDER BY daily_slot LIMIT 1",
  [firstDailySession.edition.id],
);
const sourceRound = persistedDailyRound.rows[0];
await quotaMaintenance.query("INSERT INTO ranking_pools (topic_id) VALUES ('forged-topic') ON CONFLICT DO NOTHING");
await assert.rejects(
  quotaMaintenance.query(
    `INSERT INTO choice_rounds (
       round_id, player_id, topic_id, winner_id, candidate_ids, winner_delta,
       choice_mode, daily_edition_id, daily_slot
     ) VALUES ($1, $2, 'forged-topic', $3, $4, $5, 'daily', $6, $7)`,
    [randomUUID(), legacyQuotaPlayerId, sourceRound.winner_id, sourceRound.candidate_ids, sourceRound.winner_delta, sourceRound.daily_edition_id, sourceRound.daily_slot],
  ),
  (error) => error.code === "23503",
);
await assert.rejects(
  quotaMaintenance.query(
    `INSERT INTO choice_rounds (
       round_id, player_id, topic_id, winner_id, candidate_ids, winner_delta,
       choice_mode, daily_edition_id, daily_slot
     ) VALUES ($1, $2, $3, 'winner-outside-table', $4, $5, 'daily', $6, $7)`,
    [randomUUID(), legacyQuotaPlayerId, sourceRound.topic_id, sourceRound.candidate_ids, sourceRound.winner_delta, sourceRound.daily_edition_id, sourceRound.daily_slot],
  ),
  (error) => error.code === "23514" && error.constraint === "choice_rounds_winner_in_candidates_check",
);
const divergentCandidates = [...sourceRound.candidate_ids];
const divergentIndex = divergentCandidates.findIndex((candidateId) => candidateId !== sourceRound.winner_id);
divergentCandidates[divergentIndex] = "forged-candidate";
await assert.rejects(
  quotaMaintenance.query(
    `INSERT INTO choice_rounds (
       round_id, player_id, topic_id, winner_id, candidate_ids, winner_delta,
       choice_mode, daily_edition_id, daily_slot
     ) VALUES ($1, $2, $3, $4, $5, $6, 'daily', $7, $8)`,
    [randomUUID(), legacyQuotaPlayerId, sourceRound.topic_id, sourceRound.winner_id, divergentCandidates, sourceRound.winner_delta, sourceRound.daily_edition_id, sourceRound.daily_slot],
  ),
  (error) => error.code === "23503",
);
await assert.rejects(
  quotaMaintenance.query(
    `INSERT INTO choice_rounds (
       round_id, player_id, topic_id, winner_id, candidate_ids, winner_delta,
       choice_mode, daily_edition_id, daily_slot
     ) VALUES ($1, $2, $3, $4, $5, $6, 'daily', $7, $8)`,
    [randomUUID(), sourceRound.player_id, sourceRound.topic_id, sourceRound.winner_id, sourceRound.candidate_ids, sourceRound.winner_delta, "missing-edition", sourceRound.daily_slot],
  ),
  (error) => error.code === "23503",
);
await assert.rejects(
  quotaMaintenance.query(
    `INSERT INTO choice_rounds (
       round_id, player_id, topic_id, winner_id, candidate_ids, winner_delta,
       choice_mode, daily_edition_id, daily_slot
     ) VALUES ($1, $2, $3, $4, $5, $6, 'daily', $7, $8)`,
    [randomUUID(), sourceRound.player_id, sourceRound.topic_id, sourceRound.winner_id, sourceRound.candidate_ids, sourceRound.winner_delta, sourceRound.daily_edition_id, sourceRound.daily_slot],
  ),
  (error) => error.code === "23505",
);
const secondDailyPlayerId = await playerIdFor(secondDailyPlayer.recoveryKey);
await assert.rejects(
  quotaMaintenance.query(
    `INSERT INTO daily_answers (edition_id, player_id, slot, answer_id, winner_id)
     VALUES ($1, $2, 2, $3, $4)`,
    [firstDailySession.edition.id, secondDailyPlayerId, freeRound.round.id, freeRound.round.winnerId],
  ),
  (error) => error.code === "23503",
);
await crossingStore.close();
await dailyStore.close();
await quotaMaintenance.end();

console.log("Smoke PostgreSQL aprovado: reset e upgrade aditivos, identidade/sessão, Elo idempotente, edição diária comum, 10/10 atômico, reload, concorrência, virada de São Paulo, corte fechado e modo livre separado.");
