import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicRoot = new URL("../public/", import.meta.url);
const manifestUrl = new URL("card-art/pilot/manifest.json", publicRoot);

function pngDimensions(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(buffer.subarray(12, 16).toString("ascii"), "IHDR");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test("the eight card-art pilots are immutable, unpublished and ready for blind testing", async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

  assert.equal(manifest.status, "pilot-not-published");
  assert.equal(manifest.issue, 176);
  assert.equal(manifest.assets.length, 8);
  assert.equal(new Set(manifest.assets.map(({ personId }) => personId)).size, 8);
  assert.equal(new Set(manifest.assets.map(({ file }) => file)).size, 8);

  for (const asset of manifest.assets) {
    const image = await readFile(new URL(`card-art/pilot/${asset.file}`, publicRoot));
    const reference = await readFile(new URL(asset.identityReference.replace(/^app\/public\//, ""), publicRoot));
    const dimensions = pngDimensions(image);
    const sha256 = createHash("sha256").update(image).digest("hex");

    assert.ok(reference.length > 0, `${asset.slug}: referência de identidade ausente`);
    assert.deepEqual(dimensions, { width: asset.width, height: asset.height });
    assert.ok(Math.abs((dimensions.width / dimensions.height) - 0.8) < 0.001, `${asset.slug}: proporção fora de 4:5`);
    assert.equal(sha256, asset.sha256, `${asset.slug}: arte mudou sem atualizar a proveniência`);
  }
});
