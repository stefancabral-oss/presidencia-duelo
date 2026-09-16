import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../public/integridade.html", import.meta.url), "utf8");
const main = await readFile(new URL("./main.js", import.meta.url), "utf8");

test("the public integrity page states enforced limits without claiming electoral research", () => {
  assert.match(html, /Escolhas confirmadas pelo servidor/);
  assert.match(html, /8 rodadas por minuto/);
  assert.match(html, /30 por dia/);
  assert.match(html, /3 novos jogadores anônimos por dia/);
  assert.match(html, /não constitui pesquisa eleitoral/i);
  assert.match(html, /não altera Elo, ranking, preferência nem progresso/i);
  assert.match(html, /não exibimos parcial ao vivo/i);
  assert.match(html, /linha de base de <strong>25%<\/strong>/i);
  assert.match(html, /Empates, edições sem amostra, pulos e slots sem resposta são neutros/i);
  assert.doesNotMatch(html, /cada jogador corresponde a uma pessoa única/i);
});

test("the public ranking links its server-confirmation claim to the integrity page", () => {
  assert.match(main, /Escolhas confirmadas pelo servidor\./);
  assert.match(main, /href="\/integridade\.html">Como o placar é protegido<\/a>/);
});
