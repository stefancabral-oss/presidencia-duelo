import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertCardArtPilotAggregationInput,
  validateCardArtPilotAggregationInput,
  validateCardArtPilotParticipantResponse
} from "./card-art-pilot-participant-validation.js";
import { validateCardArtPilotParticipantResponseSchema } from "./card-art-pilot-results-schema.js";
import {
  readyManifestFixture,
  validParticipantResponseFixture
} from "./fixtures/card-art-pilot-validation-fixtures.js";

const participantSchemaUrl = new URL(
  "../../stages/12_quality_gate_main/references/card-art-pilot-participant-response.schema.json",
  import.meta.url
);
const currentManifestUrl = new URL(
  "../../stages/12_quality_gate_main/evidence/card-art-pilot-176/manifest.json",
  import.meta.url
);

async function participantSchema() {
  return JSON.parse(await readFile(participantSchemaUrl, "utf8"));
}

test("a participant response carries the complete immutable batch identity", async () => {
  const manifest = readyManifestFixture();
  const response = validParticipantResponseFixture(manifest);
  assert.deepEqual(validateCardArtPilotParticipantResponseSchema(response, await participantSchema()), []);
  assert.deepEqual(validateCardArtPilotParticipantResponse(response, manifest), []);
  assert.equal(response.batch.assets.length, 8);
});

test("the participant schema rejects a legacy response without a batch fingerprint", async () => {
  const legacy = validParticipantResponseFixture();
  delete legacy.batch;
  const errors = validateCardArtPilotParticipantResponseSchema(legacy, await participantSchema());
  assert.ok(errors.some((error) => error.includes("batch") && error.includes("campo obrigatório ausente")));
});

test("aggregation rejects an old fingerprint and any mixture of versions or asset hashes", async () => {
  const manifest = readyManifestFixture();
  const first = validParticipantResponseFixture(manifest, "a".repeat(32));
  const second = validParticipantResponseFixture(manifest, "b".repeat(32), "desktop-1000x800");
  second.batch.version = "batch-old";
  second.batch.manifestSha256 = "f".repeat(64);
  second.batch.assets[0].sha256 = "e".repeat(64);

  const errors = validateCardArtPilotAggregationInput([first, second], manifest, await participantSchema());
  assert.ok(errors.some((error) => error.includes("batch.version") && error.includes("outra versão")));
  assert.ok(errors.some((error) => error.includes("batch.manifestSha256") && error.includes("outro manifesto")));
  assert.ok(errors.some((error) => error.includes("batch.assets[0]") && error.includes("não corresponde")));
  assert.ok(errors.some((error) => error.includes("mistura fingerprints")));
});

test("aggregation rejects duplicate exports and duplicate or missing blind codes", async () => {
  const manifest = readyManifestFixture();
  const first = validParticipantResponseFixture(manifest);
  const duplicate = structuredClone(first);
  duplicate.responses[7].code = "P01";
  const errors = validateCardArtPilotAggregationInput([first, duplicate], manifest, await participantSchema());
  assert.ok(errors.some((error) => error.includes("responseId") && error.includes("duplicada")));
  assert.ok(errors.some((error) => error.includes("P01") && error.includes("encontrado 2")));
  assert.ok(errors.some((error) => error.includes("P08") && error.includes("encontrado 0")));
});

test("aggregation is closed while the committed batch remains invalidated", async () => {
  const manifest = JSON.parse(await readFile(currentManifestUrl, "utf8"));
  const response = validParticipantResponseFixture(manifest);
  const schema = await participantSchema();
  const errors = validateCardArtPilotAggregationInput([response], manifest, schema);
  assert.ok(errors.some((error) => error.includes("manifest.status")));
  assert.ok(errors.some((error) => error.includes("manifest.collectionAllowed")));
  assert.throws(
    () => assertCardArtPilotAggregationInput([response], manifest, schema),
    /Entradas individuais do piloto #176 inválidas/
  );
});

test("the declared scenario and measured viewport cannot disagree", () => {
  const manifest = readyManifestFixture();
  const response = validParticipantResponseFixture(manifest);
  response.displayScenario.viewport.width = 1000;
  assert.ok(validateCardArtPilotParticipantResponse(response, manifest)
    .some((error) => error.includes("displayScenario.viewport")));
});
