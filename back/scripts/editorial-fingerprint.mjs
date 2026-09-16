import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import EDITORIAL_ASSETS from "../../shared/editorial-asset-registry.json" with { type: "json" };
import { assetApprovalFingerprint, candidateContentFingerprint, sha256Fingerprint } from "../src/editorial-gate.js";

const [kind, value, secondaryValue] = process.argv.slice(2);

if (kind === "content") {
  const candidate = CATALOG.find(({ id }) => id === value);
  if (!candidate) throw new Error(`Candidato desconhecido: ${value || ""}`);
  console.log(candidateContentFingerprint(candidate));
} else if (kind === "asset") {
  if (!value) throw new Error("Informe o caminho do asset relativo ao repositório");
  const repositoryRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
  const absolutePath = path.resolve(repositoryRoot, value);
  const relative = path.relative(repositoryRoot, absolutePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Caminho fora do repositório");
  console.log(sha256Fingerprint(await readFile(absolutePath)));
} else if (kind === "registered-asset") {
  const asset = EDITORIAL_ASSETS.assets.find(({ candidateId, kind: assetKind }) => (
    candidateId === value && assetKind === secondaryValue
  ));
  if (!asset) throw new Error(`Asset registrado não encontrado: ${value || ""}.${secondaryValue || ""}`);
  console.log(assetApprovalFingerprint(asset));
} else {
  throw new Error("Uso: editorial-fingerprint.mjs content <candidate-id> | asset <caminho-relativo> | registered-asset <candidate-id> <cardArt|documentaryPhoto>");
}
