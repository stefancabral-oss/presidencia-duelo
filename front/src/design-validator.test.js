import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const cssUrl = new URL("./duel-v2.css", import.meta.url);
const installUrl = new URL("./duel-v2-install.js", import.meta.url);
const markupUrl = new URL("./duel-v2.js", import.meta.url);

async function read(url) { return readFile(url, "utf8"); }

test("new duel is structural and mobile-first", async () => {
  const css = await read(cssUrl);
  const install = await read(installUrl);
  assert.match(css, /aspect-ratio:\s*5\s*\/\s*7/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /@media\(max-width:430px\)/);
  assert.match(install, /pm-duel-v2__arena/);
  assert.match(install, /pm-duel-v2__topline/);
});

test("duel has no separate choose button and keeps VS/skip secondary", async () => {
  const markup = await read(markupUrl);
  const css = await read(cssUrl);
  assert.doesNotMatch(markup, />\s*Escolher\s*</i);
  assert.match(markup, /id="card-a"/);
  assert.match(markup, /id="card-b"/);
  assert.match(css, /pm-duel-v2__vs/);
  assert.match(css, /pm-duel-v2__skip/);
});

test("goal feedback is compact instead of a dominant modal", async () => {
  const css = await read(cssUrl);
  assert.match(css, /pm-duel-v2__achievement-card\{display:flex/);
  assert.doesNotMatch(css, /pm-duel-v2__achievement-card[^}]*min-height:\s*[3-9]\d{2}px/);
  assert.doesNotMatch(css, /pm-duel-v2__achievement-card[^}]*position:\s*fixed/);
});

test("new duel CSS does not use poke-card as its primary architecture selector", async () => {
  const css = await read(cssUrl);
  assert.match(css, /\.pm-duel-card/);
  assert.doesNotMatch(css, /\.poke-card\s*\{/);
});

test("Chroma remains more expressive than regular cards", async () => {
  const css = await read(cssUrl);
  assert.match(css, /data-rarity\^="chroma"/);
  assert.match(css, /chroma-suprema/);
  assert.match(css, /chroma-comemorativa/);
});
