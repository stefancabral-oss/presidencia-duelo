import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  validateCardArtPilotGenerationContractDocuments,
  validateCardArtPilotManifestProvenance
} from "./card-art-pilot-manifest-provenance.js";
import { validateCardArtPilotSchemaDocument } from "./card-art-pilot-results-schema.js";
import { readyManifestFixture } from "./fixtures/card-art-pilot-validation-fixtures.js";

const manifestUrl = new URL(
  "../../stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json",
  import.meta.url
);
const generationContractSchemaUrl = new URL(
  "../../stages/12_quality_gate_main/references/card-art-pilot-generation-contract.schema.json",
  import.meta.url
);

async function currentManifest() {
  return JSON.parse(await readFile(manifestUrl, "utf8"));
}

test("the invalidated evidence preserves guide and asset lineage but cannot invent missing generation or receipt contracts", async () => {
  const errors = await validateCardArtPilotManifestProvenance(await currentManifest());
  assert.ok(errors.some((error) => error.includes("generationContract") && error.includes("não possui")));
  assert.ok(errors.some((error) => error.includes("receiptRegistry") && error.includes("não possui")));
  assert.ok(errors.some((error) => error.includes("recognitionRules") && error.includes("não possuem")));
  assert.equal(errors.some((error) => error.includes("assets.P01.sha256")), false);
});

test("equal version labels cannot replace the committed guide content proof", async () => {
  const manifest = await currentManifest();
  manifest.styleGuideAtGeneration = manifest.currentStyleGuideVersion;
  const errors = await validateCardArtPilotManifestProvenance(manifest);
  assert.ok(errors.some((error) => error.includes("styleGuideAtGeneration") && error.includes("pilot-1")));
});

test("tampered guide hashes, commit order and historical art paths fail provenance", async () => {
  const badHash = await currentManifest();
  badHash.styleGuideSha256AtGeneration = "f".repeat(64);
  assert.ok((await validateCardArtPilotManifestProvenance(badHash))
    .some((error) => error.includes("styleGuideSha256AtGeneration")));

  const sameCommit = await currentManifest();
  sameCommit.generationCommit = sameCommit.styleGuideCommitAtGeneration;
  assert.ok((await validateCardArtPilotManifestProvenance(sameCommit))
    .some((error) => error.includes("ancestral estrito")));

  const missingAsset = await currentManifest();
  missingAsset.assets[0].generationPath = "app/public/card-art/pilot/nao-existe.png";
  assert.ok((await validateCardArtPilotManifestProvenance(missingAsset))
    .some((error) => error.includes("assets.P01.generationPath") && error.includes("inexistente")));
});

function contractDocuments(manifest) {
  const plan = {
    protocol: "card-art-pilot-176-generation-plan-v1",
    issue: 176,
    batchVersion: manifest.version,
    tool: manifest.tool,
    commonPrompt: manifest.commonPrompt,
    styleGuide: {
      path: manifest.styleGuide,
      version: manifest.styleGuideAtGeneration,
      commit: manifest.styleGuideCommitAtGeneration,
      sha256: manifest.styleGuideSha256AtGeneration
    },
    assets: manifest.assets.map(({ blindCode, personId, identityReference }) => ({
      blindCode,
      personId,
      identityReference: structuredClone(identityReference)
    }))
  };
  const receipt = {
    protocol: "card-art-pilot-176-generation-receipt-v1",
    issue: 176,
    batchVersion: manifest.version,
    generatedAt: manifest.generatedAt,
    tool: manifest.tool,
    commonPrompt: manifest.commonPrompt,
    plan: structuredClone(manifest.generationContract.plan),
    assets: manifest.assets.map((asset) => ({
      blindCode: asset.blindCode,
      personId: asset.personId,
      generationPath: asset.generationPath,
      sourceOutput: asset.sourceOutput,
      styleAnchor: asset.styleAnchor,
      width: asset.width,
      height: asset.height,
      sha256: asset.sha256,
      identityReference: structuredClone(asset.identityReference)
    }))
  };
  return { plan, receipt };
}

test("generation plan and receipt bind tool, prompt, outputs, references and license metadata", async () => {
  const manifest = readyManifestFixture();
  const { plan, receipt } = contractDocuments(manifest);
  const schema = JSON.parse(await readFile(generationContractSchemaUrl, "utf8"));
  assert.deepEqual(validateCardArtPilotSchemaDocument(plan, schema), []);
  assert.deepEqual(validateCardArtPilotSchemaDocument(receipt, schema), []);
  assert.deepEqual(validateCardArtPilotGenerationContractDocuments(manifest, plan, receipt), []);

  plan.tool = "post-hoc tool";
  receipt.assets[0].sourceOutput = "post-hoc-output.png";
  plan.assets[1].identityReference.license = "invented later";
  const errors = validateCardArtPilotGenerationContractDocuments(manifest, plan, receipt);
  assert.ok(errors.some((error) => error.includes("generationPlan.tool")));
  assert.ok(errors.some((error) => error.includes("generationReceipt.assets[0]")));
  assert.ok(errors.some((error) => error.includes("generationPlan.assets[1].identityReference")));
});

test("Git timestamps remain informational and collection fails closed without an external protected-branch anchor", async () => {
  const manifest = await currentManifest();
  manifest.collectionAllowed = true;
  manifest.receiptRegistry = {
    protocol: "card-art-pilot-176-receipts-v1",
    path: "stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json",
    commit: "a40bffa31b3ca1550a0624bf121e8229584f87b7",
    committedAt: "2026-09-16T05:30:45-03:00",
    sha256: "f".repeat(64),
    issuedCount: 40
  };
  const errors = await validateCardArtPilotManifestProvenance(manifest, {
    firstCollectedAt: "2026-09-16T03:00:00Z"
  });
  assert.ok(errors.some((error) => error.includes("cronologia Git declarada")));
  assert.ok(errors.some((error) => error.includes("historyAnchor") && error.includes("fail-closed")));
});

test("declared generation commits must exist in real history and be ancestors of HEAD", async () => {
  const manifest = await currentManifest();
  manifest.generationCommit = "f".repeat(40);
  const errors = await validateCardArtPilotManifestProvenance(manifest);
  assert.ok(errors.some((error) => error.includes("manifest.generationCommit") && error.includes("ancestral do HEAD real")));

  const contractManifest = await currentManifest();
  contractManifest.generationContract = {
    plan: {
      path: "stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json",
      commit: "e".repeat(40),
      sha256: "a".repeat(64)
    },
    receipt: {
      path: "stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json",
      commit: contractManifest.generationCommit,
      sha256: "b".repeat(64)
    }
  };
  const contractErrors = await validateCardArtPilotManifestProvenance(contractManifest);
  assert.ok(contractErrors.some((error) => error.includes("generationContract.plan.commit") && error.includes("ancestral do HEAD real")));

  const registryManifest = await currentManifest();
  registryManifest.receiptRegistry = {
    protocol: "card-art-pilot-176-receipts-v1",
    path: "stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json",
    commit: "d".repeat(40),
    committedAt: "2026-09-16T00:00:00Z",
    sha256: "c".repeat(64),
    issuedCount: 40
  };
  const registryErrors = await validateCardArtPilotManifestProvenance(registryManifest);
  assert.ok(registryErrors.some((error) => error.includes("receiptRegistry.commit") && error.includes("ancestral do HEAD real")));
});
