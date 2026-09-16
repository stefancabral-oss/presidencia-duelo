import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { assertCardArtPilotResults, validateCardArtPilotResults } from "./card-art-pilot-validation.js";
import { readyManifestFixture, validResultFixture } from "./fixtures/card-art-pilot-validation-fixtures.js";

const currentManifestUrl = new URL("../../stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json", import.meta.url);

test("a coherent aggregate passes semantic validation", () => {
  assert.deepEqual(validateCardArtPilotResults(validResultFixture(), readyManifestFixture()), []);
});

test("all blind codes must be present exactly once", () => {
  const result = validResultFixture();
  result.assets[7].blindCode = "P01";
  const errors = validateCardArtPilotResults(result, readyManifestFixture());
  assert.ok(errors.some((error) => error.includes("P01 precisa aparecer exatamente uma vez; encontrado 2")));
  assert.ok(errors.some((error) => error.includes("P08 precisa aparecer exatamente uma vez; encontrado 0")));
});

test("participant strata, denominators, counts and rates must reconcile", () => {
  const result = validResultFixture();
  result.sample.participantCount = 41;
  result.assets[0].recognition.correct = 31;
  result.assets[0].neutrality.favoreceRate = 0.2;
  result.assets[0].byDisplayScenario["mobile-390x844"].validResponses = 19;
  const errors = validateCardArtPilotResults(result, readyManifestFixture());
  assert.ok(errors.some((error) => error.includes("sample.displayScenarios: soma 40 difere do denominador 41")));
  assert.ok(errors.some((error) => error.includes("sample.strata.regional: soma 40 difere do denominador 41")));
  assert.ok(errors.some((error) => error.includes("recognition: soma 39 difere do denominador 40")));
  assert.ok(errors.some((error) => error.includes("favoreceRate: taxa 0.2 difere de 4/40")));
  assert.ok(errors.some((error) => error.includes("byDisplayScenario.validResponses: soma 39 difere do denominador 40")));
});

test("seguir is blocked below 70 percent recognition in either scenario", () => {
  const result = validResultFixture("seguir");
  const asset = result.assets[0];
  asset.byDisplayScenario["mobile-390x844"].recognized = 13;
  asset.byDisplayScenario["mobile-390x844"].recognitionRate = 0.65;
  asset.recognition.correct = 29;
  asset.recognition.incorrect = 7;
  asset.recognition.rate = 0.725;
  const errors = validateCardArtPilotResults(result, readyManifestFixture());
  assert.ok(errors.some((error) => error.includes("seguir exige reconhecimento mínimo de 70%")));
});

test("seguir is blocked by rejected or pending human reviews", () => {
  const result = validResultFixture("seguir");
  result.assets[0].identityReview.status = "rejected";
  result.assets[1].dignityReview.status = "pending";
  const errors = validateCardArtPilotResults(result, readyManifestFixture());
  assert.ok(errors.some((error) => error.includes("identityReview.status") && error.includes("rejected")));
  assert.ok(errors.some((error) => error.includes("dignityReview.status") && error.includes("pending")));
});

test("seguir is blocked by a pending reference license", () => {
  const result = validResultFixture("seguir");
  const manifest = readyManifestFixture();
  manifest.assets[2].identityReference.licenseStatus = "license-pending";
  const errors = validateCardArtPilotResults(result, manifest);
  assert.ok(errors.some((error) => error.includes("manifest.assets.P03") && error.includes("license-pending")));
});

test("seguir requires twenty external participants per scenario and an accountable attestation", () => {
  const result = validResultFixture("seguir");
  result.sample.displayScenarios["mobile-390x844"] = 19;
  result.sample.externalRecruitment.externalParticipantsOnly = false;
  result.sample.externalRecruitment.attestedBy = "";
  const errors = validateCardArtPilotResults(result, readyManifestFixture());
  assert.ok(errors.some((error) => error.includes("mobile-390x844") && error.includes("ao menos 20")));
  assert.ok(errors.some((error) => error.includes("seguir exige pelo menos 20 participantes externos")));
  assert.ok(errors.some((error) => error.includes("atestação responsável e datada")));
});

test("the aggregate rejects participant records and weakened privacy controls", () => {
  const result = validResultFixture();
  result.sample.participants = [{ name: "não deve existir" }];
  result.sample.externalRecruitment.participantEmails = ["não@deve.existir"];
  result.sample.privacy.containsParticipantRecords = true;
  result.sample.privacy.minimumPublishedCellSize = 1;
  result.sample.privacy.crossTabsPublished = true;
  result.sample.privacy.rawExportsDeletedAfterConsolidation = false;
  const errors = validateCardArtPilotResults(result, readyManifestFixture());
  assert.ok(errors.some((error) => error.includes("sample.participants") && error.includes("campo não permitido")));
  assert.ok(errors.some((error) => error.includes("participantEmails") && error.includes("campo não permitido")));
  assert.ok(errors.some((error) => error.includes("containsParticipantRecords") && error.includes("false")));
  assert.ok(errors.some((error) => error.includes("minimumPublishedCellSize") && error.includes("5")));
  assert.ok(errors.some((error) => error.includes("crossTabsPublished") && error.includes("false")));
  assert.ok(errors.some((error) => error.includes("rawExportsDeletedAfterConsolidation") && error.includes("true")));
});

test("the CLI resolves a relative result path from the npm invocation directory", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "card-art-pilot-176-"));
  const resultPath = join(temporaryDirectory, "result.json");
  try {
    await writeFile(resultPath, JSON.stringify(validResultFixture()), "utf8");
    const cliPath = fileURLToPath(new URL("../scripts/validate-card-art-pilot-results.mjs", import.meta.url));
    const execution = spawnSync(process.execPath, [cliPath, basename(resultPath)], {
      cwd: temporaryDirectory,
      encoding: "utf8",
      env: { ...process.env, INIT_CWD: temporaryDirectory }
    });
    assert.equal(execution.status, 0, execution.stderr);
    assert.match(execution.stdout, /semantic validation passed/);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("the current invalidated manifest cannot support a seguir decision", async () => {
  const currentManifest = JSON.parse(await readFile(currentManifestUrl, "utf8"));
  const result = validResultFixture("seguir");
  const errors = validateCardArtPilotResults(result, currentManifest);
  assert.ok(errors.some((error) => error.includes("collectionAllowed")));
  assert.ok(errors.some((error) => error.includes("scaleDecisionAllowed")));
  assert.ok(errors.some((error) => error.includes("license-pending")));
  assert.throws(() => assertCardArtPilotResults(result, currentManifest), /Resultado do piloto #176 inválido/);
});
