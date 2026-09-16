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
const FINGERPRINTED_ROUTING_FIELDS = Object.freeze(["group", "area"]);
const NON_AUTHORITATIVE_CATALOG_FIELDS = Object.freeze(["photo", "reviewStatus", "reviewedAt"]);
const KNOWN_CATALOG_FIELDS = new Set([
  ...PUBLIC_CANDIDATE_CONTENT_FIELDS,
  ...FINGERPRINTED_ROUTING_FIELDS,
  ...NON_AUTHORITATIVE_CATALOG_FIELDS,
]);
const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GITHUB_LOGIN_PATTERN = /^(?=.{1,39}$)(?!.*--)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
const LOCAL_ASSET_PATH_PATTERN = /^\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*$/;
const INVISIBLE_OR_CONTROL_PATTERN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/u;
const GOVERNANCE_TIME_ZONE = "America/Sao_Paulo";
const GOVERNANCE_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  timeZone: GOVERNANCE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function invalid(message) {
  throw new TypeError(`registro editorial inválido: ${message}`);
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function visibleText(value, { max = 500 } = {}) {
  return typeof value === "string"
    && value.trim().length > 0
    && value.length <= max
    && !INVISIBLE_OR_CONTROL_PATTERN.test(value);
}

function validEvidenceReference(value) {
  if (!visibleText(value, { max: 2_000 }) || /\s/u.test(value)) return false;
  if (/^https:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:"
        && Boolean(parsed.hostname)
        && !parsed.username
        && !parsed.password;
    } catch {
      return false;
    }
  }
  const [repoPath, fragment, ...extra] = value.split("#");
  if (extra.length || (!repoPath.includes("/") && !repoPath.includes("."))) return false;
  const segments = repoPath.split("/");
  if (repoPath.startsWith("/") || repoPath.includes("\\") || segments.some((segment) => (
    !segment || segment === "." || segment === ".." || !/^[A-Za-z0-9._-]+$/.test(segment)
  ))) return false;
  return fragment === undefined || /^[A-Za-z0-9._:-]+$/.test(fragment);
}

function immutableSnapshot(value, seen = new WeakSet()) {
  const valueType = typeof value;
  if (value === null || valueType === "string" || valueType === "boolean" || valueType === "undefined") return value;
  if (valueType === "number") {
    if (!Number.isFinite(value)) invalid("dados editoriais devem conter somente números finitos");
    return value;
  }
  if (valueType !== "object") invalid("dados editoriais devem conter somente valores JSON");
  if (seen.has(value)) invalid("dados editoriais não podem conter referências cíclicas");
  seen.add(value);
  let snapshot;
  if (Array.isArray(value)) {
    snapshot = value.map((item) => immutableSnapshot(item, seen));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) invalid("dados editoriais devem ser objetos JSON");
    snapshot = Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, immutableSnapshot(item, seen)]),
    );
  }
  seen.delete(value);
  return Object.freeze(snapshot);
}

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
  if (typeof now !== "function") invalid("clock deve ser uma função");
  const current = now();
  if (!(current instanceof Date) || Number.isNaN(current.valueOf())) invalid("clock deve retornar uma data válida");
  const parts = Object.fromEntries(
    GOVERNANCE_DATE_FORMATTER.formatToParts(current)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
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
  return immutableSnapshot(Object.fromEntries(
    PUBLIC_CANDIDATE_CONTENT_FIELDS.map((field) => [field, normalized[field]]),
  ));
}

export function candidatePublicPayload(candidate) {
  const publication = candidate.publication || {};
  const content = publication.content || {};
  const cardArt = publication.cardArt || {};
  const documentaryPhoto = publication.documentaryPhoto || {};
  return immutableSnapshot({
    ...candidatePublicContent(candidate),
    cardArt: candidate.cardArt || "",
    photo: candidate.photo || "",
    reviewedAt: candidate.reviewedAt || "",
    reviewStatus: candidate.reviewStatus || "pending",
    topicIds: Array.isArray(candidate.topicIds) ? [...candidate.topicIds] : [],
    publication: {
      content: { status: content.status || "pending", reviewedAt: content.reviewedAt || "" },
      cardArt: { status: cardArt.status || "missing", image: cardArt.image || "", version: cardArt.version || "" },
      documentaryPhoto: {
        status: documentaryPhoto.status || "missing",
        image: documentaryPhoto.image || "",
        source: documentaryPhoto.source || "",
        license: documentaryPhoto.license || "",
      },
    },
  });
}

export function candidateContentFingerprint(candidate) {
  const unknownField = Object.keys(candidate || {}).find((field) => !KNOWN_CATALOG_FIELDS.has(field));
  if (unknownField) invalid(`campo de catálogo sem política editorial: ${unknownField}`);
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
  const personIds = new Set();
  for (const candidate of catalog) {
    if (!candidate || !SLUG_PATTERN.test(String(candidate.id || "")) || !Number.isInteger(candidate.personId) || candidate.personId <= 0) {
      invalid("candidato sem id ou personId válido");
    }
    if (ids.has(candidate.id)) invalid(`candidato duplicado: ${candidate.id}`);
    if (personIds.has(candidate.personId)) invalid(`personId duplicado: ${candidate.personId}`);
    const unknownField = Object.keys(candidate).find((field) => !KNOWN_CATALOG_FIELDS.has(field));
    if (unknownField) invalid(`campo de catálogo sem política editorial: ${unknownField}`);
    ids.add(candidate.id);
    personIds.add(candidate.personId);
  }
  return ids;
}

