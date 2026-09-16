import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CARD_ART_PILOT_GEOMETRY_TOLERANCE_CSS_PX,
  assertCardArtPilotAggregationInput,
  deriveCardArtPilotQuantitativeResult,
  validateCardArtPilotAggregationInput,
  validateCardArtPilotParticipantResponse,
  validateCardArtPilotResultDerivation,
  validateCardArtPilotResultCustody
} from "./card-art-pilot-participant-validation.js";
import { validateCardArtPilotParticipantResponseSchema } from "./card-art-pilot-results-schema.js";
import {
  readyManifestFixture,
  recognitionRulesFixture,
  receiptRegistryFixture,
  validParticipantBundleFixture,
  validParticipantResponseFixture,
  validResultFixture
} from "./fixtures/card-art-pilot-validation-fixtures.js";

const referenceRoot = new URL("../../stages/12_quality_gate_main/references/", import.meta.url);
const participantSchemaUrl = new URL("card-art-pilot-participant-response.schema.json", referenceRoot);
const bundleSchemaUrl = new URL("card-art-pilot-response-bundle.schema.json", referenceRoot);
const receiptRegistrySchemaUrl = new URL("card-art-pilot-receipt-registry.schema.json", referenceRoot);
const recognitionRulesSchemaUrl = new URL("card-art-pilot-recognition-rules.schema.json", referenceRoot);
const currentManifestUrl = new URL("../../stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json", import.meta.url);

async function schemas() {
  const [participantSchema, bundleSchema, receiptRegistrySchema, recognitionRulesSchema] = await Promise.all([
    readFile(participantSchemaUrl, "utf8").then(JSON.parse),
    readFile(bundleSchemaUrl, "utf8").then(JSON.parse),
    readFile(receiptRegistrySchemaUrl, "utf8").then(JSON.parse),
    readFile(recognitionRulesSchemaUrl, "utf8").then(JSON.parse)
  ]);
  return { participantSchema, bundleSchema, receiptRegistrySchema, recognitionRulesSchema };
}

async function aggregationOptions(manifest, receiptRegistry = receiptRegistryFixture(manifest), overrides = {}) {
  return { ...(await schemas()), receiptRegistry, recognitionRules: recognitionRulesFixture(manifest), ...overrides };
}

test("a participant response and non-empty bundle carry batch identity, receipt and collection time", async () => {
  const manifest = readyManifestFixture();
  const registry = receiptRegistryFixture(manifest);
  const bundle = validParticipantBundleFixture(manifest, registry);
  bundle.responses[1].collectedAt = "2026-09-15T22:00:00-03:00";
  const response = bundle.responses[0];
  assert.deepEqual(validateCardArtPilotParticipantResponseSchema(response, (await schemas()).participantSchema), []);
  assert.deepEqual(validateCardArtPilotParticipantResponse(response, manifest), []);
  assert.deepEqual(validateCardArtPilotAggregationInput(bundle, manifest, await aggregationOptions(manifest, registry)), []);
  const custody = assertCardArtPilotAggregationInput(bundle, manifest, await aggregationOptions(manifest, registry));
  assert.equal(custody.responseCount, 40);
  assert.equal(custody.entries.length, 40);
  assert.equal(custody.firstCollectedAt, "2026-09-16T00:30:00.000Z", "chronology must compare instants, not date-time strings");
  assert.match(custody.responseSetRootSha256, /^[a-f0-9]{64}$/);
});

test("schemas reject legacy responses and the aggregator rejects an array or empty bundle", async () => {
  const manifest = readyManifestFixture();
  const legacy = validParticipantResponseFixture(manifest);
  delete legacy.batch;
  delete legacy.receipt;
  delete legacy.collectedAt;
  const schemaErrors = validateCardArtPilotParticipantResponseSchema(legacy, (await schemas()).participantSchema);
  for (const field of ["batch", "receipt", "collectedAt"]) {
    assert.ok(schemaErrors.some((error) => error.includes(field) && error.includes("campo obrigatório ausente")), field);
  }
  for (const invalid of [[], { protocol: "card-art-pilot-176-v2-response-bundle", responses: [] }]) {
    assert.ok(validateCardArtPilotAggregationInput(invalid, manifest, await aggregationOptions(manifest)).length > 0);
  }
});

test("aggregation rejects old or mixed fingerprints", async () => {
  const manifest = readyManifestFixture();
  const registry = receiptRegistryFixture(manifest);
  const bundle = validParticipantBundleFixture(manifest, registry);
  bundle.responses[1].batch.version = "batch-old";
  bundle.responses[1].batch.manifestSha256 = "f".repeat(64);
  bundle.responses[1].batch.assets[0].sha256 = "e".repeat(64);

  const errors = validateCardArtPilotAggregationInput(bundle, manifest, await aggregationOptions(manifest, registry));
  assert.ok(errors.some((error) => error.includes("batch.version") && error.includes("outra versão")));
  assert.ok(errors.some((error) => error.includes("batch.manifestSha256") && error.includes("outro manifesto")));
  assert.ok(errors.some((error) => error.includes("batch.assets[0]") && error.includes("não corresponde")));
  assert.ok(errors.some((error) => error.includes("mistura fingerprints")));
});

