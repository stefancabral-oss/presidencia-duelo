import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createTopicStore } from "../src/topic-store.js";

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

const { recoveryKey } = await firstStore.createPlayer();
const personalBefore = await firstStore.playerRanking(recoveryKey, "eleicoes-2026");
assert.equal(personalBefore.version, 0);
assert.equal(personalBefore.duels, 0);

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
assert.equal(round.round.comparisons, 3);
assert.equal(round.duels, 3);
assert.equal(round.player.version, 3);
assert.equal(round.player.duels, 3);
assert.equal(round.ranking.find(({ id }) => id === "anitta").wins, 4);
assert.equal(round.round.feedback.outcomes.length, 4);
assert.equal(round.round.feedback.outcomes.filter(({ result }) => result === "winner").length, 1);
assert.equal(round.round.feedback.outcomes.filter(({ result }) => result === "loser").length, 3);
assert.ok(round.round.feedback.outcomes.every(({ delta, tier }) => Number.isInteger(delta) && tier?.id));

const repeatedRound = await restartedStore.roundVote({
  topicId: "eleicoes-2026",
  winnerId: "anitta",
  candidateIds: ["neymar-jr", "anitta", "jair-bolsonaro", "lula"],
  roundId,
  recoveryKey,
  playerVersion: 2,
});
assert.equal(repeatedRound.round.status, "alreadyProcessed");
assert.equal(repeatedRound.duels, 3);
assert.deepEqual(repeatedRound.round.feedback, round.round.feedback);

const firstGoogleSession = await restartedStore.signInWithGoogle({
  identity: { subject: "google-sub-integration", displayName: "Bia", avatarUrl: "https://example.com/bia.jpg" },
  currentToken: recoveryKey,
  topicId: "eleicoes-2026",
});
assert.match(firstGoogleSession.sessionToken, /^pms_/);
assert.equal(firstGoogleSession.player.duels, 3);
assert.deepEqual(firstGoogleSession.account, { displayName: "Bia", avatarUrl: "https://example.com/bia.jpg" });
assert.equal(Object.hasOwn(firstGoogleSession.account, "email"), false);
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
    (SELECT count(*) FROM player_identities WHERE provider = 'google') AS google_identities,
    (SELECT count(*) FROM player_sessions) AS active_sessions`,
  [roundId],
);
assert.equal(Number(audit.rows[0].comparisons), 5);
assert.equal(Number(audit.rows[0].rounds), 1);
assert.equal(Number(audit.rows[0].linked_comparisons), 3);
assert.equal(Number(audit.rows[0].winner_snapshots), 1);
assert.equal(Number(audit.rows[0].feedback_outcomes), 4);
assert.equal(Number(audit.rows[0].google_identities), 1);
assert.equal(Number(audit.rows[0].active_sessions), 1);
await auditPool.end();
await restartedStore.close();

const precedingRelease = new pg.Pool({ connectionString });
await precedingRelease.query("ALTER TABLE votes DROP COLUMN round_id");
await precedingRelease.query("DELETE FROM schema_migrations WHERE id = '2026-09-15-link-four-card-comparisons'");
await precedingRelease.end();

const upgradedStore = createTopicStore(connectionString);
await upgradedStore.init();
const upgradedAuditPool = new pg.Pool({ connectionString });
const upgradedAudit = await upgradedAuditPool.query("SELECT count(*) AS linked_comparisons FROM votes WHERE round_id = $1", [roundId]);
assert.equal(Number(upgradedAudit.rows[0].linked_comparisons), 3);
const migrationAudit = await upgradedAuditPool.query("SELECT count(*) AS applied FROM schema_migrations WHERE id = '2026-09-15-link-four-card-comparisons'");
assert.equal(Number(migrationAudit.rows[0].applied), 1);
await upgradedAuditPool.end();
await upgradedStore.close();

console.log("Smoke PostgreSQL aprovado: reset único, jogador antigo, login Google preservando progresso, sessão revogável, rodada idempotente e rankings persistentes.");
