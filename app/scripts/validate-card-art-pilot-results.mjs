import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { assertCardArtPilotResultDocument } from "../src/card-art-pilot-results-schema.js";
import { cardArtPilotManifestSha256 } from "../src/card-art-pilot-validation.js";
import { assertCardArtPilotManifestProvenance } from "../src/card-art-pilot-manifest-provenance.js";
import {
  assertCardArtPilotAggregationInput,
  assertCardArtPilotResultCustody
} from "../src/card-art-pilot-participant-validation.js";

const resultPath = process.argv[2];
const bundlePath = process.argv[3];
const repoRootUrl = new URL("../../", import.meta.url);
const manifestUrl = new URL("../../stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json", import.meta.url);
const schemaUrl = new URL("../../stages/12_quality_gate_main/references/card-art-pilot-results.schema.json", import.meta.url);
const participantSchemaUrl = new URL("../../stages/12_quality_gate_main/references/card-art-pilot-participant-response.schema.json", import.meta.url);
const bundleSchemaUrl = new URL("../../stages/12_quality_gate_main/references/card-art-pilot-response-bundle.schema.json", import.meta.url);
const registrySchemaUrl = new URL("../../stages/12_quality_gate_main/references/card-art-pilot-receipt-registry.schema.json", import.meta.url);
let absoluteResultPath;
let absoluteBundlePath;

function repositoryFileUrl(path) {
  if (typeof path !== "string" || !path || path.includes("\\") || path.startsWith("/") || /^[A-Za-z]:/.test(path) || path.split("/").includes("..")) {
    throw new Error("manifest.receiptRegistry.path inseguro ou ausente");
  }
  return new URL(path, repoRootUrl);
}
if (resultPath === "--manifest-sha256") {
  try {
    const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
    console.log(cardArtPilotManifestSha256(manifest));
  } catch (error) {
    console.error(`Falha ao calcular o SHA-256 do manifesto do piloto #176: ${error.message}`);
    process.exitCode = 1;
  }
} else if (!resultPath || !bundlePath) {
  console.error("Uso: npm run card-art-pilot:validate-results --prefix app -- <result.json> <response-bundle.json>|--manifest-sha256");
  process.exitCode = 2;
} else {
  try {
    const invocationDirectory = process.env.INIT_CWD || process.cwd();
    absoluteResultPath = isAbsolute(resultPath) ? resultPath : resolve(invocationDirectory, resultPath);
    absoluteBundlePath = isAbsolute(bundlePath) ? bundlePath : resolve(invocationDirectory, bundlePath);
    const result = JSON.parse(await readFile(absoluteResultPath, "utf8"));
    const bundle = JSON.parse(await readFile(absoluteBundlePath, "utf8"));
    const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
    const [schema, participantSchema, bundleSchema, receiptRegistrySchema] = await Promise.all([
      readFile(schemaUrl, "utf8").then(JSON.parse),
      readFile(participantSchemaUrl, "utf8").then(JSON.parse),
      readFile(bundleSchemaUrl, "utf8").then(JSON.parse),
      readFile(registrySchemaUrl, "utf8").then(JSON.parse)
    ]);
    assertCardArtPilotResultDocument(result, manifest, schema);
    const receiptRegistry = JSON.parse(await readFile(repositoryFileUrl(manifest?.receiptRegistry?.path), "utf8"));
    const custody = assertCardArtPilotAggregationInput(bundle, manifest, {
      participantSchema,
      bundleSchema,
      receiptRegistrySchema,
      receiptRegistry
    });
    assertCardArtPilotResultCustody(result, bundle, receiptRegistry);
    await assertCardArtPilotManifestProvenance(manifest, { firstCollectedAt: custody.firstCollectedAt });
    console.log(`Schema, semântica, bundle individual, custódia e proveniência aprovados: ${absoluteResultPath}`);
  } catch (error) {
    const source = absoluteResultPath ? ` (${absoluteResultPath}${absoluteBundlePath ? ` + ${absoluteBundlePath}` : ""})` : "";
    console.error(`Falha ao validar o resultado do piloto #176${source}: ${error.message}`);
    process.exitCode = 1;
  }
}
