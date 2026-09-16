import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { assertCardArtPilotResults, validateCardArtPilotResults } from "./card-art-pilot-validation.js";
import { validateCardArtPilotResultDocument, validateCardArtPilotResultSchema } from "./card-art-pilot-results-schema.js";
import { readyManifestFixture, validResultFixture } from "./fixtures/card-art-pilot-validation-fixtures.js";

const currentManifestUrl = new URL("../../stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json", import.meta.url);
const resultSchemaUrl = new URL("../../stages/12_quality_gate_main/references/card-art-pilot-results.schema.json", import.meta.url);
const cliPath = fileURLToPath(new URL("../scripts/validate-card-art-pilot-results.mjs", import.meta.url));

async function resultSchema() {
  return JSON.parse(await readFile(resultSchemaUrl, "utf8"));
}

function executeCli(resultPath, directory) {
  return spawnSync(process.execPath, [cliPath, basename(resultPath)], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, INIT_CWD: directory }
  });
}

function keepOnlyOneValidResponsePerScenario(asset) {
  asset.validResponses = 2;
  asset.recognition = { correct: 2, incorrect: 0, unknown: 0, rate: 1 };
  asset.neutrality = {
    favorece: 0,
    neutra: 2,
    prejudica: 0,
    favoreceRate: 0,
    neutraRate: 1,
    prejudicaRate: 0,
    balancePercentagePoints: 0
  };
  for (const scenario of Object.values(asset.byDisplayScenario)) {
    Object.assign(scenario, {
      validResponses: 1,
      recognized: 1,
      recognitionRate: 1,
      favorece: 0,
      neutra: 1,
      prejudica: 0,
      favoreceRate: 0,
      neutraRate: 1,
      prejudicaRate: 0
    });
  }
}

test("a coherent aggregate passes semantic validation", () => {
  assert.deepEqual(validateCardArtPilotResults(validResultFixture(), readyManifestFixture()), []);
});

