import assert from "node:assert/strict";
import test from "node:test";
import { buildContentCatalog, displayName, normalizePersonName } from "./content-import.js";

const profile = (name) => ({
  nome_exibicao: name,
  ocupacao_atual: "Cargo atual",
  partido_ou_area: "Área",
  frase_card: "Frase curta",
  resumo_30s: "Resumo",
  relevancia_2026: "Relevância",
  tres_fatos: ["Um", "Dois", "Três"],
  realizacao_ou_destaque: "Destaque",
  controversia: "Controvérsia",
  fontes: ["https://example.com/fonte", "https://example.com/fonte"],
  data_revisao: "2026-09-13",
});

const chromas = (name) => Array.from({ length: 12 }, (_, index) => ({
  pessoa: name,
  numero: index + 1,
  titulo_divertido: `Chroma ${index + 1}`,
  ano_ou_periodo: "2026",
  contexto: "Contexto",
  descricao_visual: "Descrição",
  objeto_gesto_cenario: "Objeto",
  frase_carta: "Frase",
  efeito_jogo: "Efeito",
  raridade: "Comum",
  fonte: index ? "Perfil oficial" : "https://example.com/chroma",
  riscos_contexto: "Risco",
}));

test("normalizes names across accents and parenthetical aliases", () => {
  assert.equal(normalizePersonName("Popó (Acelino Freitas)"), "popo");
  assert.equal(displayName("Luiz Inácio Lula da Silva (Lula)"), "Lula");
  assert.equal(displayName("Monark (Bruno Aiub)"), "Monark");
});

test("builds separate candidate and draft Chroma catalogs", () => {
  const name = "Luiz Inácio Lula da Silva (Lula)";
  const result = buildContentCatalog([{ nome: name, grupo: "politica" }], [profile(name)], chromas(name));
  assert.equal(result.candidates[0].id, "lula");
  assert.equal(result.candidates[0].sources.length, 1);
  assert.equal(result.chromas.length, 12);
  assert.equal(result.chromas[0].sourceReviewStatus, "url-provided");
  assert.equal(result.chromas[1].sourceReviewStatus, "source-required");
  assert.equal(result.chromas.every(({ status, artworkUrl }) => status === "draft" && artworkUrl === ""), true);
});

test("refuses an incomplete Chroma set", () => {
  const name = "Pessoa Exemplo";
  assert.throws(
    () => buildContentCatalog([{ nome: name, grupo: "politica" }], [profile(name)], chromas(name).slice(0, 11)),
    /possui 11 Chromas/,
  );
});
