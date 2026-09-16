import { createHash } from "node:crypto";
import {
  CARD_ART_PILOT_CODES,
  CARD_ART_PILOT_MAX_CLOCK_SKEW_MS,
  cardArtPilotBatchIdentity,
  cardArtPilotCanonicalJson,
  cardArtPilotCanonicalSha256
} from "./card-art-pilot-validation.js";
import {
  validateCardArtPilotParticipantResponseSchema,
  validateCardArtPilotReceiptRegistrySchema,
  validateCardArtPilotResponseBundleSchema
} from "./card-art-pilot-results-schema.js";

export const CARD_ART_PILOT_RECEIPT_PROTOCOL = "card-art-pilot-176-receipts-v1";
export const CARD_ART_PILOT_BUNDLE_PROTOCOL = "card-art-pilot-176-v2-response-bundle";
export const CARD_ART_PILOT_CUSTODY_PROTOCOL = "card-art-pilot-176-v2-custody";
export const CARD_ART_PILOT_GEOMETRY_TOLERANCE_CSS_PX = 0.2;

export const CARD_ART_PILOT_SCENARIO_GEOMETRY = Object.freeze({
  "mobile-390x844": Object.freeze({
    viewport: Object.freeze({ width: 390, height: 844 }),
    card: Object.freeze({ width: 183.5, height: 280 }),
    artWindow: Object.freeze({ width: 169.5, height: 162 }),
    image: Object.freeze({ width: 167.5, height: 160 }),
    blindPlate: Object.freeze({ width: 169.5, height: 105 })
  }),
  "desktop-1000x800": Object.freeze({
    viewport: Object.freeze({ width: 1000, height: 800 }),
    card: Object.freeze({ width: 226, height: 316.4 }),
    artWindow: Object.freeze({ width: 206, height: 189.4 }),
    image: Object.freeze({ width: 204, height: 187.4 }),
    blindPlate: Object.freeze({ width: 206, height: 109 })
  })
});

function validationNow({ now, clock = Date.now } = {}) {
  const supplied = now ?? (typeof clock === "function" ? clock() : clock);
  const timestamp = supplied instanceof Date ? supplied.getTime() : supplied;
  if (!Number.isFinite(timestamp)) throw new TypeError("relógio de validação inválido");
  return timestamp;
}

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

function validateGeometry(errors, scenario, path) {
  const expected = CARD_ART_PILOT_SCENARIO_GEOMETRY[scenario?.id];
  if (!expected) return;
  for (const area of ["viewport", "card", "artWindow", "image", "blindPlate"]) {
    for (const dimension of ["width", "height"]) {
      const observed = scenario?.[area]?.[dimension];
      const canonical = expected[area][dimension];
      if (!Number.isFinite(observed) || Math.abs(observed - canonical) > CARD_ART_PILOT_GEOMETRY_TOLERANCE_CSS_PX) {
        errors.push(`${path}.${area}.${dimension}: ${observed} diverge de ${canonical} além da tolerância de ${CARD_ART_PILOT_GEOMETRY_TOLERANCE_CSS_PX} CSS px`);
      }
    }
  }
  if (scenario?.image?.objectFit !== "cover") errors.push(`${path}.image.objectFit: deve ser cover`);
  if (scenario?.image?.objectPosition !== "50% 0%") errors.push(`${path}.image.objectPosition: deve ser 50% 0%`);
}

export function cardArtPilotReceiptSha256(receipt, registry) {
  const domain = [
    CARD_ART_PILOT_RECEIPT_PROTOCOL,
    registry?.batchVersion || "",
    registry?.receiptDomain || "",
    receipt || ""
  ].join("\0");
  return createHash("sha256").update(domain, "utf8").digest("hex");
}

export function cardArtPilotResponseSha256(response) {
  return cardArtPilotCanonicalSha256(response);
}

export function cardArtPilotReceiptRegistrySha256(registry) {
  return cardArtPilotCanonicalSha256(registry);
}

export function cardArtPilotCustodyFromBundle(bundle, registry) {
  const entries = (bundle?.responses || []).map((response) => ({
    responseId: response.responseId,
    receiptSha256: cardArtPilotReceiptSha256(response.receipt, registry),
    responseSha256: cardArtPilotResponseSha256(response)
  })).sort((left, right) => left.receiptSha256.localeCompare(right.receiptSha256)
    || left.responseId.localeCompare(right.responseId));
  const collectedTimes = (bundle?.responses || [])
    .map((response) => response.collectedAt)
    .sort((left, right) => Date.parse(left) - Date.parse(right) || left.localeCompare(right));
  const envelope = {
    protocol: CARD_ART_PILOT_CUSTODY_PROTOCOL,
    receiptRegistrySha256: cardArtPilotReceiptRegistrySha256(registry),
    responseCount: entries.length,
    firstCollectedAt: collectedTimes[0],
    lastCollectedAt: collectedTimes.at(-1),
    entries
  };
  return {
    ...envelope,
    responseSetRootSha256: cardArtPilotCanonicalSha256({ batch: bundle.batch, ...envelope })
  };
}