test("a coherent aggregate passes Draft 2020-12 schema before semantic validation", async () => {
  assert.deepEqual(
    validateCardArtPilotResultDocument(validResultFixture(), readyManifestFixture(), await resultSchema()),
    []
  );
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

test("collection is blocked when documented license metadata is incomplete", () => {
  const manifest = readyManifestFixture();
  delete manifest.assets[0].identityReference.photographer;
  const errors = validateCardArtPilotResults(validResultFixture("iterar"), manifest);
  assert.ok(errors.some((error) => error.includes("manifest.assets.P01.identityReference.photographer")));
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
  result.participantRecords = [{ name: "não deve existir" }];
  result.sample.participants = [{ name: "não deve existir" }];
  result.sample.externalRecruitment.participantEmails = ["não@deve.existir"];
  result.sample.externalRecruitment.attestedBy = "Responsável responsavel@example.org CPF 123.456.789-09";
  result.sample.privacy.containsParticipantRecords = true;
  result.sample.privacy.minimumPublishedCellSize = 1;
  result.sample.privacy.crossTabsPublished = true;
  result.sample.privacy.rawExportsDeletedAfterConsolidation = false;
  const errors = validateCardArtPilotResults(result, readyManifestFixture());
  assert.ok(errors.some((error) => error.includes("result.participantRecords") && error.includes("PII")));
  assert.ok(errors.some((error) => error.includes("sample.participants") && error.includes("campo não permitido")));
  assert.ok(errors.some((error) => error.includes("participantEmails") && error.includes("campo não permitido")));
  assert.ok(errors.some((error) => error.includes("attestedBy") && error.includes("e-mail")));
  assert.ok(errors.some((error) => error.includes("attestedBy") && error.includes("CPF")));
  assert.ok(errors.some((error) => error.includes("containsParticipantRecords") && error.includes("false")));
  assert.ok(errors.some((error) => error.includes("minimumPublishedCellSize") && error.includes("5")));
  assert.ok(errors.some((error) => error.includes("crossTabsPublished") && error.includes("false")));
  assert.ok(errors.some((error) => error.includes("rawExportsDeletedAfterConsolidation") && error.includes("true")));
});

test("every asset needs twenty valid external responses in each scenario for any decision", () => {
  const result = validResultFixture("iterar");
  keepOnlyOneValidResponsePerScenario(result.assets[0]);
  const errors = validateCardArtPilotResults(result, readyManifestFixture());
  assert.ok(errors.some((error) => error.includes("mobile-390x844.validResponses") && error.includes("ao menos 20 respostas válidas externas")));
  assert.ok(errors.some((error) => error.includes("desktop-1000x800.validResponses") && error.includes("ao menos 20 respostas válidas externas")));
});

test("Draft 2020-12 schema rejects the exact PII and unsigned-result bypass", async () => {
  const result = validResultFixture("seguir");
  result.participantRecords = [{ name: "Participante", email: "participante@example.org", cpf: "123.456.789-09" }];
  result.assets[0].rawAnswers = [{ participantEmail: "participante@example.org" }];
  result.assets[0].identityReview = { status: "approved" };
  result.assets[0].dignityReview = { status: "approved" };
  result.decision = { value: "seguir" };

  const errors = validateCardArtPilotResultSchema(result, await resultSchema());
  assert.ok(errors.some((error) => error.includes("participantRecords") && error.includes("propriedade não permitida")));
  assert.ok(errors.some((error) => error.includes("rawAnswers") && error.includes("propriedade não permitida")));
  for (const missing of ["reviewedBy", "reviewedAt", "notes", "decidedBy", "decidedAt", "rationale"]) {
    assert.ok(errors.some((error) => error.includes(missing) && error.includes("campo obrigatório ausente")), missing);
  }
});

test("the CLI resolves a relative result path and rejects every result for the invalidated batch", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "card-art-pilot-176-"));
  const resultPath = join(temporaryDirectory, "result.json");
  try {
    await writeFile(resultPath, JSON.stringify(validResultFixture()), "utf8");
    const execution = executeCli(resultPath, temporaryDirectory);
    assert.equal(execution.status, 1, execution.stdout);
    assert.match(execution.stderr, /manifest\.collectionAllowed/);
    assert.match(execution.stderr, new RegExp(basename(resultPath).replace(".", "\\.")));
    assert.doesNotMatch(execution.stderr, /ENOENT/);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("the CLI validates schema before semantics", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "card-art-pilot-176-schema-"));
  const resultPath = join(temporaryDirectory, "malicious-result.json");
  const result = validResultFixture("seguir");
  result.participantRecords = [{ email: "participante@example.org" }];
  result.decision = { value: "seguir" };
  try {
    await writeFile(resultPath, JSON.stringify(result), "utf8");
    const execution = executeCli(resultPath, temporaryDirectory);
    assert.equal(execution.status, 1, execution.stdout);
    assert.match(execution.stderr, /schema.*participantRecords.*propriedade não permitida/i);
    assert.match(execution.stderr, /decidedBy.*campo obrigatório ausente/i);
    assert.doesNotMatch(execution.stderr, /manifest\.collectionAllowed/);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("the current invalidated manifest cannot support any consolidated decision", async () => {
  const currentManifest = JSON.parse(await readFile(currentManifestUrl, "utf8"));
  for (const decision of ["seguir", "iterar", "abandonar"]) {
    const result = validResultFixture(decision);
    const errors = validateCardArtPilotResults(result, currentManifest);
    assert.ok(errors.some((error) => error.includes("manifest.collectionAllowed")), decision);
    assert.ok(errors.some((error) => error.includes("license-pending")), decision);
    if (decision === "seguir") assert.ok(errors.some((error) => error.includes("scaleDecisionAllowed")));
    assert.throws(() => assertCardArtPilotResults(result, currentManifest), /Resultado do piloto #176 inválido/);
  }
});
