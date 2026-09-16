import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { assertCardArtPilotManifestProvenance } from "../src/card-art-pilot-manifest-provenance.js";
import { assertCardArtPilotAggregationInput } from "../src/card-art-pilot-participant-validation.js";

const inputPath = process.argv[2];
const repoRootUrl = new URL("../../", import.meta.url);
const manifestUrl = new URL("../../stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json", import.meta.url);
const participantSchemaUrl = new URL("../../stages/12_quality_gate_main/references/card-art-pilot-participant-response.schema.json", import.meta.url);
const bundleSchemaUrl = new URL("../../stages/12_quality_gate_main/references/card-art-pilot-response-bundle.schema.json", import.meta.url);
const registrySchemaUrl = new URL("../../stages/12_quality_gate_main/references/card-art-pilot-receipt-registry.schema.json", import.meta.url);
let absoluteInputPath;

function repositoryFileUrl(path) {
  if (typeof path !== "string" || !path || path.includes("\\") || path.startsWith("/") || /^[A-Za-z]:/.test(path) || path.split("/").includes("..")) {
    throw new Error("manifest.receiptRegistry.path inseguro ou ausente");
  }
  return new URL(path, repoRootUrl);
}

if (!inputPath) {
  console.error("Uso: npm run card-art-pilot:validate-participants --prefix app -- <response-bundle.json>");
  process.exitCode = 2;
} else {
  try {
    const invocationDirectory = process.env.INIT_CWD || process.cwd();
    absoluteInputPath = isAbsolute(inputPath) ? inputPath : resolve(invocationDirectory, inputPath);
    const bundle = JSON.parse(await readFile(absoluteInputPath, "utf8"));
    const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
    const [participantSchema, bundleSchema, receiptRegistrySchema] = await Promise.all([
      readFile(participantSchemaUrl, "utf8").then(JSON.parse),
      readFile(bundleSchemaUrl, "utf8").then(JSON.parse),
      readFile(registrySchemaUrl, "utf8").then(JSON.parse)
    ]);
    const receiptRegistry = JSON.parse(await readFile(repositoryFileUrl(manifest?.receiptRegistry?.path), "utf8"));
    const custody = assertCardArtPilotAggregationInput(bundle, manifest, {
      participantSchema,
      bundleSchema,
      receiptRegistrySchema,
      receiptRegistry
    });
    await assertCardArtPilotManifestProvenance(manifest, { firstCollectedAt: custody.firstCollectedAt });
    console.log(`Preflight de agregação aprovado: ${bundle.responses.length} respostas com receipts únicos de um único lote (${absoluteInputPath})`);
  } catch (error) {
    const source = absoluteInputPath ? ` (${absoluteInputPath})` : "";
    console.error(`Falha no preflight de agregação do piloto #176${source}: ${error.message}`);
    process.exitCode = 1;
  }
}
