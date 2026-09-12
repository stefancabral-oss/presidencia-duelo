import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyElo,
  emptyStats,
  expectedScore,
  incrementZebraCount,
  isZebra,
  mergeStats,
  ratingDeltas,
  ZEBRA_THRESHOLD,
} from "../../shared/elo.js";

test("expected scores for a pair always sum to 1", () => {
  const pairs = [
    [1000, 1000],
    [1200, 1000],
    [800, 1400],
    [1016, 984],
  ];
  for (const [ra, rb] of pairs) {
    assert.ok(Math.abs(expectedScore(ra, rb) + expectedScore(rb, ra) - 1) < 1e-12);
  }
});

test("applyElo updates ratings with eb = 1 - ea", () => {
  const state = emptyStats(["a", "b"]);
  applyElo(state, "a", "b");
  assert.equal(state.ratings.a, 1016);
  assert.equal(state.ratings.b, 984);
  assert.equal(state.wins.a, 1);
  assert.equal(state.losses.b, 1);
  assert.equal(state.duels, 1);
});

test("applyElo matches the two-call expectedScore formula", () => {
  const state = emptyStats(["winner", "loser"]);
  state.ratings.winner = 1200;
  state.ratings.loser = 1000;
  const ea = expectedScore(1200, 1000);
  const eb = 1 - ea;
  applyElo(state, "winner", "loser");
  assert.equal(state.ratings.winner, Math.round(1200 + 32 * (1 - ea)));
  assert.equal(state.ratings.loser, Math.round(1000 + 32 * (0 - eb)));
  assert.equal(state.ratings.loser, Math.round(1000 + 32 * (0 - expectedScore(1000, 1200))));
});

test("ratingDeltas match the rating change applyElo writes", () => {
  const pairs = [
    [1000, 1000],
    [1200, 1000],
    [800, 1400],
    [1016, 984],
  ];
  for (const [ra, rb] of pairs) {
    const state = emptyStats(["winner", "loser"]);
    state.ratings.winner = ra;
    state.ratings.loser = rb;
    const expected = ratingDeltas(ra, rb);
    const returned = applyElo(state, "winner", "loser");
    assert.deepEqual(returned, { ...expected, zebra: isZebra(ra, rb) });
    assert.equal(state.ratings.winner, ra + expected.winnerDelta);
    assert.equal(state.ratings.loser, rb + expected.loserDelta);
  }
});

test("equal ratings yield the classic +16 / -16 first-hit deltas", () => {
  assert.deepEqual(ratingDeltas(1000, 1000), { winnerDelta: 16, loserDelta: -16 });
});

test("isZebra is true at the default 50-point gap and false just below", () => {
  assert.equal(ZEBRA_THRESHOLD, 50);
  assert.equal(isZebra(1000, 1050), true);
  assert.equal(isZebra(1000, 1049), false);
  assert.equal(isZebra(1000, 1000), false);
  assert.equal(isZebra(1100, 1000), false);
  assert.equal(isZebra(950, 1100), true);
});

test("isZebra honors a custom threshold and rejects non-finite ratings", () => {
  assert.equal(isZebra(1000, 1020, 20), true);
  assert.equal(isZebra(1000, 1019, 20), false);
  assert.equal(isZebra(undefined, 1100), false);
  assert.equal(isZebra(1000, Number.NaN), false);
});

test("incrementZebraCount starts at 1 and accumulates on the winner", () => {
  const first = incrementZebraCount({}, "underdog");
  assert.equal(first.underdog, 1);
  const second = incrementZebraCount(first, "underdog");
  assert.equal(second.underdog, 2);
  const fromMissing = incrementZebraCount(undefined, "a");
  assert.equal(fromMissing.a, 1);
});

test("applyElo counts a zebra only when the underdog wins before ratings move", () => {
  const upset = emptyStats(["underdog", "favorite"]);
  upset.ratings.underdog = 1000;
  upset.ratings.favorite = 1050;
  const zebraHit = applyElo(upset, "underdog", "favorite");
  assert.equal(zebraHit.zebra, true);
  assert.equal(upset.zebras.underdog, 1);
  assert.equal(upset.zebras.favorite, 0);

  const favoriteWin = emptyStats(["underdog", "favorite"]);
  favoriteWin.ratings.underdog = 1000;
  favoriteWin.ratings.favorite = 1050;
  const noZebra = applyElo(favoriteWin, "favorite", "underdog");
  assert.equal(noZebra.zebra, false);
  assert.equal(favoriteWin.zebras.favorite, 0);
  assert.equal(favoriteWin.zebras.underdog, 0);
});

test("applyElo still counts zebras when the persisted field is missing", () => {
  const state = emptyStats(["a", "b"]);
  delete state.zebras;
  state.ratings.a = 980;
  state.ratings.b = 1040;
  const result = applyElo(state, "a", "b");
  assert.equal(result.zebra, true);
  assert.equal(state.zebras.a, 1);
});

test("mergeStats fills missing zebras with 0 and keeps stored counts", () => {
  const base = emptyStats(["a", "b"]);
  const legacy = mergeStats(base, {
    ratings: { a: 1100 },
    wins: { a: 4 },
    losses: { b: 4 },
    duels: 4,
  });
  assert.equal(legacy.zebras.a, 0);
  assert.equal(legacy.zebras.b, 0);
  assert.equal(legacy.ratings.a, 1100);
  assert.equal(legacy.duels, 4);

  const withZebras = mergeStats(base, { zebras: { a: 3 }, duels: 1 });
  assert.equal(withZebras.zebras.a, 3);
  assert.equal(withZebras.zebras.b, 0);
});
