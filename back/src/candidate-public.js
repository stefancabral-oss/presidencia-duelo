import {
  assertExactKeys,
  editorialInvalid,
  immutableJsonSnapshot,
  sha256Fingerprint,
  visibleText,
} from "./editorial-integrity.js";

export const PUBLIC_CANDIDATE_SCHEMA_V1 = "candidate-public-v1";
export const PUBLIC_CANDIDATE_SCHEMA_V2 = "candidate-public-v2";
export const PUBLIC_CANDIDATE_SCHEMA_V3 = "candidate-public-v3";
export const PUBLIC_CANDIDATE_SCHEMA_V4 = "candidate-public-v4";

export const PUBLIC_CANDIDATE_CONTENT_FIELDS_V1 = Object.freeze([
  "personId",
  "id",
  "name",
  "displayName",
  "role",
  "affiliation",
  "office",
  "party",
  "location",
  "summary",
  "bio",
  "relevance2026",
  "facts",
  "highlight",
  "controversy",
  "sources",
]);

export const PUBLIC_CANDIDATE_CONTENT_FIELDS_V2 = Object.freeze([
  "personId",
  "id",
  "name",
  "displayName",
  "role",
  "party",
  "primaryArea",
  "contextAffiliation",
  "taxonomyProvenance",
  "summary",
  "location",
  "bio",
  "relevance2026",
  "facts",
  "highlight",
  "controversy",
  "sources",
]);

// Compatibilidade com os consumidores existentes da #171. O nome sem versão
// continua significando v1; integrações novas devem escolher o ruleset.
export const PUBLIC_CANDIDATE_CONTENT_FIELDS = PUBLIC_CANDIDATE_CONTENT_FIELDS_V1;

const CATALOG_FIELDS_V1 = Object.freeze([
  ...PUBLIC_CANDIDATE_CONTENT_FIELDS_V1,
  "group",
  "area",
  "photo",
  "reviewStatus",
  "reviewedAt",
]);
const CATALOG_FIELDS_V2 = Object.freeze([
  ...PUBLIC_CANDIDATE_CONTENT_FIELDS_V2,
  "group",
  "photo",
  "reviewStatus",
  "reviewedAt",
]);
const TAXONOMY_FIELDS = Object.freeze(["role", "party", "primaryArea", "contextAffiliation"]);
const TAXONOMY_STATUSES = new Set(["extracted", "inferred", "ambiguous"]);
const REVIEW_STATUSES = new Set(["pending", "reviewed", "published", "approved", "rejected"]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function rulesetDefinition(ruleset) {
  if (ruleset === PUBLIC_CANDIDATE_SCHEMA_V1) {
    return {
      catalogFields: CATALOG_FIELDS_V1,
      contentFields: PUBLIC_CANDIDATE_CONTENT_FIELDS_V1,
      routingFields: ["group", "area"],
    };
  }
  if (ruleset === PUBLIC_CANDIDATE_SCHEMA_V2) {
    return {
      catalogFields: CATALOG_FIELDS_V2,
      contentFields: PUBLIC_CANDIDATE_CONTENT_FIELDS_V2,
      routingFields: ["group"],
    };
  }
  editorialInvalid(`ruleset público não suportado: ${ruleset}`);
}

function requireString(value, label, { allowEmpty = false, max = 10_000 } = {}) {
  if (!visibleText(value, { allowEmpty, max })) editorialInvalid(`${label} deve ser texto ${allowEmpty ? "válido" : "visível"}`);
  return value;
}

function requireNullableString(value, label, options) {
  if (value === null) return null;
  return requireString(value, label, options);
}

function validDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validateHttpsUrl(value, label) {
  requireString(value, label, { max: 2_000 });
  if (/\s/u.test(value)) editorialInvalid(`${label} deve ser URL HTTPS sem espaços`);
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) throw new Error("unsafe");
  } catch {
    editorialInvalid(`${label} deve ser URL HTTPS sem credenciais`);
  }
  return value;
}

function validateFacts(facts, label) {
  if (!Array.isArray(facts)) editorialInvalid(`${label} deve ser uma lista`);
  return facts.map((fact, index) => requireString(fact, `${label}[${index}]`, { max: 2_000 }));
}

function validateSources(sources, label) {
  if (!Array.isArray(sources)) editorialInvalid(`${label} deve ser uma lista`);
  return sources.map((source, index) => {
    const itemLabel = `${label}[${index}]`;
    assertExactKeys(source, ["label", "url"], itemLabel);
    return {
      label: requireString(source.label, `${itemLabel}.label`, { max: 200 }),
      url: validateHttpsUrl(source.url, `${itemLabel}.url`),
    };
  });
}

