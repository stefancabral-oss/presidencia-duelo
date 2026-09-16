import assert from "node:assert/strict";
import test from "node:test";
import {
  PRIMARY_AREA_INFERENCE_SOURCE,
  TAXONOMY_SOURCE_POINTERS,
  assertValidCatalogTaxonomy,
  catalogTaxonomyErrors,
  catalogTaxonomyEvidenceErrors,
} from "./catalog-taxonomy.js";
import { readFileSync } from "node:fs";

function validRecord() {
  return {
    id: "pessoa-exemplo",
    name: "Pessoa Exemplo",
    role: "Deputada federal por São Paulo",
    party: "PT",
    primaryArea: "Política institucional",
    contextAffiliation: null,
    taxonomyProvenance: {
      role: { status: "extracted", source: TAXONOMY_SOURCE_POINTERS.profileCurrentOccupation },
      party: { status: "extracted", source: TAXONOMY_SOURCE_POINTERS.profilePartyOrArea },
      primaryArea: { status: "inferred", source: PRIMARY_AREA_INFERENCE_SOURCE },
      contextAffiliation: { status: "ambiguous", source: TAXONOMY_SOURCE_POINTERS.profilePartyOrArea },
    },
  };
}

test("accepts a closed-vocabulary record with attribute-level provenance", () => {
  assert.doesNotThrow(() => assertValidCatalogTaxonomy([validRecord()], { expectedCount: 1 }));
});

test("rejects prose in party, an unknown area and role leakage", () => {
  const invalid = [
    { ...validRecord(), id: "party-prose", party: "PT / Executivo" },
    { ...validRecord(), id: "open-area", primaryArea: "Política / digital" },
    { ...validRecord(), id: "role-leak", role: "PSDB" },
  ];
  const errors = catalogTaxonomyErrors(invalid, { expectedCount: 3 });
  assert.equal(errors.some((error) => error.includes("party-prose.party: sigla fora")), true);
  assert.equal(errors.some((error) => error.includes("open-area.primaryArea: área fora")), true);
  assert.equal(errors.some((error) => error.includes("role-leak.role: cargo/função")), true);
});

test("rejects guessed ambiguous values and incomplete provenance", () => {
  const guessed = validRecord();
  guessed.party = "PL";
  guessed.taxonomyProvenance.party = { status: "ambiguous", source: TAXONOMY_SOURCE_POINTERS.profilePartyOrArea };
  const missingSource = validRecord();
  missingSource.id = "missing-source";
  missingSource.taxonomyProvenance.primaryArea = { status: "inferred", source: "" };
  const errors = catalogTaxonomyErrors([guessed, missingSource], { expectedCount: 2 });
  assert.equal(errors.some((error) => error.includes("valor ambíguo deve ficar sem valor")), true);
  assert.equal(errors.some((error) => error.includes("fonte de proveniência ausente")), true);
});

test("rejects unknown source pointers", () => {
  const invalid = validRecord();
  invalid.taxonomyProvenance.party = { status: "extracted", source: "arquivo-inexistente.json#partido" };
  const errors = catalogTaxonomyErrors([invalid], { expectedCount: 1 });
  assert.equal(errors.some((error) => error.includes("ponteiro de fonte desconhecido")), true);
});

test("checks extracted values against the pointed source", () => {
  const record = validRecord();
  const evidence = {
    profiles: [{
      nome_exibicao: record.name,
      ocupacao_atual: record.role,
      partido_ou_area: "PT",
    }],
    master: [{ nome: record.name, grupo: "politica", area: "Política" }],
  };
  assert.deepEqual(catalogTaxonomyEvidenceErrors([record], evidence), []);

  const tampered = structuredClone(record);
  tampered.party = "PL";
  const errors = catalogTaxonomyEvidenceErrors([tampered], evidence);
  assert.equal(errors.some((error) => error.includes("party: valor extracted não tem relação semântica")), true);
});

test("only treats semantic area mappings as inferred", () => {
  const record = validRecord();
  record.party = null;
  record.primaryArea = "Justiça";
  record.taxonomyProvenance.party = { status: "ambiguous", source: TAXONOMY_SOURCE_POINTERS.profilePartyOrArea };
  record.taxonomyProvenance.primaryArea = { status: "extracted", source: TAXONOMY_SOURCE_POINTERS.profilePartyOrArea };
  const evidence = {
    profiles: [{ nome_exibicao: record.name, ocupacao_atual: record.role, partido_ou_area: "Judiciário / STF" }],
    master: [{ nome: record.name, grupo: "politica", area: "Justiça" }],
  };
  assert.equal(
    catalogTaxonomyEvidenceErrors([record], evidence).some((error) => error.includes("primaryArea: valor extracted não tem relação semântica")),
    true,
  );
  record.taxonomyProvenance.primaryArea.status = "inferred";
  assert.deepEqual(catalogTaxonomyEvidenceErrors([record], evidence), []);
});

