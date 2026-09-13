import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  assertSameVote,
  normalizeVoteId,
  normalizeLegacyPools,
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
