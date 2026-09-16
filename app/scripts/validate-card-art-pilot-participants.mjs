import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { assertCardArtPilotManifestProvenance } from "../src/card-art-pilot-manifest-provenance.js";
import { assertCardArtPilotAggregationInput } from "../src/card-art-pilot-participant-validation.js";

const inputPath = process.argv[2];
const manifestUrl = new URL("../../stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json", import.meta.url);
const schemaUrl = new URL("../../stages/12_quality_gate_main/references/card-art-pilot-participant-response.schema.json", import.meta.url);
let absoluteInputPath;

if (!inputPath) {
  console.error("Uso: npm run card-art-pilot:validate-participants --prefix app -- <responses.json>");
  process.exitCode = 2;
} else {
  try {
    const invocationDirectory = process.env.INIT_CWD || process.cwd();
    absoluteInputPath = isAbsolute(inputPath) ? inputPath : resolve(invocationDirectory, inputPath);
    const responses = JSON.parse(await readFile(absoluteInputPath, "utf8"));
    const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
    const schema = JSON.parse(await readFile(schemaUrl, "utf8"));
    assertCardArtPilotAggregationInput(responses, manifest, schema);
    await assertCardArtPilotManifestProvenance(manifest);
    console.log(`Preflight de agregação aprovado: ${responses.length} respostas de um único lote (${absoluteInputPath})`);
  } catch (error) {
    const source = absoluteInputPath ? ` (${absoluteInputPath})` : "";
    console.error(`Falha no preflight de agregação do piloto #176${source}: ${error.message}`);
    process.exitCode = 1;
  }
}
