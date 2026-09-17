import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  TAXONOMY_FIELDS,
  TAXONOMY_SCHEMA_VERSION,
  assertValidCatalogTaxonomy,
  assertValidCatalogTaxonomyEvidence,
  assertValidCatalogTaxonomySources,
  materializeCandidateTaxonomy,
} from "./catalog-taxonomy.js";

const paths = {
  master: new URL("../stages/10_rebuild_eleicoes_2026/input/polimatch-catalogo-125.json", import.meta.url),
  profiles: new URL("../stages/10_rebuild_eleicoes_2026/input/polimatch-perfis-editoriais-125.json", import.meta.url),
  taxonomy: new URL("../stages/10_rebuild_eleicoes_2026/input/polimatch-taxonomia-125.json", import.meta.url),
  generated: new URL("./elections-2026.json", import.meta.url),
};

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const [master, profiles, taxonomySource, generated] = await Promise.all([
  readJson(paths.master),
  readJson(paths.profiles),
  readJson(paths.taxonomy),
  readJson(paths.generated),
]);

assert.equal(taxonomySource.schemaVersion, TAXONOMY_SCHEMA_VERSION, "versão da fonte taxonômica não suportada");
assert.equal(Array.isArray(taxonomySource.records), true, "fonte taxonômica deve expor records[]");
assert.equal(taxonomySource.records.length, profiles.length, "fonte taxonômica e perfis devem ter a mesma cardinalidade");

const taxonomyByName = new Map();
for (const record of taxonomySource.records) {
  assert.equal(typeof record.name, "string", "registro taxonômico sem nome");
  assert.equal(taxonomyByName.has(record.name), false, `nome taxonômico duplicado: ${record.name}`);
  taxonomyByName.set(record.name, record);
}
const generatedByName = new Map(generated.map((record) => [record.name, record]));

for (const profile of profiles) {
  const taxonomy = taxonomyByName.get(profile.nome_exibicao);
  const candidate = generatedByName.get(profile.nome_exibicao);
  assert.ok(taxonomy, `taxonomia ausente: ${profile.nome_exibicao}`);
  assert.ok(candidate, `artefato gerado ausente: ${profile.nome_exibicao}`);
  const expected = materializeCandidateTaxonomy(profile, taxonomy);
  for (const field of TAXONOMY_FIELDS) {
    assert.deepEqual(candidate[field], expected[field], `${profile.nome_exibicao}.${field} está desatualizado`);
    assert.deepEqual(
      candidate.taxonomyProvenance?.[field],
      expected.taxonomyProvenance[field],
      `${profile.nome_exibicao}.${field} perdeu a proveniência`,
    );
  }
}

assert.equal(taxonomyByName.size, profiles.length, "há taxonomia fora dos perfis editoriais");
assert.equal(generatedByName.size, profiles.length, "há pessoa extra ou duplicada no artefato gerado");
assertValidCatalogTaxonomySources(generated, {
  profiles,
  master,
  taxonomy: taxonomySource.records,
});
assertValidCatalogTaxonomy(generated, { expectedCount: profiles.length });
assertValidCatalogTaxonomyEvidence(generated, { profiles, master });

const statusCounts = Object.fromEntries(TAXONOMY_FIELDS.map((field) => [
  field,
  Object.fromEntries(["extracted", "inferred", "ambiguous"].map((status) => [
    status,
    generated.filter((record) => record.taxonomyProvenance[field].status === status).length,
  ])),
]));

console.log(JSON.stringify({
  records: generated.length,
  parties: new Set(generated.map(({ party }) => party).filter(Boolean)).size,
  primaryAreas: new Set(generated.map(({ primaryArea }) => primaryArea).filter(Boolean)).size,
  statusCounts,
}));
