import {
  PUBLIC_CANDIDATE_CONTENT_FIELDS_V1,
  PUBLIC_CANDIDATE_CONTENT_FIELDS_V2,
  PUBLIC_CANDIDATE_SCHEMA_V1,
  PUBLIC_CANDIDATE_SCHEMA_V2,
} from "./candidate-public.js";
import {
  assertExactKeys,
  editorialInvalid,
  immutableJsonSnapshot,
  normalizedTextBlob,
  safeRepositoryPath,
  textBlobFingerprint,
  visibleText,
} from "./editorial-integrity.js";

export const EDITORIAL_ATTESTATION_RULESET_V1 = "editorial-attestation-v1";
export const EDITORIAL_ASSET_RULESET_V1 = "editorial-asset-v1";
export const EDITORIAL_EVIDENCE_RULESET_V1 = "editorial-evidence-v1";

const DIMENSIONS = Object.freeze(["content", "cardArt", "documentaryPhoto"]);
const CONTENT_STATUSES = new Set(["pending", "approved", "rejected"]);
const ASSET_STATUSES = new Set(["missing", "approved", "rejected"]);
const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/;
const GIT_OBJECT_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const GITHUB_LOGIN_PATTERN = /^(?=.{1,39}$)(?!.*--)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EVIDENCE_UNSAFE_TEXT_PATTERN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const MAX_EVIDENCE_TEXT_LENGTH = 1_000_000;
const MAX_REFERENCE_TEXT_LENGTH = 5_000_000;
const MIN_REVIEW_NOTE_LENGTH = 12;
const MIN_REFERENCE_TEXT_LENGTH = 20;
const MIN_SUBSTANTIVE_WORDS = 3;
const ASSET_REVIEW_ITEMS = Object.freeze({
  cardArt: Object.freeze(["candidate-identity", "visual-review", "usage-rights"]),
  documentaryPhoto: Object.freeze(["candidate-identity", "source", "license"]),
});
const REVIEW_VERDICTS = new Set(["verified", "rejected", "unavailable"]);

function validDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function assertRegularRepositoryFile(statRepositoryFile, path, label) {
  if (typeof statRepositoryFile !== "function") {
    editorialInvalid(`${label} não pode ser verificado sem metadados do repositório`);
  }
  let metadata;
  try {
    metadata = statRepositoryFile(path);
  } catch {
    editorialInvalid(`${label} não existe no repositório: ${path}`);
  }
  if (!metadata || metadata.isFile !== true || metadata.isSymbolicLink === true) {
    editorialInvalid(`${label} deve ser arquivo regular, nunca symlink: ${path}`);
  }
}

function readRepositoryText(loadRepositoryFile, statRepositoryFile, path, label) {
  if (typeof loadRepositoryFile !== "function") editorialInvalid(`${label} não pode ser verificado sem leitor do repositório`);
  assertRegularRepositoryFile(statRepositoryFile, path, label);
  let bytes;
  try {
    bytes = loadRepositoryFile(path);
  } catch {
    editorialInvalid(`${label} não existe no repositório: ${path}`);
  }
  if (bytes === undefined || bytes === null) editorialInvalid(`${label} não existe no repositório: ${path}`);
  return normalizedTextBlob(bytes, label);
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    editorialInvalid(`${label} não contém JSON válido`);
  }
}

function validateHttpsUrl(value, label) {
  if (!visibleText(value, { max: 2_000 }) || /\s/u.test(value)) editorialInvalid(`${label} deve ser URL HTTPS segura`);
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) throw new Error("unsafe");
  } catch {
    editorialInvalid(`${label} deve ser URL HTTPS segura`);
  }
}

function substantiveText(value, { minLength, max }) {
  if (!visibleText(value, { max })) return false;
  const trimmed = value.trim();
  const words = trimmed.match(/[\p{L}\p{N}]+/gu) || [];
  return trimmed.length >= minLength && words.length >= MIN_SUBSTANTIVE_WORDS;
}

export function validateGovernancePolicy(policy) {
  assertExactKeys(policy, ["schemaVersion", "attestationRuleset", "declaredReviewers"], "política editorial declarativa");
  if (policy.schemaVersion !== 2 || policy.attestationRuleset !== EDITORIAL_ATTESTATION_RULESET_V1) {
    editorialInvalid("política editorial declarativa deve usar schemaVersion 2 e editorial-attestation-v1");
  }
  assertExactKeys(policy.declaredReviewers, DIMENSIONS, "política editorial.declaredReviewers");
  for (const dimension of DIMENSIONS) {
    const reviewers = policy.declaredReviewers[dimension];
    if (!Array.isArray(reviewers) || reviewers.length === 0) {
      editorialInvalid(`política editorial.${dimension} deve declarar ao menos um revisor`);
    }
    if (new Set(reviewers).size !== reviewers.length || reviewers.some((reviewer) => !GITHUB_LOGIN_PATTERN.test(reviewer))) {
      editorialInvalid(`política editorial.${dimension} contém login inválido ou duplicado`);
    }
  }
  return immutableJsonSnapshot(policy);
}

