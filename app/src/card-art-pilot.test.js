import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../../", import.meta.url);
const evidenceRoot = new URL("stages/12_quality_gate_main/evidence/card-art-pilot-176/", repoRoot);
const manifestUrl = new URL("manifest.json", evidenceRoot);
const resultSchemaUrl = new URL("stages/12_quality_gate_main/references/card-art-pilot-results.schema.json", repoRoot);
const participantSchemaUrl = new URL("stages/12_quality_gate_main/references/card-art-pilot-participant-response.schema.json", repoRoot);
const bundleSchemaUrl = new URL("stages/12_quality_gate_main/references/card-art-pilot-response-bundle.schema.json", repoRoot);
const receiptRegistrySchemaUrl = new URL("stages/12_quality_gate_main/references/card-art-pilot-receipt-registry.schema.json", repoRoot);
const recognitionRulesSchemaUrl = new URL("stages/12_quality_gate_main/references/card-art-pilot-recognition-rules.schema.json", repoRoot);
const generationContractSchemaUrl = new URL("stages/12_quality_gate_main/references/card-art-pilot-generation-contract.schema.json", repoRoot);
const publicPilotUrl = new URL("app/public/card-art/pilot/", repoRoot);

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function pngDimensions(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(buffer.subarray(12, 16).toString("ascii"), "IHDR");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test("the eight pilot assets stay immutable in evidence storage outside app/public", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

  assert.equal(manifest.status, "pilot-invalidated-regeneration-required");
  assert.equal(manifest.issue, 176);
  assert.equal(manifest.collectionAllowed, false);
  assert.equal(manifest.scaleDecisionAllowed, false);
  assert.equal(manifest.generationContract, null);
  assert.equal(manifest.receiptRegistry, null);
  assert.equal(manifest.recognitionRules, null);
  assert.equal(manifest.recognitionRulesSchema, "stages/12_quality_gate_main/references/card-art-pilot-recognition-rules.schema.json");
  assert.equal(manifest.styleGuideAtGeneration, "pilot-1");
  assert.equal(manifest.currentStyleGuideVersion, "pilot-2");
  assert.match(manifest.generationCommit, /^[a-f0-9]{40}$/);
  assert.match(manifest.styleGuideCommitAtGeneration, /^[a-f0-9]{40}$/);
  assert.match(manifest.styleGuideSha256AtGeneration, /^[a-f0-9]{64}$/);
  assert.ok(manifest.tool.trim());
  assert.ok(manifest.commonPrompt.trim());
  assert.equal(manifest.nonconformance.code, "style-guide-changed-after-generation");
  assert.match(manifest.nonconformance.requiredRemediation, /nao reutilizar P01-P08/i);
  assert.equal(manifest.storage.purpose, "nonconforming-evidence-only");
  assert.equal(manifest.storage.servedByApplication, false);
  assert.equal(manifest.storage.expectedInViteDist, false);
  assert.equal(manifest.assets.length, 8);
  assert.equal(new Set(manifest.assets.map(({ personId }) => personId)).size, 8);
  assert.equal(new Set(manifest.assets.map(({ blindCode }) => blindCode)).size, 8);
  assert.equal(new Set(manifest.assets.map(({ file }) => file)).size, 8);
  await assert.rejects(access(publicPilotUrl), { code: "ENOENT" });

  const licensePending = new Set(["001", "028", "033", "063", "084"]);
  for (const asset of manifest.assets) {
    assert.match(asset.blindCode, /^P0[1-8]$/);
    assert.equal(asset.file, `${asset.blindCode}.png`);
    assert.ok(asset.generationPath);
    assert.ok(!asset.file.includes(asset.slug), `${asset.blindCode}: filename leaks identity`);

    const image = await readFile(new URL(asset.file, evidenceRoot));
    const reference = await readFile(new URL(asset.identityReference.path, repoRoot));
    const dimensions = pngDimensions(image);

    assert.deepEqual(dimensions, { width: asset.width, height: asset.height });
    assert.ok(Math.abs((dimensions.width / dimensions.height) - 0.8) < 0.001, `${asset.blindCode}: ratio is not 4:5`);
    assert.equal(sha256(image), asset.sha256, `${asset.blindCode}: generated asset changed without provenance update`);
    assert.equal(sha256(reference), asset.identityReference.sha256, `${asset.blindCode}: identity reference changed without provenance update`);

    if (licensePending.has(asset.personId)) {
      assert.equal(asset.identityReference.licenseStatus, "license-pending");
      assert.equal(asset.identityReference.photoSource, null);
      assert.equal(asset.identityReference.photographer, null);
      assert.equal(asset.identityReference.license, null);
      assert.match(asset.identityReference.provenanceNote, /nao licenciam este arquivo substituto/i);
    } else {
      assert.equal(asset.identityReference.licenseStatus, "documented");
      assert.match(asset.identityReference.photoSource, /^https:\/\//);
      assert.ok(asset.identityReference.photographer);
      assert.ok(asset.identityReference.license);
    }
  }
});

test("the consolidation schema requires accountable reviews and a human decision", async () => {
  const schema = JSON.parse(await readFile(resultSchemaUrl, "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.deepEqual(schema.required, ["protocol", "issue", "batch", "custody", "generatedAt", "sample", "assets", "decision"]);
  assert.deepEqual(schema.properties.batch.required, ["version", "manifestSha256", "assets"]);
  assert.equal(schema.properties.batch.properties.version.pattern, "^batch-[1-9][0-9]*-(?:ready|invalidated)$");
  assert.equal(schema.properties.batch.properties.manifestSha256.pattern, "^[a-f0-9]{64}$");
  assert.equal(schema.properties.batch.properties.assets.minItems, 8);
  assert.equal(schema.$defs.custody.properties.responseCount.minimum, 40);
  assert.equal(schema.$defs.custody.properties.entries.minItems, 40);
  assert.deepEqual(schema.$defs.custodyEntry.required, ["responseId", "receiptSha256", "responseSha256"]);
  assert.ok(schema.$defs.sample.required.includes("externalRecruitment"));
  assert.deepEqual(schema.$defs.sample.properties.externalRecruitment.required, ["externalParticipantsOnly", "productionTeamExcluded", "attestedBy", "attestedAt"]);
  assert.equal(schema.$defs.sample.properties.externalRecruitment.properties.attestedBy.$ref, "#/$defs/governanceActorId");
  assert.ok(schema.$defs.assetResult.required.includes("byDisplayScenario"));
  assert.equal(schema.$defs.assetValidResponseCount.minimum, 40);
  assert.equal(schema.$defs.scenarioValidResponseCount.minimum, 20);
  assert.deepEqual(schema.$defs.assetResult.properties.byDisplayScenario.required, ["mobile-390x844", "desktop-1000x800"]);
  assert.equal(schema.$defs.governanceActorId.pattern, "^gov_[a-f0-9]{32}$");
  assert.deepEqual(schema.$defs.identityReview.required, ["status", "reviewedBy", "reviewedAt", "outcomeCode"]);
  assert.deepEqual(schema.$defs.dignityReview.required, ["status", "reviewedBy", "reviewedAt", "outcomeCode"]);
  assert.ok(schema.$defs.identityReview.properties.status.enum.includes("pending"));
  assert.equal(schema.$defs.identityReview.properties.notes, undefined);
  assert.equal(schema.$defs.dignityReview.properties.notes, undefined);
  assert.deepEqual(schema.$defs.decision.required, ["value", "decidedBy", "decidedAt", "reasonCodes"]);
  assert.equal(schema.$defs.decision.properties.rationale, undefined);
  assert.equal(schema.$defs.privateEvidenceRef.properties.handling.const, "restricted-redacted-excluded-from-public-bundle");
  assert.equal(JSON.stringify(schema).includes('"pattern":"\\\\S"'), false);
});

test("the public result schema exposes no unrestricted string slot", async () => {
  const schema = JSON.parse(await readFile(resultSchemaUrl, "utf8"));
  const unrestricted = [];
  const allowedPatterns = new Set([
    "^batch-[1-9][0-9]*-(?:ready|invalidated)$",
    "^[a-f0-9]{64}$",
    "^[a-f0-9]{32}$",
    "^P0[1-8]$",
    "^gov_[a-f0-9]{32}$",
    "^private-governance-[a-f0-9]{32}$"
  ]);
  function inspect(value, path = "$") {
    if (!value || typeof value !== "object") return;
    if (value.type === "string") {
      const constrained = value.const !== undefined
        || Array.isArray(value.enum)
        || value.format === "date-time"
        || allowedPatterns.has(value.pattern);
      if (!constrained) unrestricted.push(path);
    }
    for (const [key, child] of Object.entries(value)) inspect(child, `${path}.${key}`);
  }
  inspect(schema);
  assert.deepEqual(unrestricted, []);
});

test("the individual response schema requires the same version, manifest and eight art hashes", async () => {
  const schema = JSON.parse(await readFile(participantSchemaUrl, "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.ok(schema.required.includes("batch"));
  assert.ok(schema.required.includes("receipt"));
  assert.ok(schema.required.includes("collectedAt"));
  assert.deepEqual(schema.$defs.batchIdentity.required, ["version", "manifestSha256", "assets"]);
  assert.equal(schema.$defs.batchIdentity.properties.assets.minItems, 8);
  assert.equal(schema.$defs.batchIdentity.properties.assets.maxItems, 8);
  assert.equal(schema.$defs.batchAsset.properties.sha256.pattern, "^[a-f0-9]{64}$");
});

test("bundle, receipt registry, recognition rules and generation contract schemas close empty and post-hoc inputs", async () => {
  const [bundle, registry, recognition, generation] = await Promise.all([
    readFile(bundleSchemaUrl, "utf8").then(JSON.parse),
    readFile(receiptRegistrySchemaUrl, "utf8").then(JSON.parse),
    readFile(recognitionRulesSchemaUrl, "utf8").then(JSON.parse),
    readFile(generationContractSchemaUrl, "utf8").then(JSON.parse)
  ]);
  assert.equal(bundle.properties.responses.minItems, 1);
  assert.equal(registry.properties.receiptHashes.minItems, 40);
  assert.equal(registry.properties.receiptHashes.uniqueItems, true);
  assert.equal(recognition.properties.normalization.const, "pt-BR-nfkc-casefold-alnum-v1");
  assert.equal(recognition.properties.assets.minItems, 8);
  assert.equal(generation.oneOf.length, 2);
  assert.equal(generation.$defs.plan.properties.assets.minItems, 8);
  assert.equal(generation.$defs.receipt.properties.assets.minItems, 8);
});
