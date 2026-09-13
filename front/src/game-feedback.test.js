import assert from "node:assert/strict";
import { test } from "node:test";
import { rankingFeedbackKind } from "./game-feedback.js";

test("ranking feedback prioritizes meaningful movement without ideological input", () => {
  assert.equal(rankingFeedbackKind({ before: 1, after: 1, total: 20 }), "leader-defense");
  assert.equal(rankingFeedbackKind({ before: 4, after: 1, total: 20 }), "leader");
  assert.equal(rankingFeedbackKind({ before: 8, after: 3, total: 20 }), "top-3");
  assert.equal(rankingFeedbackKind({ before: 11, after: 9, total: 20 }), "top-10");
  assert.equal(rankingFeedbackKind({ before: 20, after: 18, total: 20 }), "comeback");
  assert.equal(rankingFeedbackKind({ before: 8, after: 7, total: 20 }), "overtake");
  assert.equal(rankingFeedbackKind({ before: 8, after: 8, total: 20, zebra: true }), "zebra");
  assert.equal(rankingFeedbackKind({ before: 8, after: 8, total: 20, combo: 3 }), "combo");
});
