import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./game.js", import.meta.url), "utf8");

test("the required-online fallback is top-level and callable from initialization", () => {
  const fallback = source.indexOf("function renderConnectionRequired(root)");
  const ranking = source.indexOf("function renderRankItems(");
  const init = source.indexOf("export async function initGame(");

  assert.ok(fallback > 0);
  assert.ok(fallback < ranking);
  assert.ok(ranking < init);
  assert.match(source.slice(init), /if \(requireApi\) \{\s*renderConnectionRequired\(root\);\s*return false;/);
});
