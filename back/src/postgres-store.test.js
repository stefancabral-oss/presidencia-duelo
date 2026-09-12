import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeLegacyPools,
  snapshotFromRows,
  validateMode,
  validateVote,
} from "./postgres-store.js";

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
