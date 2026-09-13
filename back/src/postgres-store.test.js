import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  assertSameVote,
  deriveRankingBaseline,
  normalizeVoteId,
  normalizeRequiredUuid,
  normalizeLegacyPools,
  replayRanking,
  snapshotFromRows,
  validateMode,
  validateVote,
} from "./postgres-store.js";

const storeSource = readFileSync(new URL("./postgres-store.js", import.meta.url), "utf8");

test("vote IDs are normalized and legacy clients receive a generated ID", () => {
  const id = "9EC92A08-C726-4C39-9FFF-1E18048B1DC5";
  assert.equal(normalizeVoteId(id), id.toLowerCase());
  assert.equal(
    normalizeVoteId(undefined, () => "faeb2a0f-f4e8-4272-9808-aa7195eb767d"),
    "faeb2a0f-f4e8-4272-9808-aa7195eb767d",
  );
  assert.throws(() => normalizeVoteId("not-a-uuid"), /voteId inválido/);
});

test("required audit IDs never generate a replacement for a missing original", () => {
  const id = "9EC92A08-C726-4C39-9FFF-1E18048B1DC5";
  assert.equal(normalizeRequiredUuid(id, "voteId"), id.toLowerCase());
  assert.throws(
    () => normalizeRequiredUuid(undefined, "voteId"),
    (error) => error.status === 400 && error.message === "voteId inválido",
  );
});

test("reusing a vote ID with different content is rejected", () => {
  const existing = { mode: "presidentes", winner_id: "lula", loser_id: "zema" };
  assert.doesNotThrow(() => assertSameVote(existing, {
    voteId: "9ec92a08-c726-4c39-9fff-1e18048b1dc5",
    winnerId: "lula",
    loserId: "zema",
    mode: "presidentes",
  }));
  assert.throws(() => assertSameVote(existing, {
    voteId: "9ec92a08-c726-4c39-9fff-1e18048b1dc5",
    winnerId: "zema",
    loserId: "lula",
    mode: "presidentes",
  }), (error) => error.status === 409);
});

test("the transaction serializes a vote ID before checking and updating ranking", () => {
  const lockAt = storeSource.indexOf("pg_advisory_xact_lock");
  const lookupAt = storeSource.indexOf("FROM votes WHERE vote_id = $1");
  const rankingUpdateAt = storeSource.indexOf("SET rating = rating + $3");
  assert.ok(lockAt > 0);
  assert.ok(lookupAt > lockAt);
  assert.ok(rankingUpdateAt > lookupAt);
  assert.match(storeSource, /CREATE UNIQUE INDEX IF NOT EXISTS votes_vote_id_uidx/);
  assert.match(storeSource, /status: "alreadyProcessed"/);
  assert.match(storeSource, /status: "created"/);
});

test("a baseline is derived by unwinding auditable votes in reverse order", () => {
  const baseline = deriveRankingBaseline([
    { candidate_id: "lula", rating: 999, wins: 1, losses: 1, zebras: 0 },
    { candidate_id: "zema", rating: 984, wins: 0, losses: 1, zebras: 0 },
    { candidate_id: "bolsonaro", rating: 1017, wins: 1, losses: 0, zebras: 0 },
  ], 2, [
    {
      id: 2,
      winner_id: "bolsonaro",
      loser_id: "lula",
      winner_rating_before: 1000,
      loser_rating_before: 1016,
      zebra: false,
    },
    {
      id: 1,
      winner_id: "lula",
      loser_id: "zema",
      winner_rating_before: 1000,
      loser_rating_before: 1000,
      zebra: false,
    },
  ]);

  assert.equal(baseline.duels, 0);
  assert.deepEqual(baseline.rows, [
    { candidate_id: "lula", rating: 1000, wins: 0, losses: 0, zebras: 0 },
    { candidate_id: "zema", rating: 1000, wins: 0, losses: 0, zebras: 0 },
    { candidate_id: "bolsonaro", rating: 1000, wins: 0, losses: 0, zebras: 0 },
  ]);
});

test("ranking replay recalculates later Elo after an earlier vote is reversed", () => {
  const rebuilt = replayRanking([
    { candidate_id: "pessoa-133", rating: 1000, wins: 0, losses: 0, zebras: 0 },
    { candidate_id: "zema", rating: 1000, wins: 0, losses: 0, zebras: 0 },
    { candidate_id: "pessoa-180", rating: 1000, wins: 0, losses: 0, zebras: 0 },
  ], 0, [
    { id: 2, winner_id: "pessoa-180", loser_id: "pessoa-133" },
  ]);
  const rows = new Map(rebuilt.rows.map((row) => [row.candidate_id, row]));

  assert.equal(rebuilt.duels, 1);
  assert.equal(rows.get("pessoa-180").rating, 1016);
  assert.equal(rows.get("pessoa-133").rating, 984);
  assert.equal(rows.get("zema").rating, 1000);
});

test("vote reversals are append-only, unique, transactional, and not publicly routed", () => {
  assert.match(storeSource, /CREATE TABLE IF NOT EXISTS vote_reversals/);
  assert.match(storeSource, /reversal_id uuid NOT NULL UNIQUE/);
  assert.match(storeSource, /vote_row_id bigint NOT NULL UNIQUE/);
  assert.match(storeSource, /vote_reversals_are_immutable/);
  assert.match(storeSource, /async reverseVote[\s\S]*BEGIN[\s\S]*INSERT INTO vote_reversals[\s\S]*rebuildRanking[\s\S]*COMMIT/);
  const serverSource = readFileSync(new URL("./server.js", import.meta.url), "utf8");
  assert.doesNotMatch(serverSource, /api\/.*revers/i);
});

test("legacy single-pool state is migrated as presidents without losing stats", () => {
  const pools = normalizeLegacyPools({
    ratings: { lula: 1042 },
    wins: { lula: 3 },
    losses: { zema: 3 },
    duels: 3,
  });

  assert.equal(pools.presidentes.ratings.lula, 1042);
  assert.equal(pools.presidentes.wins.lula, 3);
  assert.equal(pools.presidentes.duels, 3);
  assert.equal(pools.vices.duels, 0);
});

test("president and vice legacy pools remain independent", () => {
  const pools = normalizeLegacyPools({
    pools: {
      presidentes: { ratings: { lula: 1016 }, wins: { lula: 1 }, duels: 1 },
      vices: { ratings: { zema: 1016 }, wins: { zema: 1 }, duels: 1 },
    },
  });

  assert.equal(pools.presidentes.wins.lula, 1);
  assert.equal(pools.presidentes.wins.zema, 0);
  assert.equal(pools.vices.wins.zema, 1);
  assert.equal(pools.vices.wins.lula, 0);
});

test("database rows are converted into the API ranking contract", () => {
  const result = snapshotFromRows("presidentes", "2", [
    { candidate_id: "lula", rating: 1030, wins: "2", losses: "0", zebras: "1" },
    { candidate_id: "zema", rating: 970, wins: "0", losses: "2", zebras: "0" },
  ]);

  assert.equal(result.duels, 2);
  assert.equal(result.ranking[0].id, "lula");
  assert.equal(result.ranking[0].winRate, 100);
  assert.equal(result.ranking[0].zebras, 1);
});

test("invalid modes and votes are rejected", () => {
  assert.throws(() => validateMode("outro"), /modo inválido/);
  assert.throws(() => validateVote("lula", "lula"), /voto inválido/);
  assert.throws(() => validateVote("desconhecido", "zema"), /voto inválido/);
});
