import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const cssUrl = new URL("./ranking-v2.css", import.meta.url);
const installerUrl = new URL("./ranking-v2-install.js", import.meta.url);

test("ranking v2 prioriza lista, filtros e ações sem modal dominante", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /pm-ranking-v2__hero/);
  assert.match(css, /pm-ranking-v2__sort/);
  assert.match(css, /pm-ranking-v2__list/);
  assert.match(css, /rank-item:nth-child\(1\)/);
  assert.match(css, /safe-area-inset-bottom/);
});

test("installer mantém IDs existentes e só adiciona a nova estrutura visual", async () => {
  const source = await readFile(installerUrl, "utf8");
  assert.match(source, /getElementById\("panel-rank"\)/);
  assert.match(source, /getElementById|querySelector/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
});
