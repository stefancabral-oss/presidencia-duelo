import assert from "node:assert/strict";
import test from "node:test";
import {
  PRIMARY_AREA_INFERENCE_SOURCE,
  TAXONOMY_SOURCE_POINTERS,
  assertValidCatalogTaxonomy,
  catalogTaxonomyErrors,
  catalogTaxonomyEvidenceErrors,
} from "./catalog-taxonomy.js";

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
  assert.equal(errors.some((error) => error.includes("party: valor extracted não é literal")), true);
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
    catalogTaxonomyEvidenceErrors([record], evidence).some((error) => error.includes("primaryArea: valor extracted não é literal")),
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
