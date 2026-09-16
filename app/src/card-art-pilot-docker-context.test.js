import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const dockerfileUrl = new URL("../Dockerfile", import.meta.url);
const dockerignoreUrl = new URL("../../.dockerignore", import.meta.url);
const manifestUrl = new URL("../../stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json", import.meta.url);
const verifierUrl = new URL("../scripts/verify-card-art-pilot-excluded.mjs", import.meta.url);
const manifestPath = "stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json";

test("the root Docker context explicitly supplies the isolation manifest before the app build", async () => {
  const [dockerfile, dockerignore, verifier] = await Promise.all([
    readFile(dockerfileUrl, "utf8"),
    readFile(dockerignoreUrl, "utf8"),
    readFile(verifierUrl, "utf8")
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
  assert.equal(activeIgnoreRules.some((rule) => rule.startsWith("stages/12_quality_gate_main")), false);

  const finalStage = dockerfile.slice(dockerfile.indexOf("FROM nginx:"));
  assert.equal(finalStage.includes(manifestPath), false, "the evidence manifest must not enter the nginx image");
  assert.match(finalStage, /COPY --from=build \/repo\/app\/dist \/usr\/share\/nginx\/html/);
});
