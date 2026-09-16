import {
  PUBLIC_CANDIDATE_CONTENT_FIELDS,
  PUBLIC_CANDIDATE_CONTENT_FIELDS_V1,
  PUBLIC_CANDIDATE_CONTENT_FIELDS_V2,
  PUBLIC_CANDIDATE_SCHEMA_V1,
  PUBLIC_CANDIDATE_SCHEMA_V2,
  candidateContentFingerprint,
  candidatePublicContent,
  candidatePublicPayload,
  candidatePublicProjectorBySchema,
  candidatePublicSnapshot,
  candidateRoutingFingerprint,
  validateCatalogCandidate,
} from "./candidate-public.js";
import {
  validateDecisionAttestation,
  validateGovernancePolicy,
} from "./editorial-attestation.js";
import {
  assertExactKeys,
  assertPlainRecord,
  editorialInvalid,
  immutableJsonSnapshot,
  sha256Fingerprint,
  visibleText,
} from "./editorial-integrity.js";

export {
  PUBLIC_CANDIDATE_CONTENT_FIELDS,
  PUBLIC_CANDIDATE_CONTENT_FIELDS_V1,
  PUBLIC_CANDIDATE_CONTENT_FIELDS_V2,
  PUBLIC_CANDIDATE_SCHEMA_V1,
  PUBLIC_CANDIDATE_SCHEMA_V2,
  candidateContentFingerprint,
  candidatePublicContent,
  candidatePublicPayload,
  candidatePublicProjectorBySchema,
  candidatePublicSnapshot,
  candidateRoutingFingerprint,
  sha256Fingerprint,
};

export const CONTENT_STATUSES = Object.freeze(["pending", "approved", "rejected"]);
export const ASSET_STATUSES = Object.freeze(["missing", "approved", "rejected"]);
export const ASSET_KINDS = Object.freeze(["cardArt", "documentaryPhoto"]);

const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCAL_ASSET_PATH_PATTERN = /^\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*$/;
const GOVERNANCE_TIME_ZONE = "America/Sao_Paulo";
const GOVERNANCE_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  timeZone: GOVERNANCE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function readonlyMapFacade(source) {
  let facade;
  facade = {
    get size() { return source.size; },
    get(key) { return source.get(key); },
    has(key) { return source.has(key); },
    keys() { return source.keys(); },
    values() { return source.values(); },
    entries() { return source.entries(); },
    forEach(callback, thisArg) {
      source.forEach((value, key) => callback.call(thisArg, value, key, facade));
    },
    [Symbol.iterator]() { return source[Symbol.iterator](); },
  };
  return Object.freeze(facade);
}