function validateTaxonomy(candidate) {
  requireNullableString(candidate.party, "candidate.party", { allowEmpty: false, max: 64 });
  requireNullableString(candidate.primaryArea, "candidate.primaryArea", { max: 128 });
  requireNullableString(candidate.contextAffiliation, "candidate.contextAffiliation", { max: 500 });
  assertExactKeys(candidate.taxonomyProvenance, TAXONOMY_FIELDS, "candidate.taxonomyProvenance");
  for (const field of TAXONOMY_FIELDS) {
    const provenance = candidate.taxonomyProvenance[field];
    assertExactKeys(provenance, ["status", "source"], `candidate.taxonomyProvenance.${field}`);
    if (!TAXONOMY_STATUSES.has(provenance.status)) {
      editorialInvalid(`candidate.taxonomyProvenance.${field}.status desconhecido`);
    }
    requireString(provenance.source, `candidate.taxonomyProvenance.${field}.source`, { max: 1_000 });
    if (provenance.status === "ambiguous" && candidate[field] !== null) {
      editorialInvalid(`candidate.${field} deve ser null quando a proveniência é ambiguous`);
    }
    if (provenance.status !== "ambiguous" && candidate[field] === null) {
      editorialInvalid(`candidate.${field} não pode ser null quando a proveniência é ${provenance.status}`);
    }
  }
}

function validateSharedCandidateFields(candidate) {
  if (!Number.isInteger(candidate.personId) || candidate.personId <= 0) editorialInvalid("candidate.personId deve ser inteiro positivo");
  if (!SLUG_PATTERN.test(candidate.id)) editorialInvalid("candidate.id deve ser slug minúsculo seguro");
  for (const field of [
    "name", "displayName", "role", "location", "summary", "bio", "relevance2026", "highlight", "controversy",
  ]) {
    requireString(candidate[field], `candidate.${field}`);
  }
  requireString(candidate.group, "candidate.group", { max: 64 });
  validateFacts(candidate.facts, "candidate.facts");
  validateSources(candidate.sources, "candidate.sources");
  requireString(candidate.photo, "candidate.photo", { allowEmpty: true, max: 1_000 });
  if (!REVIEW_STATUSES.has(candidate.reviewStatus)) editorialInvalid("candidate.reviewStatus desconhecido");
  if (!validDate(candidate.reviewedAt)) editorialInvalid("candidate.reviewedAt deve ser uma data YYYY-MM-DD válida");
}

export function validateCatalogCandidate(candidate, { ruleset = PUBLIC_CANDIDATE_SCHEMA_V1 } = {}) {
  const definition = rulesetDefinition(ruleset);
  assertExactKeys(candidate, definition.catalogFields, `candidate ${candidate?.id || ""}`.trim());
  validateSharedCandidateFields(candidate);
  if (ruleset === PUBLIC_CANDIDATE_SCHEMA_V1) {
    for (const field of ["affiliation", "office", "area"]) requireString(candidate[field], `candidate.${field}`);
    requireString(candidate.party, "candidate.party", { allowEmpty: true, max: 128 });
  } else {
    validateTaxonomy(candidate);
  }
  return candidate;
}

function projectedContent(candidate, ruleset) {
  const definition = rulesetDefinition(ruleset);
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    editorialInvalid(`candidato incompatível com ${ruleset}`);
  }
  const missing = definition.contentFields.filter((field) => (
    !Object.hasOwn(candidate, field) || candidate[field] === undefined
  ));
  if (missing.length) {
    editorialInvalid(`candidato incompatível com ${ruleset}; campos ausentes: ${missing.join(", ")}`);
  }
  const projection = Object.fromEntries(definition.contentFields.map((field) => [field, candidate[field]]));
  if (!Number.isInteger(projection.personId) || projection.personId <= 0) editorialInvalid("conteúdo público exige personId inteiro positivo");
  if (!SLUG_PATTERN.test(projection.id)) editorialInvalid("conteúdo público exige id seguro");
  for (const field of ["name", "displayName", "role", "location", "summary", "bio", "relevance2026", "highlight", "controversy"]) {
    requireString(projection[field], `conteúdo público.${field}`);
  }
  projection.facts = validateFacts(projection.facts, "conteúdo público.facts");
  projection.sources = validateSources(projection.sources, "conteúdo público.sources");
  if (ruleset === PUBLIC_CANDIDATE_SCHEMA_V1) {
    for (const field of ["affiliation", "office"]) requireString(projection[field], `conteúdo público.${field}`);
    requireString(projection.party, "conteúdo público.party", { allowEmpty: true, max: 128 });
  } else {
    validateTaxonomy({ ...candidate, ...projection });
  }
  return projection;
}

