import assert from "node:assert/strict";
import { test } from "node:test";
import { hpFillWidth } from "./hp-bar.js";

test("unplayed candidate uses the neutral 55% bar", () => {
  assert.equal(hpFillWidth(0, 0, 0), 55);
});

test("played candidate with 0% wins uses the 18% floor, not 55", () => {
  assert.equal(hpFillWidth(0, 4, 0), 18);
});

test("played candidate follows win rate between the floor and 100", () => {
  assert.equal(hpFillWidth(1, 1, 50), 50);
  assert.equal(hpFillWidth(3, 1, 75), 75);
  assert.equal(hpFillWidth(5, 0, 100), 100);
});
