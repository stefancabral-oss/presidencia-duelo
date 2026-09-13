import assert from "node:assert/strict";
import { test } from "node:test";
import { findLeaderId, rarityFor, rarityForElo } from "./rarity.js";

function state(ratings, wins = {}, losses = {}) {
  return { ratings, wins, losses };
}

test("rarity follows Malaquita Elo thresholds", () => {
  const samples = [
    [1000, "basica"],
    [1015, "incomum"],
    [1040, "rara"],
    [1070, "rara-dupla"],
    [1100, "ultra"],
    [1120, "chroma-ilustrada"],
    [1150, "chroma-especial"],
    [1180, "chroma-suprema"],
    [1220, "chroma-comemorativa"],
  ];
  for (const [elo, expected] of samples) {
    assert.equal(rarityForElo(elo).id, expected);
    assert.equal(rarityFor(state({ a: elo }), "a").id, expected);
  }
});

test("families remain simple for public reading", () => {
  assert.equal(rarityForElo(1000).family, "Comum");
  assert.equal(rarityForElo(1070).family, "Rara");
  assert.equal(rarityForElo(1180).family, "Chroma");
});

test("experienced Chroma leader receives commemorative treatment", () => {
  assert.equal(findLeaderId(["a", "b"], state({ a: 1119, b: 1090 }, { a: 6 })), "a");
  assert.equal(rarityFor(state({ a: 1119 }), "a", "a").id, "ultra");
  assert.equal(findLeaderId(["a", "b"], state({ a: 1120, b: 1090 }, { a: 6 })), "a");
  assert.equal(rarityFor(state({ a: 1120 }), "a", "a").id, "chroma-comemorativa");
});
