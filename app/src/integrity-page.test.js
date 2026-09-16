import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AGGREGATE_PUBLIC_COPY_POLICY } from "../../shared/aggregate-publication-copy.js";

const html = await readFile(new URL("../public/integridade.html", import.meta.url), "utf8");
const main = await readFile(new URL("./main.js", import.meta.url), "utf8");

test("the public integrity page describes personal enforcement and neutral aggregate withholding", () => {
  assert.match(html, /Seu jogo é confirmado pelo servidor/);
  assert.match(html, /8 rodadas por minuto/);
  assert.match(html, /30 por dia/);
  assert.match(html, /3 novos jogadores anônimos por dia/);
  assert.match(html, new RegExp(AGGREGATE_PUBLIC_COPY_POLICY.withheld.copy.comparisonUnavailable));
  assert.match(html, /Ranking público, distribuição diária, apostas e revelações não aparecem no modo pessoal/i);
  assert.doesNotMatch(html, /Como funcionam as apostas diárias/i);
  assert.doesNotMatch(html, /cada jogador corresponde a uma pessoa única/i);
});

test("authorized public copy comes from the fingerprinted shared artifact", () => {
  assert.match(main, /from "\.\/aggregate-copy\.js"/);
  assert.match(main, /PUBLIC_RANKING_COPY\.trust/);
  assert.match(main, /href="\/integridade\.html">\$\{PUBLIC_RANKING_COPY\.integrityLink\}<\/a>/);
});
