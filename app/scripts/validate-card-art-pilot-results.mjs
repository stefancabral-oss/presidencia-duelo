import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { assertCardArtPilotResults } from "../src/card-art-pilot-validation.js";

const resultPath = process.argv[2];
if (!resultPath) {
  console.error("Uso: npm run card-art-pilot:validate-results --prefix app -- <result.json>");
  process.exitCode = 2;
} else {
  try {
    const invocationDirectory = process.env.INIT_CWD || process.cwd();
    const absoluteResultPath = isAbsolute(resultPath) ? resultPath : resolve(invocationDirectory, resultPath);
    const result = JSON.parse(await readFile(absoluteResultPath, "utf8"));
    const manifestUrl = new URL("../../stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json", import.meta.url);
    const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
    assertCardArtPilotResults(result, manifest);
    console.log(`semantic validation passed: ${absoluteResultPath}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