export function validateCardArtPilotParticipantResponse(response, manifest, path = "response", options = {}) {
  const errors = [];
  const now = validationNow(options);
  validateBatchIdentity(errors, response?.batch, manifest, `${path}.batch`);

  const codes = Array.isArray(response?.responses) ? response.responses.map((item) => item?.code) : [];
  for (const code of CARD_ART_PILOT_CODES) {
    const count = codes.filter((observed) => observed === code).length;
    if (count !== 1) errors.push(`${path}.responses: ${code} precisa aparecer exatamente uma vez; encontrado ${count}`);
  }

  validateGeometry(errors, response?.displayScenario, `${path}.displayScenario`);

  const generatedAt = Date.parse(manifest?.generatedAt);
  const collectedAt = Date.parse(response?.collectedAt);
  if (Number.isNaN(collectedAt)) {
    errors.push(`${path}.collectedAt: instante de coleta válido obrigatório`);
  } else {
    if (Number.isFinite(generatedAt) && collectedAt <= generatedAt) {
      errors.push(`${path}.collectedAt: coleta precisa ser posterior a manifest.generatedAt`);
    }
    if (collectedAt > now + CARD_ART_PILOT_MAX_CLOCK_SKEW_MS) {
      errors.push(`${path}.collectedAt: coleta não pode estar no futuro`);
    }
  }
  return errors;
}

function validateRegistry(errors, registry, manifest, schema, now) {
  const schemaErrors = validateCardArtPilotReceiptRegistrySchema(registry, schema);
  errors.push(...schemaErrors.map((error) => `receiptRegistry.${error}`));
  if (schemaErrors.length) return;

  const expectedAssets = cardArtPilotBatchIdentity(manifest).assets;
  if (registry.protocol !== CARD_ART_PILOT_RECEIPT_PROTOCOL) errors.push("receiptRegistry.protocol: protocolo inesperado");
  if (registry.batchVersion !== manifest?.version) errors.push("receiptRegistry.batchVersion: versão não corresponde ao manifesto");
  if (cardArtPilotCanonicalJson(registry.assets) !== cardArtPilotCanonicalJson(expectedAssets)) {
    errors.push("receiptRegistry.assets: hashes de arte não correspondem ao manifesto");
  }
  const observedSha = cardArtPilotReceiptRegistrySha256(registry);
  if (manifest?.receiptRegistry?.sha256 !== observedSha) errors.push(`manifest.receiptRegistry.sha256: esperado ${observedSha}`);
  if (manifest?.receiptRegistry?.protocol !== registry.protocol) errors.push("manifest.receiptRegistry.protocol: diverge do registro fornecido");
  if (manifest?.receiptRegistry?.issuedCount !== registry.receiptHashes.length) errors.push("manifest.receiptRegistry.issuedCount: diverge do registro fornecido");
  if (new Set(registry.receiptHashes).size !== registry.receiptHashes.length) errors.push("receiptRegistry.receiptHashes: hashes pré-emitidos precisam ser únicos");
  const sorted = [...registry.receiptHashes].sort();
  if (cardArtPilotCanonicalJson(sorted) !== cardArtPilotCanonicalJson(registry.receiptHashes)) {
    errors.push("receiptRegistry.receiptHashes: hashes precisam estar em ordem lexicográfica canônica");
  }
  const issuedAt = Date.parse(registry.issuedAt);
  const generatedAt = Date.parse(manifest?.generatedAt);
  if (Number.isNaN(issuedAt)) errors.push("receiptRegistry.issuedAt: instante válido obrigatório");
  if (Number.isFinite(issuedAt) && Number.isFinite(generatedAt) && issuedAt <= generatedAt) {
    errors.push("receiptRegistry.issuedAt: emissão precisa ser posterior a manifest.generatedAt");
  }
  if (Number.isFinite(issuedAt) && issuedAt > now + CARD_ART_PILOT_MAX_CLOCK_SKEW_MS) {
    errors.push("receiptRegistry.issuedAt: emissão não pode estar no futuro");
  }
}

