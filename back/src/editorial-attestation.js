import {
  assertExactKeys,
  editorialInvalid,
  immutableJsonSnapshot,
  normalizedTextBlob,
  safeRepositoryPath,
  textBlobFingerprint,
  visibleText,
} from "./editorial-integrity.js";
import { PUBLIC_CANDIDATE_SCHEMA_V1, PUBLIC_CANDIDATE_SCHEMA_V2 } from "./candidate-public.js";

export const EDITORIAL_ATTESTATION_RULESET_V1 = "editorial-attestation-v1";
export const EDITORIAL_ASSET_RULESET_V1 = "editorial-asset-v1";

const DIMENSIONS = Object.freeze(["content", "cardArt", "documentaryPhoto"]);
const CONTENT_STATUSES = new Set(["pending", "approved", "rejected"]);
const ASSET_STATUSES = new Set(["missing", "approved", "rejected"]);
const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/;
const GIT_OBJECT_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const GITHUB_LOGIN_PATTERN = /^(?=.{1,39}$)(?!.*--)[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EVIDENCE_UNSAFE_TEXT_PATTERN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const MAX_EVIDENCE_TEXT_LENGTH = 1_000_000;

function validDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function readRepositoryText(loadRepositoryFile, path, label) {
  if (typeof loadRepositoryFile !== "function") editorialInvalid(`${label} não pode ser verificado sem leitor do repositório`);
  let bytes;
  try {
    bytes = loadRepositoryFile(path);
  } catch {
    editorialInvalid(`${label} não existe no repositório: ${path}`);
  }
  if (bytes === undefined || bytes === null) editorialInvalid(`${label} não existe no repositório: ${path}`);
  return normalizedTextBlob(bytes, label);
}

export function validateGovernancePolicy(policy) {
  assertExactKeys(policy, ["schemaVersion", "attestationRuleset", "authorizedReviewers"], "política editorial");
  if (policy.schemaVersion !== 1 || policy.attestationRuleset !== EDITORIAL_ATTESTATION_RULESET_V1) {
    editorialInvalid("política editorial deve usar schemaVersion 1 e editorial-attestation-v1");
  }
  assertExactKeys(policy.authorizedReviewers, DIMENSIONS, "política editorial.authorizedReviewers");
  for (const dimension of DIMENSIONS) {
    const reviewers = policy.authorizedReviewers[dimension];
    if (!Array.isArray(reviewers) || reviewers.length === 0) {
      editorialInvalid(`política editorial.${dimension} deve autorizar ao menos um revisor`);
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
  if (!governancePolicy.authorizedReviewers[dimension].includes(decision.decidedBy)) {
    editorialInvalid(`${candidateId}.${dimension}.decidedBy não está autorizado pela política versionada`);
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
  if (!Array.isArray(attestation.evidence) || attestation.evidence.length === 0) {
    editorialInvalid(`${candidateId}.${dimension}.attestation.evidence deve registrar prova interna`);
  }
}

function validateEvidenceFiles({ candidateId, dimension, attestation, loadRepositoryFile }) {
  const seenPaths = new Set();
  const expectedPrefix = `shared/editorial-evidence/${candidateId}/${dimension}/`;
  for (const [index, evidence] of attestation.evidence.entries()) {
    const label = `${candidateId}.${dimension}.attestation.evidence[${index}]`;
    assertExactKeys(evidence, ["label", "path", "blobSha256", "gitBlob"], label);
    if (!visibleText(evidence.label, { max: 200 })) editorialInvalid(`${label}.label deve ser texto visível`);
    if (!safeRepositoryPath(evidence.path, { prefix: expectedPrefix, extensions: [".md", ".json", ".txt"] })) {
      editorialInvalid(`${label}.path deve apontar para evidência textual interna de ${candidateId}.${dimension}`);
    }
    if (seenPaths.has(evidence.path)) editorialInvalid(`${label}.path duplicado`);
    seenPaths.add(evidence.path);
    if (!FINGERPRINT_PATTERN.test(evidence.blobSha256) || !GIT_OBJECT_PATTERN.test(evidence.gitBlob)) {
      editorialInvalid(`${label} exige blobSha256 e gitBlob válidos`);
    }
    const currentEvidence = readRepositoryText(loadRepositoryFile, evidence.path, label);
    const evidenceBody = currentEvidence.replace(/[\n\t]/g, "");
    if (!evidenceBody.trim()
      || currentEvidence.length > MAX_EVIDENCE_TEXT_LENGTH
      || EVIDENCE_UNSAFE_TEXT_PATTERN.test(evidenceBody)) {
      editorialInvalid(`${label} deve conter evidência textual visível e segura`);
    }
    if (textBlobFingerprint(currentEvidence, label) !== evidence.blobSha256) {
      editorialInvalid(`${label}.blobSha256 não corresponde ao arquivo existente`);
    }
  }
}

export function validateDecisionAttestation({
  candidateId,
  dimension,
  decision,
  today,
  governancePolicy,
  contentRuleset,
  loadRepositoryFile,
  verifyReviewedState,
}) {
  validateDecisionShape(candidateId, dimension, decision, today);
  const attestationText = readRepositoryText(loadRepositoryFile, decision.attestation.path, `${candidateId}.${dimension}.attestation`);
  if (textBlobFingerprint(attestationText, `${candidateId}.${dimension}.attestation`) !== decision.attestation.blobSha256) {
    editorialInvalid(`${candidateId}.${dimension}.attestation.blobSha256 não corresponde ao arquivo existente`);
  }
  let attestation;
  try {
    attestation = JSON.parse(attestationText);
  } catch {
    editorialInvalid(`${candidateId}.${dimension}.attestation não contém JSON válido`);
  }
  validateAttestationRecord({ candidateId, dimension, decision, attestation, governancePolicy, contentRuleset });
  validateEvidenceFiles({ candidateId, dimension, attestation, loadRepositoryFile });
  if (verifyReviewedState) {
    try {
      if (verifyReviewedState(immutableJsonSnapshot(attestation)) === false) throw new Error("rejeitado");
    } catch (error) {
      editorialInvalid(`${candidateId}.${dimension}.attestation não foi comprovada no commit revisado: ${error.message}`);
    }
  }
  return immutableJsonSnapshot(attestation);
}
