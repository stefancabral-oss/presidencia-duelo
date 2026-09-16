import { createHash } from "node:crypto";

export const CONTENT_STATUSES = Object.freeze(["pending", "approved", "rejected"]);
export const ASSET_STATUSES = Object.freeze(["missing", "approved", "rejected"]);
export const ASSET_KINDS = Object.freeze(["cardArt", "documentaryPhoto"]);

export const PUBLIC_CANDIDATE_CONTENT_FIELDS = Object.freeze([
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
const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_ASSET_PATH_PATTERN = /^\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*$/;

function invalid(message) {
  throw new TypeError(`registro editorial inválido: ${message}`);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validDate(value) {
  const normalized = String(value || "");
  if (!DATE_PATTERN.test(normalized)) return false;
  const date = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === normalized;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value ?? null;
}

export function sha256Fingerprint(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function candidatePublicContent(candidate) {
  if (!candidate || !nonEmpty(candidate.id)) invalid("candidato sem id para projeção pública");
  const normalized = {
    ...candidate,
    office: candidate.office || "",
    party: candidate.party || "",
    location: candidate.location || "",
    bio: candidate.bio || candidate.summary || "",
    facts: Array.isArray(candidate.facts) ? [...candidate.facts] : [],
    sources: Array.isArray(candidate.sources) ? [...candidate.sources] : [],
  };
  return Object.freeze(Object.fromEntries(
    PUBLIC_CANDIDATE_CONTENT_FIELDS.map((field) => [field, normalized[field]]),
  ));
}

export function candidatePublicPayload(candidate) {
  const publication = candidate.publication || {};
  const content = publication.content || {};
  const cardArt = publication.cardArt || {};
  const documentaryPhoto = publication.documentaryPhoto || {};
  return Object.freeze({
    ...candidatePublicContent(candidate),
    cardArt: candidate.cardArt || "",
    photo: candidate.photo || "",
    reviewedAt: candidate.reviewedAt || "",
    reviewStatus: candidate.reviewStatus || "pending",
    topicIds: Object.freeze(Array.isArray(candidate.topicIds) ? [...candidate.topicIds] : []),
    publication: Object.freeze({
      content: Object.freeze({ status: content.status || "pending", reviewedAt: content.reviewedAt || "" }),
      cardArt: Object.freeze({ status: cardArt.status || "missing", image: cardArt.image || "", version: cardArt.version || "" }),
      documentaryPhoto: Object.freeze({
        status: documentaryPhoto.status || "missing",
        image: documentaryPhoto.image || "",
        source: documentaryPhoto.source || "",
        license: documentaryPhoto.license || "",
      }),
    }),
  });
}

export function candidateContentFingerprint(candidate) {
  const publicContent = candidatePublicContent(candidate);
  const fingerprintedContent = {
    publicContent,
    routing: {
      group: candidate.group ?? null,
      area: candidate.area ?? null,
    },
  };
  return sha256Fingerprint(JSON.stringify(canonicalize(fingerprintedContent)));
}

export function assetApprovalFingerprint(asset) {
  if (!asset || !ASSET_KINDS.includes(asset.kind)) invalid("asset sem kind para fingerprint editorial");
  const approvalSnapshot = {
    candidateId: asset.candidateId ?? null,
    kind: asset.kind,
    path: asset.path ?? null,
    byteFingerprint: asset.fingerprint ?? null,
    ...(asset.kind === "cardArt"
      ? { version: asset.version ?? null }
      : { source: asset.source ?? null, license: asset.license ?? null }),
  };
  return sha256Fingerprint(JSON.stringify(canonicalize(approvalSnapshot)));
}

function validateCatalog(catalog) {
  if (!Array.isArray(catalog)) invalid("catálogo deve ser uma lista");
  const ids = new Set();
  for (const candidate of catalog) {
    if (!candidate || !nonEmpty(candidate.id) || !Number.isInteger(Number(candidate.personId))) {
      invalid("candidato sem id ou personId válido");
    }
    if (ids.has(candidate.id)) invalid(`candidato duplicado: ${candidate.id}`);
    ids.add(candidate.id);
  }
  return ids;
}

function validateBasis(basis, candidateId, dimension) {
  if (!Array.isArray(basis) || basis.length === 0) invalid(`${candidateId}.${dimension}.basis deve registrar evidência`);
  for (const item of basis) {
    if (!item || !nonEmpty(item.label) || !nonEmpty(item.reference)) {
      invalid(`${candidateId}.${dimension}.basis exige label e reference`);
    }
  }
}

function validateDecision(candidateId, dimension, decision, statuses) {
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) invalid(`${candidateId}.${dimension} deve ser um objeto`);
  if (!statuses.includes(decision.status)) invalid(`${candidateId}.${dimension}.status desconhecido`);
  if (!nonEmpty(decision.decidedBy)) invalid(`${candidateId}.${dimension}.decidedBy é obrigatório`);
  if (!validDate(decision.decidedAt)) invalid(`${candidateId}.${dimension}.decidedAt deve ser uma data YYYY-MM-DD válida`);
  validateBasis(decision.basis, candidateId, dimension);

  const missingAsset = dimension !== "content" && decision.status === "missing";
  if (missingAsset) {
    if (decision.fingerprint !== null && decision.fingerprint !== undefined) {
      invalid(`${candidateId}.${dimension}.missing não aceita fingerprint`);
    }
  } else if (!FINGERPRINT_PATTERN.test(String(decision.fingerprint || ""))) {
    invalid(`${candidateId}.${dimension}.fingerprint deve ser sha256`);
  }
}

function validateAssetRegistry(assetRegistry, candidateIds) {
  if (!assetRegistry || assetRegistry.schemaVersion !== 1 || !Array.isArray(assetRegistry.assets)) {
    invalid("asset registry deve usar schemaVersion 1 e assets[]");
  }
  const assets = new Map();
  for (const asset of assetRegistry.assets) {
    if (!asset || !candidateIds.has(asset.candidateId)) invalid(`asset referencia candidato desconhecido: ${asset?.candidateId || ""}`);
    if (!ASSET_KINDS.includes(asset.kind)) invalid(`asset ${asset.candidateId} tem kind desconhecido`);
    if (!LOCAL_ASSET_PATH_PATTERN.test(String(asset.path || ""))) {
      invalid(`asset ${asset.candidateId}.${asset.kind} tem path inseguro`);
    }
    if (!FINGERPRINT_PATTERN.test(String(asset.fingerprint || ""))) invalid(`asset ${asset.candidateId}.${asset.kind} não tem fingerprint sha256`);
    if (asset.kind === "cardArt" && !nonEmpty(asset.version)) invalid(`asset ${asset.candidateId}.cardArt não tem versão`);
    if (asset.kind === "documentaryPhoto" && (!nonEmpty(asset.source) || !nonEmpty(asset.license))) {
      invalid(`asset ${asset.candidateId}.documentaryPhoto exige fonte e licença`);
    }
    const key = `${asset.candidateId}:${asset.kind}`;
    if (assets.has(key)) invalid(`asset duplicado: ${key}`);
    assets.set(key, Object.freeze({ ...asset }));
  }
  return assets;
}

function validateLedger(ledger, candidateIds) {
  if (!ledger || ledger.schemaVersion !== 1 || !Array.isArray(ledger.decisions)) {
    invalid("ledger deve usar schemaVersion 1 e decisions[]");
  }
  const decisions = new Map();
  for (const entry of ledger.decisions) {
    if (!entry || !candidateIds.has(entry.candidateId)) invalid(`decisão referencia candidato desconhecido: ${entry?.candidateId || ""}`);
    if (decisions.has(entry.candidateId)) invalid(`decisão duplicada: ${entry.candidateId}`);
    if (entry.content) validateDecision(entry.candidateId, "content", entry.content, CONTENT_STATUSES);
    if (entry.cardArt) validateDecision(entry.candidateId, "cardArt", entry.cardArt, ASSET_STATUSES);
    if (entry.documentaryPhoto) validateDecision(entry.candidateId, "documentaryPhoto", entry.documentaryPhoto, ASSET_STATUSES);
    if (!entry.content && !entry.cardArt && !entry.documentaryPhoto) invalid(`decisão vazia: ${entry.candidateId}`);
    decisions.set(entry.candidateId, entry);
  }
  return decisions;
}

function auditOf(decision) {
  if (!decision) return null;
  return Object.freeze({
    decidedBy: decision.decidedBy,
    decidedAt: decision.decidedAt,
    basis: Object.freeze(decision.basis.map((item) => Object.freeze({ ...item }))),
  });
}

function resolveContent(candidate, decision) {
  const fingerprint = candidateContentFingerprint(candidate);
  const current = decision?.fingerprint === fingerprint;
  return Object.freeze({
    status: current ? decision.status : "pending",
    fingerprint,
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
  if (!current) {
    return Object.freeze({ status: "missing", invalidated: true, image: "", audit: null });
  }
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

export function createCandidateRegistry({ catalog, topics, ledger, assetRegistry }) {
  const candidateIds = validateCatalog(catalog);
  if (!Array.isArray(topics) || topics.some((topic) => !topic || !nonEmpty(topic.id))) invalid("topics deve ser uma lista válida");
  const topicsById = new Map(topics.map((topic) => [topic.id, topic]));
  if (topicsById.size !== topics.length) invalid("topic duplicado");
  const assets = validateAssetRegistry(assetRegistry, candidateIds);
  const decisions = validateLedger(ledger, candidateIds);

  const candidates = Object.freeze(catalog.map((person) => {
    const entry = decisions.get(person.id) || {};
    const publicContent = candidatePublicContent(person);
    const content = resolveContent(person, entry.content);
    const cardArt = resolveAsset("cardArt", entry.cardArt, assets.get(`${person.id}:cardArt`));
    const documentaryPhoto = resolveAsset("documentaryPhoto", entry.documentaryPhoto, assets.get(`${person.id}:documentaryPhoto`));
    const publication = Object.freeze({ content, cardArt, documentaryPhoto });
    return Object.freeze({
      ...person,
      ...publicContent,
      facts: Object.freeze(publicContent.facts),
      sources: Object.freeze(publicContent.sources),
      reviewStatus: content.status,
      reviewedAt: content.reviewedAt,
      cardArt: cardArt.image,
      photo: documentaryPhoto.image,
      publication,
      eligible: content.status === "approved" && cardArt.status === "approved",
      topicIds: Object.freeze(topicIdsFor(person)),
    });
  }));
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  const registry = {
    topics: Object.freeze(topics.map((topic) => Object.freeze({ ...topic }))),
    topicsById,
    candidates,
    candidatesById,
    candidatesForTopic(topicId) {
      if (!topicsById.get(topicId)?.active) return [];
      return candidates.filter((candidate) => candidate.eligible && candidate.topicIds.includes(topicId));
    },
    candidateBelongsToTopic(candidateId, topicId) {
      if (!topicsById.get(topicId)?.active) return false;
      const candidate = candidatesById.get(candidateId);
      return candidate?.eligible === true && candidate.topicIds.includes(topicId);
    },
  };
  return Object.freeze(registry);
}
