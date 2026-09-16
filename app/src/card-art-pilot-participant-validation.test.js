import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CARD_ART_PILOT_GEOMETRY_TOLERANCE_CSS_PX,
  assertCardArtPilotAggregationInput,
  validateCardArtPilotAggregationInput,
  validateCardArtPilotParticipantResponse,
  validateCardArtPilotResultCustody
} from "./card-art-pilot-participant-validation.js";
import { validateCardArtPilotParticipantResponseSchema } from "./card-art-pilot-results-schema.js";
import {
  readyManifestFixture,
  receiptRegistryFixture,
  validParticipantBundleFixture,
  validParticipantResponseFixture,
  validResultFixture
} from "./fixtures/card-art-pilot-validation-fixtures.js";

const referenceRoot = new URL("../../stages/12_quality_gate_main/references/", import.meta.url);
const participantSchemaUrl = new URL("card-art-pilot-participant-response.schema.json", referenceRoot);
const bundleSchemaUrl = new URL("card-art-pilot-response-bundle.schema.json", referenceRoot);
const receiptRegistrySchemaUrl = new URL("card-art-pilot-receipt-registry.schema.json", referenceRoot);
const currentManifestUrl = new URL("../../stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json", import.meta.url);

async function schemas() {
  const [participantSchema, bundleSchema, receiptRegistrySchema] = await Promise.all([
    readFile(participantSchemaUrl, "utf8").then(JSON.parse),
    readFile(bundleSchemaUrl, "utf8").then(JSON.parse),
    readFile(receiptRegistrySchemaUrl, "utf8").then(JSON.parse)
  ]);
  return { participantSchema, bundleSchema, receiptRegistrySchema };
}

async function aggregationOptions(manifest, receiptRegistry = receiptRegistryFixture(manifest), overrides = {}) {
  return { ...(await schemas()), receiptRegistry, ...overrides };
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

test("unknown receipts and a registry forged after collection are rejected", async () => {
  const manifest = readyManifestFixture();
  const registry = receiptRegistryFixture(manifest);
  const bundle = validParticipantBundleFixture(manifest, registry);
  bundle.responses[0].receipt = "1".repeat(64);
  manifest.receiptRegistry.committedAt = "2026-09-16T00:31:00Z";
  const errors = validateCardArtPilotAggregationInput(bundle, manifest, await aggregationOptions(manifest, registry));
  assert.ok(errors.some((error) => error.includes("nonce não foi pré-emitido")));
  assert.ok(errors.some((error) => error.includes("posterior ao commit verificável")));
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
