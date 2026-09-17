import { execFileSync } from "node:child_process";
import {
  candidateContentFingerprint,
  candidateRoutingFingerprint,
} from "./candidate-public.js";
import {
  EDITORIAL_ASSET_RULESET_V1,
  validateGovernancePolicy,
  validateStructuredEvidence,
} from "./editorial-attestation.js";
import { normalizedTextBlob, sha256Fingerprint, textBlobFingerprint } from "./editorial-integrity.js";
import { assetApprovalFingerprint } from "./editorial-gate.js";

const REGULAR_BLOB_MODES = new Set(["100644", "100755"]);

function parseJson(bytes, label) {
  try {
    return JSON.parse(normalizedTextBlob(bytes, label));
  } catch {
    throw new Error(`${label} não contém JSON válido`);
  }
}

export function sanitizedGitEnvironment(environment = process.env) {
  const sanitized = {};
  for (const [key, value] of Object.entries(environment)) {
    if (!key.toUpperCase().startsWith("GIT_")) sanitized[key] = value;
  }
  const nullDevice = process.platform === "win32" ? "NUL" : "/dev/null";
  return {
    ...sanitized,
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: nullDevice,
    GIT_CONFIG_SYSTEM: nullDevice,
    GIT_LITERAL_PATHSPECS: "1",
    GIT_OPTIONAL_LOCKS: "0",
  };
}

export function createGitReviewedStateVerifier({ repositoryRoot, runGit, environment = process.env } = {}) {
  const git = runGit || ((args, { encoding = null } = {}) => execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding,
    env: sanitizedGitEnvironment(environment),
    stdio: ["ignore", "pipe", "pipe"],
  }));
  const fileAt = (commit, repositoryPath) => git(["show", `${commit}:${repositoryPath}`]);
  const regularBlobAt = (commit, repositoryPath) => {
    const listing = git(["ls-tree", commit, "--", repositoryPath], { encoding: "utf8" }).trim();
    const lines = listing ? listing.split(/\r?\n/) : [];
    if (lines.length !== 1) throw new Error(`blob histórico ausente ou ambíguo: ${repositoryPath}`);
    const match = /^([0-7]{6}) (blob|tree|commit) ([a-f0-9]{40}|[a-f0-9]{64})\t(.+)$/.exec(lines[0]);
    if (!match || match[4] !== repositoryPath) throw new Error(`entrada Git histórica inválida: ${repositoryPath}`);
    const [, mode, type, oid] = match;
    if (type !== "blob" || !REGULAR_BLOB_MODES.has(mode)) {
      throw new Error(`modo Git não permitido para ${repositoryPath}: ${mode} ${type}`);
    }
    return { bytes: fileAt(commit, repositoryPath), oid, mode };
  };

  return (attestation) => {
    git(["cat-file", "-e", `${attestation.reviewedCommit}^{commit}`]);
    git(["merge-base", "--is-ancestor", attestation.reviewedCommit, "HEAD"]);

    const policyBlob = regularBlobAt(attestation.reviewedCommit, "shared/editorial-governance-policy.json");
    const reviewedPolicy = validateGovernancePolicy(parseJson(
      policyBlob.bytes,
      "política editorial no commit revisado",
    ));
    if (reviewedPolicy.attestationRuleset !== attestation.ruleset
      || !reviewedPolicy.declaredReviewers[attestation.dimension].includes(attestation.decidedBy)) {
      throw new Error("revisor declarado não corresponde à policy do commit revisado");
    }

    for (const evidence of attestation.evidence) {
      const evidenceBlob = regularBlobAt(attestation.reviewedCommit, evidence.path);
      if (evidenceBlob.oid !== evidence.gitBlob) throw new Error(`gitBlob diverge para ${evidence.path}`);
      if (textBlobFingerprint(evidenceBlob.bytes, evidence.path) !== evidence.blobSha256) {
        throw new Error(`blobSha256 diverge para ${evidence.path}`);
      }
      const structuredEvidence = validateStructuredEvidence(parseJson(
        evidenceBlob.bytes,
        `evidência histórica ${evidence.path}`,
      ), {
        candidateId: attestation.candidateId,
        dimension: attestation.dimension,
        attestation,
      });
      for (const reference of structuredEvidence.references) {
        const referenceBlob = regularBlobAt(attestation.reviewedCommit, reference.path);
        if (referenceBlob.oid !== reference.gitBlob) throw new Error(`gitBlob diverge para ${reference.path}`);
        if (textBlobFingerprint(referenceBlob.bytes, reference.path) !== reference.blobSha256) {
          throw new Error(`blobSha256 diverge para ${reference.path}`);
        }
      }
    }

    if (attestation.dimension === "content") {
      const catalogBlob = regularBlobAt(attestation.reviewedCommit, "shared/elections-2026.json");
      const catalog = parseJson(catalogBlob.bytes, "catálogo no commit revisado");
      const candidate = catalog.find(({ id }) => id === attestation.candidateId);
      if (!candidate) throw new Error("candidato ausente no commit revisado");
      if (candidateContentFingerprint(candidate, { ruleset: attestation.subject.ruleset }) !== attestation.subject.fingerprint
        || candidateRoutingFingerprint(candidate, { ruleset: attestation.subject.ruleset }) !== attestation.subject.routingFingerprint) {
        throw new Error("conteúdo ou roteamento diverge do commit revisado");
      }
      return true;
    }

    if (attestation.subject.ruleset !== EDITORIAL_ASSET_RULESET_V1) throw new Error("ruleset de asset desconhecido");
    if (attestation.status === "missing") return true;
    const registryBlob = regularBlobAt(attestation.reviewedCommit, "shared/editorial-asset-registry.json");
    const assetRegistry = parseJson(registryBlob.bytes, "asset registry no commit revisado");
    const asset = assetRegistry.assets?.find(({ candidateId, kind }) => (
      candidateId === attestation.candidateId && kind === attestation.dimension
    ));
    if (!asset || assetApprovalFingerprint(asset) !== attestation.subject.fingerprint) {
      throw new Error("asset diverge do commit revisado");
    }
    const assetBlob = regularBlobAt(attestation.reviewedCommit, `app/public${asset.path}`);
    if (sha256Fingerprint(assetBlob.bytes) !== asset.fingerprint) throw new Error("bytes do asset divergem do registry revisado");
    return true;
  };
}
