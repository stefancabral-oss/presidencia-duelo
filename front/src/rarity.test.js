import assert from "node:assert/strict";
import { test } from "node:test";
import { findLeaderId, rarityFor } from "./rarity.js";

function state(ratings, wins = {}, losses = {}) {
  return { ratings, wins, losses };
}

test("rarity follows Elo thresholds", () => {
  assert.equal(rarityFor(state({ a: 1000 }), "a").id, "comum");
  assert.equal(rarityFor(state({ a: 1040 }), "a").id, "raro");
  assert.equal(rarityFor(state({ a: 1100 }), "a").id, "epico");
  assert.equal(rarityFor(state({ a: 1180 }), "a").id, "lendario");
});

test("only an isolated, experienced leader receives the legendary crown", () => {
  assert.equal(findLeaderId(["a", "b"], state({ a: 1100, b: 1090 }, { a: 5 })), null);
  assert.equal(findLeaderId(["a", "b"], state({ a: 1100, b: 1100 }, { a: 6 })), null);
  assert.equal(findLeaderId(["a", "b"], state({ a: 1100, b: 1090 }, { a: 6 })), "a");
  assert.equal(rarityFor(state({ a: 1100 }), "a", "a").id, "lendario");
});
