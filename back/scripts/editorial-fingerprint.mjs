import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import EDITORIAL_ASSETS from "../../shared/editorial-asset-registry.json" with { type: "json" };
import {
  PUBLIC_CANDIDATE_SCHEMA_V2,
  assetApprovalFingerprint,
  candidateContentFingerprint,
  candidateRoutingFingerprint,
  sha256Fingerprint,
} from "../src/editorial-gate.js";
import { approvalAuthorityRequestFingerprint } from "../src/editorial-authority.js";
import { textBlobFingerprint } from "../src/editorial-integrity.js";

const [kind, value, secondaryValue] = process.argv.slice(2);

if (kind === "content") {
  const candidate = CATALOG.find(({ id }) => id === value);
  if (!candidate) throw new Error(`Candidato desconhecido: ${value || ""}`);
  console.log(candidateContentFingerprint(candidate, { ruleset: secondaryValue || PUBLIC_CANDIDATE_SCHEMA_V2 }));
} else if (kind === "routing") {
  const candidate = CATALOG.find(({ id }) => id === value);
  if (!candidate) throw new Error(`Candidato desconhecido: ${value || ""}`);
  console.log(candidateRoutingFingerprint(candidate, { ruleset: secondaryValue || PUBLIC_CANDIDATE_SCHEMA_V2 }));
} else if (kind === "asset") {
  if (!value) throw new Error("Informe o caminho do asset relativo ao repositório");
  const repositoryRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
  const absolutePath = path.resolve(repositoryRoot, value);
  const relative = path.relative(repositoryRoot, absolutePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Caminho fora do repositório");
  console.log(sha256Fingerprint(await readFile(absolutePath)));
} else if (kind === "file") {
  if (!value) throw new Error("Informe o caminho textual relativo ao repositório");
  const repositoryRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
  const absolutePath = path.resolve(repositoryRoot, value);
  const relative = path.relative(repositoryRoot, absolutePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Caminho fora do repositório");
  console.log(textBlobFingerprint(await readFile(absolutePath), value));
} else if (kind === "authority-request") {
  if (!value) throw new Error("Informe o caminho da atestação relativo ao repositório");
  const repositoryRoot = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
  const absolutePath = path.resolve(repositoryRoot, value);
  const relative = path.relative(repositoryRoot, absolutePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Caminho fora do repositório");
  const attestation = JSON.parse(await readFile(absolutePath, "utf8"));
  console.log(approvalAuthorityRequestFingerprint(attestation));
} else if (kind === "registered-asset") {
  const asset = EDITORIAL_ASSETS.assets.find(({ candidateId, kind: assetKind }) => (
    candidateId === value && assetKind === secondaryValue
  ));
  if (!asset) throw new Error(`Asset registrado não encontrado: ${value || ""}.${secondaryValue || ""}`);
  console.log(assetApprovalFingerprint(asset));
} else {
  throw new Error("Uso: editorial-fingerprint.mjs content|routing <candidate-id> [candidate-public-v1|candidate-public-v2] | asset <caminho-binário> | file <caminho-textual> | authority-request <atestação.json> | registered-asset <candidate-id> <cardArt|documentaryPhoto>");
}
