import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const dockerfileUrl = new URL("../Dockerfile", import.meta.url);
const dockerignoreUrl = new URL("../../.dockerignore", import.meta.url);
const manifestUrl = new URL("../../stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json", import.meta.url);
const verifierUrl = new URL("../scripts/verify-card-art-pilot-excluded.mjs", import.meta.url);
const workflowUrl = new URL("../../.github/workflows/design-validator.yml", import.meta.url);
const manifestPath = "stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json";

test("the root Docker context explicitly supplies the isolation manifest before the app build", async () => {
  const [dockerfile, dockerignore, verifier, workflow] = await Promise.all([
    readFile(dockerfileUrl, "utf8"),
    readFile(dockerignoreUrl, "utf8"),
    readFile(verifierUrl, "utf8"),
    readFile(workflowUrl, "utf8")
  ]);
  await access(manifestUrl);

  const copyInstruction = `COPY ${manifestPath} ${manifestPath}`;
  const copyPosition = dockerfile.indexOf(copyInstruction);
  const buildPosition = dockerfile.indexOf("RUN npm run build --prefix app");
  assert.notEqual(copyPosition, -1, "app/Dockerfile must copy the evidence manifest from the repository-root context");
  assert.ok(copyPosition < buildPosition, "the evidence manifest must exist before npm run build invokes the isolation verifier");
  assert.match(verifier, new RegExp(manifestPath.replaceAll("/", "\\/")));

  const activeIgnoreRules = dockerignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  assert.equal(activeIgnoreRules.includes("stages"), false);
  assert.ok(activeIgnoreRules.includes("stages/12_quality_gate_main/evidence/card-art-pilot-176/*"));
  assert.ok(activeIgnoreRules.includes("!stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json"));

  const finalStage = dockerfile.slice(dockerfile.indexOf("FROM nginx:"));
  assert.equal(finalStage.includes(manifestPath), false, "the evidence manifest must not enter the nginx image");
  assert.match(finalStage, /COPY --from=build \/repo\/app\/dist \/usr\/share\/nginx\/html/);

  assert.match(workflow, /docker build --file app\/Dockerfile --tag polimatch-app:pilot-176 \./);
  assert.match(workflow, /fetch-depth:\s*0/, "provenance tests require the complete Git history");
  for (const trigger of [
    "'app/**'",
    "'shared/**'",
    "'.dockerignore'",
    "'CREDITS.md'",
    "'stages/12_quality_gate_main/evidence/card-art-pilot-176/**'",
    "'stages/12_quality_gate_main/output/card-art-pilot-results.json'",
    "'stages/12_quality_gate_main/references/card-art-pilot-participant-response.schema.json'",
    "'stages/12_quality_gate_main/references/card-art-pilot-results.schema.json'"
  ]) {
    assert.ok(workflow.includes(trigger), `remote Docker gate must run when ${trigger} changes`);
  }
});