function expectedDecisionKeys(dimension) {
  return dimension === "content"
    ? ["status", "fingerprint", "routingFingerprint", "decidedBy", "decidedAt", "attestation"]
    : ["status", "fingerprint", "decidedBy", "decidedAt", "attestation"];
}

function validateDecisionShape(candidateId, dimension, decision, today) {
  assertExactKeys(decision, expectedDecisionKeys(dimension), `${candidateId}.${dimension}`);
  const statuses = dimension === "content" ? CONTENT_STATUSES : ASSET_STATUSES;
  if (!statuses.has(decision.status)) editorialInvalid(`${candidateId}.${dimension}.status desconhecido`);
  if (!GITHUB_LOGIN_PATTERN.test(decision.decidedBy)) {
    editorialInvalid(`${candidateId}.${dimension}.decidedBy deve ser um login GitHub válido`);
  }
  if (!validDate(decision.decidedAt)) editorialInvalid(`${candidateId}.${dimension}.decidedAt deve ser uma data YYYY-MM-DD válida`);
  if (decision.decidedAt > today) editorialInvalid(`${candidateId}.${dimension}.decidedAt não pode estar no futuro`);
  const missingAsset = dimension !== "content" && decision.status === "missing";
  if (missingAsset) {
    if (decision.fingerprint !== null) editorialInvalid(`${candidateId}.${dimension}.missing exige fingerprint null`);
  } else if (!FINGERPRINT_PATTERN.test(decision.fingerprint)) {
    editorialInvalid(`${candidateId}.${dimension}.fingerprint deve ser sha256`);
  }
  if (dimension === "content" && !FINGERPRINT_PATTERN.test(decision.routingFingerprint)) {
    editorialInvalid(`${candidateId}.content.routingFingerprint deve ser sha256`);
  }
  assertExactKeys(decision.attestation, ["path", "blobSha256"], `${candidateId}.${dimension}.attestation`);
  const expectedPath = `shared/editorial-attestations/${candidateId}/${dimension}.json`;
  if (decision.attestation.path !== expectedPath) {
    editorialInvalid(`${candidateId}.${dimension}.attestation deve usar ${expectedPath}`);
  }
  if (!FINGERPRINT_PATTERN.test(decision.attestation.blobSha256)) {
    editorialInvalid(`${candidateId}.${dimension}.attestation.blobSha256 deve ser sha256`);
  }
}

function validateAttestationRecord({ candidateId, dimension, decision, attestation, governancePolicy, contentRuleset }) {
  assertExactKeys(attestation, [
    "schemaVersion",
    "ruleset",
    "candidateId",
    "dimension",
    "status",
    "subject",
    "decidedBy",
    "decidedAt",
    "reviewedCommit",
    "evidence",
  ], `${candidateId}.${dimension}.attestation record`);
  if (attestation.schemaVersion !== 1 || attestation.ruleset !== governancePolicy.attestationRuleset) {
    editorialInvalid(`${candidateId}.${dimension}.attestation usa ruleset desconhecido`);
  }
  for (const field of ["candidateId", "dimension", "status", "decidedBy", "decidedAt"]) {
    if (attestation[field] !== (field === "candidateId" ? candidateId : field === "dimension" ? dimension : decision[field])) {
      editorialInvalid(`${candidateId}.${dimension}.attestation não corresponde a ${field}`);
    }
  }
  if (!governancePolicy.declaredReviewers[dimension].includes(decision.decidedBy)) {
    editorialInvalid(`${candidateId}.${dimension}.decidedBy não consta como revisor declarado na política versionada`);
  }
  if (!GIT_OBJECT_PATTERN.test(attestation.reviewedCommit)) {
    editorialInvalid(`${candidateId}.${dimension}.attestation.reviewedCommit deve ser SHA completo`);
  }
  assertExactKeys(attestation.subject, ["ruleset", "fingerprint", "routingFingerprint"], `${candidateId}.${dimension}.attestation.subject`);
  const expectedSubjectRuleset = dimension === "content" ? contentRuleset : EDITORIAL_ASSET_RULESET_V1;
  if (attestation.subject.ruleset !== expectedSubjectRuleset
    || attestation.subject.fingerprint !== decision.fingerprint
    || attestation.subject.routingFingerprint !== (dimension === "content" ? decision.routingFingerprint : null)) {
    editorialInvalid(`${candidateId}.${dimension}.attestation.subject diverge da decisão`);
  }
  if (![PUBLIC_CANDIDATE_SCHEMA_V1, PUBLIC_CANDIDATE_SCHEMA_V2].includes(contentRuleset)) {
    editorialInvalid(`ruleset de conteúdo desconhecido: ${contentRuleset}`);
  }
  if (!Array.isArray(attestation.evidence) || attestation.evidence.length !== 1) {
    editorialInvalid(`${candidateId}.${dimension}.attestation.evidence deve conter exatamente um registro estruturado`);
  }
}