test("a renamed replay cannot bypass one-time pre-issued receipt consumption", async () => {
  const manifest = readyManifestFixture();
  const registry = receiptRegistryFixture(manifest);
  const bundle = validParticipantBundleFixture(manifest, registry);
  bundle.responses[1] = structuredClone(bundle.responses[0]);
  bundle.responses[1].responseId = "b".repeat(32);
  const errors = validateCardArtPilotAggregationInput(bundle, manifest, await aggregationOptions(manifest, registry));
  assert.equal(errors.some((error) => error.includes("responseId") && error.includes("duplicada")), false);
  assert.ok(errors.some((error) => error.includes("receipt já consumido") && error.includes("cópia renomeada")));
});

test("unknown receipts and an internally inconsistent declared registry chronology are rejected", async () => {
  const manifest = readyManifestFixture();
  const registry = receiptRegistryFixture(manifest);
  const bundle = validParticipantBundleFixture(manifest, registry);
  bundle.responses[0].receipt = "1".repeat(64);
  manifest.receiptRegistry.committedAt = "2026-09-16T00:31:00Z";
  const errors = validateCardArtPilotAggregationInput(bundle, manifest, await aggregationOptions(manifest, registry));
  assert.ok(errors.some((error) => error.includes("nonce não foi pré-emitido")));
  assert.ok(errors.some((error) => error.includes("cronologia declarada") && error.includes("prova externa")));
});

