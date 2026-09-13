import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { skipUnknownDuel } from "./skip-duel.js";

const gameSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "game.js"), "utf8");

test("skip advances exactly once without a vote callback", () => {
  let advances = 0;
  let announced;
  const result = skipUnknownDuel({
    locked: false,
    pair: ["a", "b"],
    nextPair: () => { advances += 1; },
    announce: (pair) => { announced = pair; },
  });
  assert.equal(result, true);
  assert.equal(advances, 1);
  assert.deepEqual(announced, ["a", "b"]);
});

test("game skip flow is a native accessible button and never posts a vote", () => {
  assert.match(gameSource, /id="skip-duel"[\s\S]*aria-label="Não conheço estas pessoas; pular este duelo"/);
  const start = gameSource.indexOf("function skipCurrentDuel()");
  const end = gameSource.indexOf("function commitLocalPick", start);
  const flow = gameSource.slice(start, end);
  assert.match(flow, /skipUnknownDuel/);
  assert.doesNotMatch(flow, /postVote|applyElo|wins|losses|zebras/);
});

test("skip is inert while locked or without a valid pair", () => {
  let advances = 0;
  const nextPair = () => { advances += 1; };
  assert.equal(skipUnknownDuel({ locked: true, pair: ["a", "b"], nextPair }), false);
  assert.equal(skipUnknownDuel({ locked: false, pair: null, nextPair }), false);
  assert.equal(advances, 0);
});
