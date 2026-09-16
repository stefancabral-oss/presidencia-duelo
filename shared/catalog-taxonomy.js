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
export const TAXONOMY_SCHEMA_VERSION = 2;
export const TAXONOMY_SOURCE_POINTERS = Object.freeze({
  profileCurrentOccupation: "polimatch-perfis-editoriais-125.json#ocupacao_atual",
  profilePartyOrArea: "polimatch-perfis-editoriais-125.json#partido_ou_area",
  masterGroup: "polimatch-catalogo-125.json#grupo",
  masterArea: "polimatch-catalogo-125.json#area",
});
export const ROLE_SOURCE = TAXONOMY_SOURCE_POINTERS.profileCurrentOccupation;
export const PRIMARY_AREA_INFERENCE_SOURCE = `${TAXONOMY_SOURCE_POINTERS.masterGroup} + ${ROLE_SOURCE}`;
export const TAXONOMY_NORMALIZATIONS = Object.freeze({
  version: 1,
  party: Object.freeze({
    Avante: "AVANTE",
    Missão: "MISSÃO",
    Novo: "NOVO",
    Rede: "REDE",
    Republicanos: "REPUBLICANOS",
    "União Brasil": "UNIÃO",
  }),
});

// `contextAffiliation` is intentionally free-form in the product, but an
// `extracted` value still needs a machine-verifiable semantic contract.  This
// versioned registry contains the institutional labels that the legacy source
// can currently prove.  Adding another literal is an explicit editorial
// decision; merely finding a word such as "direita" or "digital" in the old
// overloaded column is not enough.
export const TAXONOMY_CONTEXT_EXTRACTIONS = Object.freeze({
  version: 1,
  values: Object.freeze({
    MBL: Object.freeze([
      TAXONOMY_SOURCE_POINTERS.profileCurrentOccupation,
      TAXONOMY_SOURCE_POINTERS.profilePartyOrArea,
    ]),
    Executivo: Object.freeze([TAXONOMY_SOURCE_POINTERS.profilePartyOrArea]),
    "governo Lula": Object.freeze([TAXONOMY_SOURCE_POINTERS.profilePartyOrArea]),
    STF: Object.freeze([TAXONOMY_SOURCE_POINTERS.profilePartyOrArea]),
    BC: Object.freeze([TAXONOMY_SOURCE_POINTERS.profilePartyOrArea]),
    "órbita PL": Object.freeze([TAXONOMY_SOURCE_POINTERS.profilePartyOrArea]),
    "Assembleia de Deus Vitória em Cristo (ADVEC)": Object.freeze([
      TAXONOMY_SOURCE_POINTERS.profileCurrentOccupation,
    ]),
    Universal: Object.freeze([TAXONOMY_SOURCE_POINTERS.profilePartyOrArea]),
  }),
});

const PARTY_SET = new Set(PARTY_CODES);
const PRIMARY_AREA_SET = new Set(PRIMARY_AREAS);
const PROVENANCE_SET = new Set(PROVENANCE_STATUSES);
const LEGACY_TAXONOMY_FIELDS = ["affiliation", "area", "office"];
const SOURCE_POINTER_FIELDS = new Map([
  [TAXONOMY_SOURCE_POINTERS.profileCurrentOccupation, ["profile", "ocupacao_atual"]],
  [TAXONOMY_SOURCE_POINTERS.profilePartyOrArea, ["profile", "partido_ou_area"]],
  [TAXONOMY_SOURCE_POINTERS.masterGroup, ["master", "grupo"]],
  [TAXONOMY_SOURCE_POINTERS.masterArea, ["master", "area"]],
]);

function clean(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value;
}

function present(value) {
  return typeof value === "string" && Boolean(clean(value));
}

function recordLabel(record, index) {
  return record?.id || record?.name || `registro ${index + 1}`;
}