function currentIsoDate(now) {
  if (typeof now !== "function") editorialInvalid("clock deve ser uma função");
  const current = now();
  if (!(current instanceof Date) || Number.isNaN(current.valueOf())) editorialInvalid("clock deve retornar uma data válida");
  const parts = Object.fromEntries(
    GOVERNANCE_DATE_FORMATTER.formatToParts(current)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function validateAssetShape(asset) {
  assertPlainRecord(asset, "asset editorial");
  if (!ASSET_KINDS.includes(asset.kind)) editorialInvalid(`asset ${asset.candidateId || ""} tem kind desconhecido`);
  const fields = asset.kind === "cardArt"
    ? ["candidateId", "kind", "path", "fingerprint", "version"]
    : ["candidateId", "kind", "path", "fingerprint", "source", "license"];
  assertExactKeys(asset, fields, `asset ${asset.candidateId || ""}.${asset.kind}`);
  if (!SLUG_PATTERN.test(asset.candidateId)) editorialInvalid("asset deve referenciar candidateId seguro");
  if (!LOCAL_ASSET_PATH_PATTERN.test(asset.path)) editorialInvalid(`asset ${asset.candidateId}.${asset.kind} tem path inseguro`);
  if (!FINGERPRINT_PATTERN.test(asset.fingerprint)) editorialInvalid(`asset ${asset.candidateId}.${asset.kind} não tem fingerprint sha256`);
  if (asset.kind === "cardArt" && !visibleText(asset.version, { max: 128 })) {
    editorialInvalid(`asset ${asset.candidateId}.cardArt exige versão visível`);
  }
  if (asset.kind === "documentaryPhoto" && (
    !visibleText(asset.source, { max: 1_000 }) || !visibleText(asset.license, { max: 1_000 })
  )) {
    editorialInvalid(`asset ${asset.candidateId}.documentaryPhoto exige fonte e licença visíveis`);
  }
}

export function assetApprovalFingerprint(asset) {
  validateAssetShape(asset);
  const approvalSnapshot = asset.kind === "cardArt"
    ? {
      candidateId: asset.candidateId,
      kind: asset.kind,
      path: asset.path,
      byteFingerprint: asset.fingerprint,
      version: asset.version,
    }
    : {
      candidateId: asset.candidateId,
      kind: asset.kind,
      path: asset.path,
      byteFingerprint: asset.fingerprint,
      source: asset.source,
      license: asset.license,
    };
  return sha256Fingerprint(JSON.stringify(approvalSnapshot));
}

function validateCatalog(catalog, contentRuleset) {
  if (!Array.isArray(catalog)) editorialInvalid("catálogo deve ser uma lista");
  const ids = new Set();
  const personIds = new Set();
  for (const candidate of catalog) {
    validateCatalogCandidate(candidate, { ruleset: contentRuleset });
    if (ids.has(candidate.id)) editorialInvalid(`candidato duplicado: ${candidate.id}`);
    if (personIds.has(candidate.personId)) editorialInvalid(`personId duplicado: ${candidate.personId}`);
    ids.add(candidate.id);
    personIds.add(candidate.personId);
  }
  return ids;
}

function validateAssetRegistry(assetRegistry, candidateIds) {
  assertExactKeys(assetRegistry, ["schemaVersion", "assets"], "asset registry");
  if (assetRegistry.schemaVersion !== 1 || !Array.isArray(assetRegistry.assets)) {
    editorialInvalid("asset registry deve usar schemaVersion 1 e assets[]");
  }
  const assets = new Map();
  for (const asset of assetRegistry.assets) {
    validateAssetShape(asset);
    if (!candidateIds.has(asset.candidateId)) editorialInvalid(`asset referencia candidato desconhecido: ${asset.candidateId}`);
    const key = `${asset.candidateId}:${asset.kind}`;
    if (assets.has(key)) editorialInvalid(`asset duplicado: ${key}`);
    assets.set(key, asset);
  }
  return assets;
}

function validateLedger({
  ledger,
  candidateIds,
  today,
  governancePolicy,
  contentRuleset,
  loadRepositoryFile,
  verifyReviewedState,
}) {
  assertExactKeys(ledger, ["schemaVersion", "decisions"], "ledger");
  if (ledger.schemaVersion !== 1 || !Array.isArray(ledger.decisions)) {
    editorialInvalid("ledger deve usar schemaVersion 1 e decisions[]");
  }
  const decisions = new Map();
  const allowedEntryFields = new Set(["candidateId", "content", "cardArt", "documentaryPhoto"]);
  for (const entry of ledger.decisions) {
    assertPlainRecord(entry, "decisão editorial");
    const unknownField = Object.keys(entry).find((field) => !allowedEntryFields.has(field));
    if (unknownField) editorialInvalid(`decisão tem campo desconhecido: ${unknownField}`);
    if (!candidateIds.has(entry.candidateId)) editorialInvalid(`decisão referencia candidato desconhecido: ${entry.candidateId || ""}`);
    if (decisions.has(entry.candidateId)) editorialInvalid(`decisão duplicada: ${entry.candidateId}`);
    const dimensions = ["content", "cardArt", "documentaryPhoto"].filter((dimension) => Object.hasOwn(entry, dimension));
    if (dimensions.length === 0) editorialInvalid(`decisão vazia: ${entry.candidateId}`);
    const validatedEntry = { candidateId: entry.candidateId };
    for (const dimension of dimensions) {
      const decision = entry[dimension];
      const verifiedAttestation = validateDecisionAttestation({
        candidateId: entry.candidateId,
        dimension,
        decision,
        today,
        governancePolicy,
        contentRuleset,
        loadRepositoryFile,
        verifyReviewedState,
      });
      validatedEntry[dimension] = Object.freeze({ ...decision, verifiedAttestation });
    }
    decisions.set(entry.candidateId, Object.freeze(validatedEntry));
  }
  return decisions;
}

function auditOf(decision) {
  if (!decision) return null;
  const attestation = decision.verifiedAttestation;
  return immutableJsonSnapshot({
    decidedBy: decision.decidedBy,
    decidedAt: decision.decidedAt,
    attestation: {
      path: decision.attestation.path,
      blobSha256: decision.attestation.blobSha256,
      ruleset: attestation.ruleset,
      reviewedCommit: attestation.reviewedCommit,
      evidence: attestation.evidence,
    },
  });
}

function resolveContent(candidate, decision, contentRuleset) {
  const fingerprint = candidateContentFingerprint(candidate, { ruleset: contentRuleset });
  const routingFingerprint = candidateRoutingFingerprint(candidate, { ruleset: contentRuleset });
  const current = decision?.fingerprint === fingerprint && decision?.routingFingerprint === routingFingerprint;
  return Object.freeze({
    status: current ? decision.status : "pending",
    fingerprint,
    routingFingerprint,
    invalidated: Boolean(decision && !current),
    reviewedAt: current && decision.status === "approved" ? decision.decidedAt : "",
    audit: current ? auditOf(decision) : null,
  });
}

function resolveAsset(kind, decision, asset) {
  if (!decision || decision.status === "missing") {
    return Object.freeze({ status: "missing", invalidated: false, image: "", audit: auditOf(decision) });
  }
  const current = Boolean(asset && decision.fingerprint === assetApprovalFingerprint(asset));
  if (!current) return Object.freeze({ status: "missing", invalidated: true, image: "", audit: null });
  const approved = decision.status === "approved";
  return Object.freeze({
    status: decision.status,
    invalidated: false,
    image: approved ? asset.path : "",
    fingerprint: decision.fingerprint,
    assetFingerprint: asset.fingerprint,
    version: kind === "cardArt" && approved ? asset.version : "",
    source: kind === "documentaryPhoto" && approved ? asset.source : "",
    license: kind === "documentaryPhoto" && approved ? asset.license : "",
    audit: auditOf(decision),
  });
}

function topicIdsFor(candidate) {
  return candidate.group === "politica"
    ? ["eleicoes-2026"]
    : ["eleicoes-2026", "influenciadores"];
}

export function createCandidateRegistry({
  catalog,
  topics,
  ledger,
  assetRegistry,
  governancePolicy,
  loadRepositoryFile,
  verifyReviewedState,
  contentRuleset = PUBLIC_CANDIDATE_SCHEMA_V1,
  now = () => new Date(),
}) {
  const today = currentIsoDate(now);
  const catalogSnapshot = immutableJsonSnapshot(catalog);
  const topicsSnapshot = immutableJsonSnapshot(topics);
  const ledgerSnapshot = immutableJsonSnapshot(ledger);
  const assetRegistrySnapshot = immutableJsonSnapshot(assetRegistry);
  const policySnapshot = validateGovernancePolicy(immutableJsonSnapshot(governancePolicy));
  const candidateIds = validateCatalog(catalogSnapshot, contentRuleset);
  if (!Array.isArray(topicsSnapshot) || topicsSnapshot.some((topic) => (
    !topic || !SLUG_PATTERN.test(String(topic.id || "")) || typeof topic.active !== "boolean"
  ))) editorialInvalid("topics deve ser uma lista válida");
  const internalTopicsById = new Map(topicsSnapshot.map((topic) => [topic.id, topic]));
  if (internalTopicsById.size !== topicsSnapshot.length) editorialInvalid("topic duplicado");
  const assets = validateAssetRegistry(assetRegistrySnapshot, candidateIds);
  const decisions = validateLedger({
    ledger: ledgerSnapshot,
    candidateIds,
    today,
    governancePolicy: policySnapshot,
    contentRuleset,
    loadRepositoryFile,
    verifyReviewedState,
  });

  const candidates = Object.freeze(catalogSnapshot.map((person) => {
    const entry = decisions.get(person.id) || {};
    const publicContent = candidatePublicContent(person, { ruleset: contentRuleset });
    const content = resolveContent(person, entry.content, contentRuleset);
    const cardArt = resolveAsset("cardArt", entry.cardArt, assets.get(`${person.id}:cardArt`));
    const documentaryPhoto = resolveAsset("documentaryPhoto", entry.documentaryPhoto, assets.get(`${person.id}:documentaryPhoto`));
    const publication = Object.freeze({ content, cardArt, documentaryPhoto });
    return Object.freeze({
      ...person,
      ...publicContent,
      facts: publicContent.facts,
      sources: publicContent.sources,
      reviewStatus: content.status,
      reviewedAt: content.reviewedAt,
      cardArt: cardArt.image,
      photo: documentaryPhoto.image,
      publication,
      eligible: content.status === "approved" && cardArt.status === "approved",
      topicIds: Object.freeze(topicIdsFor(person)),
    });
  }));
  const internalCandidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const registry = {
    contentRuleset,
    topics: topicsSnapshot,
    topicsById: readonlyMapFacade(internalTopicsById),
    candidates,
    candidatesById: readonlyMapFacade(internalCandidatesById),
    candidatesForTopic(topicId) {
      if (!internalTopicsById.get(topicId)?.active) return Object.freeze([]);
      return Object.freeze(candidates.filter((candidate) => candidate.eligible && candidate.topicIds.includes(topicId)));
    },
    candidateBelongsToTopic(candidateId, topicId) {
      if (!internalTopicsById.get(topicId)?.active) return false;
      const candidate = internalCandidatesById.get(candidateId);
      return candidate?.eligible === true && candidate.topicIds.includes(topicId);
    },
  };
  return Object.freeze(registry);
}
