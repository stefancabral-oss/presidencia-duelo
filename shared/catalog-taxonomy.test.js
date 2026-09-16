import assert from "node:assert/strict";
import test from "node:test";
import { assertValidCatalogTaxonomy, catalogTaxonomyErrors } from "./catalog-taxonomy.js";

function validRecord() {
  return {
    id: "pessoa-exemplo",
    role: "Deputada federal por São Paulo",
    party: "PT",
    primaryArea: "Política institucional",
    contextAffiliation: null,
    taxonomyProvenance: {
      role: { status: "extracted", source: "profile.currentOccupation" },
      party: { status: "extracted", source: "profile.partyOrArea" },
      primaryArea: { status: "inferred", source: "master.group + profile.currentOccupation" },
      contextAffiliation: { status: "ambiguous", source: "profile.partyOrArea" },
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
  guessed.taxonomyProvenance.party = { status: "ambiguous", source: "profile.partyOrArea" };
  const missingSource = validRecord();
  missingSource.id = "missing-source";
  missingSource.taxonomyProvenance.primaryArea = { status: "inferred", source: "" };
  const errors = catalogTaxonomyErrors([guessed, missingSource], { expectedCount: 2 });
  assert.equal(errors.some((error) => error.includes("valor ambíguo deve ficar sem valor")), true);
  assert.equal(errors.some((error) => error.includes("fonte de proveniência ausente")), true);
});
