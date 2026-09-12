import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "game.js"), "utf8");

test("duel cards are native buttons so Enter/Space already activate click", () => {
  assert.match(src, /<button type="button" class="poke-card" id="card-a">/);
  assert.match(src, /<button type="button" class="poke-card" id="card-b">/);
});

test("game attaches one document keydown handler for quick controls", () => {
  assert.match(src, /document\.addEventListener\("keydown", handleQuickControlKey\)/);
  assert.doesNotMatch(src, /cardA\.addEventListener\(\s*["']keydown["']/);
  assert.doesNotMatch(src, /cardB\.addEventListener\(\s*["']keydown["']/);
});

test("pick uses applyElo deltas and applyPickFeedback", () => {
  assert.match(src, /const \{ winnerDelta, loserDelta, zebra \} = applyElo\(state, winnerId, loserId\)/);
  assert.match(src, /applyPickFeedback\(winnerEl, loserEl, winnerDelta, loserDelta, \{ zebra \}\)/);
  assert.match(src, /els\.cardA\.addEventListener\("click", \(\) => pick\(els\.cardA\)\)/);
  assert.match(src, /els\.cardB\.addEventListener\("click", \(\) => pick\(els\.cardB\)\)/);
});
