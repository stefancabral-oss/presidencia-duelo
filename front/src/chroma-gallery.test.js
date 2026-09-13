import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const src = await readFile(new URL("./chroma-gallery.js", import.meta.url), "utf8");
const css = await readFile(new URL("./chroma-gallery.css", import.meta.url), "utf8");

test("Galeria Chroma usa ranking agregado real para definir disponibilidade", () => {
  assert.match(src, /fetchServerRanking\("presidentes"\)/);
  assert.match(src, /rarityForElo/);
  assert.match(src, /rarity\.family !== "Chroma"/);
});

test("ficha historica usa fontes cadastradas e fallback sem inventar conteudo", () => {
  assert.match(src, /PERSON_PROFILES/);
  assert.match(src, /profile\?\.sources/);
  assert.match(src, /Histórico em atualização/);
  assert.match(src, /Conteúdo em atualização/);
});

test("galeria possui filtros de tiers e navegacao anterior proxima", () => {
  for (const tier of ["chroma-ilustrada", "chroma-especial", "chroma-suprema", "chroma-comemorativa"]) {
    assert.match(src, new RegExp(tier));
  }
  assert.match(src, /data-history-prev/);
  assert.match(src, /data-history-next/);
});

test("layout mobile preserva duas colunas e ficha em tela cheia", () => {
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /height:100dvh/);
});