test("uses the explicit v1 party normalization map", () => {
  const record = validRecord();
  record.party = "REPUBLICANOS";
  const evidence = {
    profiles: [{ nome_exibicao: record.name, ocupacao_atual: record.role, partido_ou_area: "Republicanos / religião" }],
    master: [{ nome: record.name, grupo: "politica", area: "Política" }],
  };
  assert.deepEqual(catalogTaxonomyEvidenceErrors([record], evidence), []);
});

test("requires an explicit party relationship instead of any matching token", () => {
  const record = validRecord();
  record.party = "PL";
  const evidence = {
    profiles: [{ nome_exibicao: record.name, ocupacao_atual: record.role, partido_ou_area: "Economia / órbita PL" }],
    master: [{ nome: record.name, grupo: "economia", area: "Economia" }],
  };
  const errors = catalogTaxonomyEvidenceErrors([record], evidence);
  assert.equal(errors.some((error) => error.includes("party: valor extracted não tem relação semântica")), true);

  record.party = "REPUBLICANOS";
  evidence.profiles[0].partido_ou_area = "Fitness / digital (filiada Republicanos; sem candidatura ativa)";
  assert.deepEqual(catalogTaxonomyEvidenceErrors([record], evidence), []);
});

test("rejects literal ideology and channel labels as extracted affiliations", () => {
  const record = validRecord();
  record.party = "NOVO";
  record.contextAffiliation = "direita";
  record.taxonomyProvenance.contextAffiliation = {
    status: "extracted",
    source: TAXONOMY_SOURCE_POINTERS.profilePartyOrArea,
  };
  const evidence = {
    profiles: [{ nome_exibicao: record.name, ocupacao_atual: record.role, partido_ou_area: "Novo / direita" }],
    master: [{ nome: record.name, grupo: "politica", area: "Política" }],
  };
  const errors = catalogTaxonomyEvidenceErrors([record], evidence);
  assert.equal(errors.some((error) => error.includes("contextAffiliation: valor extracted não tem relação semântica")), true);
});

test("protects the real catalog regressions while preserving explicit affiliation", () => {
  const profiles = JSON.parse(readFileSync(new URL(
    "../stages/10_rebuild_eleicoes_2026/input/polimatch-perfis-editoriais-125.json",
    import.meta.url,
  ), "utf8"));
  const master = JSON.parse(readFileSync(new URL(
    "../stages/10_rebuild_eleicoes_2026/input/polimatch-catalogo-125.json",
    import.meta.url,
  ), "utf8"));
  const generated = JSON.parse(readFileSync(new URL("./elections-2026.json", import.meta.url), "utf8"));

  const paulo = structuredClone(generated.find(({ name }) => name === "Paulo Guedes"));
  paulo.party = "PL";
  paulo.taxonomyProvenance.party = {
    status: "extracted",
    source: TAXONOMY_SOURCE_POINTERS.profilePartyOrArea,
  };
  assert.equal(
    catalogTaxonomyEvidenceErrors([paulo], { profiles, master })
      .some((error) => error.includes("party: valor extracted não tem relação semântica")),
    true,
  );

  for (const [name, contextAffiliation] of [
    ["Guilherme Boulos", "articulação digital governista"],
    ["Jones Manoel", "esquerda radical"],
    ["Carla Zambelli", "digital"],
    ["Deltan Dallagnol", "direita"],
  ]) {
    const candidate = structuredClone(generated.find((entry) => entry.name === name));
    candidate.contextAffiliation = contextAffiliation;
    candidate.taxonomyProvenance.contextAffiliation = {
      status: "extracted",
      source: TAXONOMY_SOURCE_POINTERS.profilePartyOrArea,
    };
    assert.equal(
      catalogTaxonomyEvidenceErrors([candidate], { profiles, master })
        .some((error) => error.includes("contextAffiliation: valor extracted não tem relação semântica")),
      true,
      `${name} não pode recuperar contexto categorial`,
    );
  }

  const gracyanne = generated.find(({ name }) => name === "Gracyanne Barbosa");
  assert.deepEqual(catalogTaxonomyEvidenceErrors([gracyanne], { profiles, master }), []);
});
