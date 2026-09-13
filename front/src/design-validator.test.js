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

test("v2 panels only override .panel display while active", async () => {
  const panels = [
    ["home-v2.css", "pm-home-v2"],
    ["ranking-v2.css", "pm-ranking-v2"],
    ["tournament-v2.css", "pm-tournament-v2"],
  ];
  for (const [file, className] of panels) {
    const css = await read(new URL(`./${file}`, import.meta.url));
    assert.doesNotMatch(
      css,
      new RegExp(`\\.${className}\\{[^}]*display:`),
      `${file}: .${className} não pode definir display sem .active (venceria .panel{display:none})`,
    );
    assert.match(css, new RegExp(`\\.${className}\\.active\\{[^}]*display:grid`), `${file}: falta .${className}.active{display:grid}`);
    assert.match(
      css,
      new RegExp(`\\.${className}\\.active\\{[^}]*grid-template-columns:minmax\\(0,1fr\\)`),
      `${file}: a coluna implícita (auto) cresce até o min-content dos filhos; sem minmax(0,1fr) o seletor de assunto estoura a largura`,
    );
  }
  const base = await read(new URL("./styles.css", import.meta.url));
  assert.match(base, /\.panel:not\(\.active\)\s*\{\s*display:\s*none/, "styles.css: falta a guarda .panel:not(.active){display:none}");
});

test("duel topline stretches its children on narrow screens", async () => {
  const css = await read(cssUrl);
  assert.doesNotMatch(css, /\.pm-duel-v2__topline\{[^}]*align-items:flex-start/, "topline com flex-start deixa o seletor de assunto com largura de conteúdo (overflow)");
  assert.match(css, /\.pm-duel-v2__topline\{[^}]*align-items:stretch[^}]*flex-direction:column/);
});

test("main navigation is fixed to the bottom and the app reserves space for it", async () => {
  const css = await read(new URL("./nav-v2.css", import.meta.url));
  assert.match(css, /\.pm-nav-v2\{[^}]*position:fixed/);
  assert.doesNotMatch(css, /\.pm-nav-v2\{[^}]*position:sticky/);
  assert.match(css, /\.app\{[^}]*padding-bottom:calc\([^)]*safe-area-inset-bottom/);
});