export function candidatePublicContent(candidate, { ruleset = PUBLIC_CANDIDATE_SCHEMA_V1 } = {}) {
  return immutableJsonSnapshot(projectedContent(candidate, ruleset));
}

export function candidateRoutingContent(candidate, { ruleset = PUBLIC_CANDIDATE_SCHEMA_V1 } = {}) {
  const definition = rulesetDefinition(ruleset);
  const routing = Object.fromEntries(definition.routingFields.map((field) => [field, candidate[field]]));
  for (const [field, value] of Object.entries(routing)) requireString(value, `roteamento.${field}`, { max: 128 });
  return immutableJsonSnapshot(routing);
}

export function candidateContentFingerprint(candidate, { ruleset = PUBLIC_CANDIDATE_SCHEMA_V1 } = {}) {
  validateCatalogCandidate(candidate, { ruleset });
  return sha256Fingerprint(JSON.stringify(candidatePublicContent(candidate, { ruleset })));
}

export function candidateRoutingFingerprint(candidate, { ruleset = PUBLIC_CANDIDATE_SCHEMA_V1 } = {}) {
  validateCatalogCandidate(candidate, { ruleset });
  return sha256Fingerprint(JSON.stringify(candidateRoutingContent(candidate, { ruleset })));
}

function ownStringOr(candidate, field, fallback, label) {
  if (!Object.hasOwn(candidate, field)) return fallback;
  return requireString(candidate[field], label, { allowEmpty: true, max: 2_000 });
}

function publicationPayload(candidate) {
  const publication = candidate.publication;
  if (publication !== undefined) assertExactKeys(publication, ["content", "cardArt", "documentaryPhoto"], "candidate.publication");
  const content = publication?.content || {};
  const cardArt = publication?.cardArt || {};
  const documentaryPhoto = publication?.documentaryPhoto || {};
  const status = (value, allowed, fallback, label) => {
    const normalized = value === undefined ? fallback : value;
    if (!allowed.includes(normalized)) editorialInvalid(`${label} desconhecido`);
    return normalized;
  };
  return {
    content: {
      status: status(content.status, ["pending", "approved", "rejected"], "pending", "publication.content.status"),
      reviewedAt: ownStringOr(content, "reviewedAt", "", "publication.content.reviewedAt"),
    },
    cardArt: {
      status: status(cardArt.status, ["missing", "approved", "rejected"], "missing", "publication.cardArt.status"),
      image: ownStringOr(cardArt, "image", "", "publication.cardArt.image"),
      version: ownStringOr(cardArt, "version", "", "publication.cardArt.version"),
    },
    documentaryPhoto: {
      status: status(documentaryPhoto.status, ["missing", "approved", "rejected", "restored"], "missing", "publication.documentaryPhoto.status"),
      image: ownStringOr(documentaryPhoto, "image", "", "publication.documentaryPhoto.image"),
      source: ownStringOr(documentaryPhoto, "source", "", "publication.documentaryPhoto.source"),
      license: ownStringOr(documentaryPhoto, "license", "", "publication.documentaryPhoto.license"),
    },
  };
}

export function candidatePublicPayload(candidate, { ruleset = PUBLIC_CANDIDATE_SCHEMA_V1 } = {}) {
  const content = candidatePublicContent(candidate, { ruleset });
  const topicIds = Object.hasOwn(candidate, "topicIds") ? candidate.topicIds : [];
  if (!Array.isArray(topicIds) || topicIds.some((topicId) => !SLUG_PATTERN.test(topicId))) {
    editorialInvalid("candidate.topicIds deve conter somente slugs seguros");
  }
  return immutableJsonSnapshot({
    ...content,
    cardArt: ownStringOr(candidate, "cardArt", "", "candidate.cardArt"),
    photo: ownStringOr(candidate, "photo", "", "candidate.photo"),
    reviewedAt: ownStringOr(candidate, "reviewedAt", "", "candidate.reviewedAt"),
    reviewStatus: ownStringOr(candidate, "reviewStatus", "pending", "candidate.reviewStatus"),
    topicIds: [...topicIds],
    publication: publicationPayload(candidate),
  });
}

