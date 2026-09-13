import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gameSrc = readFileSync(new URL("./game.js", import.meta.url), "utf8");

test("the duel no longer exposes or wires a local-only undo", () => {
  assert.doesNotMatch(gameSrc, /id=["']undo-duel["']/);
  assert.doesNotMatch(gameSrc, />\s*Desfazer\s*</);
  assert.doesNotMatch(gameSrc, /undoLastDuel|syncUndoButton|restoreDuel|snapshotDuel|undoPair/);
});

test("legacy lastDuel data is ignored instead of loaded into current state", () => {
  assert.doesNotMatch(gameSrc, /lastDuel:/);
  assert.doesNotMatch(gameSrc, /parsed\.lastDuel/);
  assert.match(gameSrc, /mergeStats\(defaultState\(candidates\), parsed\)/);
});