function normalizePersonName(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function splitSourcePointers(source) {
  if (!present(source)) return [];
  return clean(source).split(/\s+\+\s+/u);
}

function containsLiteral(sourceValue, expectedValue) {
  const source = clean(sourceValue);
  const expected = clean(expectedValue);
  if (!present(source) || !present(expected)) return false;
  let offset = source.indexOf(expected);
  while (offset !== -1) {
    const before = offset > 0 ? source[offset - 1] : "";
    const after = source[offset + expected.length] || "";
    if ((!before || !/[\p{L}\p{N}]/u.test(before)) && (!after || !/[\p{L}\p{N}]/u.test(after))) return true;
    offset = source.indexOf(expected, offset + 1);
  }
  return false;
}

function normalizedPartyLiterals(value) {
  const normalizedValue = clean(value);
  return [
    normalizedValue,
    ...Object.entries(TAXONOMY_NORMALIZATIONS.party)
      .filter(([, normalized]) => normalized === normalizedValue)
      .map(([literal]) => literal),
  ];
}

function partyEvidenceMatches(value, evidence) {
  if (evidence.pointer !== TAXONOMY_SOURCE_POINTERS.profilePartyOrArea) return false;
  const source = clean(evidence.value);
  if (!present(source)) return false;
  const firstLegacyClause = clean(source.split("/")[0]);
  const literals = normalizedPartyLiterals(value);

  // In the legacy column, a direct party declaration always occupied the
  // first slash-delimited clause.  A later mention (for example "órbita PL")
  // is context, not proof of party membership.
  if (literals.some((literal) => firstLegacyClause === literal)) return true;

  // The one migrated exception is an explicit affiliation sentence, not a
  // token discovered by cleanup: "filiada Republicanos".
  return literals.some((literal) => {
    const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\bfiliad[oa]\\s+(?:(?:ao|a)\\s+)?${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu").test(source);
  });
}

function contextEvidenceMatches(value, source) {
  const allowedSources = TAXONOMY_CONTEXT_EXTRACTIONS.values[clean(value)];
  return Boolean(
    allowedSources?.includes(source.pointer)
    && containsLiteral(source.value, value),
  );
}

function extractedValueMatches(field, value, source) {
  if (field === "role") return clean(value) === clean(source.value);
  if (field === "party") return partyEvidenceMatches(value, source);
  if (field === "contextAffiliation") return contextEvidenceMatches(value, source);
  return containsLiteral(source.value, value);
}

function indexEvidence(records, nameField) {
  const indexed = new Map();
  for (const record of records || []) {
    const key = normalizePersonName(record?.[nameField]);
    if (key && !indexed.has(key)) indexed.set(key, record);
  }
  return indexed;
}

function indexTaxonomySource(records, nameField, sourceLabel, errors) {
  const indexed = new Map();
  for (const [index, record] of records.entries()) {
    const sourceName = clean(record?.[nameField]);
    const key = normalizePersonName(sourceName);
    if (!key) {
      errors.push(`${sourceLabel}[${index}]: nome ausente`);
      continue;
    }
    if (indexed.has(key)) {
      errors.push(`${sourceLabel}: nome duplicado: ${sourceName}`);
      continue;
    }
    indexed.set(key, { record, sourceName });
  }
  return indexed;
}

export function catalogTaxonomySourceErrors(records, {
  profiles = [],
  master = [],
  taxonomy = [],
} = {}) {
  const errors = [];
  const sources = [
    ["artefato gerado", records, "name"],
    ["perfis editoriais", profiles, "nome_exibicao"],
    ["catálogo mestre", master, "nome"],
    ["fonte taxonômica", taxonomy, "name"],
  ];
  for (const [sourceLabel, sourceRecords] of sources) {
    if (!Array.isArray(sourceRecords)) errors.push(`${sourceLabel}: fonte deve ser uma lista`);
  }
  if (errors.length) return errors;

  const indexedSources = sources.map(([sourceLabel, sourceRecords, nameField]) => ({
    sourceLabel,
    records: indexTaxonomySource(sourceRecords, nameField, sourceLabel, errors),
  }));
  const reference = indexedSources[0].records;

  for (const { sourceLabel, records: sourceRecords } of indexedSources.slice(1)) {
    for (const [key, { sourceName }] of reference) {
      if (!sourceRecords.has(key)) errors.push(`${sourceLabel}: pessoa ausente: ${sourceName}`);
    }
    for (const [key, { sourceName }] of sourceRecords) {
      if (!reference.has(key)) errors.push(`${sourceLabel}: pessoa fora do artefato gerado: ${sourceName}`);
    }
  }
  return errors;
}

export function assertValidCatalogTaxonomySources(records, options) {
  const errors = catalogTaxonomySourceErrors(records, options);
  if (errors.length) {
    throw new Error(`fontes taxonômicas dessincronizadas:\n- ${errors.join("\n- ")}`);
  }
  return records;
}

export function resolveTaxonomySources(source, { profile, master } = {}) {
  return splitSourcePointers(source).map((pointer) => {
    const target = SOURCE_POINTER_FIELDS.get(pointer);
    if (!target) return { pointer, known: false, value: undefined };
    const [recordType, field] = target;
    const record = recordType === "profile" ? profile : master;
    return { pointer, known: true, value: record?.[field] };
  });
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
  } else {
    for (const pointer of splitSourcePointers(provenance.source)) {
      if (!SOURCE_POINTER_FIELDS.has(pointer)) {
        errors.push(`${label}.${field}: ponteiro de fonte desconhecido: ${pointer}`);
      }
    }
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

export function catalogTaxonomyEvidenceErrors(records, { profiles = [], master = [] } = {}) {
  const errors = [];
  if (!Array.isArray(records)) return ["catálogo taxonômico deve ser uma lista"];
  if (!Array.isArray(profiles) || !Array.isArray(master)) return ["fontes editoriais devem ser listas"];
  const profilesByName = indexEvidence(profiles, "nome_exibicao");
  const masterByName = indexEvidence(master, "nome");

  for (const [index, record] of records.entries()) {
    const label = recordLabel(record, index);
    const key = normalizePersonName(record?.name);
    const profile = profilesByName.get(key);
    const masterRecord = masterByName.get(key);
    if (!profile) errors.push(`${label}: perfil editorial de origem não encontrado`);
    if (!masterRecord) errors.push(`${label}: registro mestre de origem não encontrado`);
    if (!profile || !masterRecord) continue;

    for (const field of TAXONOMY_FIELDS) {
      const provenance = record.taxonomyProvenance?.[field];
      if (!provenance || !present(provenance.source)) continue;
      const sources = resolveTaxonomySources(provenance.source, { profile, master: masterRecord });
      if (sources.some(({ known }) => !known)) continue;
      for (const source of sources) {
        if (!present(source.value)) errors.push(`${label}.${field}: fonte sem valor: ${source.pointer}`);
      }
      if (provenance.status !== "extracted") continue;
      if (sources.length !== 1) {
        errors.push(`${label}.${field}: extracted exige um único ponteiro de fonte`);
        continue;
      }
      if (!extractedValueMatches(field, record[field], sources[0])) {
        errors.push(`${label}.${field}: valor extracted não tem relação semântica válida com a fonte ${sources[0].pointer}`);
      }
    }
  }
  return errors;
}

export function assertValidCatalogTaxonomyEvidence(records, options) {
  const errors = catalogTaxonomyEvidenceErrors(records, options);
  if (errors.length) {
    throw new Error(`evidência taxonômica inválida:\n- ${errors.join("\n- ")}`);
  }
  return records;
}

export function compactTaxonomyLabel(candidate) {
  return clean(candidate?.party) || clean(candidate?.primaryArea) || "";
}
