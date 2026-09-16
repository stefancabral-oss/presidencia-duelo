import { createHash } from "node:crypto";
import { isIP } from "node:net";

export const CARD_ART_PILOT_CODES = Object.freeze(Array.from({ length: 8 }, (_, index) => `P0${index + 1}`));
export const CARD_ART_PILOT_SCENARIOS = Object.freeze(["mobile-390x844", "desktop-1000x800"]);

const RATE_TOLERANCE = 1e-6;
const PERCENTAGE_POINT_TOLERANCE = 1e-4;
const MINIMUM_VALID_RESPONSES_PER_ASSET_SCENARIO = 20;
const PILOT_GUIDE_VERSIONED_AT = Date.UTC(2026, 8, 16);
export const CARD_ART_PILOT_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const FORBIDDEN_PARTICIPANT_KEYS = new Set([
  "participant",
  "participants",
  "participantrecord",
  "participantrecords",
  "participantname",
  "participantnames",
  "participantemail",
  "participantemails",
  "rawanswer",
  "rawanswers",
  "rawresponse",
  "rawresponses",
  "respondent",
  "respondents",
  "email",
  "emails",
  "cpf",
  "cpfs",
  "ip",
  "ips",
  "city",
  "cities",
  "cidade",
  "cidades",
  "state",
  "states",
  "estado",
  "estados",
  "organization",
  "organizations",
  "organizacao",
  "organizacoes"
]);
const FORBIDDEN_PII_PATTERNS = [
  { label: "e-mail", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { label: "CPF", pattern: /\b\d{3}[.\s-]?\d{3}[.\s-]?\d{3}[.\s-]?\d{2}\b/ },
  { label: "telefone", pattern: /(?<![A-Fa-f0-9])(?:\+?55[\s.-]*)?(?:\(?\d{2}\)?[\s.-]*)?(?:9\d{4}|\d{4})[\s.-]?\d{4}(?![A-Fa-f0-9])/ },
  { label: "RG", pattern: /\bRG\s*(?:n[.º°o]?\s*)?[:#=-]?\s*\d{1,2}[.\s-]?\d{3}[.\s-]?\d{3}[-.\s]?[0-9X]\b/i },
  { label: "endereço IPv4", pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/ },
  { label: "marcador de participante", pattern: /\b(?:participante|respondente|pessoa|voluntári[oa]|entrevistad[oa]|nome do participante|id do participante)\s*[:#=-]\s*\S+/i },
  { label: "nome de participante", pattern: /\b(?:A\s+|O\s+)?(?:Participante|Respondente|Pessoa|Voluntári[oa]|Entrevistad[oa])\s+(?!(?:extern[oa]s?|anônim[oa]s?|sem|não)\b)(?:[A-ZÀ-ÖØ-Þ][\p{L}'-]+\s+){1,3}[A-ZÀ-ÖØ-Þ][\p{L}'-]+\b/u },
  { label: "identificação natural de participante", pattern: /\b(?:a|o)\s+(?:participante|respondente|pessoa|voluntári[oa]|entrevistad[oa])\s+(?!(?:extern[oa]s?|anônim[oa]s?|não|sem|que)\b)(?:[\p{L}'-]+\s+){1,5}(?:mora|reside|vive)\b/iu },
  { label: "marcador de endereço", pattern: /\b(?:endereço|endereco|logradouro|CEP)\s*[:#=-]\s*\S+/i },
  { label: "CEP", pattern: /\b(?:CEP\s*[:#=-]?\s*)?\d{5}-?\d{3}\b/iu },
  { label: "endereço postal", pattern: /\b(?:Rua|R\.|Avenida|Av\.|Travessa|Trav\.|Alameda|Al\.|Rodovia|Rod\.|Praça|Pç\.|Largo|Estrada|Beco|Viela|Quadra|Condomínio|Setor|Sítio|Fazenda)\s+[\p{L}\d][^\r\n,;]{1,80}(?:,\s*)?(?:(?:n(?:[.º°o])?\s*)?\d+|s\s*\/?\s*n(?:[.º°o])?|sem\s+n[uú]mero)\b/iu }
];

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function cardArtPilotCanonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("manifesto contém número não finito");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(cardArtPilotCanonicalJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${cardArtPilotCanonicalJson(value[key])}`)
      .join(",")}}`;
  }
  throw new TypeError(`manifesto contém valor JSON inválido: ${typeof value}`);
}

export function cardArtPilotCanonicalSha256(value) {
  return createHash("sha256").update(cardArtPilotCanonicalJson(value), "utf8").digest("hex");
}

export function cardArtPilotManifestSha256(manifest) {
  return cardArtPilotCanonicalSha256(manifest);
}

export function cardArtPilotBatchIdentity(manifest) {
  return {
    version: manifest?.version,
    manifestSha256: cardArtPilotManifestSha256(manifest),
    assets: CARD_ART_PILOT_CODES.map((blindCode) => {
      const asset = manifest?.assets?.find((candidate) => candidate?.blindCode === blindCode);
      return { blindCode, sha256: asset?.sha256 };
    })
  };
}

function isCount(value) {
  return Number.isInteger(value) && value >= 0;
}

function addError(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function rejectUnknownKeys(errors, path, value, allowedKeys) {
  if (!isRecord(value)) return;
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) addError(errors, `${path}.${key}`, "campo não permitido no consolidado agregado");
  }
}

function containsIpv6(value) {
  const candidates = value.match(/\[?[0-9A-Fa-f:.%_-]*:[0-9A-Fa-f:.%_-]+\]?/g) || [];
  return candidates.some((candidate) => {
    const withoutBrackets = candidate.replace(/^\[/, "").replace(/\]$/, "");
    return isIP(withoutBrackets.split("%")[0]) === 6;
  });
}

function validatePiiText(errors, value, path) {
  for (const { label, pattern } of FORBIDDEN_PII_PATTERNS) {
    if (pattern.test(value)) addError(errors, path, `${label} não é permitido no consolidado`);
  }
  if (containsIpv6(value)) addError(errors, path, "endereço IPv6 não é permitido no consolidado");
}

function validateNoParticipantPii(errors, value, path = "result") {
  if (typeof value === "string") {
    validatePiiText(errors, value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateNoParticipantPii(errors, item, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f_-]/g, "").toLocaleLowerCase("pt-BR");
    if (FORBIDDEN_PARTICIPANT_KEYS.has(normalizedKey)) {
      addError(errors, childPath, "campo com registro individual ou PII de participante não é permitido");
    }
    validateNoParticipantPii(errors, child, childPath);
  }
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isHttpsUrl(value) {
  if (!hasText(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function parsedCivilDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.getTime();
}

function validateManifestBinding(errors, result, manifest) {
  const suppliedBatch = result?.batch;
  const supplied = suppliedBatch?.manifestSha256;
  if (!/^[a-f0-9]{64}$/.test(supplied || "")) {
    addError(errors, "batch.manifestSha256", "SHA-256 canônico do manifesto obrigatório");
    return;
  }
  if (!isRecord(manifest)) return;
  try {
    const expected = cardArtPilotBatchIdentity(manifest);
    if (supplied !== expected.manifestSha256) {
      addError(errors, "batch.manifestSha256", `resultado pertence a outro lote; esperado ${expected.manifestSha256}`);
    }
    if (suppliedBatch?.version !== expected.version) {
      addError(errors, "batch.version", `resultado declara versão diferente do manifesto; esperado ${expected.version || "missing"}`);
    }
    if (!Array.isArray(suppliedBatch?.assets) || suppliedBatch.assets.length !== expected.assets.length) {
      addError(errors, "batch.assets", "resultado deve vincular os oito hashes de arte do manifesto");
    } else {
      for (const [index, expectedAsset] of expected.assets.entries()) {
        const suppliedAsset = suppliedBatch.assets[index];
        if (suppliedAsset?.blindCode !== expectedAsset.blindCode || suppliedAsset?.sha256 !== expectedAsset.sha256) {
          addError(errors, `batch.assets[${index}]`, `${expectedAsset.blindCode} ou seu SHA-256 não corresponde ao manifesto`);
        }
      }
    }
  } catch (error) {
    addError(errors, "manifest", `não foi possível calcular o SHA-256 canônico: ${error.message}`);
  }
}

function validateManifestForCollection(errors, manifest, now) {
  if (!isRecord(manifest)) return;
  if (!hasText(manifest.version)) addError(errors, "manifest.version", "versão do lote obrigatória");
  if (manifest.status !== "pilot-ready-for-human-decision") {
    addError(errors, "manifest.status", `consolidação exige pilot-ready-for-human-decision; recebido ${manifest.status || "missing"}`);
  }
  if (manifest.issue !== 176) addError(errors, "manifest.issue", "deve identificar a issue 176");
  const manifestDate = parsedCivilDate(manifest.generatedOn);
  if (manifestDate === null) {
    addError(errors, "manifest.generatedOn", "data ISO do lote obrigatória");
  } else {
    if (manifestDate < PILOT_GUIDE_VERSIONED_AT) addError(errors, "manifest.generatedOn", "lote não pode anteceder o guia versionado");
    if (manifestDate > now + CARD_ART_PILOT_MAX_CLOCK_SKEW_MS) addError(errors, "manifest.generatedOn", "lote não pode ter data futura");
  }
  const generatedAt = parsedDate(manifest.generatedAt);
  const styleGuideVersionedAt = parsedDate(manifest.styleGuideVersionedAt);
  if (generatedAt === null) addError(errors, "manifest.generatedAt", "instante de geração válido obrigatório");
  if (styleGuideVersionedAt === null) addError(errors, "manifest.styleGuideVersionedAt", "instante de versão do guia válido obrigatório");
  if (generatedAt !== null && generatedAt > now + CARD_ART_PILOT_MAX_CLOCK_SKEW_MS) addError(errors, "manifest.generatedAt", "geração não pode estar no futuro");
  if (styleGuideVersionedAt !== null && styleGuideVersionedAt > now + CARD_ART_PILOT_MAX_CLOCK_SKEW_MS) addError(errors, "manifest.styleGuideVersionedAt", "versionamento do guia não pode estar no futuro");
  if (generatedAt !== null && manifestDate !== null && new Date(generatedAt).toISOString().slice(0, 10) !== manifest.generatedOn) {
    addError(errors, "manifest.generatedOn", "data civil deve corresponder ao instante UTC de geração");
  }
  if (generatedAt !== null && styleGuideVersionedAt !== null && styleGuideVersionedAt >= generatedAt) {
    addError(errors, "manifest.styleGuideVersionedAt", "guia precisa estar versionado antes da geração");
  }
  if (!/^[a-f0-9]{40}$/.test(manifest.generationCommit || "")) addError(errors, "manifest.generationCommit", "commit da geração obrigatório");
  if (manifest.styleGuide !== "docs/design/CARD_ART_NEUTRALITY_GUIDE.md") {
    addError(errors, "manifest.styleGuide", "deve apontar para o guia canônico versionado");
  }
  if (!hasText(manifest.styleGuideAtGeneration)) addError(errors, "manifest.styleGuideAtGeneration", "versão do guia usada na geração obrigatória");
  if (!/^[a-f0-9]{40}$/.test(manifest.styleGuideCommitAtGeneration || "")) addError(errors, "manifest.styleGuideCommitAtGeneration", "commit prévio do guia obrigatório");
  if (!isSha256(manifest.styleGuideSha256AtGeneration)) addError(errors, "manifest.styleGuideSha256AtGeneration", "SHA-256 do conteúdo prévio do guia obrigatório");
  if (manifest.styleGuideCommitAtGeneration === manifest.generationCommit) addError(errors, "manifest.styleGuideCommitAtGeneration", "guia e geração precisam estar em commits distintos e ordenados");
  if (!hasText(manifest.currentStyleGuideVersion)) addError(errors, "manifest.currentStyleGuideVersion", "versão vigente do guia obrigatória");
  if (manifest.styleGuideAtGeneration !== manifest.currentStyleGuideVersion) {
    addError(errors, "manifest.styleGuideAtGeneration", "coleta exige que a versão usada na geração seja a versão vigente");
  }
  if (!hasText(manifest.tool)) addError(errors, "manifest.tool", "ferramenta de geração obrigatória");
  if (!hasText(manifest.commonPrompt)) addError(errors, "manifest.commonPrompt", "prompt comum imutável obrigatório");
  const generationContract = manifest.generationContract;
  if (!isRecord(generationContract)) {
    addError(errors, "manifest.generationContract", "plano prévio e receipt histórico da geração obrigatórios");
  } else {
    for (const phase of ["plan", "receipt"]) {
      const record = generationContract[phase];
      if (!isRecord(record)) {
        addError(errors, `manifest.generationContract.${phase}`, "registro obrigatório");
        continue;
      }
      if (!hasText(record.path)) addError(errors, `manifest.generationContract.${phase}.path`, "caminho obrigatório");
      if (!/^[a-f0-9]{40}$/.test(record.commit || "")) addError(errors, `manifest.generationContract.${phase}.commit`, "commit obrigatório");
      if (!isSha256(record.sha256)) addError(errors, `manifest.generationContract.${phase}.sha256`, "SHA-256 obrigatório");
    }
    if (generationContract.receipt?.commit !== manifest.generationCommit) {
      addError(errors, "manifest.generationContract.receipt.commit", "receipt precisa estar no commit de geração");
    }
  }
  const receiptRegistry = manifest.receiptRegistry;
  if (!isRecord(receiptRegistry)) {
    addError(errors, "manifest.receiptRegistry", "registro de receipts pré-emitidos obrigatório");
  } else {
    if (receiptRegistry.protocol !== "card-art-pilot-176-receipts-v1") addError(errors, "manifest.receiptRegistry.protocol", "protocolo inválido");
    if (!hasText(receiptRegistry.path)) addError(errors, "manifest.receiptRegistry.path", "caminho obrigatório");
    if (!/^[a-f0-9]{40}$/.test(receiptRegistry.commit || "")) addError(errors, "manifest.receiptRegistry.commit", "commit obrigatório");
    if (parsedDate(receiptRegistry.committedAt) === null) addError(errors, "manifest.receiptRegistry.committedAt", "instante do commit válido obrigatório");
    if (!isSha256(receiptRegistry.sha256)) addError(errors, "manifest.receiptRegistry.sha256", "SHA-256 obrigatório");
    if (!Number.isInteger(receiptRegistry.issuedCount) || receiptRegistry.issuedCount < 40) {
      addError(errors, "manifest.receiptRegistry.issuedCount", "ao menos 40 receipts pré-emitidos obrigatórios");
    }
  }
  if (manifest.generationContractSchema !== "stages/12_quality_gate_main/references/card-art-pilot-generation-contract.schema.json") {
    addError(errors, "manifest.generationContractSchema", "schema canônico do contrato de geração obrigatório");
  }
  if (manifest.participantResponseSchema !== "stages/12_quality_gate_main/references/card-art-pilot-participant-response.schema.json") {
    addError(errors, "manifest.participantResponseSchema", "schema canônico das respostas individuais obrigatório");
  }
  if (manifest.responseBundleSchema !== "stages/12_quality_gate_main/references/card-art-pilot-response-bundle.schema.json") {
    addError(errors, "manifest.responseBundleSchema", "schema canônico do bundle obrigatório");
  }
  if (manifest.receiptRegistrySchema !== "stages/12_quality_gate_main/references/card-art-pilot-receipt-registry.schema.json") {
    addError(errors, "manifest.receiptRegistrySchema", "schema canônico do registro de receipts obrigatório");
  }
  if (manifest.collectionAllowed !== true) {
    addError(errors, "manifest.collectionAllowed", "nenhum resultado pode ser consolidado enquanto a coleta não estiver explicitamente autorizada");
  }
  if (typeof manifest.scaleDecisionAllowed !== "boolean") {
    addError(errors, "manifest.scaleDecisionAllowed", "gate de escala deve ser booleano");
  } else if (manifest.scaleDecisionAllowed && manifest.collectionAllowed !== true) {
    addError(errors, "manifest.scaleDecisionAllowed", "escala não pode ser autorizada enquanto collectionAllowed não for true");
  }
  if (!Array.isArray(manifest.assets)) {
    addError(errors, "manifest.assets", "lista de artes e licenças ausente");
    return;
  }

  const observedCodes = manifest.assets.map((asset) => asset?.blindCode);
  const observedPeople = manifest.assets.map((asset) => asset?.personId).filter(hasText);
  const observedFiles = manifest.assets.map((asset) => asset?.file).filter(hasText);
  const observedArtHashes = manifest.assets.map((asset) => asset?.sha256).filter(isSha256);
  const observedReferenceHashes = manifest.assets.map((asset) => asset?.identityReference?.sha256).filter(isSha256);
  for (const [label, values] of [
    ["personId", observedPeople],
    ["file", observedFiles],
    ["sha256", observedArtHashes],
    ["identityReference.sha256", observedReferenceHashes]
  ]) {
    if (new Set(values).size !== values.length) addError(errors, `manifest.assets.${label}`, "valores precisam ser únicos no lote");
  }
  for (const code of CARD_ART_PILOT_CODES) {
    const matches = manifest.assets.filter((asset) => asset?.blindCode === code);
    if (matches.length !== 1) {
      addError(errors, "manifest.assets", `${code} precisa aparecer exatamente uma vez; encontrado ${matches.length}`);
      continue;
    }
    const asset = matches[0];
    const assetPath = `manifest.assets.${code}`;
    if (!hasText(asset.personId)) addError(errors, `${assetPath}.personId`, "pessoa vinculada obrigatória");
    if (asset.file !== `${code}.png`) addError(errors, `${assetPath}.file`, `arquivo cego deve ser ${code}.png`);
    if (!hasText(asset.generationPath)) addError(errors, `${assetPath}.generationPath`, "caminho da arte no commit de geração obrigatório");
    if (!isSha256(asset.sha256)) addError(errors, `${assetPath}.sha256`, "SHA-256 da arte obrigatório");
    if (!Number.isInteger(asset.width) || asset.width <= 0) addError(errors, `${assetPath}.width`, "largura positiva obrigatória");
    if (!Number.isInteger(asset.height) || asset.height <= 0) addError(errors, `${assetPath}.height`, "altura positiva obrigatória");
    if (!hasText(asset.sourceOutput)) addError(errors, `${assetPath}.sourceOutput`, "origem da geração obrigatória");

    const reference = asset.identityReference;
    const path = `manifest.assets.${code}.identityReference`;
    if (!isRecord(reference)) {
      addError(errors, path, "proveniência da referência ausente");
      continue;
    }
    if (!hasText(reference.path)) addError(errors, `${path}.path`, "arquivo de referência obrigatório");
    if (!isSha256(reference.sha256)) addError(errors, `${path}.sha256`, "SHA-256 da referência obrigatório");
    if (!hasText(reference.derivation)) addError(errors, `${path}.derivation`, "derivação da referência obrigatória");
    if (reference.licenseStatus !== "documented") {
      addError(errors, `${path}.licenseStatus`, `coleta exige licença documented; recebido ${reference.licenseStatus || "missing"}`);
    }
    if (!isHttpsUrl(reference.photoSource)) addError(errors, `${path}.photoSource`, "coleta exige URL HTTPS da fotografia efetivamente usada");
    if (!hasText(reference.photographer)) addError(errors, `${path}.photographer`, "coleta exige autoria documentada");
    if (!hasText(reference.license)) addError(errors, `${path}.license`, "coleta exige licença documentada");
  }
  for (const code of observedCodes.filter((observed) => !CARD_ART_PILOT_CODES.includes(observed))) {
    addError(errors, "manifest.assets", `código inesperado ${code}`);
  }
}

function requireCount(errors, path, value) {
  if (!isCount(value)) {
    addError(errors, path, "deve ser um inteiro não negativo");
    return false;
  }
  return true;
}

function requireRate(errors, path, value) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    addError(errors, path, "deve ser uma taxa entre 0 e 1");
    return false;
  }
  return true;
}

function checkSum(errors, path, expected, values) {
  if (!isCount(expected) || !values.every(isCount)) return;
  const observed = values.reduce((total, value) => total + value, 0);
  if (observed !== expected) addError(errors, path, `soma ${observed} difere do denominador ${expected}`);
}

function checkRate(errors, path, numerator, denominator, rate) {
  if (!isCount(numerator) || !isCount(denominator) || !requireRate(errors, path, rate)) return;
  const expected = denominator === 0 ? 0 : numerator / denominator;
  if (Math.abs(rate - expected) > RATE_TOLERANCE) {
    addError(errors, path, `taxa ${rate} difere de ${numerator}/${denominator} (${expected})`);
  }
}

function validateStratum(errors, sample, key) {
  const stratum = sample?.strata?.[key];
  const path = `sample.strata.${key}`;
  if (!isRecord(stratum) || !Array.isArray(stratum.published)) {
    addError(errors, path, "estrutura de estrato ausente");
    return;
  }
  const keys = stratum.published.map((item) => item?.key);
  if (new Set(keys).size !== keys.length) addError(errors, `${path}.published`, "chaves publicadas repetidas");
  const publishedCounts = stratum.published.map((item, index) => {
    const participantCount = item?.participantCount;
    requireCount(errors, `${path}.published[${index}].participantCount`, participantCount);
    if (isCount(participantCount) && participantCount < 5) {
      addError(errors, `${path}.published[${index}].participantCount`, "célula publicada precisa ter ao menos cinco participantes");
    }
    return participantCount;
  });
  requireCount(errors, `${path}.suppressedCount`, stratum.suppressedCount);
  if (isCount(sample.participantCount) && publishedCounts.every(isCount) && isCount(stratum.suppressedCount)) {
    checkSum(errors, path, sample.participantCount, [...publishedCounts, stratum.suppressedCount]);
  }
}

function validatePrivacy(errors, privacy) {
  const path = "sample.privacy";
  if (!isRecord(privacy)) {
    addError(errors, path, "controles de privacidade ausentes");
    return;
  }
  rejectUnknownKeys(errors, path, privacy, [
    "containsParticipantRecords",
    "minimumPublishedCellSize",
    "crossTabsPublished",
    "rawExportsDeletedAfterConsolidation"
  ]);
  const expectations = {
    containsParticipantRecords: false,
    minimumPublishedCellSize: 5,
    crossTabsPublished: false,
    rawExportsDeletedAfterConsolidation: true
  };
  for (const [key, expected] of Object.entries(expectations)) {
    if (privacy[key] !== expected) addError(errors, `${path}.${key}`, `deve ser ${JSON.stringify(expected)}`);
  }
}

function validateCustody(errors, result, manifest) {
  const custody = result?.custody;
  if (!isRecord(custody)) {
    addError(errors, "custody", "cadeia de custódia das respostas individuais ausente");
    return;
  }
  if (custody.protocol !== "card-art-pilot-176-v2-custody") addError(errors, "custody.protocol", "protocolo de custódia inválido");
  if (!isSha256(custody.receiptRegistrySha256)) addError(errors, "custody.receiptRegistrySha256", "SHA-256 do registro de receipts obrigatório");
  if (custody.receiptRegistrySha256 !== manifest?.receiptRegistry?.sha256) {
    addError(errors, "custody.receiptRegistrySha256", "registro de receipts diverge do manifesto");
  }
  if (!Number.isInteger(custody.responseCount) || custody.responseCount < 1) addError(errors, "custody.responseCount", "contagem positiva obrigatória");
  if (!Array.isArray(custody.entries) || custody.entries.length === 0) {
    addError(errors, "custody.entries", "resultado final não pode consolidar um conjunto vazio");
    return;
  }
  if (custody.entries.length !== custody.responseCount) addError(errors, "custody.entries", "quantidade diverge de custody.responseCount");
  if (result?.sample?.participantCount !== custody.responseCount) addError(errors, "custody.responseCount", "quantidade diverge de sample.participantCount");

  const responseIds = custody.entries.map((entry) => entry?.responseId);
  const receiptHashes = custody.entries.map((entry) => entry?.receiptSha256);
  const responseHashes = custody.entries.map((entry) => entry?.responseSha256);
  for (const [label, values] of [
    ["responseId", responseIds],
    ["receiptSha256", receiptHashes],
    ["responseSha256", responseHashes]
  ]) {
    if (new Set(values).size !== values.length) addError(errors, `custody.entries.${label}`, "valores precisam ser únicos");
  }
  const sorted = [...custody.entries].sort((left, right) => String(left?.receiptSha256).localeCompare(String(right?.receiptSha256))
    || String(left?.responseId).localeCompare(String(right?.responseId)));
  if (cardArtPilotCanonicalJson(sorted) !== cardArtPilotCanonicalJson(custody.entries)) {
    addError(errors, "custody.entries", "entradas precisam estar na ordem canônica por receiptSha256 e responseId");
  }
  const { responseSetRootSha256, ...envelope } = custody;
  const expectedRoot = cardArtPilotCanonicalSha256({ batch: result.batch, ...envelope });
  if (responseSetRootSha256 !== expectedRoot) {
    addError(errors, "custody.responseSetRootSha256", `raiz canônica diverge; esperado ${expectedRoot}`);
  }
}

function parsedDate(value) {
  if (!hasText(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function validateHumanAccountability(errors, result, manifest, now) {
  const decision = result?.decision;
  if (!isRecord(decision)) {
    addError(errors, "decision", "decisão humana ausente");
    return;
  }
  if (!hasText(decision.decidedBy)) addError(errors, "decision.decidedBy", "responsável não pode ser vazio");
  if (!hasText(decision.rationale)) addError(errors, "decision.rationale", "justificativa não pode ser vazia");
  const decisionAt = parsedDate(decision.decidedAt);
  if (decisionAt === null) addError(errors, "decision.decidedAt", "data válida obrigatória");

  const generatedAt = parsedDate(result.generatedAt);
  if (generatedAt === null) {
    addError(errors, "generatedAt", "data válida obrigatória");
  } else if (decisionAt !== null && decisionAt > generatedAt) {
    addError(errors, "decision.decidedAt", "decisão não pode ser posterior à geração do consolidado");
  }

  const attestedAt = parsedDate(result?.sample?.externalRecruitment?.attestedAt);
  if (decisionAt !== null && attestedAt !== null && attestedAt > decisionAt) {
    addError(errors, "sample.externalRecruitment.attestedAt", "atestação não pode ser posterior à decisão");
  }

  const manifestDate = parsedCivilDate(manifest?.generatedOn);
  const manifestGeneratedAt = parsedDate(manifest?.generatedAt);
  const firstCollectedAt = parsedDate(result?.custody?.firstCollectedAt);
  const lastCollectedAt = parsedDate(result?.custody?.lastCollectedAt);
  const latestPilotDate = manifestDate === null ? null : manifestDate + (366 * 24 * 60 * 60 * 1000);
  const boundedDates = [
    ["custody.firstCollectedAt", firstCollectedAt],
    ["custody.lastCollectedAt", lastCollectedAt],
    ["sample.externalRecruitment.attestedAt", attestedAt],
    ["decision.decidedAt", decisionAt],
    ["generatedAt", generatedAt]
  ];

  for (const [index, asset] of (result.assets || []).entries()) {
    const code = asset?.blindCode || `index-${index}`;
    for (const reviewName of ["identityReview", "dignityReview"]) {
      const review = asset?.[reviewName];
      const path = `assets[${index}](${code}).${reviewName}`;
      if (!isRecord(review)) {
        addError(errors, path, "revisão humana ausente");
        continue;
      }
      if (!hasText(review.reviewedBy)) addError(errors, `${path}.reviewedBy`, "responsável não pode ser vazio");
      if (!hasText(review.notes)) addError(errors, `${path}.notes`, "notas não podem ser vazias");
      const reviewedAt = parsedDate(review.reviewedAt);
      if (reviewedAt === null) {
        addError(errors, `${path}.reviewedAt`, "data válida obrigatória");
      } else if (decisionAt !== null && reviewedAt > decisionAt) {
        addError(errors, `${path}.reviewedAt`, "revisão não pode ser posterior à decisão");
      }
      if (reviewedAt !== null && attestedAt !== null && reviewedAt < attestedAt) {
        addError(errors, `${path}.reviewedAt`, "revisão não pode anteceder a atestação final da coleta");
      }
      boundedDates.push([`${path}.reviewedAt`, reviewedAt]);
    }
  }

  if (firstCollectedAt !== null && lastCollectedAt !== null && firstCollectedAt > lastCollectedAt) {
    addError(errors, "custody.firstCollectedAt", "primeira coleta não pode ser posterior à última coleta");
  }
  if (lastCollectedAt !== null && attestedAt !== null && lastCollectedAt > attestedAt) {
    addError(errors, "sample.externalRecruitment.attestedAt", "atestação não pode anteceder o encerramento da coleta");
  }
  if (manifestGeneratedAt !== null) {
    for (const [path, timestamp] of boundedDates) {
      if (timestamp !== null && timestamp <= manifestGeneratedAt) {
        addError(errors, path, "instante precisa ser posterior a manifest.generatedAt");
      }
    }
  }

  for (const [path, timestamp] of boundedDates) {
    if (timestamp !== null && timestamp > now + CARD_ART_PILOT_MAX_CLOCK_SKEW_MS) {
      addError(errors, path, "data não pode estar no futuro");
    }
  }

  if (manifestDate === null) {
    addError(errors, "manifest.generatedOn", "data do lote válida obrigatória para conferir a cronologia");
  } else {
    for (const [path, timestamp] of boundedDates) {
      if (timestamp === null) continue;
      if (timestamp < manifestDate) addError(errors, path, "data não pode anteceder a geração do lote");
      if (timestamp > latestPilotDate) addError(errors, path, "data excede a janela verificável de 366 dias do lote");
    }
  }
}

function validateScenarioMetrics(errors, metrics, path, assignedParticipants) {
  if (!isRecord(metrics)) {
    addError(errors, path, "métricas ausentes");
    return;
  }
  for (const key of ["validResponses", "recognized", "favorece", "neutra", "prejudica"]) {
    requireCount(errors, `${path}.${key}`, metrics[key]);
  }
  if (isCount(metrics.validResponses) && isCount(assignedParticipants) && metrics.validResponses > assignedParticipants) {
    addError(errors, `${path}.validResponses`, `excede os ${assignedParticipants} participantes atribuídos ao cenário`);
  }
  if (isCount(metrics.validResponses) && metrics.validResponses < MINIMUM_VALID_RESPONSES_PER_ASSET_SCENARIO) {
    addError(errors, `${path}.validResponses`, `precisa ter ao menos ${MINIMUM_VALID_RESPONSES_PER_ASSET_SCENARIO} respostas válidas externas nesta arte e cenário`);
  }
  checkSum(errors, `${path}.neutrality`, metrics.validResponses, [metrics.favorece, metrics.neutra, metrics.prejudica]);
  checkRate(errors, `${path}.recognitionRate`, metrics.recognized, metrics.validResponses, metrics.recognitionRate);
  checkRate(errors, `${path}.favoreceRate`, metrics.favorece, metrics.validResponses, metrics.favoreceRate);
  checkRate(errors, `${path}.neutraRate`, metrics.neutra, metrics.validResponses, metrics.neutraRate);
  checkRate(errors, `${path}.prejudicaRate`, metrics.prejudica, metrics.validResponses, metrics.prejudicaRate);
}

function validateAssetMetrics(errors, asset, index, sample) {
  const code = asset?.blindCode || `index-${index}`;
  const path = `assets[${index}](${code})`;
  if (!isRecord(asset)) {
    addError(errors, path, "resultado ausente");
    return;
  }
  requireCount(errors, `${path}.validResponses`, asset.validResponses);
  if (isCount(asset.validResponses) && isCount(sample?.participantCount) && asset.validResponses > sample.participantCount) {
    addError(errors, `${path}.validResponses`, `excede os ${sample.participantCount} participantes da amostra`);
  }

  const recognition = asset.recognition;
  if (!isRecord(recognition)) {
    addError(errors, `${path}.recognition`, "métricas ausentes");
  } else {
    for (const key of ["correct", "incorrect", "unknown"]) requireCount(errors, `${path}.recognition.${key}`, recognition[key]);
    checkSum(errors, `${path}.recognition`, asset.validResponses, [recognition.correct, recognition.incorrect, recognition.unknown]);
    checkRate(errors, `${path}.recognition.rate`, recognition.correct, asset.validResponses, recognition.rate);
  }

  const neutrality = asset.neutrality;
  if (!isRecord(neutrality)) {
    addError(errors, `${path}.neutrality`, "métricas ausentes");
  } else {
    for (const key of ["favorece", "neutra", "prejudica"]) requireCount(errors, `${path}.neutrality.${key}`, neutrality[key]);
    checkSum(errors, `${path}.neutrality`, asset.validResponses, [neutrality.favorece, neutrality.neutra, neutrality.prejudica]);
    checkRate(errors, `${path}.neutrality.favoreceRate`, neutrality.favorece, asset.validResponses, neutrality.favoreceRate);
    checkRate(errors, `${path}.neutrality.neutraRate`, neutrality.neutra, asset.validResponses, neutrality.neutraRate);
    checkRate(errors, `${path}.neutrality.prejudicaRate`, neutrality.prejudica, asset.validResponses, neutrality.prejudicaRate);
    if (Number.isFinite(neutrality.favoreceRate) && Number.isFinite(neutrality.prejudicaRate)) {
      const expectedBalance = (neutrality.favoreceRate - neutrality.prejudicaRate) * 100;
      if (!Number.isFinite(neutrality.balancePercentagePoints)
        || Math.abs(neutrality.balancePercentagePoints - expectedBalance) > PERCENTAGE_POINT_TOLERANCE) {
        addError(errors, `${path}.neutrality.balancePercentagePoints`, `saldo difere de ${expectedBalance}`);
      }
    }
  }

  const scenarios = asset.byDisplayScenario;
  if (!isRecord(scenarios)) {
    addError(errors, `${path}.byDisplayScenario`, "métricas por cenário ausentes");
    return;
  }
  for (const scenario of CARD_ART_PILOT_SCENARIOS) {
    validateScenarioMetrics(errors, scenarios[scenario], `${path}.byDisplayScenario.${scenario}`, sample?.displayScenarios?.[scenario]);
  }
  const scenarioMetrics = CARD_ART_PILOT_SCENARIOS.map((scenario) => scenarios[scenario]).filter(isRecord);
  if (scenarioMetrics.length === CARD_ART_PILOT_SCENARIOS.length) {
    checkSum(errors, `${path}.byDisplayScenario.validResponses`, asset.validResponses, scenarioMetrics.map(({ validResponses }) => validResponses));
    if (isRecord(recognition)) checkSum(errors, `${path}.byDisplayScenario.recognized`, recognition.correct, scenarioMetrics.map(({ recognized }) => recognized));
    if (isRecord(neutrality)) {
      for (const tone of ["favorece", "neutra", "prejudica"]) {
        checkSum(errors, `${path}.byDisplayScenario.${tone}`, neutrality[tone], scenarioMetrics.map((metrics) => metrics[tone]));
      }
    }
  }
}

function validateFollowDecision(errors, result, manifest) {
  if (result?.decision?.value !== "seguir") return;
  if (manifest?.scaleDecisionAllowed !== true) addError(errors, "decision.value", "seguir bloqueado porque scaleDecisionAllowed não é true no manifesto");
  for (const scenario of CARD_ART_PILOT_SCENARIOS) {
    const participants = result?.sample?.displayScenarios?.[scenario];
    if (!isCount(participants) || participants < 20) {
      addError(errors, `sample.displayScenarios.${scenario}`, "seguir exige pelo menos 20 participantes externos neste cenário");
    }
  }
  const recruitment = result?.sample?.externalRecruitment;
  if (recruitment?.externalParticipantsOnly !== true
    || recruitment?.productionTeamExcluded !== true
    || !String(recruitment?.attestedBy || "").trim()
    || Number.isNaN(Date.parse(recruitment?.attestedAt))) {
    addError(errors, "sample.externalRecruitment", "seguir exige atestação responsável e datada de recrutamento exclusivamente externo");
  }

  const balances = [];
  for (const [index, asset] of (result.assets || []).entries()) {
    const code = asset?.blindCode || `index-${index}`;
    for (const scenario of CARD_ART_PILOT_SCENARIOS) {
      const rate = asset?.byDisplayScenario?.[scenario]?.recognitionRate;
      if (!Number.isFinite(rate) || rate < 0.7) {
        addError(errors, `assets[${index}](${code}).byDisplayScenario.${scenario}.recognitionRate`, "seguir exige reconhecimento mínimo de 70% em cada cenário");
      }
      for (const tone of ["favorece", "prejudica"]) {
        const toneRate = asset?.byDisplayScenario?.[scenario]?.[`${tone}Rate`];
        if (!Number.isFinite(toneRate) || toneRate > 0.2) {
          addError(errors, `assets[${index}](${code}).byDisplayScenario.${scenario}.${tone}Rate`, `seguir exige ${tone}Rate menor ou igual a 20% em cada cenário`);
        }
      }
    }
    const [mobile, desktop] = CARD_ART_PILOT_SCENARIOS.map((scenario) => asset?.byDisplayScenario?.[scenario]);
    if (isCount(mobile?.recognized) && isCount(mobile?.validResponses) && mobile.validResponses > 0
      && isCount(desktop?.recognized) && isCount(desktop?.validResponses) && desktop.validResponses > 0) {
      const exactGapNumerator = Math.abs(
        (mobile.recognized * desktop.validResponses) - (desktop.recognized * mobile.validResponses)
      ) * 100;
      const maximumGapNumerator = 15 * mobile.validResponses * desktop.validResponses;
      if (exactGapNumerator > maximumGapNumerator) {
        addError(errors, `assets[${index}](${code}).byDisplayScenario.recognitionRate`, "seguir exige diferença de reconhecimento de no máximo 15 pontos percentuais entre cenários");
      }
    }
    for (const tone of ["favorece", "prejudica"]) {
      const toneRate = asset?.neutrality?.[`${tone}Rate`];
      if (!Number.isFinite(toneRate) || toneRate > 0.2) {
        addError(errors, `assets[${index}](${code}).neutrality.${tone}Rate`, `seguir exige ${tone}Rate total menor ou igual a 20%`);
      }
    }
    for (const review of ["identityReview", "dignityReview"]) {
      const reviewStatus = asset?.[review]?.status;
      if (reviewStatus !== "approved") addError(errors, `assets[${index}](${code}).${review}.status`, `seguir exige revisão approved; recebido ${reviewStatus || "pending"}`);
    }
    if (Number.isFinite(asset?.neutrality?.balancePercentagePoints)) balances.push(asset.neutrality.balancePercentagePoints);
  }
  if (balances.length > 1 && Math.max(...balances) - Math.min(...balances) > 20 + PERCENTAGE_POINT_TOLERANCE) {
    addError(errors, "assets.neutrality.balancePercentagePoints", "seguir bloqueado por discrepância superior a 20 pontos percentuais entre imagens");
  }
}

function resolveValidationNow({ now, clock = Date.now } = {}) {
  const supplied = now ?? (typeof clock === "function" ? clock() : clock);
  const timestamp = supplied instanceof Date ? supplied.getTime() : supplied;
  if (!Number.isFinite(timestamp)) throw new TypeError("relógio de validação inválido");
  return timestamp;
}

export function validateCardArtPilotResults(result, manifest, options) {
  const now = resolveValidationNow(options);
  const errors = [];
  if (!isRecord(result)) return ["result: deve ser um objeto"];
  if (!isRecord(manifest)) addError(errors, "manifest", "manifesto obrigatório para validar licenças e gates");
  validateNoParticipantPii(errors, result);
  validateManifestBinding(errors, result, manifest);
  validateManifestForCollection(errors, manifest, now);
  validateCustody(errors, result, manifest);

  const sample = result.sample;
  if (!isRecord(sample)) {
    addError(errors, "sample", "amostra ausente");
  } else {
    rejectUnknownKeys(errors, "sample", sample, ["participantCount", "displayScenarios", "externalRecruitment", "privacy", "strata"]);
    requireCount(errors, "sample.participantCount", sample.participantCount);
    const scenarioCounts = CARD_ART_PILOT_SCENARIOS.map((scenario) => {
      const count = sample.displayScenarios?.[scenario];
      requireCount(errors, `sample.displayScenarios.${scenario}`, count);
      if (isCount(count) && count < 20) addError(errors, `sample.displayScenarios.${scenario}`, "precisa ter ao menos 20 participantes");
      return count;
    });
    if (isCount(sample.participantCount) && scenarioCounts.every(isCount)) {
      checkSum(errors, "sample.displayScenarios", sample.participantCount, scenarioCounts);
    }
    const recruitment = sample.externalRecruitment;
    if (!isRecord(recruitment)) {
      addError(errors, "sample.externalRecruitment", "atestação de recrutamento externo ausente");
    } else {
      rejectUnknownKeys(errors, "sample.externalRecruitment", recruitment, [
        "externalParticipantsOnly",
        "productionTeamExcluded",
        "attestedBy",
        "attestedAt"
      ]);
      if (recruitment.externalParticipantsOnly !== true) addError(errors, "sample.externalRecruitment.externalParticipantsOnly", "deve confirmar somente participantes externos");
      if (recruitment.productionTeamExcluded !== true) addError(errors, "sample.externalRecruitment.productionTeamExcluded", "deve confirmar exclusão da equipe de produção");
      if (!String(recruitment.attestedBy || "").trim()) addError(errors, "sample.externalRecruitment.attestedBy", "responsável obrigatório");
      if (!recruitment.attestedAt || Number.isNaN(Date.parse(recruitment.attestedAt))) addError(errors, "sample.externalRecruitment.attestedAt", "data válida obrigatória");
    }
    validatePrivacy(errors, sample.privacy);
    validateStratum(errors, sample, "regional");
    validateStratum(errors, sample, "familiarity");
  }

  if (!Array.isArray(result.assets)) {
    addError(errors, "assets", "lista ausente");
  } else {
    const observedCodes = result.assets.map((asset) => asset?.blindCode);
    for (const code of CARD_ART_PILOT_CODES) {
      const occurrences = observedCodes.filter((observed) => observed === code).length;
      if (occurrences !== 1) addError(errors, "assets", `${code} precisa aparecer exatamente uma vez; encontrado ${occurrences}`);
    }
    for (const code of observedCodes.filter((observed) => !CARD_ART_PILOT_CODES.includes(observed))) {
      addError(errors, "assets", `código inesperado ${code}`);
    }
    result.assets.forEach((asset, index) => validateAssetMetrics(errors, asset, index, sample));
  }

  validateHumanAccountability(errors, result, manifest, now);
  validateFollowDecision(errors, result, manifest);
  return errors;
}

export function assertCardArtPilotResults(result, manifest, options) {
  const errors = validateCardArtPilotResults(result, manifest, options);
  if (!errors.length) return;
  const error = new Error(`Resultado do piloto #176 inválido:\n- ${errors.join("\n- ")}`);
  error.validationErrors = errors;
  throw error;
}
