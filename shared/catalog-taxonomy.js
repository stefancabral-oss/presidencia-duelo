export const PARTY_CODES = Object.freeze([
  "AVANTE",
  "MDB",
  "MISSÃO",
  "NOVO",
  "PDT",
  "PL",
  "PP",
  "PRTB",
  "PSB",
  "PSD",
  "PSDB",
  "PSOL",
  "PT",
  "REDE",
  "REPUBLICANOS",
  "UNIÃO",
]);

export const PRIMARY_AREAS = Object.freeze([
  "Audiovisual e artes cênicas",
  "Comunicação digital",
  "Economia",
  "Esporte",
  "Humor",
  "Justiça",
  "Mídia e jornalismo",
  "Música",
  "Política institucional",
  "Religião",
  "Saúde e bem-estar",
]);

export const PROVENANCE_STATUSES = Object.freeze(["extracted", "inferred", "ambiguous"]);
export const TAXONOMY_FIELDS = Object.freeze(["role", "party", "primaryArea", "contextAffiliation"]);
export const ROLE_SOURCE = "polimatch-perfis-editoriais-125.json#ocupacao_atual";

const PARTY_SET = new Set(PARTY_CODES);
const PRIMARY_AREA_SET = new Set(PRIMARY_AREAS);
const PROVENANCE_SET = new Set(PROVENANCE_STATUSES);
const LEGACY_TAXONOMY_FIELDS = ["affiliation", "area", "office"];

function clean(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value;
}

function present(value) {
  return typeof value === "string" && Boolean(clean(value));
}

function recordLabel(record, index) {
  return record?.id || record?.name || `registro ${index + 1}`;
}

function validateProvenance(record, field, label, errors) {
  const value = record[field];
  const provenance = record.taxonomyProvenance?.[field];
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
    errors.push(`${label}.${field}: proveniência ausente`);
    return;
  }
  if (!PROVENANCE_SET.has(provenance.status)) {
    errors.push(`${label}.${field}: status de proveniência inválido: ${provenance.status ?? "(ausente)"}`);
  }
  if (!present(provenance.source)) {
    errors.push(`${label}.${field}: fonte de proveniência ausente`);
  }
  if (provenance.status === "ambiguous" && value !== null && value !== "") {
    errors.push(`${label}.${field}: valor ambíguo deve ficar sem valor`);
  }
  if (provenance.status !== "ambiguous" && !present(value)) {
    errors.push(`${label}.${field}: ${provenance.status || "proveniência"} exige valor`);
  }
}

export function materializeCandidateTaxonomy(profile, taxonomyRecord) {
  return {
    role: clean(profile?.ocupacao_atual) || null,
    party: clean(taxonomyRecord?.party) || null,
    primaryArea: clean(taxonomyRecord?.primaryArea) || null,
    contextAffiliation: clean(taxonomyRecord?.contextAffiliation) || null,
    taxonomyProvenance: {
      role: { status: "extracted", source: ROLE_SOURCE },
      party: taxonomyRecord?.taxonomyProvenance?.party,
      primaryArea: taxonomyRecord?.taxonomyProvenance?.primaryArea,
      contextAffiliation: taxonomyRecord?.taxonomyProvenance?.contextAffiliation,
    },
  };
}

export function catalogTaxonomyErrors(records, { expectedCount = 125, forbidLegacyFields = true } = {}) {
  const errors = [];
  if (!Array.isArray(records)) return ["catálogo taxonômico deve ser uma lista"];
  if (expectedCount !== null && records.length !== expectedCount) {
    errors.push(`catálogo possui ${records.length} registros; esperado: ${expectedCount}`);
  }
  const ids = new Set();
  for (const [index, record] of records.entries()) {
    const label = recordLabel(record, index);
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      errors.push(`${label}: registro inválido`);
      continue;
    }
    if (!present(record.id)) errors.push(`${label}: id ausente`);
    else if (ids.has(record.id)) errors.push(`${label}: id duplicado`);
    else ids.add(record.id);

    if (forbidLegacyFields) {
      for (const field of LEGACY_TAXONOMY_FIELDS) {
        if (Object.hasOwn(record, field)) errors.push(`${label}.${field}: campo taxonômico legado proibido`);
      }
    }

    for (const field of TAXONOMY_FIELDS) validateProvenance(record, field, label, errors);

    if (!present(record.role) || !/\s/u.test(clean(record.role))) {
      errors.push(`${label}.role: cargo/função deve ser prosa descritiva`);
    } else if (PARTY_SET.has(clean(record.role)) || PRIMARY_AREA_SET.has(clean(record.role))) {
      errors.push(`${label}.role: cargo/função não pode reutilizar partido ou área`);
    }

    if (record.party !== null && record.party !== "" && !PARTY_SET.has(clean(record.party))) {
      errors.push(`${label}.party: sigla fora do vocabulário: ${record.party}`);
    }
    if (record.primaryArea !== null && record.primaryArea !== "" && !PRIMARY_AREA_SET.has(clean(record.primaryArea))) {
      errors.push(`${label}.primaryArea: área fora do vocabulário: ${record.primaryArea}`);
    }
    if (record.contextAffiliation !== null && record.contextAffiliation !== "" && !present(record.contextAffiliation)) {
      errors.push(`${label}.contextAffiliation: contexto deve ser texto ou nulo`);
    }
  }
  return errors;
}

export function assertValidCatalogTaxonomy(records, options) {
  const errors = catalogTaxonomyErrors(records, options);
  if (errors.length) {
    throw new Error(`taxonomia editorial inválida:\n- ${errors.join("\n- ")}`);
  }
  return records;
}

export function compactTaxonomyLabel(candidate) {
  return clean(candidate?.party) || clean(candidate?.primaryArea) || "";
}
