import assert from "node:assert/strict";
import test from "node:test";
import { PRIMARY_AREA_INFERENCE_SOURCE, TAXONOMY_SOURCE_POINTERS } from "../../shared/catalog-taxonomy.js";
import { buildContentCatalog, displayName, normalizePersonName } from "./content-import.js";

const profile = (name) => ({
  nome_exibicao: name,
  ocupacao_atual: "Cargo atual",
  partido_ou_area: "PT",
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

const taxonomy = (name) => ({
  name,
  party: "PT",
  primaryArea: "Política institucional",
  contextAffiliation: null,
  taxonomyProvenance: {
    party: { status: "extracted", source: TAXONOMY_SOURCE_POINTERS.profilePartyOrArea },
    primaryArea: { status: "inferred", source: PRIMARY_AREA_INFERENCE_SOURCE },
    contextAffiliation: { status: "ambiguous", source: TAXONOMY_SOURCE_POINTERS.profilePartyOrArea },
  },
});

test("normalizes names across accents and parenthetical aliases", () => {
  assert.equal(normalizePersonName("Popó (Acelino Freitas)"), "popo");
  assert.equal(displayName("Luiz Inácio Lula da Silva (Lula)"), "Lula");
  assert.equal(displayName("Monark (Bruno Aiub)"), "Monark");
});

test("builds separate candidate and draft Chroma catalogs", () => {
  const name = "Luiz Inácio Lula da Silva (Lula)";
  const result = buildContentCatalog([{ nome: name, grupo: "politica" }], [profile(name)], [taxonomy(name)], chromas(name));
  assert.equal(result.candidates[0].id, "lula");
  assert.equal(result.candidates[0].role, "Cargo atual");
  assert.equal(result.candidates[0].party, "PT");
  assert.equal(result.candidates[0].primaryArea, "Política institucional");
  assert.equal(result.candidates[0].contextAffiliation, null);
  assert.equal(result.candidates[0].taxonomyProvenance.contextAffiliation.status, "ambiguous");
  assert.equal("affiliation" in result.candidates[0], false);
  assert.equal("area" in result.candidates[0], false);
  assert.equal("office" in result.candidates[0], false);
  assert.equal(result.candidates[0].sources.length, 1);
  assert.equal(result.chromas.length, 12);
  assert.equal(result.chromas[0].sourceReviewStatus, "url-provided");
  assert.equal(result.chromas[1].sourceReviewStatus, "source-required");
  assert.equal(result.chromas.every(({ status, artworkUrl }) => status === "draft" && artworkUrl === ""), true);
});

test("refuses an incomplete Chroma set", () => {
  const name = "Pessoa Exemplo";
  assert.throws(
    () => buildContentCatalog([{ nome: name, grupo: "politica" }], [profile(name)], [taxonomy(name)], chromas(name).slice(0, 11)),
    /possui 11 Chromas/,
  );
});

test("refuses taxonomy prose in the party slot", () => {
  const name = "Pessoa Exemplo";
  const invalid = { ...taxonomy(name), party: "PT / Executivo" };
  assert.throws(
    () => buildContentCatalog([{ nome: name, grupo: "politica" }], [profile(name)], [invalid], chromas(name)),
    /sigla fora do vocabulário/,
  );
});

test("refuses an extracted party that is absent from the real source field", () => {
  const name = "Luiz Inácio Lula da Silva (Lula)";
  const tampered = { ...taxonomy(name), party: "PL" };
  assert.throws(
    () => buildContentCatalog([{ nome: name, grupo: "politica" }], [profile(name)], [tampered], chromas(name)),
    /party: valor extracted não é literal na fonte/,
  );
});
