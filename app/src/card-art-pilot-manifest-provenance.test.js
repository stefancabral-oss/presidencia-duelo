import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateCardArtPilotManifestProvenance } from "./card-art-pilot-manifest-provenance.js";

const manifestUrl = new URL(
  "../../stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json",
  import.meta.url
);

async function currentManifest() {
  return JSON.parse(await readFile(manifestUrl, "utf8"));
}

test("the invalidated evidence still has a cryptographically verifiable pre-generation guide and asset lineage", async () => {
  assert.deepEqual(await validateCardArtPilotManifestProvenance(await currentManifest()), []);
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
    .some((error) => error.includes("assets.P01.generationPath") && error.includes("Git não comprovou")));
});
