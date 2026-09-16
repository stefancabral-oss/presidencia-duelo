export const CARD_ART_PILOT_CODES = Object.freeze(Array.from({ length: 8 }, (_, index) => `P0${index + 1}`));
export const CARD_ART_PILOT_SCENARIOS = Object.freeze(["mobile-390x844", "desktop-1000x800"]);

const RATE_TOLERANCE = 1e-6;
const PERCENTAGE_POINT_TOLERANCE = 1e-4;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
  if (manifest?.collectionAllowed !== true) addError(errors, "decision.value", "seguir bloqueado porque collectionAllowed não é true no manifesto");
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

  const licenseByCode = new Map((manifest?.assets || []).map((asset) => [asset.blindCode, asset.identityReference?.licenseStatus]));
  const balances = [];
  for (const [index, asset] of (result.assets || []).entries()) {
    const code = asset?.blindCode || `index-${index}`;
    for (const scenario of CARD_ART_PILOT_SCENARIOS) {
      const rate = asset?.byDisplayScenario?.[scenario]?.recognitionRate;
      if (!Number.isFinite(rate) || rate < 0.7) {
        addError(errors, `assets[${index}](${code}).byDisplayScenario.${scenario}.recognitionRate`, "seguir exige reconhecimento mínimo de 70% em cada cenário");
      }
    }
    for (const review of ["identityReview", "dignityReview"]) {
      const reviewStatus = asset?.[review]?.status;
      if (reviewStatus !== "approved") addError(errors, `assets[${index}](${code}).${review}.status`, `seguir exige revisão approved; recebido ${reviewStatus || "pending"}`);
    }
    const licenseStatus = licenseByCode.get(code);
    if (licenseStatus !== "documented") addError(errors, `manifest.assets.${code}.identityReference.licenseStatus`, `seguir exige licença documented; recebido ${licenseStatus || "missing"}`);
    if (Number.isFinite(asset?.neutrality?.balancePercentagePoints)) balances.push(asset.neutrality.balancePercentagePoints);
  }
  if (balances.length > 1 && Math.max(...balances) - Math.min(...balances) > 20 + PERCENTAGE_POINT_TOLERANCE) {
    addError(errors, "assets.neutrality.balancePercentagePoints", "seguir bloqueado por discrepância superior a 20 pontos percentuais entre imagens");
  }
}

export function validateCardArtPilotResults(result, manifest) {
  const errors = [];
  if (!isRecord(result)) return ["result: deve ser um objeto"];
  if (!isRecord(manifest)) addError(errors, "manifest", "manifesto obrigatório para validar licenças e gates");

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

  validateFollowDecision(errors, result, manifest);
  return errors;
}

export function assertCardArtPilotResults(result, manifest) {
  const errors = validateCardArtPilotResults(result, manifest);
  if (!errors.length) return;
  const error = new Error(`Resultado do piloto #176 inválido:\n- ${errors.join("\n- ")}`);
  error.validationErrors = errors;
  throw error;
}
