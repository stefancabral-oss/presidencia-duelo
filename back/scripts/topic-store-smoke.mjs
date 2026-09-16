import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createTopicStore, recoveryKeyHash } from "../src/topic-store.js";

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
const dailyStore = createTopicStore(connectionString, { clock: () => dailyNow });
await dailyStore.init();
const firstDailyPlayer = await dailyStore.createPlayer({ networkHash: "b".repeat(64) });
const secondDailyPlayer = await dailyStore.createPlayer({ networkHash: "c".repeat(64) });
const firstDailySession = await dailyStore.dailySession(firstDailyPlayer.recoveryKey, "eleicoes-2026");
const secondDailySession = await dailyStore.dailySession(secondDailyPlayer.recoveryKey, "eleicoes-2026");
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

dailyNow = new Date("2026-09-17T12:00:00.000Z");
const nextDay = await dailyStore.dailySession(firstDailyPlayer.recoveryKey, "eleicoes-2026");
assert.notEqual(nextDay.edition.id, firstDailySession.edition.id);
assert.notDeepEqual(nextDay.round.candidateIds, firstDailySession.round.candidateIds);
assert.deepEqual(nextDay.progress, { answered: 0, total: 10 });
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
assert.equal(publishedCut.completedPlayers, 1);
assert.equal(publishedCut.completedAnswers, 10);
assert.match(publishedCut.methodology, /entre quem concluiu a rodada de 16\/09/);
assert.match(publishedCut.sampleNotice, /baixa participação/);
const repeatedCut = await dailyStore.dailyCut("eleicoes-2026", "2026-09-16");
assert.deepEqual(repeatedCut, publishedCut);

const crossingPlayer = await dailyStore.createPlayer({ networkHash: "d".repeat(64) });
const beforeMidnight = new Date("2026-09-18T02:59:59.900Z");
const afterMidnight = new Date("2026-09-18T03:00:00.100Z");
const crossingStore = createTopicStore(connectionString, { clock: () => afterMidnight });
await crossingStore.init();
const crossingSession = await crossingStore.dailySession(crossingPlayer.recoveryKey, "eleicoes-2026", { now: beforeMidnight });
await assert.rejects(
  crossingStore.dailyVote({
    topicId: "eleicoes-2026",
    editionId: crossingSession.edition.id,
    slot: 1,
    winnerId: crossingSession.round.candidateIds[0],
    answerId: randomUUID(),
    recoveryKey: crossingPlayer.recoveryKey,
    playerVersion: 0,
    now: beforeMidnight,
  }),
  (error) => error.code === "DAILY_EDITION_CLOSED",
);
const crossingReload = await crossingStore.dailySession(crossingPlayer.recoveryKey, "eleicoes-2026", { now: beforeMidnight });
assert.equal(crossingReload.progress.answered, 0);

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
      ORDER BY used DESC LIMIT 1) AS daily_quota_used,
    (SELECT used FROM abuse_quota_counters
      WHERE scope = 'player-free-editorial-day-v2'
      ORDER BY used DESC LIMIT 1) AS free_quota_used
`, [firstDailySession.edition.id, recoveryKeyHash(firstDailyPlayer.recoveryKey)]);
assert.equal(Number(dailyAudit.rows[0].daily_rounds), 11);
assert.equal(Number(dailyAudit.rows[0].player_free_rounds), 1);
assert.equal(Number(dailyAudit.rows[0].completions), 1);
assert.equal(Number(dailyAudit.rows[0].cuts), 1);
assert.equal(Number(dailyAudit.rows[0].daily_quota_used), 10);
assert.equal(Number(dailyAudit.rows[0].free_quota_used), 1);
await crossingStore.close();
await dailyStore.close();
await quotaMaintenance.end();

console.log("Smoke PostgreSQL aprovado: reset e upgrade aditivos, identidade/sessão, Elo idempotente, edição diária comum, 10/10 atômico, reload, concorrência, virada de São Paulo, corte fechado e modo livre separado.");