test("aggregation stays closed while the committed batch remains invalidated", async () => {
  const manifest = JSON.parse(await readFile(currentManifestUrl, "utf8"));
  const registry = receiptRegistryFixture(manifest);
  const bundle = validParticipantBundleFixture(manifest, registry);
  const options = await aggregationOptions(manifest, registry);
  const errors = validateCardArtPilotAggregationInput(bundle, manifest, options);
  assert.ok(errors.some((error) => error.includes("manifest.status")));
  assert.ok(errors.some((error) => error.includes("manifest.collectionAllowed")));
  assert.throws(() => assertCardArtPilotAggregationInput(bundle, manifest, options), /Bundle individual do piloto #176 inválido/);
});

test("every measured geometry field obeys the canonical browser geometry tolerance", () => {
  const manifest = readyManifestFixture();
  const areas = ["viewport", "card", "artWindow", "image", "blindPlate"];
  for (const area of areas) {
    for (const dimension of ["width", "height"]) {
      const absurd = validParticipantResponseFixture(manifest);
      absurd.displayScenario[area][dimension] = dimension === "width" ? 9999 : 1;
      assert.ok(validateCardArtPilotParticipantResponse(absurd, manifest)
        .some((error) => error.includes(`displayScenario.${area}.${dimension}`)), `${area}.${dimension}`);
    }
  }
  const tolerated = validParticipantResponseFixture(manifest);
  tolerated.displayScenario.card.width += CARD_ART_PILOT_GEOMETRY_TOLERANCE_CSS_PX;
  assert.deepEqual(validateCardArtPilotParticipantResponse(tolerated, manifest), []);
  const outside = validParticipantResponseFixture(manifest);
  outside.displayScenario.card.width += CARD_ART_PILOT_GEOMETRY_TOLERANCE_CSS_PX + 0.01;
  assert.ok(validateCardArtPilotParticipantResponse(outside, manifest)
    .some((error) => error.includes("displayScenario.card.width")));
});

test("collection timestamps must follow exact generation time and cannot be future-dated", () => {
  const manifest = readyManifestFixture();
  const response = validParticipantResponseFixture(manifest);
  response.collectedAt = manifest.generatedAt;
  assert.ok(validateCardArtPilotParticipantResponse(response, manifest)
    .some((error) => error.includes("collectedAt") && error.includes("posterior")));
  response.collectedAt = "2026-09-16T00:19:59Z";
  assert.ok(validateCardArtPilotParticipantResponse(response, manifest)
    .some((error) => error.includes("manifest.generatedAt")));
  response.collectedAt = "2026-09-16T03:06:00Z";
  assert.ok(validateCardArtPilotParticipantResponse(response, manifest, "response", { now: Date.parse("2026-09-16T03:00:00Z") })
    .some((error) => error.includes("futuro")));
});

test("result custody is recomputed from ordered IDs, receipt hashes and response digests", () => {
  const manifest = readyManifestFixture();
  const registry = receiptRegistryFixture(manifest);
  const bundle = validParticipantBundleFixture(manifest, registry);
  const result = validResultFixture("iterar", manifest);
  assert.deepEqual(validateCardArtPilotResultCustody(result, bundle, registry), []);
  result.custody.entries[0].responseId = "f".repeat(32);
  assert.ok(validateCardArtPilotResultCustody(result, bundle, registry)
    .some((error) => error.includes("raiz canônica") || error.includes("bundle")));
});

test("all quantitative output is canonically derived from individual answers and pre-versioned aliases", () => {
  const manifest = readyManifestFixture();
  const registry = receiptRegistryFixture(manifest);
  const rules = recognitionRulesFixture(manifest);
  const bundle = validParticipantBundleFixture(manifest, registry);
  const result = validResultFixture("iterar", manifest);
  const derived = deriveCardArtPilotQuantitativeResult(bundle, rules);
  assert.equal(derived.sample.participantCount, 40);
  assert.deepEqual(derived.sample.displayScenarios, { "mobile-390x844": 20, "desktop-1000x800": 20 });
  assert.deepEqual(derived.sample.strata.regional, {
    published: [
      { key: "nordeste", participantCount: 15 },
      { key: "sudeste", participantCount: 20 }
    ],
    suppressedCount: 5
  });
  assert.equal(derived.assets[0].recognition.correct, 32);
  assert.equal(derived.assets[0].recognition.incorrect, 4);
  assert.equal(derived.assets[0].recognition.unknown, 4);
  assert.equal(derived.assets[0].neutrality.favorece, 4);
  assert.equal(derived.assets[0].neutrality.prejudica, 4);
  assert.deepEqual(validateCardArtPilotResultDerivation(result, bundle, rules), []);

  const mutations = [
    (copy) => { copy.sample.participantCount += 1; },
    (copy) => { copy.sample.displayScenarios["mobile-390x844"] += 1; },
    (copy) => { copy.sample.strata.regional.suppressedCount = 0; },
    (copy) => { copy.sample.strata.familiarity.published[0].participantCount += 1; },
    (copy) => { copy.sample.strata.regional.published[0].key = "norte"; },
    (copy) => { copy.assets[0].validResponses += 1; },
    (copy) => { copy.assets[0].recognition.correct -= 1; copy.assets[0].recognition.incorrect += 1; },
    (copy) => { copy.assets[0].recognition.unknown += 1; },
    (copy) => { copy.assets[0].recognition.rate = 0.799999; },
    (copy) => { copy.assets[0].neutrality.favorece += 1; },
    (copy) => { copy.assets[0].neutrality.neutra -= 1; },
    (copy) => { copy.assets[0].neutrality.prejudica += 1; },
    (copy) => { copy.assets[0].neutrality.favoreceRate = 0.11; },
    (copy) => { copy.assets[0].neutrality.neutraRate = 0.79; },
    (copy) => { copy.assets[0].neutrality.prejudicaRate = 0.11; },
    (copy) => { copy.assets[0].neutrality.balancePercentagePoints = 1; },
    (copy) => { copy.assets[0].byDisplayScenario["mobile-390x844"].validResponses += 1; },
    (copy) => { copy.assets[0].byDisplayScenario["mobile-390x844"].recognized -= 1; },
    (copy) => { copy.assets[0].byDisplayScenario["mobile-390x844"].favorece += 1; },
    (copy) => { copy.assets[0].byDisplayScenario["mobile-390x844"].neutra -= 1; },
    (copy) => { copy.assets[0].byDisplayScenario["mobile-390x844"].prejudica += 1; },
    (copy) => { copy.assets[0].byDisplayScenario["mobile-390x844"].favoreceRate = 0.11; },
    (copy) => { copy.assets[0].byDisplayScenario["mobile-390x844"].neutraRate = 0.79; },
    (copy) => { copy.assets[0].byDisplayScenario["mobile-390x844"].prejudicaRate = 0.11; },
    (copy) => { copy.assets[0].byDisplayScenario["desktop-1000x800"].recognitionRate = 0.81; }
  ];
  for (const mutate of mutations) {
    const copy = structuredClone(result);
    mutate(copy);
    assert.ok(validateCardArtPilotResultDerivation(copy, bundle, rules)
      .some((error) => error.includes("derivação canônica")));
  }

  const widthVariant = structuredClone(bundle);
  widthVariant.responses[0].responses[0].identity = "Ｐｅｓｓｏａ reconhecida Ｐ０１";
  assert.deepEqual(validateCardArtPilotResultDerivation(result, widthVariant, rules), []);
});

test("recognition aliases must be pre-versioned, normalized and globally unambiguous", async () => {
  const manifest = readyManifestFixture();
  const registry = receiptRegistryFixture(manifest);
  const bundle = validParticipantBundleFixture(manifest, registry);
  const rules = recognitionRulesFixture(manifest);
  rules.assets[1].aliases = [...rules.assets[0].aliases];
  rules.unknownAnswers.reverse();
  const errors = validateCardArtPilotAggregationInput(bundle, manifest, await aggregationOptions(manifest, registry, {
    recognitionRules: rules
  }));
  assert.ok(errors.some((error) => error.includes("recognitionRules") && error.includes("sha256")));
  assert.ok(errors.some((error) => error.includes("ordem canônica")));
  assert.ok(errors.some((error) => error.includes("alias ambíguo")));
});
