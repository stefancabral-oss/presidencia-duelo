import { createPublicKey, verify } from "node:crypto";
import {
  assertExactKeys,
  editorialInvalid,
  immutableJsonSnapshot,
  sha256Fingerprint,
  visibleText,
} from "./editorial-integrity.js";

export const EDITORIAL_AUTHORITY_REQUEST_RULESET_V1 = "editorial-authority-request-v1";
export const EDITORIAL_AUTHORITY_RECEIPT_RULESET_V1 = "editorial-authority-receipt-v1";

const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const GOVERNANCE_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function validInstant(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function validDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function governanceDate(date) {
  const parts = Object.fromEntries(
    GOVERNANCE_DATE_FORMATTER.formatToParts(date)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function approvalAuthorityRequest(attestation) {
  return immutableJsonSnapshot({
    schemaVersion: 1,
    ruleset: EDITORIAL_AUTHORITY_REQUEST_RULESET_V1,
    candidateId: attestation.candidateId,
    dimension: attestation.dimension,
    status: attestation.status,
    subject: attestation.subject,
    decidedBy: attestation.decidedBy,
    decidedAt: attestation.decidedAt,
    reviewedCommit: attestation.reviewedCommit,
    evidence: attestation.evidence,
  });
}

export function approvalAuthorityRequestFingerprint(attestation) {
  return sha256Fingerprint(JSON.stringify(approvalAuthorityRequest(attestation)));
}

export function authorityReceiptSigningPayload(receipt) {
  return immutableJsonSnapshot({
    schemaVersion: receipt.schemaVersion,
    ruleset: receipt.ruleset,
    issuer: receipt.issuer,
    keyId: receipt.keyId,
    requestFingerprint: receipt.requestFingerprint,
    authorizedAt: receipt.authorizedAt,
  });
}

function validateReceipt(receipt, { issuer, keyId, publicKey, now }) {
  assertExactKeys(receipt, [
    "schemaVersion",
    "ruleset",
    "issuer",
    "keyId",
    "requestFingerprint",
    "authorizedAt",
    "signature",
  ], "recibo de autoridade editorial");
  if (receipt.schemaVersion !== 1 || receipt.ruleset !== EDITORIAL_AUTHORITY_RECEIPT_RULESET_V1) {
    editorialInvalid("recibo de autoridade usa ruleset desconhecido");
  }
  if (receipt.issuer !== issuer || receipt.keyId !== keyId) {
    editorialInvalid("recibo de autoridade não pertence ao emissor/chave injetados");
  }
  if (!FINGERPRINT_PATTERN.test(receipt.requestFingerprint)) {
    editorialInvalid("recibo de autoridade exige requestFingerprint sha256");
  }
  if (!validInstant(receipt.authorizedAt)) editorialInvalid("recibo de autoridade exige authorizedAt UTC canônico");
  if (new Date(receipt.authorizedAt) > now) editorialInvalid("recibo de autoridade não pode ser autorizado no futuro");
  if (typeof receipt.signature !== "string" || !BASE64URL_PATTERN.test(receipt.signature)) {
    editorialInvalid("recibo de autoridade exige assinatura base64url");
  }
  const signature = Buffer.from(receipt.signature, "base64url");
  if (signature.length !== 64 || signature.toString("base64url") !== receipt.signature) {
    editorialInvalid("recibo de autoridade contém assinatura Ed25519 inválida");
  }
  const payload = Buffer.from(JSON.stringify(authorityReceiptSigningPayload(receipt)));
  if (!verify(null, payload, publicKey, signature)) {
    editorialInvalid("recibo de autoridade não foi assinado pela chave externa injetada");
  }
  return immutableJsonSnapshot(receipt);
}

export function createEd25519ApprovalAuthority({ publicKeyJwk, issuer, keyId, receipts, now = () => new Date() }) {
  assertExactKeys(publicKeyJwk, ["crv", "kty", "x"], "chave pública editorial externa");
  if (publicKeyJwk.kty !== "OKP" || publicKeyJwk.crv !== "Ed25519" || !visibleText(publicKeyJwk.x, { max: 100 })) {
    editorialInvalid("chave pública editorial deve ser JWK Ed25519 pública");
  }
  if (!visibleText(issuer, { max: 200 }) || !visibleText(keyId, { max: 200 })) {
    editorialInvalid("autoridade editorial externa exige issuer e keyId visíveis");
  }
  if (!Array.isArray(receipts)) editorialInvalid("recibos editoriais externos devem ser uma lista");
  if (typeof now !== "function") editorialInvalid("clock da autoridade editorial deve ser uma função");
  const current = now();
  if (!(current instanceof Date) || Number.isNaN(current.valueOf())) {
    editorialInvalid("clock da autoridade editorial deve retornar uma data válida");
  }
  let publicKey;
  try {
    publicKey = createPublicKey({ key: publicKeyJwk, format: "jwk" });
  } catch {
    editorialInvalid("chave pública editorial externa não é uma JWK válida");
  }
  if (publicKey.asymmetricKeyType !== "ed25519") editorialInvalid("chave pública editorial externa não é Ed25519");

  const receiptsByRequest = new Map();
  for (const candidateReceipt of receipts) {
    const receipt = validateReceipt(candidateReceipt, { issuer, keyId, publicKey, now: current });
    if (receiptsByRequest.has(receipt.requestFingerprint)) {
      editorialInvalid(`recibo editorial duplicado: ${receipt.requestFingerprint}`);
    }
    receiptsByRequest.set(receipt.requestFingerprint, receipt);
  }

  return Object.freeze((attestation) => {
    const receipt = receiptsByRequest.get(approvalAuthorityRequestFingerprint(attestation));
    if (!receipt || !validDate(attestation.decidedAt)) return false;
    if (governanceDate(new Date(receipt.authorizedAt)) < attestation.decidedAt) return false;
    return receipt;
  });
}

export function approvalAuthorityFromEnvironment(environment = process.env, { now } = {}) {
  const publicJwkText = environment.EDITORIAL_AUTHORITY_PUBLIC_JWK;
  const issuer = environment.EDITORIAL_AUTHORITY_ISSUER;
  const keyId = environment.EDITORIAL_AUTHORITY_KEY_ID;
  const receiptsText = environment.EDITORIAL_AUTHORITY_RECEIPTS;
  const supplied = [publicJwkText, issuer, keyId, receiptsText].filter((value) => typeof value === "string" && value.length > 0);
  if (supplied.length === 0) return null;
  if (supplied.length !== 4) editorialInvalid("configuração externa de autoridade editorial está incompleta");
  let publicKeyJwk;
  let receipts;
  try {
    publicKeyJwk = JSON.parse(publicJwkText);
    receipts = JSON.parse(receiptsText);
  } catch {
    editorialInvalid("configuração externa de autoridade editorial contém JSON inválido");
  }
  return createEd25519ApprovalAuthority({
    publicKeyJwk,
    issuer,
    keyId,
    receipts,
    ...(now === undefined ? {} : { now }),
  });
}
