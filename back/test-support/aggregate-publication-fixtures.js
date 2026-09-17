import { generateKeyPairSync, sign } from "node:crypto";
import {
  AGGREGATE_AUTHORITY_RECEIPT_RULESET,
  AGGREGATE_CONTROLS_FINGERPRINT,
  AGGREGATE_COPY_POLICY_FINGERPRINT,
  AGGREGATE_PUBLICATION_SCOPES,
  aggregateReceiptSigningPayload,
  createAggregatePublicationAuthority,
} from "../src/aggregate-publication.js";

export function authorizedAggregatePublication({
  scopes = AGGREGATE_PUBLICATION_SCOPES,
  now = new Date("2026-09-16T12:00:00.000Z"),
  environment = "test",
  releaseRevision = "e".repeat(40),
} = {}) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const issuer = "test-external-authority";
  const keyId = "test-key-1";
  const receipts = scopes.map((scope, index) => {
    const receipt = {
      schemaVersion: 1,
      ruleset: AGGREGATE_AUTHORITY_RECEIPT_RULESET,
      issuer,
      keyId,
      decisionId: `test-decision-${index + 1}`,
      environment,
      subject: "eleicoes-2026",
      scope,
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2027-01-01T00:00:00.000Z",
      authorizedAt: "2025-12-31T12:00:00.000Z",
      controlsFingerprint: AGGREGATE_CONTROLS_FINGERPRINT,
      copyPolicyFingerprint: AGGREGATE_COPY_POLICY_FINGERPRINT,
      releaseRevision,
      signature: "pending",
    };
    receipt.signature = sign(
      null,
      Buffer.from(JSON.stringify(aggregateReceiptSigningPayload(receipt))),
      privateKey,
    ).toString("base64url");
    return receipt;
  });
  return createAggregatePublicationAuthority({
    publicKeyJwk: publicKey.export({ format: "jwk" }),
    issuer,
    keyId,
    receipts,
    environment,
    releaseRevision,
    now: () => new Date(now),
  });
}
