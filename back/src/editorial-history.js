import { execFileSync } from "node:child_process";
import {
  candidateContentFingerprint,
  candidateRoutingFingerprint,
} from "./candidate-public.js";
import { EDITORIAL_ASSET_RULESET_V1, validateGovernancePolicy } from "./editorial-attestation.js";
import { normalizedTextBlob, sha256Fingerprint, textBlobFingerprint } from "./editorial-integrity.js";
import { assetApprovalFingerprint } from "./editorial-gate.js";

function parseJson(bytes, label) {
  try {
    return JSON.parse(normalizedTextBlob(bytes, label));
  } catch {
    throw new Error(`${label} não contém JSON válido`);
  }
}

export function createGitReviewedStateVerifier({ repositoryRoot, runGit } = {}) {
  const git = runGit || ((args, { encoding = null } = {}) => execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding,
    stdio: ["ignore", "pipe", "pipe"],
  }));
  const fileAt = (commit, repositoryPath) => git(["show", `${commit}:${repositoryPath}`]);
  const objectAt = (commit, repositoryPath) => git(["rev-parse", `${commit}:${repositoryPath}`], { encoding: "utf8" }).trim();

  return (attestation) => {
    git(["cat-file", "-e", `${attestation.reviewedCommit}^{commit}`]);
    git(["merge-base", "--is-ancestor", attestation.reviewedCommit, "HEAD"]);
    const reviewedPolicy = validateGovernancePolicy(parseJson(
      fileAt(attestation.reviewedCommit, "shared/editorial-governance-policy.json"),
      "política editorial no commit revisado",
    ));
    if (reviewedPolicy.attestationRuleset !== attestation.ruleset
      || !reviewedPolicy.authorizedReviewers[attestation.dimension].includes(attestation.decidedBy)) {
      throw new Error("revisor não estava autorizado no commit revisado");
    }
    for (const evidence of attestation.evidence) {
      const bytes = fileAt(attestation.reviewedCommit, evidence.path);
      if (objectAt(attestation.reviewedCommit, evidence.path) !== evidence.gitBlob) {
        throw new Error(`gitBlob diverge para ${evidence.path}`);
      }
      if (textBlobFingerprint(bytes, evidence.path) !== evidence.blobSha256) {
        throw new Error(`blobSha256 diverge para ${evidence.path}`);
      }
    }

    if (attestation.dimension === "content") {
      const catalog = parseJson(
        fileAt(attestation.reviewedCommit, "shared/elections-2026.json"),
        "catálogo no commit revisado",
      );
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
    const assetRegistry = parseJson(
      fileAt(attestation.reviewedCommit, "shared/editorial-asset-registry.json"),
      "asset registry no commit revisado",
    );
    const asset = assetRegistry.assets?.find(({ candidateId, kind }) => (
      candidateId === attestation.candidateId && kind === attestation.dimension
    ));
    if (!asset || assetApprovalFingerprint(asset) !== attestation.subject.fingerprint) {
      throw new Error("asset diverge do commit revisado");
    }
    const assetBytes = fileAt(attestation.reviewedCommit, `app/public${asset.path}`);
    if (sha256Fingerprint(assetBytes) !== asset.fingerprint) throw new Error("bytes do asset divergem do registry revisado");
    return true;
  };
}