function requiredReviewItems(dimension, subjectRuleset) {
  if (dimension === "content") {
    const fields = subjectRuleset === PUBLIC_CANDIDATE_SCHEMA_V1
      ? PUBLIC_CANDIDATE_CONTENT_FIELDS_V1
      : PUBLIC_CANDIDATE_CONTENT_FIELDS_V2;
    return [...fields, "routing"];
  }
  return ASSET_REVIEW_ITEMS[dimension];
}

function validateReferenceShape(reference, { candidateId, dimension, index }) {
  const label = `${candidateId}.${dimension}.evidence.references[${index}]`;
  assertExactKeys(reference, ["label", "sourceUrl", "path", "blobSha256", "gitBlob"], label);
  if (!visibleText(reference.label, { max: 200 })) editorialInvalid(`${label}.label deve ser texto visível`);
  if (reference.sourceUrl !== null) validateHttpsUrl(reference.sourceUrl, `${label}.sourceUrl`);
  const prefix = `shared/editorial-evidence/${candidateId}/${dimension}/references/`;
  if (!safeRepositoryPath(reference.path, { prefix, extensions: [".md", ".json", ".txt"] })) {
    editorialInvalid(`${label}.path deve apontar para captura interna no escopo exato da decisão`);
  }
  if (!FINGERPRINT_PATTERN.test(reference.blobSha256) || !GIT_OBJECT_PATTERN.test(reference.gitBlob)) {
    editorialInvalid(`${label} exige blobSha256 e gitBlob válidos`);
  }
}

export function validateStructuredEvidence(record, { candidateId, dimension, attestation }) {
  const label = `${candidateId}.${dimension}.evidence`;
  assertExactKeys(record, [
    "schemaVersion",
    "ruleset",
    "candidateId",
    "dimension",
    "decision",
    "reviewedItems",
    "references",
  ], label);
  if (record.schemaVersion !== 1 || record.ruleset !== EDITORIAL_EVIDENCE_RULESET_V1) {
    editorialInvalid(`${label} deve usar editorial-evidence-v1`);
  }
  if (record.candidateId !== candidateId || record.dimension !== dimension) {
    editorialInvalid(`${label} não está ligado ao candidato/dimensão da atestação`);
  }
  assertExactKeys(record.decision, ["status", "ruleset", "fingerprint", "routingFingerprint"], `${label}.decision`);
  if (record.decision.status !== attestation.status
    || record.decision.ruleset !== attestation.subject.ruleset
    || record.decision.fingerprint !== attestation.subject.fingerprint
    || record.decision.routingFingerprint !== attestation.subject.routingFingerprint) {
    editorialInvalid(`${label}.decision diverge do sujeito atestado`);
  }

  const expectedItems = requiredReviewItems(dimension, attestation.subject.ruleset);
  if (!Array.isArray(record.reviewedItems) || record.reviewedItems.length !== expectedItems.length) {
    editorialInvalid(`${label}.reviewedItems deve cobrir exatamente os itens obrigatórios`);
  }
  const verdicts = [];
  for (const [index, item] of record.reviewedItems.entries()) {
    const itemLabel = `${label}.reviewedItems[${index}]`;
    assertExactKeys(item, ["item", "verdict", "note"], itemLabel);
    if (item.item !== expectedItems[index]) editorialInvalid(`${itemLabel}.item fora da ordem/allowlist obrigatória`);
    if (!REVIEW_VERDICTS.has(item.verdict)) editorialInvalid(`${itemLabel}.verdict desconhecido`);
    if (!substantiveText(item.note, { minLength: MIN_REVIEW_NOTE_LENGTH, max: 2_000 })) {
      editorialInvalid(`${itemLabel}.note deve ser texto substantivo e visível`);
    }
    verdicts.push(item.verdict);
  }
  if (attestation.status === "approved" && verdicts.some((verdict) => verdict !== "verified")) {
    editorialInvalid(`${label} aprovado exige todos os itens verified`);
  }
  if (["pending", "missing"].includes(attestation.status) && verdicts.some((verdict) => verdict !== "unavailable")) {
    editorialInvalid(`${label} pendente/ausente exige todos os itens unavailable`);
  }
  if (attestation.status === "rejected" && !verdicts.includes("rejected")) {
    editorialInvalid(`${label} rejeitado exige ao menos um item rejected`);
  }

  if (!Array.isArray(record.references) || record.references.length === 0) {
    editorialInvalid(`${label}.references deve conter ao menos uma referência capturada e verificável`);
  }
  const referencePaths = new Set();
  for (const [index, reference] of record.references.entries()) {
    validateReferenceShape(reference, { candidateId, dimension, index });
    if (referencePaths.has(reference.path)) editorialInvalid(`${label}.references contém path duplicado`);
    referencePaths.add(reference.path);
  }
  return immutableJsonSnapshot(record);
}