function validateBasis(basis, candidateId, dimension) {
  if (!Array.isArray(basis) || basis.length === 0) invalid(`${candidateId}.${dimension}.basis deve registrar evidência`);
  for (const item of basis) {
    if (!item || !visibleText(item.label, { max: 200 })) invalid(`${candidateId}.${dimension}.basis.label deve ser texto visível`);
    if (!validEvidenceReference(item.reference)) invalid(`${candidateId}.${dimension}.basis.reference deve ser URL HTTPS ou caminho seguro do repositório`);
  }
}

function validateDecision(candidateId, dimension, decision, statuses, today) {
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) invalid(`${candidateId}.${dimension} deve ser um objeto`);
  if (!statuses.includes(decision.status)) invalid(`${candidateId}.${dimension}.status desconhecido`);
  if (!GITHUB_LOGIN_PATTERN.test(String(decision.decidedBy || ""))) {
    invalid(`${candidateId}.${dimension}.decidedBy deve ser um login GitHub válido`);
  }
  if (!validDate(decision.decidedAt)) invalid(`${candidateId}.${dimension}.decidedAt deve ser uma data YYYY-MM-DD válida`);
  if (decision.decidedAt > today) invalid(`${candidateId}.${dimension}.decidedAt não pode estar no futuro`);
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
    if (asset.kind === "cardArt" && !visibleText(asset.version, { max: 128 })) {
      invalid(`asset ${asset.candidateId}.cardArt exige versão visível`);
    }
    if (asset.kind === "documentaryPhoto" && (
      !visibleText(asset.source, { max: 1_000 }) || !visibleText(asset.license, { max: 1_000 })
    )) {
      invalid(`asset ${asset.candidateId}.documentaryPhoto exige fonte e licença visíveis`);
    }
    const key = `${asset.candidateId}:${asset.kind}`;
    if (assets.has(key)) invalid(`asset duplicado: ${key}`);
    assets.set(key, Object.freeze({ ...asset }));
  }
  return assets;
}

function validateLedger(ledger, candidateIds, today) {
  if (!ledger || ledger.schemaVersion !== 1 || !Array.isArray(ledger.decisions)) {
    invalid("ledger deve usar schemaVersion 1 e decisions[]");
  }
  const decisions = new Map();
  for (const entry of ledger.decisions) {
    if (!entry || !candidateIds.has(entry.candidateId)) invalid(`decisão referencia candidato desconhecido: ${entry?.candidateId || ""}`);
    if (decisions.has(entry.candidateId)) invalid(`decisão duplicada: ${entry.candidateId}`);
    if (entry.content) validateDecision(entry.candidateId, "content", entry.content, CONTENT_STATUSES, today);
    if (entry.cardArt) validateDecision(entry.candidateId, "cardArt", entry.cardArt, ASSET_STATUSES, today);
    if (entry.documentaryPhoto) validateDecision(entry.candidateId, "documentaryPhoto", entry.documentaryPhoto, ASSET_STATUSES, today);
    if (!entry.content && !entry.cardArt && !entry.documentaryPhoto) invalid(`decisão vazia: ${entry.candidateId}`);
    decisions.set(entry.candidateId, entry);
  }
  return decisions;
}

function auditOf(decision) {
  if (!decision) return null;
  return immutableSnapshot({
    decidedBy: decision.decidedBy,
    decidedAt: decision.decidedAt,
    basis: decision.basis,
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

export function createCandidateRegistry({ catalog, topics, ledger, assetRegistry, now = () => new Date() }) {
  const today = currentIsoDate(now);
  const catalogSnapshot = immutableSnapshot(catalog);
  const topicsSnapshot = immutableSnapshot(topics);
  const ledgerSnapshot = immutableSnapshot(ledger);
  const assetRegistrySnapshot = immutableSnapshot(assetRegistry);
  const candidateIds = validateCatalog(catalogSnapshot);
  if (!Array.isArray(topicsSnapshot) || topicsSnapshot.some((topic) => (
    !topic || !SLUG_PATTERN.test(String(topic.id || "")) || typeof topic.active !== "boolean"
  ))) invalid("topics deve ser uma lista válida");
  const internalTopicsById = new Map(topicsSnapshot.map((topic) => [topic.id, topic]));
  if (internalTopicsById.size !== topicsSnapshot.length) invalid("topic duplicado");
  const assets = validateAssetRegistry(assetRegistrySnapshot, candidateIds);
  const decisions = validateLedger(ledgerSnapshot, candidateIds, today);

  const candidates = Object.freeze(catalogSnapshot.map((person) => {
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
  const internalCandidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const topicsById = readonlyMapFacade(internalTopicsById);
  const candidatesById = readonlyMapFacade(internalCandidatesById);

  const registry = {
    topics: topicsSnapshot,
    topicsById,
    candidates,
    candidatesById,
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