// Ordem histórica copiada do projector da #179. Nunca acrescente, remova ou
// reordene campos: snapshots persistidos usam JSON.stringify destes objetos.
const CANDIDATE_PUBLIC_V1_SNAPSHOT_FIELDS = Object.freeze([
  "personId", "id", "name", "displayName", "affiliation", "photo", "role", "summary", "office", "party",
  "location", "bio", "relevance2026", "facts", "highlight", "controversy", "sources", "reviewedAt", "reviewStatus", "topicIds",
]);
const CANDIDATE_PUBLIC_V2_SNAPSHOT_FIELDS = Object.freeze([
  "personId", "id", "name", "displayName", "photo", "role", "party", "primaryArea",
  "contextAffiliation", "taxonomyProvenance", "summary", "location", "bio", "relevance2026",
  "facts", "highlight", "controversy", "sources", "reviewedAt", "reviewStatus", "topicIds",
]);

function requireSnapshotFields(candidate, fields, schema) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    editorialInvalid(`candidato incompatível com ${schema}`);
  }
  const missing = fields.filter((field) => !Object.hasOwn(candidate, field) || candidate[field] === undefined);
  if (missing.length) editorialInvalid(`candidato incompatível com ${schema}; campos ausentes: ${missing.join(", ")}`);
}

function candidatePublicSnapshotV1(candidate) {
  requireSnapshotFields(candidate, CANDIDATE_PUBLIC_V1_SNAPSHOT_FIELDS, PUBLIC_CANDIDATE_SCHEMA_V1);
  // O snapshot é uma allowlist histórica; metadados internos presentes no
  // objeto do registry não participam nem da validação nem da serialização.
  const payload = candidatePublicPayload({ ...candidate, publication: undefined }, {
    ruleset: PUBLIC_CANDIDATE_SCHEMA_V1,
  });
  return immutableJsonSnapshot(Object.fromEntries(
    CANDIDATE_PUBLIC_V1_SNAPSHOT_FIELDS.map((field) => [field, payload[field]]),
  ));
}

function candidatePublicSnapshotV2(candidate) {
  requireSnapshotFields(candidate, CANDIDATE_PUBLIC_V2_SNAPSHOT_FIELDS, PUBLIC_CANDIDATE_SCHEMA_V2);
  const payload = candidatePublicPayload({ ...candidate, publication: undefined }, {
    ruleset: PUBLIC_CANDIDATE_SCHEMA_V2,
  });
  return immutableJsonSnapshot(Object.fromEntries(
    CANDIDATE_PUBLIC_V2_SNAPSHOT_FIELDS.map((field) => [field, payload[field]]),
  ));
}

function candidatePublicSnapshotV4(candidate) {
  const payload = candidatePublicPayload(candidate, { ruleset: PUBLIC_CANDIDATE_SCHEMA_V2 });
  // Preserve the frozen value on replay; only approved live profiles can
  // introduce a new classification. Restored name/photo-only profiles cannot.
  const group = Object.hasOwn(candidate, "mirrorGroup") ? candidate.mirrorGroup
    : payload.publication.content.status === "approved" ? candidate.group ?? null : null;
  if (group !== null && !["politica", "influencia_debate"].includes(group)) editorialInvalid("grupo do Espelho inválido");
  return immutableJsonSnapshot({ ...payload, mirrorGroup: group });
}

const PUBLIC_CANDIDATE_PROJECTORS = new Map([
  [PUBLIC_CANDIDATE_SCHEMA_V4, candidatePublicSnapshotV4],
  [PUBLIC_CANDIDATE_SCHEMA_V1, candidatePublicSnapshotV1],
  [PUBLIC_CANDIDATE_SCHEMA_V2, candidatePublicSnapshotV2],
  [PUBLIC_CANDIDATE_SCHEMA_V3, (candidate) => candidatePublicPayload(candidate, { ruleset: PUBLIC_CANDIDATE_SCHEMA_V2 })],
]);

export function candidatePublicProjectorBySchema(schema) {
  const projector = PUBLIC_CANDIDATE_PROJECTORS.get(String(schema || ""));
  if (!projector) editorialInvalid(`schema público histórico não suportado: ${schema}`);
  return projector;
}

export function candidatePublicSnapshot(candidate, schema = PUBLIC_CANDIDATE_SCHEMA_V1) {
  return candidatePublicProjectorBySchema(schema)(candidate);
}
