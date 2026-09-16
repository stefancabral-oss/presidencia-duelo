import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const defaultRepoRoot = new URL("../../", import.meta.url);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function normalizedTextSha256(bytes) {
  const normalized = bytes.toString("utf8").replace(/\r\n/g, "\n");
  return sha256(Buffer.from(normalized, "utf8"));
}

function isSafeRepoPath(value) {
  if (typeof value !== "string" || !value || value.includes("\\")) return false;
  if (value.startsWith("/") || /^[A-Za-z]:/.test(value)) return false;
  return !value.split("/").includes("..");
}

function runGit(args, repoRoot) {
  return spawnSync("git", args, {
    cwd: fileURLToPath(repoRoot),
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
}

function gitBytes(errors, args, path, repoRoot) {
  const execution = runGit(args, repoRoot);
  if (execution.status === 0) return execution.stdout;
  const detail = execution.stderr?.toString("utf8").trim();
  errors.push(`${path}: Git não comprovou a proveniência${detail ? ` (${detail})` : ""}`);
  return null;
}

export async function validateCardArtPilotManifestProvenance(manifest, { repoRoot = defaultRepoRoot } = {}) {
  const errors = [];
  const guidePath = manifest?.styleGuide;
  const guideCommit = manifest?.styleGuideCommitAtGeneration;
  const generationCommit = manifest?.generationCommit;
  if (!isSafeRepoPath(guidePath) || !/^[a-f0-9]{40}$/.test(guideCommit || "") || !/^[a-f0-9]{40}$/.test(generationCommit || "")) {
    return ["manifest: caminhos ou commits insuficientes para verificar a proveniência"];
  }

  const historicalGuide = gitBytes(
    errors,
    ["show", `${guideCommit}:${guidePath}`],
    "manifest.styleGuideCommitAtGeneration",
    repoRoot
  );
  if (historicalGuide) {
    const observed = normalizedTextSha256(historicalGuide);
    if (observed !== manifest.styleGuideSha256AtGeneration) {
      errors.push(`manifest.styleGuideSha256AtGeneration: conteúdo no commit ${guideCommit} tem SHA-256 ${observed}`);
    }
    const version = /^Versão:\s*`([^`]+)`/mu.exec(historicalGuide.toString("utf8"))?.[1];
    if (version !== manifest.styleGuideAtGeneration) {
      errors.push(`manifest.styleGuideAtGeneration: guia no commit declara ${version || "versão ausente"}`);
    }
  }

  const guideAtGeneration = gitBytes(
    errors,
    ["show", `${generationCommit}:${guidePath}`],
    "manifest.generationCommit",
    repoRoot
  );
  if (guideAtGeneration && normalizedTextSha256(guideAtGeneration) !== manifest.styleGuideSha256AtGeneration) {
    errors.push("manifest.generationCommit: conteúdo do guia na geração diverge do guia previamente versionado");
  }

  const ancestry = runGit(["merge-base", "--is-ancestor", guideCommit, generationCommit], repoRoot);
  if (guideCommit === generationCommit || ancestry.status !== 0) {
    errors.push("manifest.generationCommit: commit do guia não é ancestral estrito do commit de geração");
  }

  let observedGuideTimestamp = null;
  const guideAuthoredAt = gitBytes(errors, ["show", "-s", "--format=%aI", guideCommit], "manifest.styleGuideVersionedAt", repoRoot);
  if (guideAuthoredAt) {
    observedGuideTimestamp = Date.parse(guideAuthoredAt.toString("utf8").trim());
    if (observedGuideTimestamp !== Date.parse(manifest.styleGuideVersionedAt)) {
      errors.push("manifest.styleGuideVersionedAt: instante diverge do commit do guia");
    }
  }
  let observedGenerationTimestamp = null;
  const generationAuthoredAt = gitBytes(errors, ["show", "-s", "--format=%aI", generationCommit], "manifest.generatedAt", repoRoot);
  if (generationAuthoredAt) {
    observedGenerationTimestamp = Date.parse(generationAuthoredAt.toString("utf8").trim());
    if (observedGenerationTimestamp !== Date.parse(manifest.generatedAt)) {
      errors.push("manifest.generatedAt: instante diverge do commit de geração");
    }
  }
  if (Number.isFinite(observedGuideTimestamp) && Number.isFinite(observedGenerationTimestamp)
    && observedGuideTimestamp >= observedGenerationTimestamp) {
    errors.push("manifest.generationCommit: commit do guia precisa anteceder cronologicamente o commit de geração");
  }

  if (manifest.collectionAllowed === true) {
    try {
      const currentGuide = await readFile(new URL(guidePath, repoRoot));
      const observed = normalizedTextSha256(currentGuide);
      if (observed !== manifest.styleGuideSha256AtGeneration) {
        errors.push(`manifest.styleGuideSha256AtGeneration: guia vigente mudou após a geração (${observed})`);
      }
      const version = /^Versão:\s*`([^`]+)`/mu.exec(currentGuide.toString("utf8"))?.[1];
      if (version !== manifest.currentStyleGuideVersion) {
        errors.push(`manifest.currentStyleGuideVersion: guia vigente declara ${version || "versão ausente"}`);
      }
    } catch (error) {
      errors.push(`manifest.styleGuide: não foi possível ler o guia vigente (${error.message})`);
    }
  }

  for (const asset of manifest.assets || []) {
    const code = asset?.blindCode || "unknown";
    if (!isSafeRepoPath(asset?.generationPath)) {
      errors.push(`manifest.assets.${code}.generationPath: caminho inseguro ou ausente`);
    } else {
      const generatedAsset = gitBytes(
        errors,
        ["show", `${generationCommit}:${asset.generationPath}`],
        `manifest.assets.${code}.generationPath`,
        repoRoot
      );
      if (generatedAsset && sha256(generatedAsset) !== asset.sha256) {
        errors.push(`manifest.assets.${code}.sha256: arte diverge do commit de geração`);
      }
    }

    const referencePath = asset?.identityReference?.path;
    if (!isSafeRepoPath(referencePath)) {
      errors.push(`manifest.assets.${code}.identityReference.path: caminho inseguro ou ausente`);
    } else {
      const reference = gitBytes(
        errors,
        ["show", `${generationCommit}:${referencePath}`],
        `manifest.assets.${code}.identityReference.path`,
        repoRoot
      );
      if (reference && sha256(reference) !== asset.identityReference.sha256) {
        errors.push(`manifest.assets.${code}.identityReference.sha256: referência diverge do commit de geração`);
      }
    }
  }
  return errors;
}

export async function assertCardArtPilotManifestProvenance(manifest, options) {
  const errors = await validateCardArtPilotManifestProvenance(manifest, options);
  if (!errors.length) return;
  throw new Error(`Proveniência do manifesto #176 inválida:\n- ${errors.join("\n- ")}`);
}
