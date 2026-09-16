import {
  PUBLIC_CANDIDATE_CONTENT_FIELDS_V1,
  PUBLIC_CANDIDATE_CONTENT_FIELDS_V2,
  PUBLIC_CANDIDATE_SCHEMA_V1,
  PUBLIC_CANDIDATE_SCHEMA_V2,
  candidateRoutingFingerprint,
} from "../src/editorial-gate.js";
import { textBlobFingerprint } from "../src/editorial-integrity.js";

export const TEST_REVIEWED_COMMIT = "1".repeat(40);
export const TEST_GIT_BLOB = "2".repeat(40);

export function testGovernancePolicy(reviewers = ["editor-humano", "fixture-automatizada"]) {
  return {
    schemaVersion: 2,
    attestationRuleset: "editorial-attestation-v1",
    declaredReviewers: {
      content: [...reviewers],
      cardArt: [...reviewers],
      documentaryPhoto: [...reviewers],
    },
  };
}

function reviewItemNames(dimension, contentRuleset) {
  if (dimension === "content") {
    return [
      ...(contentRuleset === PUBLIC_CANDIDATE_SCHEMA_V2
        ? PUBLIC_CANDIDATE_CONTENT_FIELDS_V2
        : PUBLIC_CANDIDATE_CONTENT_FIELDS_V1),
      "routing",
    ];
  }
  return dimension === "cardArt"
    ? ["candidate-identity", "visual-review", "usage-rights"]
    : ["candidate-identity", "source", "license"];
}

function verdictFor(status, index) {
  if (status === "approved") return "verified";
  if (status === "pending" || status === "missing") return "unavailable";
  return index === 0 ? "rejected" : "verified";
}

export function attachTestAttestations(input, {
  contentRuleset = PUBLIC_CANDIDATE_SCHEMA_V1,
  governancePolicy = testGovernancePolicy(),
  reviewedCommit = TEST_REVIEWED_COMMIT,
} = {}) {
  const catalog = structuredClone(input.catalog);
  const topics = structuredClone(input.topics);
  const assetRegistry = structuredClone(input.assetRegistry);
  const ledger = structuredClone(input.ledger);
  const candidatesById = new Map(catalog.map((candidate) => [candidate.id, candidate]));
  const repositoryFiles = new Map();

  for (const entry of ledger.decisions) {
    for (const dimension of ["content", "cardArt", "documentaryPhoto"]) {
      const decision = entry[dimension];
      if (!decision) continue;
      if (dimension === "content" && !decision.routingFingerprint) {
        decision.routingFingerprint = candidateRoutingFingerprint(candidatesById.get(entry.candidateId), { ruleset: contentRuleset });
      }
      const evidencePath = `shared/editorial-evidence/${entry.candidateId}/${dimension}/review.json`;
      const referencePath = `shared/editorial-evidence/${entry.candidateId}/${dimension}/references/fixture.txt`;
      const referenceText = `Referência imutável de teste para ${entry.candidateId}.${dimension}.\n`;
      repositoryFiles.set(referencePath, referenceText);
      const attestation = {
        schemaVersion: 1,
        ruleset: "editorial-attestation-v1",
        candidateId: entry.candidateId,
        dimension,
        status: decision.status,
        subject: {
          ruleset: dimension === "content" ? contentRuleset : "editorial-asset-v1",
          fingerprint: decision.fingerprint,
          routingFingerprint: dimension === "content" ? decision.routingFingerprint : null,
        },
        decidedBy: decision.decidedBy,
        decidedAt: decision.decidedAt,
        reviewedCommit,
        evidence: [],
      };
      const structuredEvidence = {
        schemaVersion: 1,
        ruleset: "editorial-evidence-v1",
        candidateId: entry.candidateId,
        dimension,
        decision: {
          status: decision.status,
          ruleset: attestation.subject.ruleset,
          fingerprint: attestation.subject.fingerprint,
          routingFingerprint: attestation.subject.routingFingerprint,
        },
        reviewedItems: reviewItemNames(dimension, contentRuleset).map((item, index) => ({
          item,
          verdict: verdictFor(decision.status, index),
          note: `Revisão estruturada de fixture: ${item}.`,
        })),
        references: [{
          label: `Referência ${dimension}`,
          sourceUrl: null,
          path: referencePath,
          blobSha256: textBlobFingerprint(referenceText, referencePath),
          gitBlob: TEST_GIT_BLOB,
        }],
      };
      const evidenceText = `${JSON.stringify(structuredEvidence, null, 2)}\n`;
      repositoryFiles.set(evidencePath, evidenceText);
      attestation.evidence.push({
        label: `Evidência ${dimension}`,
        path: evidencePath,
        blobSha256: textBlobFingerprint(evidenceText, evidencePath),
        gitBlob: TEST_GIT_BLOB,
      });
      const attestationPath = `shared/editorial-attestations/${entry.candidateId}/${dimension}.json`;
      const attestationText = `${JSON.stringify(attestation, null, 2)}\n`;
      repositoryFiles.set(attestationPath, attestationText);
      decision.attestation = {
        path: attestationPath,
        blobSha256: textBlobFingerprint(attestationText, attestationPath),
      };
    }
  }

  return {
    catalog,
    topics,
    assetRegistry,
    ledger,
    governancePolicy: structuredClone(governancePolicy),
    contentRuleset,
    repositoryFiles,
    loadRepositoryFile(path) {
      if (!repositoryFiles.has(path)) throw new Error(`fixture ausente: ${path}`);
      return repositoryFiles.get(path);
    },
    statRepositoryFile(path) {
      if (!repositoryFiles.has(path)) throw new Error(`fixture ausente: ${path}`);
      return { isFile: true, isSymbolicLink: false, mode: 0o644 };
    },
  };
}
