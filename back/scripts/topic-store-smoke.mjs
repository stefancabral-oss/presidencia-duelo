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
assert.equal(initial.ranking.length, 100);

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

const restartedStore = createTopicStore(connectionString);
const secondMigration = await restartedStore.init();
assert.equal(secondMigration.resetApplied, false);
const afterRestart = await restartedStore.ranking("eleicoes-2026");
assert.equal(afterRestart.duels, 1);
await restartedStore.close();

console.log("Smoke PostgreSQL aprovado: reset único, jogador, voto idempotente e rankings persistentes.");
