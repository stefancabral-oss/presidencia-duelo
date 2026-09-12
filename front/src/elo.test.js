import assert from "node:assert/strict";
import { test } from "node:test";
import { applyElo, emptyStats, expectedScore } from "../../shared/elo.js";

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
