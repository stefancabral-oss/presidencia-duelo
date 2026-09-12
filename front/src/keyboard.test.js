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

test("game does not attach redundant keydown handlers on the cards", () => {
  assert.doesNotMatch(src, /addEventListener\(\s*["']keydown["']/);
});
