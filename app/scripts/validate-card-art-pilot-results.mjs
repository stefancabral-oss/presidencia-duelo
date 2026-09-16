import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { assertCardArtPilotResultDocument } from "../src/card-art-pilot-results-schema.js";
import { cardArtPilotManifestSha256 } from "../src/card-art-pilot-validation.js";

const resultPath = process.argv[2];
const manifestUrl = new URL("../../stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json", import.meta.url);
const schemaUrl = new URL("../../stages/12_quality_gate_main/references/card-art-pilot-results.schema.json", import.meta.url);
let absoluteResultPath;
if (resultPath === "--manifest-sha256") {
  try {
    const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
    console.log(cardArtPilotManifestSha256(manifest));
  } catch (error) {
    console.error(`Falha ao calcular o SHA-256 do manifesto do piloto #176: ${error.message}`);
    process.exitCode = 1;
  }
} else if (!resultPath) {
  console.error("Uso: npm run card-art-pilot:validate-results --prefix app -- <result.json>|--manifest-sha256");
  process.exitCode = 2;
} else {
  try {
    const invocationDirectory = process.env.INIT_CWD || process.cwd();
    absoluteResultPath = isAbsolute(resultPath) ? resultPath : resolve(invocationDirectory, resultPath);
    const result = JSON.parse(await readFile(absoluteResultPath, "utf8"));
    const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
    const schema = JSON.parse(await readFile(schemaUrl, "utf8"));
    assertCardArtPilotResultDocument(result, manifest, schema);
    console.log(`Draft 2020-12 schema and semantic validation passed: ${absoluteResultPath}`);
  } catch (error) {
    const source = absoluteResultPath ? ` (${absoluteResultPath})` : "";
    console.error(`Falha ao validar o resultado do piloto #176${source}: ${error.message}`);
    process.exitCode = 1;
  }
}