export function validateCardArtPilotAggregationInput(bundle, manifest, {
  participantSchema,
  bundleSchema,
  receiptRegistrySchema,
  receiptRegistry,
  now,
  clock
} = {}) {
  const currentTime = validationNow({ now, clock });
  const errors = [];
  const bundleSchemaErrors = validateCardArtPilotResponseBundleSchema(bundle, bundleSchema);
  errors.push(...bundleSchemaErrors.map((error) => `bundle.${error}`));
  if (bundleSchemaErrors.length) return errors;

  if (manifest?.status !== "pilot-ready-for-human-decision") {
    errors.push(`manifest.status: agregação exige pilot-ready-for-human-decision; recebido ${manifest?.status || "missing"}`);
  }
  if (manifest?.collectionAllowed !== true) {
    errors.push("manifest.collectionAllowed: agregação exige coleta explicitamente autorizada");
  }
  validateBatchIdentity(errors, bundle.batch, manifest, "bundle.batch");
  validateRegistry(errors, receiptRegistry, manifest, receiptRegistrySchema, currentTime);
  if (bundle.receiptRegistrySha256 !== cardArtPilotReceiptRegistrySha256(receiptRegistry)) {
    errors.push("bundle.receiptRegistrySha256: não corresponde ao registro pré-emitido");
  }

  const allowedReceipts = new Set(receiptRegistry?.receiptHashes || []);
  const batchKeys = new Set([batchKey(bundle.batch)]);
  const responseIds = new Set();
  const consumedReceipts = new Set();
  const responseDigests = new Set();
  let earliestCollection = Number.POSITIVE_INFINITY;
  for (const [index, response] of bundle.responses.entries()) {
    const path = `bundle.responses[${index}]`;
    const schemaErrors = validateCardArtPilotParticipantResponseSchema(response, participantSchema);
    errors.push(...schemaErrors.map((error) => `${path}.${error}`));
    if (!schemaErrors.length) {
      errors.push(...validateCardArtPilotParticipantResponse(response, manifest, path, { now: currentTime }));
    }

    batchKeys.add(batchKey(response?.batch));
    if (typeof response?.responseId === "string") {
      if (responseIds.has(response.responseId)) errors.push(`${path}.responseId: resposta duplicada não pode entrar na agregação`);
      responseIds.add(response.responseId);
    }

    const receiptHash = cardArtPilotReceiptSha256(response?.receipt, receiptRegistry);
    if (!allowedReceipts.has(receiptHash)) errors.push(`${path}.receipt: nonce não foi pré-emitido para este lote`);
    if (consumedReceipts.has(receiptHash)) errors.push(`${path}.receipt: receipt já consumido; replay ou cópia renomeada recusada`);
    consumedReceipts.add(receiptHash);

    const responseDigest = cardArtPilotResponseSha256(response);
    if (responseDigests.has(responseDigest)) errors.push(`${path}: digest de resposta duplicado`);
    responseDigests.add(responseDigest);
    const collectedAt = Date.parse(response?.collectedAt);
    if (Number.isFinite(collectedAt)) earliestCollection = Math.min(earliestCollection, collectedAt);
  }

  if (batchKeys.size > 1) {
    errors.push("bundle.responses.batch: agregação recusada porque mistura fingerprints, versões ou hashes de arte de lotes diferentes");
  }
  const issuedAt = Date.parse(receiptRegistry?.issuedAt);
  const committedAt = Date.parse(manifest?.receiptRegistry?.committedAt);
  if (Number.isFinite(issuedAt) && Number.isFinite(earliestCollection) && earliestCollection < issuedAt) {
    errors.push("bundle.responses.collectedAt: coleta não pode anteceder a emissão dos receipts");
  }
  if (Number.isFinite(committedAt) && Number.isFinite(earliestCollection) && earliestCollection <= committedAt) {
    errors.push("bundle.responses.collectedAt: primeira coleta precisa ser posterior ao commit verificável do registro de receipts");
  }
  return errors;
}

export function validateCardArtPilotResultCustody(result, bundle, receiptRegistry) {
  const errors = [];
  const expected = cardArtPilotCustodyFromBundle(bundle, receiptRegistry);
  if (cardArtPilotCanonicalJson(result?.custody) !== cardArtPilotCanonicalJson(expected)) {
    errors.push("custody: metadados ou raiz canônica não correspondem ao bundle de respostas individuais");
  }
  if (result?.sample?.participantCount !== bundle?.responses?.length) {
    errors.push("sample.participantCount: não corresponde ao número de respostas individuais do bundle");
  }
  for (const scenario of Object.keys(CARD_ART_PILOT_SCENARIO_GEOMETRY)) {
    const observed = (bundle?.responses || []).filter((response) => response?.displayScenario?.id === scenario).length;
    if (result?.sample?.displayScenarios?.[scenario] !== observed) {
      errors.push(`sample.displayScenarios.${scenario}: não corresponde às respostas individuais do bundle`);
    }
  }
  return errors;
}

export function assertCardArtPilotAggregationInput(bundle, manifest, options) {
  const errors = validateCardArtPilotAggregationInput(bundle, manifest, options);
  if (errors.length) {
    const error = new Error(`Bundle individual do piloto #176 inválido:\n- ${errors.join("\n- ")}`);
    error.validationErrors = errors;
    throw error;
  }
  return cardArtPilotCustodyFromBundle(bundle, options.receiptRegistry);
}

export function assertCardArtPilotResultCustody(result, bundle, receiptRegistry) {
  const errors = validateCardArtPilotResultCustody(result, bundle, receiptRegistry);
  if (errors.length) {
    const error = new Error(`Cadeia de custódia do piloto #176 inválida:\n- ${errors.join("\n- ")}`);
    error.validationErrors = errors;
    throw error;
  }
}
