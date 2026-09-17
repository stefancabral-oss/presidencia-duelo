import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ASSET_REGISTRY from "../../shared/editorial-asset-registry.json" with { type: "json" };

const publicRoot = path.resolve(fileURLToPath(new URL("../public/", import.meta.url)));
const localAssetPathPattern = /^\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*$/;

if (ASSET_REGISTRY.schemaVersion !== 1 || !Array.isArray(ASSET_REGISTRY.assets)) {
  throw new Error("Registro editorial de assets malformado");
}

for (const asset of ASSET_REGISTRY.assets) {
  if (!localAssetPathPattern.test(String(asset.path || ""))) {
    throw new Error(`Asset editorial tem caminho inseguro: ${asset.path || ""}`);
  }
  const absolutePath = path.resolve(publicRoot, String(asset.path || "").replace(/^\/+/, ""));
  const relative = path.relative(publicRoot, absolutePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Asset editorial fora de app/public: ${asset.path || ""}`);
  }
  let contents;
  try {
    contents = await readFile(absolutePath);
  } catch {
    throw new Error(`Asset editorial ausente: ${asset.path}`);
  }
  const fingerprint = `sha256:${createHash("sha256").update(contents).digest("hex")}`;
  if (fingerprint !== asset.fingerprint) {
    throw new Error(`Asset editorial alterado sem nova decisão humana: ${asset.candidateId}.${asset.kind}`);
  }
}

console.log(`Assets editoriais íntegros: ${ASSET_REGISTRY.assets.length}`);
