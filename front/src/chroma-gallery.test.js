import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const src = await readFile(new URL("./chroma-gallery.js", import.meta.url), "utf8");
const css = await readFile(new URL("./chroma-gallery.css", import.meta.url), "utf8");
const collectionCss = await readFile(new URL("./collection.css", import.meta.url), "utf8");

test("coleção usa ranking agregado real para definir cartas e raridade", () => {
  assert.match(src, /fetchServerRanking\("presidentes"\)/);
  assert.match(src, /rarityForElo/);
  assert.doesNotMatch(src, /rarity\.family !== "Chroma"/);
});

test("ficha historica usa fontes cadastradas e fallback sem inventar conteudo", () => {
  assert.match(src, /PERSON_PROFILES/);
  assert.match(src, /profile\?\.sources/);
  assert.match(src, /editorialSummary/);
  assert.match(src, /Conteúdo em atualização/);
});

test("coleção possui famílias, busca, ordenação, tiers e navegação", () => {
  for (const family of ['data-filter="all"', 'data-filter="chroma"', 'data-filter="regular"']) {
    assert.match(src, new RegExp(family));
  }
  for (const tier of ["chroma-ilustrada", "chroma-especial", "chroma-suprema", "chroma-comemorativa"]) {
    assert.match(src, new RegExp(tier));
  }
  assert.match(src, /id="chroma-search"/);
  assert.match(src, /id="chroma-sort"/);
  assert.match(src, /data-history-prev/);
  assert.match(src, /data-history-next/);
});

test("layout mobile preserva duas colunas e ficha em tela cheia", () => {
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /height:100dvh/);
  assert.match(collectionCss, /data-family="regular"/);
  assert.match(collectionCss, /prefers-reduced-motion/);
});
