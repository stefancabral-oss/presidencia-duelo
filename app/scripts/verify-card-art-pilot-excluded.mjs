import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

const appRoot = new URL("../", import.meta.url);
const repoRoot = new URL("../../", import.meta.url);
const distRoot = new URL("dist/", appRoot);
const manifestUrl = new URL("stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json", repoRoot);
const manifestBytes = await readFile(manifestUrl);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const pilotHashes = new Set([
  createHash("sha256").update(manifestBytes).digest("hex"),
  ...manifest.assets.map(({ sha256 }) => sha256)
]);
const manifestMarkers = [manifest.status, manifest.commonPrompt, manifest.assets[0].sourceOutput].map((marker) => Buffer.from(marker));

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    return entry.isDirectory() ? filesBelow(url) : [url];
  }));
  return nested.flat();
}

const distFiles = await filesBelow(distRoot);
for (const file of distFiles) {
  const bytes = await readFile(file);
  const hash = createHash("sha256").update(bytes).digest("hex");
  assert.ok(!pilotHashes.has(hash), `pilot asset leaked into Vite dist: ${file.pathname}`);
  assert.ok(!decodeURIComponent(file.pathname).includes("card-art-pilot-176"), `pilot path leaked into Vite dist: ${file.pathname}`);
  for (const marker of manifestMarkers) {
    assert.equal(bytes.includes(marker), false, `pilot manifest content leaked into Vite dist: ${file.pathname}`);
  }
}

console.log(`verified ${distFiles.length} dist files: no #176 pilot asset is packaged`);
