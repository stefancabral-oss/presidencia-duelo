import assert from "node:assert/strict";
import test from "node:test";
import {
  applyElo,
  eloTier,
  emptyStats,
  expectedScore,
  isZebra,
  ratingDeltas,
} from "./elo.js";

test("expected score and rounded deltas follow the Elo formula", () => {
  assert.equal(expectedScore(1000, 1000), 0.5);
  assert.ok(Math.abs(expectedScore(1400, 1000) - (10 / 11)) < 1e-12);
  assert.deepEqual(ratingDeltas(1000, 1000), { winnerDelta: 16, loserDelta: -16 });

  const upset = ratingDeltas(900, 1100);
  assert.equal(upset.winnerDelta, 24);
  assert.equal(upset.loserDelta, -24);
});

test("applying Elo mutates ratings and counters as one observable result", () => {
  const state = emptyStats(["underdog", "favorite"]);
  state.ratings.underdog = 900;
  state.ratings.favorite = 1000;

  const result = applyElo(state, "underdog", "favorite");

  assert.deepEqual(result, { winnerDelta: 20, loserDelta: -20, zebra: true });
  assert.deepEqual(state, {
    ratings: { underdog: 920, favorite: 980 },
    wins: { underdog: 1, favorite: 0 },
    losses: { underdog: 0, favorite: 1 },
    zebras: { underdog: 1, favorite: 0 },
    duels: 1,
  });
});

test("zebra classification observes its boundary and rejects invalid ratings", () => {
  assert.equal(isZebra(950, 999), false);
  assert.equal(isZebra(950, 1000), true);
  assert.equal(isZebra(950, 999, 49), true);
  assert.equal(isZebra(undefined, 1000), false);
  assert.equal(isZebra(950, Number.NaN), false);
});

test("Elo tier boundaries are stable", () => {
  assert.equal(eloTier(899).id, "recovery");
  assert.equal(eloTier(900).id, "pressure");
  assert.equal(eloTier(979).id, "pressure");
  assert.equal(eloTier(980).id, "contender");
  assert.equal(eloTier(1049).id, "contender");
  assert.equal(eloTier(1050).id, "rising");
  assert.equal(eloTier(1125).id, "seeded");
  assert.equal(eloTier(1225).id, "elite");
});
