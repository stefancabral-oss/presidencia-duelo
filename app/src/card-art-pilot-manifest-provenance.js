import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { cardArtPilotCanonicalSha256 } from "./card-art-pilot-validation.js";
import { validateCardArtPilotSchemaDocument } from "./card-art-pilot-results-schema.js";
import { resolveCardArtPilotRepoFile } from "./card-art-pilot-repo-path.js";

const defaultRepoRoot = new URL("../../", import.meta.url);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function normalizedTextSha256(bytes) {
  const normalized = bytes.toString("utf8").replace(/\r\n/g, "\n");
  return sha256(Buffer.from(normalized, "utf8"));
}

function runGit(args, repoRoot) {
  return spawnSync("git", ["--no-replace-objects", ...args], {
    cwd: fileURLToPath(repoRoot),
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    env: { ...process.env, GIT_NO_REPLACE_OBJECTS: "1" }
  });
}

async function verifiedRepoFile(errors, value, path, repoRoot) {
  try {
    return await resolveCardArtPilotRepoFile(repoRoot, value, path);
  } catch (error) {
    errors.push(error.message);
    return null;
  }
}

function requireCommitAtHead(errors, commit, path, repoRoot) {
  if (!/^[a-f0-9]{40}$/.test(commit || "")) return;
  const ancestry = runGit(["merge-base", "--is-ancestor", commit, "HEAD"], repoRoot);
  if (ancestry.status !== 0) errors.push(`${path}: commit precisa existir e ser ancestral do HEAD real`);
}

function gitBytes(errors, args, path, repoRoot) {
  const execution = runGit(args, repoRoot);
  if (execution.status === 0) return execution.stdout;
  const detail = execution.stderr?.toString("utf8").trim();
  errors.push(`${path}: Git não comprovou a proveniência${detail ? ` (${detail})` : ""}`);
  return null;
}

function parseHistoricalJson(errors, bytes, path) {
  if (!bytes) return null;
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    errors.push(`${path}: JSON histórico inválido (${error.message})`);
    return null;
  }
}

function contractReference(asset) {
  return asset?.identityReference;
}

export function validateCardArtPilotGenerationContractDocuments(manifest, plan, receipt) {
  const errors = [];
  if (plan?.protocol !== "card-art-pilot-176-generation-plan-v1") errors.push("generationPlan.protocol: protocolo inválido");
  if (receipt?.protocol !== "card-art-pilot-176-generation-receipt-v1") errors.push("generationReceipt.protocol: protocolo inválido");
  for (const [path, document] of [["generationPlan", plan], ["generationReceipt", receipt]]) {
    if (document?.issue !== 176) errors.push(`${path}.issue: deve ser 176`);
    if (document?.batchVersion !== manifest?.version) errors.push(`${path}.batchVersion: diverge do manifesto`);
    if (document?.tool !== manifest?.tool) errors.push(`${path}.tool: diverge do manifesto`);
    if (document?.commonPrompt !== manifest?.commonPrompt) errors.push(`${path}.commonPrompt: diverge do manifesto`);
  }
  const expectedGuide = {
    path: manifest?.styleGuide,
    version: manifest?.styleGuideAtGeneration,
    commit: manifest?.styleGuideCommitAtGeneration,
    sha256: manifest?.styleGuideSha256AtGeneration
  };
  if (!isDeepStrictEqual(plan?.styleGuide, expectedGuide)) errors.push("generationPlan.styleGuide: guia prévio diverge do manifesto");
  if (!isDeepStrictEqual(receipt?.plan, manifest?.generationContract?.plan)) errors.push("generationReceipt.plan: ponte para o plano prévio diverge do manifesto");
  if (receipt?.generatedAt !== manifest?.generatedAt) errors.push("generationReceipt.generatedAt: diverge do instante de geração");

  const planAssets = Array.isArray(plan?.assets) ? plan.assets : [];
  const receiptAssets = Array.isArray(receipt?.assets) ? receipt.assets : [];
  for (const [index, asset] of (manifest?.assets || []).entries()) {
    const code = asset?.blindCode || `index-${index}`;
    const planned = planAssets[index];
    const recorded = receiptAssets[index];
    if (planned?.blindCode !== code || planned?.personId !== asset?.personId) {
      errors.push(`generationPlan.assets[${index}]: código/pessoa diverge de ${code}`);
    }
    if (!isDeepStrictEqual(contractReference(planned), asset?.identityReference)) {
      errors.push(`generationPlan.assets[${index}].identityReference: hash, derivação ou metadados editoriais divergem do manifesto`);
    }
    const expectedReceiptAsset = {
      blindCode: code,
      personId: asset?.personId,
      generationPath: asset?.generationPath,
      sourceOutput: asset?.sourceOutput,
      styleAnchor: asset?.styleAnchor,
      width: asset?.width,
      height: asset?.height,
      sha256: asset?.sha256,
      identityReference: asset?.identityReference
    };
    if (!isDeepStrictEqual(recorded, expectedReceiptAsset)) {
      errors.push(`generationReceipt.assets[${index}]: output, arte ou referência diverge do manifesto`);
    }
  }
  if (planAssets.length !== (manifest?.assets || []).length) errors.push("generationPlan.assets: cobertura precisa ser exata");
  if (receiptAssets.length !== (manifest?.assets || []).length) errors.push("generationReceipt.assets: cobertura precisa ser exata");
  return errors;
}

