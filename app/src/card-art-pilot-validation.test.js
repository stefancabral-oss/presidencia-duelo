import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { assertCardArtPilotResults, cardArtPilotManifestSha256, validateCardArtPilotResults } from "./card-art-pilot-validation.js";
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

function setScenarioNeutrality(metrics, favorece, neutra, prejudica) {
  const total = favorece + neutra + prejudica;
  Object.assign(metrics, {
    validResponses: total,
    favorece,
    neutra,
    prejudica,
    favoreceRate: favorece / total,
    neutraRate: neutra / total,
    prejudicaRate: prejudica / total
  });
}

function setAssetNeutrality(asset, mobile, desktop) {
  setScenarioNeutrality(asset.byDisplayScenario["mobile-390x844"], ...mobile);
  setScenarioNeutrality(asset.byDisplayScenario["desktop-1000x800"], ...desktop);
  const favorece = mobile[0] + desktop[0];
  const neutra = mobile[1] + desktop[1];
  const prejudica = mobile[2] + desktop[2];
  const total = favorece + neutra + prejudica;
  asset.neutrality = {
    favorece,
    neutra,
    prejudica,
    favoreceRate: favorece / total,
    neutraRate: neutra / total,
    prejudicaRate: prejudica / total,
    balancePercentagePoints: ((favorece - prejudica) / total) * 100
  };
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

test("the result is cryptographically bound to every material field of the complete manifest", () => {
  const originalManifest = readyManifestFixture();
  const result = validResultFixture("seguir", originalManifest);
  const mutations = [
    ["version", (manifest) => { manifest.version = "batch-3"; }],
    ["status", (manifest) => { manifest.status = "pilot-replaced"; }],
    ["style", (manifest) => { manifest.currentStyleGuideVersion = "pilot-3"; }],
    ["assets", (manifest) => { manifest.assets.reverse(); }],
    ["person", (manifest) => { manifest.assets[0].personId = "999"; }],
    ["file", (manifest) => { manifest.assets[0].file = "replacement.png"; }],
    ["art hash", (manifest) => { manifest.assets[0].sha256 = "f".repeat(64); }],
    ["reference", (manifest) => { manifest.assets[0].identityReference.photoSource = "https://example.test/replacement.jpg"; }],
    ["reference hash", (manifest) => { manifest.assets[0].identityReference.sha256 = "e".repeat(64); }],
    ["license", (manifest) => { manifest.assets[0].identityReference.license = "CC0"; }]
  ];

  for (const [label, mutate] of mutations) {
    const changedManifest = structuredClone(originalManifest);
    mutate(changedManifest);
    const errors = validateCardArtPilotResults(result, changedManifest);
    assert.ok(
      errors.some((error) => error.includes("batch.manifestSha256") && error.includes("outro lote")),
      `${label} mutation must invalidate replay`
    );
  }
});

test("the Draft schema requires a lowercase SHA-256 manifest fingerprint at the document root", async () => {
  const schema = await resultSchema();
  const missing = validResultFixture();
  delete missing.batch;
  const malformed = validResultFixture();
  malformed.batch.manifestSha256 = "ABC123";
  const legacy = validResultFixture();
  delete legacy.batch.version;
  delete legacy.batch.assets;

  assert.ok(validateCardArtPilotResultSchema(missing, schema).some((error) => error.includes("batch") && error.includes("obrigatório")));
  assert.ok(validateCardArtPilotResultSchema(malformed, schema).some((error) => error.includes("batch/manifestSha256")));
  assert.ok(validateCardArtPilotResultSchema(legacy, schema).some((error) => error.includes("version") && error.includes("obrigatório")));
  assert.ok(validateCardArtPilotResultSchema(legacy, schema).some((error) => error.includes("assets") && error.includes("obrigatório")));
});

test("the CLI prints the canonical fingerprint of the committed manifest", async () => {
  const currentManifest = JSON.parse(await readFile(currentManifestUrl, "utf8"));
  const execution = spawnSync(process.execPath, [cliPath, "--manifest-sha256"], { encoding: "utf8" });
  assert.equal(execution.status, 0, execution.stderr);
  assert.equal(execution.stdout.trim(), cardArtPilotManifestSha256(currentManifest));
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

test("seguir rejects the same 30 percent favorable bias in all eight assets", () => {
  const manifest = readyManifestFixture();
  const result = validResultFixture("seguir", manifest);
  for (const asset of result.assets) setAssetNeutrality(asset, [6, 14, 0], [6, 14, 0]);

  const errors = validateCardArtPilotResults(result, manifest);
  assert.ok(errors.some((error) => error.includes("P01") && error.includes("neutrality.favoreceRate") && error.includes("20%")));
  assert.ok(errors.some((error) => error.includes("P08") && error.includes("mobile-390x844.favoreceRate") && error.includes("20%")));
  assert.equal(errors.some((error) => error.includes("discrepância superior a 20")), false, "uniform bias must not depend on cross-image spread");
});

test("seguir rejects scenario prejudice above 20 percent even when the asset total is exactly 20 percent", () => {
  const manifest = readyManifestFixture();
  const result = validResultFixture("seguir", manifest);
  setAssetNeutrality(result.assets[0], [2, 13, 5], [2, 15, 3]);

  const errors = validateCardArtPilotResults(result, manifest);
  assert.ok(errors.some((error) => error.includes("P01") && error.includes("mobile-390x844.prejudicaRate") && error.includes("20%")));
  assert.equal(errors.some((error) => error.includes("P01") && error.includes("neutrality.prejudicaRate") && error.includes("seguir exige")), false);
});

test("seguir accepts the exact 20 percent neutrality boundary", () => {
  const manifest = readyManifestFixture();
  const result = validResultFixture("seguir", manifest);
  for (const asset of result.assets) setAssetNeutrality(asset, [4, 12, 4], [4, 12, 4]);

  const errors = validateCardArtPilotResults(result, manifest);
  assert.equal(errors.some((error) => error.includes("favoreceRate") && error.includes("seguir exige")), false);
  assert.equal(errors.some((error) => error.includes("prejudicaRate") && error.includes("seguir exige")), false);
});

test("seguir rejects a recognition gap above 15 percentage points even when both scenarios exceed 70 percent", () => {
  const manifest = readyManifestFixture();
  const result = validResultFixture("seguir", manifest);
  const asset = result.assets[0];
  Object.assign(asset.byDisplayScenario["mobile-390x844"], { recognized: 19, recognitionRate: 0.95 });
  Object.assign(asset.byDisplayScenario["desktop-1000x800"], { recognized: 15, recognitionRate: 0.75 });
  Object.assign(asset.recognition, { correct: 34, incorrect: 3, unknown: 3, rate: 0.85 });

  const errors = validateCardArtPilotResults(result, manifest);
  assert.ok(errors.some((error) => error.includes("P01") && error.includes("no máximo 15 pontos percentuais")));
});

test("seguir accepts a recognition gap of exactly 15 percentage points", () => {
  const manifest = readyManifestFixture();
  const result = validResultFixture("seguir", manifest);
  const asset = result.assets[0];
  Object.assign(asset.byDisplayScenario["mobile-390x844"], { recognized: 18, recognitionRate: 0.9 });
  Object.assign(asset.byDisplayScenario["desktop-1000x800"], { recognized: 15, recognitionRate: 0.75 });
  Object.assign(asset.recognition, { correct: 33, incorrect: 3, unknown: 4, rate: 0.825 });

  const errors = validateCardArtPilotResults(result, manifest);
  assert.equal(errors.some((error) => error.includes("diferença de reconhecimento")), false);
});

test("seguir is blocked by rejected or pending human reviews", () => {
  const result = validResultFixture("seguir");
  result.assets[0].identityReview.status = "rejected";
  result.assets[1].dignityReview.status = "pending";
  const errors = validateCardArtPilotResults(result, readyManifestFixture());
  assert.ok(errors.some((error) => error.includes("identityReview.status") && error.includes("rejected")));
  assert.ok(errors.some((error) => error.includes("dignityReview.status") && error.includes("pending")));
});

test("human signatures, review notes and rationale cannot be whitespace", async () => {
  const manifest = readyManifestFixture();
  const result = validResultFixture("seguir", manifest);
  result.assets[0].identityReview.reviewedBy = " ";
  result.assets[0].identityReview.notes = "\t";
  result.decision.decidedBy = " ";
  result.decision.rationale = "\n";

  const semanticErrors = validateCardArtPilotResults(result, manifest);
  assert.ok(semanticErrors.some((error) => error.includes("identityReview.reviewedBy") && error.includes("vazio")));
  assert.ok(semanticErrors.some((error) => error.includes("identityReview.notes") && error.includes("vazias")));
  assert.ok(semanticErrors.some((error) => error.includes("decision.decidedBy") && error.includes("vazio")));
  assert.ok(semanticErrors.some((error) => error.includes("decision.rationale") && error.includes("vazia")));

  const schemaErrors = validateCardArtPilotResultSchema(result, await resultSchema());
  for (const field of ["reviewedBy", "notes", "decidedBy", "rationale"]) {
    assert.ok(schemaErrors.some((error) => error.includes(field) && error.includes("pattern")), field);
  }
});

test("human chronology is attestation and reviews, then decision, then consolidated document", () => {
  const manifest = readyManifestFixture();
  const result = validResultFixture("seguir", manifest);
  result.sample.externalRecruitment.attestedAt = "2026-09-16T14:30:00Z";
  result.assets[0].identityReview.reviewedAt = "9999-12-31T23:59:59Z";
  result.assets[0].dignityReview.reviewedAt = "0001-01-01T00:00:00Z";
  result.decision.decidedAt = "2026-09-16T14:00:00Z";
  result.generatedAt = "2026-09-16T13:00:00Z";

  const errors = validateCardArtPilotResults(result, manifest);
  assert.ok(errors.some((error) => error.includes("externalRecruitment.attestedAt") && error.includes("posterior à decisão")));
  assert.ok(errors.some((error) => error.includes("identityReview.reviewedAt") && error.includes("posterior à decisão")));
  assert.ok(errors.some((error) => error.includes("identityReview.reviewedAt") && error.includes("366 dias")));
  assert.ok(errors.some((error) => error.includes("dignityReview.reviewedAt") && error.includes("anteceder a geração do lote")));
  assert.ok(errors.some((error) => error.includes("decision.decidedAt") && error.includes("posterior à geração do consolidado")));
});

test("all accountable timestamps reject the future through an injectable clock with five minutes tolerance", () => {
  const now = Date.parse("2026-09-16T03:00:00Z");
  const manifest = readyManifestFixture();
  const result = validResultFixture("iterar", manifest);
  result.sample.externalRecruitment.attestedAt = "2026-09-16T03:06:00Z";
  for (const asset of result.assets) {
    asset.identityReview.reviewedAt = "2026-09-16T03:07:00Z";
    asset.dignityReview.reviewedAt = "2026-09-16T03:07:00Z";
  }
  result.decision.decidedAt = "2026-09-16T03:08:00Z";
  result.generatedAt = "2026-09-16T03:09:00Z";

  const errors = validateCardArtPilotResults(result, manifest, { clock: () => now });
  for (const path of [
    "sample.externalRecruitment.attestedAt",
    "identityReview.reviewedAt",
    "dignityReview.reviewedAt",
    "decision.decidedAt",
    "generatedAt"
  ]) {
    assert.ok(errors.some((error) => error.includes(path) && error.includes("futuro")), path);
  }

  result.sample.externalRecruitment.attestedAt = "2026-09-16T03:01:00Z";
  for (const asset of result.assets) {
    asset.identityReview.reviewedAt = "2026-09-16T03:02:00Z";
    asset.dignityReview.reviewedAt = "2026-09-16T03:02:00Z";
  }
  result.decision.decidedAt = "2026-09-16T03:04:00Z";
  result.generatedAt = "2026-09-16T03:05:00Z";
  assert.equal(validateCardArtPilotResults(result, manifest, { clock: () => now })
    .some((error) => error.includes("não pode estar no futuro")), false);
});

test("manifest generation and guide timestamps use the same injectable future bound", () => {
  const now = Date.parse("2026-09-16T03:00:00Z");
  const manifest = readyManifestFixture();
  manifest.styleGuideVersionedAt = "2026-09-16T03:06:00Z";
  manifest.generatedAt = "2026-09-16T03:07:00Z";
  const errors = validateCardArtPilotResults(validResultFixture("iterar", manifest), manifest, { now });
  assert.ok(errors.some((error) => error.includes("manifest.styleGuideVersionedAt") && error.includes("futuro")));
  assert.ok(errors.some((error) => error.includes("manifest.generatedAt") && error.includes("futuro")));
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

test("a result cannot legitimize an originally hashless or style-incoherent ready manifest", () => {
  const manifest = readyManifestFixture();
  manifest.styleGuide = "docs/design/OUTRO_GUIA.md";
  manifest.styleGuideAtGeneration = "pilot-1";
  manifest.tool = " ";
  manifest.commonPrompt = "";
  manifest.participantResponseSchema = "schema-inventado.json";
  delete manifest.generationCommit;
  delete manifest.styleGuideCommitAtGeneration;
  delete manifest.styleGuideSha256AtGeneration;
  delete manifest.assets[0].sha256;
  delete manifest.assets[0].generationPath;
  delete manifest.assets[0].sourceOutput;
  delete manifest.assets[0].identityReference.sha256;
  delete manifest.assets[0].identityReference.path;
  const result = validResultFixture("iterar", manifest);

  const errors = validateCardArtPilotResults(result, manifest);
  assert.ok(errors.some((error) => error.includes("manifest.styleGuide") && error.includes("guia canônico")));
  assert.ok(errors.some((error) => error.includes("manifest.styleGuideAtGeneration") && error.includes("versão vigente")));
  assert.ok(errors.some((error) => error.includes("manifest.tool")));
  assert.ok(errors.some((error) => error.includes("manifest.commonPrompt")));
  assert.ok(errors.some((error) => error.includes("manifest.participantResponseSchema")));
  assert.ok(errors.some((error) => error.includes("manifest.generationCommit")));
  assert.ok(errors.some((error) => error.includes("manifest.styleGuideCommitAtGeneration")));
  assert.ok(errors.some((error) => error.includes("manifest.styleGuideSha256AtGeneration")));
  assert.ok(errors.some((error) => error.includes("manifest.assets.P01.sha256")));
  assert.ok(errors.some((error) => error.includes("manifest.assets.P01.generationPath")));
  assert.ok(errors.some((error) => error.includes("manifest.assets.P01.sourceOutput")));
  assert.ok(errors.some((error) => error.includes("manifest.assets.P01.identityReference.sha256")));
  assert.ok(errors.some((error) => error.includes("manifest.assets.P01.identityReference.path")));
});

test("collection requires the canonical ready status and a real civil manifest date", () => {
  const badStatus = readyManifestFixture();
  badStatus.status = "qualquer-status";
  const statusErrors = validateCardArtPilotResults(validResultFixture("iterar", badStatus), badStatus);
  assert.ok(statusErrors.some((error) => error.includes("manifest.status") && error.includes("pilot-ready-for-human-decision")));

  const impossibleDate = readyManifestFixture();
  impossibleDate.generatedOn = "2026-02-30";
  const dateErrors = validateCardArtPilotResults(validResultFixture("iterar", impossibleDate), impossibleDate);
  assert.ok(dateErrors.some((error) => error.includes("manifest.generatedOn") && error.includes("data ISO")));

  const ancientDate = readyManifestFixture();
  ancientDate.generatedOn = "0001-01-01";
  assert.ok(validateCardArtPilotResults(validResultFixture("iterar", ancientDate), ancientDate)
    .some((error) => error.includes("manifest.generatedOn") && error.includes("anteceder o guia")));

  const absurdFuture = readyManifestFixture();
  absurdFuture.generatedOn = "9999-12-31";
  assert.ok(validateCardArtPilotResults(validResultFixture("iterar", absurdFuture), absurdFuture)
    .some((error) => error.includes("manifest.generatedOn") && error.includes("data futura")));
});

test("scaleDecisionAllowed is boolean, cannot precede collection and only blocks a seguir decision", () => {
  const malformed = readyManifestFixture();
  malformed.scaleDecisionAllowed = "true";
  assert.ok(validateCardArtPilotResults(validResultFixture("iterar", malformed), malformed)
    .some((error) => error.includes("manifest.scaleDecisionAllowed") && error.includes("booleano")));

  const premature = readyManifestFixture();
  premature.collectionAllowed = false;
  assert.ok(validateCardArtPilotResults(validResultFixture("iterar", premature), premature)
    .some((error) => error.includes("manifest.scaleDecisionAllowed") && error.includes("collectionAllowed")));

  const noScale = readyManifestFixture();
  noScale.scaleDecisionAllowed = false;
  assert.equal(validateCardArtPilotResults(validResultFixture("iterar", noScale), noScale)
    .some((error) => error.includes("decision.value") && error.includes("scaleDecisionAllowed")), false);
  assert.ok(validateCardArtPilotResults(validResultFixture("seguir", noScale), noScale)
    .some((error) => error.includes("decision.value") && error.includes("scaleDecisionAllowed")));
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

test("free-text fields reject phone, RG, IPv6 and explicit participant or address markers", () => {
  const manifest = readyManifestFixture();
  const result = validResultFixture("seguir", manifest);
  result.assets[0].identityReview.notes = "telefone +55 (11) 99999-9999";
  result.assets[0].dignityReview.notes = "RG 12.345.678-9";
  result.assets[1].identityReview.notes = "IPv6 2001:db8::1";
  result.assets[1].dignityReview.notes = "participante: Ana";
  result.assets[2].identityReview.notes = "Participante Ana Silva";
  result.decision.rationale = "rua das Flores, 123";

  const errors = validateCardArtPilotResults(result, manifest);
  for (const expected of ["telefone", "RG", "IPv6", "marcador de participante", "nome de participante", "endereço postal"]) {
    assert.ok(errors.some((error) => error.includes(expected)), expected);
  }
});

test("natural participant identification and common Brazilian address variants are rejected without generic prose false positives", () => {
  const manifest = readyManifestFixture();
  const result = validResultFixture("iterar", manifest);
  result.assets[0].identityReview.notes = "A respondente Ana Silva mora na Praça da Sé, 1";
  result.assets[0].dignityReview.notes = "O participante João Souza reside na Av. Paulista, nº 1000";
  result.decision.rationale = "Contato informado na Alameda Santos 42";
  const errors = validateCardArtPilotResults(result, manifest);
  assert.ok(errors.some((error) => error.includes("identificação natural de participante")));
  assert.ok(errors.some((error) => error.includes("endereço postal")));

  const safe = validResultFixture("iterar", manifest);
  safe.assets[0].identityReview.notes = "Participantes externos foram recrutados sem coleta de texto livre.";
  safe.assets[0].dignityReview.notes = "Revisão agregada sem nome, telefone ou endereço de participante.";
  assert.deepEqual(validateCardArtPilotResults(safe, manifest), []);
});

test("PII detection descends into arrays of primitive text", () => {
  const manifest = readyManifestFixture();
  const result = validResultFixture("iterar", manifest);
  result.auditTrail = ["seguro", "participante: pessoa-identificada"];
  const errors = validateCardArtPilotResults(result, manifest);
  assert.ok(errors.some((error) => error.includes("result.auditTrail[1]") && error.includes("marcador de participante")));
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
