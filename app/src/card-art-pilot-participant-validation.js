import { CARD_ART_PILOT_CODES, cardArtPilotBatchIdentity } from "./card-art-pilot-validation.js";
import { validateCardArtPilotParticipantResponseSchema } from "./card-art-pilot-results-schema.js";

const SCENARIO_VIEWPORTS = Object.freeze({
  "mobile-390x844": Object.freeze({ width: 390, height: 844 }),
  "desktop-1000x800": Object.freeze({ width: 1000, height: 800 })
});

function batchKey(batch) {
  const assets = Array.isArray(batch?.assets)
    ? batch.assets.map((asset) => `${asset?.blindCode || ""}:${asset?.sha256 || ""}`).join("|")
    : "";
  return `${batch?.version || ""}:${batch?.manifestSha256 || ""}:${assets}`;
}

function validateBatchIdentity(errors, batch, manifest, path) {
  const expected = cardArtPilotBatchIdentity(manifest);
  if (batch?.version !== expected.version) {
    errors.push(`${path}.version: resposta pertence a outra versão do lote; esperado ${expected.version || "missing"}`);
  }
  if (batch?.manifestSha256 !== expected.manifestSha256) {
    errors.push(`${path}.manifestSha256: resposta pertence a outro manifesto; esperado ${expected.manifestSha256}`);
  }
  if (!Array.isArray(batch?.assets) || batch.assets.length !== expected.assets.length) {
    errors.push(`${path}.assets: resposta deve carregar os oito hashes imutáveis do lote`);
    return;
  }
  for (const [index, expectedAsset] of expected.assets.entries()) {
    const observed = batch.assets[index];
    if (observed?.blindCode !== expectedAsset.blindCode || observed?.sha256 !== expectedAsset.sha256) {
      errors.push(`${path}.assets[${index}]: ${expectedAsset.blindCode} ou seu SHA-256 não corresponde ao manifesto`);
    }
  }
}

export function validateCardArtPilotParticipantResponse(response, manifest, path = "response") {
  const errors = [];
  validateBatchIdentity(errors, response?.batch, manifest, `${path}.batch`);

  const codes = Array.isArray(response?.responses) ? response.responses.map((item) => item?.code) : [];
  for (const code of CARD_ART_PILOT_CODES) {
    const count = codes.filter((observed) => observed === code).length;
    if (count !== 1) errors.push(`${path}.responses: ${code} precisa aparecer exatamente uma vez; encontrado ${count}`);
  }

  const scenario = response?.displayScenario;
  const expectedViewport = SCENARIO_VIEWPORTS[scenario?.id];
  if (expectedViewport && (scenario?.viewport?.width !== expectedViewport.width || scenario?.viewport?.height !== expectedViewport.height)) {
    errors.push(`${path}.displayScenario.viewport: viewport não corresponde a ${scenario.id}`);
  }
  return errors;
}

export function validateCardArtPilotAggregationInput(responses, manifest, schema) {
  if (!Array.isArray(responses) || responses.length === 0) {
    return ["responses: agregação exige ao menos uma resposta individual"];
  }

  const errors = [];
  if (manifest?.status !== "pilot-ready-for-human-decision") {
    errors.push(`manifest.status: agregação exige pilot-ready-for-human-decision; recebido ${manifest?.status || "missing"}`);
  }
  if (manifest?.collectionAllowed !== true) {
    errors.push("manifest.collectionAllowed: agregação exige coleta explicitamente autorizada");
  }
  const batchKeys = new Set();
  const responseIds = new Set();
  responses.forEach((response, index) => {
    const path = `responses[${index}]`;
    const schemaErrors = validateCardArtPilotParticipantResponseSchema(response, schema);
    errors.push(...schemaErrors.map((error) => `${path}.${error}`));
    if (!schemaErrors.length) errors.push(...validateCardArtPilotParticipantResponse(response, manifest, path));

    batchKeys.add(batchKey(response?.batch));
    if (typeof response?.responseId === "string") {
      if (responseIds.has(response.responseId)) errors.push(`${path}.responseId: resposta duplicada não pode entrar na agregação`);
      responseIds.add(response.responseId);
    }
  });

  if (batchKeys.size > 1) {
    errors.push("responses.batch: agregação recusada porque mistura fingerprints, versões ou hashes de arte de lotes diferentes");
  }
  return errors;
}

export function assertCardArtPilotAggregationInput(responses, manifest, schema) {
  const errors = validateCardArtPilotAggregationInput(responses, manifest, schema);
  if (errors.length) {
    const error = new Error(`Entradas individuais do piloto #176 inválidas:\n- ${errors.join("\n- ")}`);
    error.validationErrors = errors;
    throw error;
  }
  return cardArtPilotBatchIdentity(manifest);
}
