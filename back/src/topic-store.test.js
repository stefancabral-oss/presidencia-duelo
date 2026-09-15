import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CLEAN_START_MIGRATION,
  createRecoveryKey,
  normalizeVoteId,
  rankingFromRows,
  recoveryKeyHash,
  validateTopic,
  validateRoundVote,
  validateVote,
} from "./topic-store.js";

test("only active curated topics accept votes", () => {
  assert.equal(validateTopic("eleicoes-2026"), "eleicoes-2026");
  assert.throws(() => validateTopic("influenciadores"), /indisponível/);
  assert.throws(() => validateVote("eleicoes-2026", "lula", "lula"), /voto inválido/);
  assert.throws(() => validateVote("eleicoes-2026", "lula", "acm-neto"), /voto inválido/);
  assert.doesNotThrow(() => validateVote("eleicoes-2026", "lula", "jair-bolsonaro"));
});

test("four-card rounds require four unique playable candidates and the winner", () => {
  assert.deepEqual(
    validateRoundVote("eleicoes-2026", "lula", ["lula", "jair-bolsonaro", "anitta", "neymar-jr"]),
    { topic: "eleicoes-2026", candidateIds: ["lula", "jair-bolsonaro", "anitta", "neymar-jr"] },
  );
  assert.throws(() => validateRoundVote("eleicoes-2026", "lula", ["lula", "lula", "anitta", "neymar-jr"]), /rodada inválida/);
  assert.throws(() => validateRoundVote("eleicoes-2026", "lula", ["jair-bolsonaro", "anitta", "neymar-jr", "ludmilla"]), /rodada inválida/);
  assert.throws(() => validateRoundVote("eleicoes-2026", "lula", ["lula", "jair-bolsonaro", "anitta", "acm-neto"]), /rodada inválida/);
});

test("vote ids remain idempotent UUIDs", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";
  assert.equal(normalizeVoteId(id.toUpperCase()), id);
  assert.throws(() => normalizeVoteId("vote-1"), /voteId inválido/);
});

test("player recovery credentials are random and stored as hashes", () => {
  const key = createRecoveryKey(() => Buffer.alloc(32, 7));
  assert.match(key, /^pm2_/);
  assert.equal(recoveryKeyHash(key).length, 64);
  assert.equal(recoveryKeyHash(key).includes(key), false);
});

test("topic ranking exposes only candidates from that curation", () => {
  const result = rankingFromRows("eleicoes-2026", 2, [
    { candidate_id: "lula", rating: 1016, wins: 1, losses: 0, zebras: 0 },
    { candidate_id: "jair-bolsonaro", rating: 984, wins: 0, losses: 1, zebras: 0 },
    { candidate_id: "not-in-topic", rating: 4000, wins: 999, losses: 0, zebras: 0 },
  ]);
  assert.equal(result.topicId, "eleicoes-2026");
  assert.equal(result.ranking.length, 54);
  assert.equal(result.ranking[0].id, "lula");
  assert.equal(result.ranking[0].decisions, 1);
  assert.equal(result.ranking.find(({ id }) => id === "tarcisio-de-freitas").decisions, 0);
});

test("clean-start migration is one-time and explicitly removes legacy gameplay tables", async () => {
  const source = await readFile(new URL("./topic-store.js", import.meta.url), "utf8");
  assert.equal(CLEAN_START_MIGRATION, "20260913_eleicoes_2026_clean_start");
  assert.match(source, /SELECT 1 FROM schema_migrations WHERE id = \$1/);
  assert.match(source, /DROP TABLE IF EXISTS votes CASCADE/);
  assert.match(source, /DROP TABLE IF EXISTS choice_rounds CASCADE/);
  assert.match(source, /DROP TABLE IF EXISTS player_states CASCADE/);
  assert.match(source, /INSERT INTO schema_migrations \(id\)/);
  assert.match(source, /INSERT INTO player_stats[\s\S]*unnest\(\$2::text\[\]\)[\s\S]*ON CONFLICT DO NOTHING/);
});

test("four-card choices keep one immutable round and three auditable comparisons", async () => {
  const source = await readFile(new URL("./topic-store.js", import.meta.url), "utf8");
  assert.match(source, /CREATE TABLE IF NOT EXISTS choice_rounds/);
  assert.match(source, /CHECK \(array_length\(candidate_ids, 1\) = 4\)/);
  assert.match(source, /ADD COLUMN IF NOT EXISTS round_id uuid REFERENCES choice_rounds\(round_id\)/);
  assert.match(source, /INSERT INTO schema_migrations \(id\)[\s\S]*ON CONFLICT DO NOTHING[\s\S]*UPDATE votes AS comparison[\s\S]*comparison\.created_at = round\.created_at/);
  assert.match(source, /comparisons: 3/);
  assert.match(source, /INSERT INTO choice_rounds[\s\S]*INSERT INTO votes/);
  assert.match(source, /const winnerRatingBeforeRound = globalRatings\.get\(winnerId\)/);
});

test("the public API retires binary votes after the four-card launch", async () => {
  const source = await readFile(new URL("./server.js", import.meta.url), "utf8");
  assert.match(source, /app\.post\("\/api\/vote"[\s\S]*status\(410\)/);
  assert.match(source, /ROUND_V4_REQUIRED/);
});

test("Chromas are personal inventory and equipment, separate from ranking", async () => {
  const source = await readFile(new URL("./topic-store.js", import.meta.url), "utf8");
  assert.match(source, /CREATE TABLE IF NOT EXISTS chroma_catalog/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS player_chromas/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS equipped_chromas/);
  assert.match(source, /PRIMARY KEY \(player_id, topic_id, candidate_id\)/);
  assert.doesNotMatch(source, /UPDATE ranking_stats[^;]*chroma/is);
});