export async function validateCardArtPilotManifestProvenance(manifest, { repoRoot = defaultRepoRoot, firstCollectedAt } = {}) {
  const errors = [];
  const guideFile = await verifiedRepoFile(errors, manifest?.styleGuide, "manifest.styleGuide", repoRoot);
  const guidePath = guideFile?.repoPath;
  const guideCommit = manifest?.styleGuideCommitAtGeneration;
  const generationCommit = manifest?.generationCommit;
  if (!guidePath || !/^[a-f0-9]{40}$/.test(guideCommit || "") || !/^[a-f0-9]{40}$/.test(generationCommit || "")) {
    errors.push("manifest: caminhos ou commits insuficientes para verificar a proveniência");
    return errors;
  }
  requireCommitAtHead(errors, guideCommit, "manifest.styleGuideCommitAtGeneration", repoRoot);
  requireCommitAtHead(errors, generationCommit, "manifest.generationCommit", repoRoot);

  const contract = manifest?.generationContract;
  let plan = null;
  let receipt = null;
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    errors.push("manifest.generationContract: lote não possui plano prévio e receipt verificáveis no histórico");
  } else {
    const planRecord = contract.plan;
    const receiptRecord = contract.receipt;
    const planFile = await verifiedRepoFile(errors, planRecord?.path, "manifest.generationContract.plan.path", repoRoot);
    if (!planFile || !/^[a-f0-9]{40}$/.test(planRecord?.commit || "") || !/^[a-f0-9]{64}$/.test(planRecord?.sha256 || "")) {
      errors.push("manifest.generationContract.plan: caminho, commit ou SHA-256 inválido");
    } else {
      requireCommitAtHead(errors, planRecord.commit, "manifest.generationContract.plan.commit", repoRoot);
      const planBytes = gitBytes(errors, ["show", `${planRecord.commit}:${planFile.repoPath}`], "manifest.generationContract.plan", repoRoot);
      if (planBytes && sha256(planBytes) !== planRecord.sha256) errors.push("manifest.generationContract.plan.sha256: bytes históricos divergem");
      plan = parseHistoricalJson(errors, planBytes, "manifest.generationContract.plan");
      const planAncestry = runGit(["merge-base", "--is-ancestor", planRecord.commit, generationCommit], repoRoot);
      if (planRecord.commit === generationCommit || planAncestry.status !== 0) {
        errors.push("manifest.generationContract.plan.commit: plano precisa ser ancestral estrito da geração");
      }
      const guideToPlan = runGit(["merge-base", "--is-ancestor", guideCommit, planRecord.commit], repoRoot);
      if (guideToPlan.status !== 0) errors.push("manifest.generationContract.plan.commit: plano não descende do guia declarado");
    }
    const receiptFile = await verifiedRepoFile(errors, receiptRecord?.path, "manifest.generationContract.receipt.path", repoRoot);
    if (!receiptFile || !/^[a-f0-9]{40}$/.test(receiptRecord?.commit || "") || !/^[a-f0-9]{64}$/.test(receiptRecord?.sha256 || "")) {
      errors.push("manifest.generationContract.receipt: caminho, commit ou SHA-256 inválido");
    } else {
      requireCommitAtHead(errors, receiptRecord.commit, "manifest.generationContract.receipt.commit", repoRoot);
      if (receiptRecord.commit !== generationCommit) errors.push("manifest.generationContract.receipt.commit: receipt precisa estar no commit de geração");
      const receiptBytes = gitBytes(errors, ["show", `${receiptRecord.commit}:${receiptFile.repoPath}`], "manifest.generationContract.receipt", repoRoot);
      if (receiptBytes && sha256(receiptBytes) !== receiptRecord.sha256) errors.push("manifest.generationContract.receipt.sha256: bytes históricos divergem");
      receipt = parseHistoricalJson(errors, receiptBytes, "manifest.generationContract.receipt");
    }
    if (plan && receipt) {
      const schemaPath = manifest?.generationContractSchema;
      const schemaFile = await verifiedRepoFile(errors, schemaPath, "manifest.generationContractSchema", repoRoot);
      if (schemaFile) {
        try {
          const schema = JSON.parse(await readFile(schemaFile.url, "utf8"));
          for (const [path, document] of [["generationPlan", plan], ["generationReceipt", receipt]]) {
            errors.push(...validateCardArtPilotSchemaDocument(document, schema).map((error) => `${path}.${error}`));
          }
        } catch (error) {
          errors.push(`manifest.generationContractSchema: schema inválido ou ilegível (${error.message})`);
        }
      }
      errors.push(...validateCardArtPilotGenerationContractDocuments(manifest, plan, receipt));
    }
  }

  const registryRecord = manifest?.receiptRegistry;
  if (!registryRecord || typeof registryRecord !== "object" || Array.isArray(registryRecord)) {
    errors.push("manifest.receiptRegistry: registro pré-emitido não possui versão histórica obrigatória");
  } else {
    const registryFile = await verifiedRepoFile(errors, registryRecord.path, "manifest.receiptRegistry.path", repoRoot);
    if (!registryFile || !/^[a-f0-9]{40}$/.test(registryRecord.commit || "")
    || !/^[a-f0-9]{64}$/.test(registryRecord.sha256 || "")) {
      errors.push("manifest.receiptRegistry: caminho, commit ou SHA-256 inválido");
    } else {
      requireCommitAtHead(errors, registryRecord.commit, "manifest.receiptRegistry.commit", repoRoot);
      const registryBytes = gitBytes(
        errors,
        ["show", `${registryRecord.commit}:${registryFile.repoPath}`],
        "manifest.receiptRegistry",
        repoRoot
      );
      const registry = parseHistoricalJson(errors, registryBytes, "manifest.receiptRegistry");
      if (registry) {
        if (cardArtPilotCanonicalSha256(registry) !== registryRecord.sha256) {
          errors.push("manifest.receiptRegistry.sha256: conteúdo histórico canônico diverge");
        }
        const expectedAssets = (manifest.assets || []).map(({ blindCode, sha256: assetSha256 }) => ({ blindCode, sha256: assetSha256 }));
        if (registry.protocol !== registryRecord.protocol
          || registry.batchVersion !== manifest.version
          || !isDeepStrictEqual(registry.assets, expectedAssets)
          || registry.receiptHashes?.length !== registryRecord.issuedCount) {
          errors.push("manifest.receiptRegistry: protocolo, lote, artes ou contagem divergem do conteúdo histórico");
        }
        if (!Array.isArray(registry.receiptHashes)
          || new Set(registry.receiptHashes).size !== registry.receiptHashes.length
          || registry.receiptHashes.length < 40) {
          errors.push("manifest.receiptRegistry: receipts históricos precisam ser únicos e suficientes");
        }
      }
      const generationToRegistry = runGit(["merge-base", "--is-ancestor", generationCommit, registryRecord.commit], repoRoot);
      if (registryRecord.commit === generationCommit || generationToRegistry.status !== 0) {
        errors.push("manifest.receiptRegistry.commit: registro precisa descender estritamente do commit de geração");
      }
      const registryCommittedAt = gitBytes(errors, ["show", "-s", "--format=%cI", registryRecord.commit], "manifest.receiptRegistry.committedAt", repoRoot);
      const observedRegistryTimestamp = registryCommittedAt ? Date.parse(registryCommittedAt.toString("utf8").trim()) : null;
      if (Number.isFinite(observedRegistryTimestamp) && observedRegistryTimestamp !== Date.parse(registryRecord.committedAt)) {
        errors.push("manifest.receiptRegistry.committedAt: metadado declarado diverge do commit");
      }
      if (registry && Number.isFinite(observedRegistryTimestamp) && Date.parse(registry.issuedAt) > observedRegistryTimestamp) {
        errors.push("manifest.receiptRegistry.issuedAt: cronologia declarada diverge do metadado do commit");
      }
      const firstCollectionTimestamp = Date.parse(firstCollectedAt);
      if (manifest.collectionAllowed === true && !Number.isFinite(firstCollectionTimestamp)) {
        errors.push("manifest.receiptRegistry: primeira coleta é obrigatória para conferir a cronologia declarada");
      } else if (Number.isFinite(observedRegistryTimestamp) && Number.isFinite(firstCollectionTimestamp)
        && observedRegistryTimestamp >= firstCollectionTimestamp) {
        errors.push("manifest.receiptRegistry: cronologia Git declarada não antecede a primeira coleta");
      }
      if (manifest.collectionAllowed === true) {
        try {
          const currentRegistry = JSON.parse(await readFile(registryFile.url, "utf8"));
          if (cardArtPilotCanonicalSha256(currentRegistry) !== registryRecord.sha256) {
            errors.push("manifest.receiptRegistry.sha256: registro vigente diverge do conteúdo histórico");
          }
        } catch (error) {
          errors.push(`manifest.receiptRegistry.path: não foi possível ler o registro vigente (${error.message})`);
        }
      }
    }
  }

  const recognitionRecord = manifest?.recognitionRules;
  if (!recognitionRecord || typeof recognitionRecord !== "object" || Array.isArray(recognitionRecord)) {
    errors.push("manifest.recognitionRules: regras determinísticas pré-coleta não possuem versão histórica obrigatória");
  } else {
    const rulesFile = await verifiedRepoFile(errors, recognitionRecord.path, "manifest.recognitionRules.path", repoRoot);
    if (!rulesFile || !/^[a-f0-9]{40}$/.test(recognitionRecord.commit || "") || !/^[a-f0-9]{64}$/.test(recognitionRecord.sha256 || "")) {
      errors.push("manifest.recognitionRules: caminho, commit ou SHA-256 inválido");
    } else {
      requireCommitAtHead(errors, recognitionRecord.commit, "manifest.recognitionRules.commit", repoRoot);
      if (recognitionRecord.commit !== registryRecord?.commit) {
        errors.push("manifest.recognitionRules.commit: regras precisam estar no mesmo commit do registro de receipts");
      }
      const rulesBytes = gitBytes(errors, ["show", `${recognitionRecord.commit}:${rulesFile.repoPath}`], "manifest.recognitionRules", repoRoot);
      const rules = parseHistoricalJson(errors, rulesBytes, "manifest.recognitionRules");
      if (rules && cardArtPilotCanonicalSha256(rules) !== recognitionRecord.sha256) {
        errors.push("manifest.recognitionRules.sha256: conteúdo histórico canônico diverge");
      }
      const schemaFile = await verifiedRepoFile(errors, manifest?.recognitionRulesSchema, "manifest.recognitionRulesSchema", repoRoot);
      if (rules && schemaFile) {
        try {
          const schema = JSON.parse(await readFile(schemaFile.url, "utf8"));
          errors.push(...validateCardArtPilotSchemaDocument(rules, schema).map((error) => `recognitionRules.${error}`));
        } catch (error) {
          errors.push(`manifest.recognitionRulesSchema: schema inválido ou ilegível (${error.message})`);
        }
      }
      if (manifest.collectionAllowed === true) {
        try {
          const currentRules = JSON.parse(await readFile(rulesFile.url, "utf8"));
          if (cardArtPilotCanonicalSha256(currentRules) !== recognitionRecord.sha256) {
            errors.push("manifest.recognitionRules.sha256: regras vigentes divergem do conteúdo histórico");
          }
        } catch (error) {
          errors.push(`manifest.recognitionRules.path: não foi possível ler as regras vigentes (${error.message})`);
        }
      }
    }
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
    errors.push("manifest.generationCommit: metadados temporais declarados do guia e da geração são incoerentes");
  }
  if (/^[a-f0-9]{40}$/.test(contract?.plan?.commit || "") && Number.isFinite(observedGenerationTimestamp)) {
    const planAuthoredAt = gitBytes(errors, ["show", "-s", "--format=%aI", contract.plan.commit], "manifest.generationContract.plan.commit", repoRoot);
    const observedPlanTimestamp = planAuthoredAt ? Date.parse(planAuthoredAt.toString("utf8").trim()) : null;
    if (Number.isFinite(observedPlanTimestamp) && observedPlanTimestamp >= observedGenerationTimestamp) {
      errors.push("manifest.generationContract.plan.commit: metadados temporais declarados do plano e da geração são incoerentes");
    }
  }

  if (manifest.collectionAllowed === true) {
    try {
      const currentGuide = await readFile(guideFile.url);
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
    const assetFile = await verifiedRepoFile(errors, asset?.generationPath, `manifest.assets.${code}.generationPath`, repoRoot);
    if (assetFile) {
      const generatedAsset = gitBytes(
        errors,
        ["show", `${generationCommit}:${assetFile.repoPath}`],
        `manifest.assets.${code}.generationPath`,
        repoRoot
      );
      if (generatedAsset && sha256(generatedAsset) !== asset.sha256) {
        errors.push(`manifest.assets.${code}.sha256: arte diverge do commit de geração`);
      }
    }

    const referencePath = asset?.identityReference?.path;
    const referenceFile = await verifiedRepoFile(errors, referencePath, `manifest.assets.${code}.identityReference.path`, repoRoot);
    if (referenceFile) {
      const reference = gitBytes(
        errors,
        ["show", `${generationCommit}:${referenceFile.repoPath}`],
        `manifest.assets.${code}.identityReference.path`,
        repoRoot
      );
      if (reference && sha256(reference) !== asset.identityReference.sha256) {
        errors.push(`manifest.assets.${code}.identityReference.sha256: referência diverge do commit de geração`);
      }
    }
  }
  if (manifest.collectionAllowed === true) {
    errors.push("manifest.historyAnchor: datas de autor/committer Git são controláveis e não provam pré-coleta; falta âncora externa verificável em branch protegida (fail-closed)");
  }
  return errors;
}

export async function assertCardArtPilotManifestProvenance(manifest, options) {
  const errors = await validateCardArtPilotManifestProvenance(manifest, options);
  if (!errors.length) return;
  throw new Error(`Proveniência do manifesto #176 inválida:\n- ${errors.join("\n- ")}`);
}