function validateReferenceFiles({ structuredEvidence, candidateId, dimension, loadRepositoryFile, statRepositoryFile }) {
  for (const [index, reference] of structuredEvidence.references.entries()) {
    const label = `${candidateId}.${dimension}.evidence.references[${index}]`;
    const referenceText = readRepositoryText(loadRepositoryFile, statRepositoryFile, reference.path, label);
    const body = referenceText.replace(/[\n\t]/g, "");
    if (!substantiveText(body, { minLength: MIN_REFERENCE_TEXT_LENGTH, max: MAX_REFERENCE_TEXT_LENGTH })
      || referenceText.length > MAX_REFERENCE_TEXT_LENGTH
      || EVIDENCE_UNSAFE_TEXT_PATTERN.test(body)) {
      editorialInvalid(`${label} deve conter captura textual substantiva e segura`);
    }
    if (textBlobFingerprint(referenceText, label) !== reference.blobSha256) {
      editorialInvalid(`${label}.blobSha256 não corresponde à captura existente`);
    }
  }
}

function validateEvidenceFile({ candidateId, dimension, attestation, loadRepositoryFile, statRepositoryFile }) {
  const evidence = attestation.evidence[0];
  const label = `${candidateId}.${dimension}.attestation.evidence[0]`;
  assertExactKeys(evidence, ["label", "path", "blobSha256", "gitBlob"], label);
  if (!visibleText(evidence.label, { max: 200 })) editorialInvalid(`${label}.label deve ser texto visível`);
  const expectedPrefix = `shared/editorial-evidence/${candidateId}/${dimension}/`;
  if (!safeRepositoryPath(evidence.path, { prefix: expectedPrefix, extensions: [".json"] })
    || evidence.path.startsWith(`${expectedPrefix}references/`)) {
    editorialInvalid(`${label}.path deve apontar para o registro JSON estruturado da decisão`);
  }
  if (!FINGERPRINT_PATTERN.test(evidence.blobSha256) || !GIT_OBJECT_PATTERN.test(evidence.gitBlob)) {
    editorialInvalid(`${label} exige blobSha256 e gitBlob válidos`);
  }
  const evidenceText = readRepositoryText(loadRepositoryFile, statRepositoryFile, evidence.path, label);
  if (evidenceText.length > MAX_EVIDENCE_TEXT_LENGTH) editorialInvalid(`${label} excede o limite de tamanho`);
  if (textBlobFingerprint(evidenceText, label) !== evidence.blobSha256) {
    editorialInvalid(`${label}.blobSha256 não corresponde ao arquivo existente`);
  }
  const structuredEvidence = validateStructuredEvidence(parseJson(evidenceText, label), {
    candidateId,
    dimension,
    attestation,
  });
  validateReferenceFiles({ structuredEvidence, candidateId, dimension, loadRepositoryFile, statRepositoryFile });
}

export function validateDecisionAttestation({
  candidateId,
  dimension,
  decision,
  today,
  governancePolicy,
  contentRuleset,
  loadRepositoryFile,
  statRepositoryFile,
  verifyReviewedState,
}) {
  validateDecisionShape(candidateId, dimension, decision, today);
  const attestationLabel = `${candidateId}.${dimension}.attestation`;
  const attestationText = readRepositoryText(
    loadRepositoryFile,
    statRepositoryFile,
    decision.attestation.path,
    attestationLabel,
  );
  if (textBlobFingerprint(attestationText, attestationLabel) !== decision.attestation.blobSha256) {
    editorialInvalid(`${attestationLabel}.blobSha256 não corresponde ao arquivo existente`);
  }
  const attestation = parseJson(attestationText, attestationLabel);
  validateAttestationRecord({ candidateId, dimension, decision, attestation, governancePolicy, contentRuleset });
  validateEvidenceFile({ candidateId, dimension, attestation, loadRepositoryFile, statRepositoryFile });
  if (verifyReviewedState) {
    try {
      if (verifyReviewedState(immutableJsonSnapshot(attestation)) === false) throw new Error("rejeitado");
    } catch (error) {
      editorialInvalid(`${attestationLabel} não foi comprovada no commit revisado: ${error.message}`);
    }
  }
  return immutableJsonSnapshot(attestation);
}
