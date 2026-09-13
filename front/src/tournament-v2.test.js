import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const cssUrl = new URL("./tournament-v2.css", import.meta.url);
const installerUrl = new URL("./tournament-v2-install.js", import.meta.url);

test("torneio v2 usa cards verticais e centro secundario", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /aspect-ratio:5\/7/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) 34px minmax\(0,1fr\)/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /pm-tournament-v2__winner/);
});

test("installer preserva DOM existente e adiciona apenas classes", async () => {
  const source = await readFile(installerUrl, "utf8");
  assert.match(source, /getElementById\("panel-tournament"\)/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
});
