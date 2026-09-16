import { dailyMethodologyForDate, validateDailySession } from "./daily-session.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RESULT_TYPES = new Set(["correct", "incorrect", "tie", "no-sample", "skipped", "not-answered"]);
const PREDICTION_STATUSES = new Set(["created", "alreadyProcessed"]);
const DAILY_TOPIC = "eleicoes-2026";
const DAILY_RULESET_ID = "daily-four-card-v1";
const DAILY_RULESET_VERSION = 1;
const DAILY_CATALOG_SCHEMA = "candidate-public-v1";
const DAILY_ROUNDS = 10;
const DAILY_CARDS = 4;
const SELECTED_CANDIDATES = DAILY_ROUNDS * DAILY_CARDS;

function fail(field) {
  throw new TypeError(`resultado de apostas inválido: ${field}`);
}

function integer(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) fail(field);
  return value;
}

function instant(value, field) {
  if (typeof value !== "string") fail(field);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) fail(field);
  return parsed;
}

function nextDate(date) {
  const parsed = Date.parse(`${date}T12:00:00.000Z`);
  if (!Number.isFinite(parsed)) fail("edition.date");
  return new Date(parsed + 86_400_000).toISOString().slice(0, 10);
}

function saoPauloWallClock(value) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const byType = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    time: `${byType.hour}:${byType.minute}:${byType.second}`,
  };
}

function expectedSampleNotice(completedPlayers) {
  if (completedPlayers === 0) return "Nenhuma sessão concluída; não há resultado a interpretar.";
  if (completedPlayers < 30) return "Recorte de baixa participação; apresente contagens, não uma conclusão populacional.";
  return null;
}

function expectedRoundResult(round, completedPlayers) {
  const highest = Math.max(...round.choices.map(({ count }) => count));
  const leaderIds = completedPlayers
    ? round.choices.filter(({ count }) => count === highest).map(({ candidateId }) => candidateId)
    : [];
  const winnerId = leaderIds.length === 1 ? leaderIds[0] : null;
  const outcome = winnerId ? "decided" : completedPlayers ? "tie" : "no-sample";
  return { leaderIds, winnerId, outcome };
}

function sameRecord(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function samePrefix(current, next) {
  return current.every((record, index) => sameRecord(record, next[index]));
}

/**
 * Confirma que um 200 de aposta pertence exatamente à tentativa que o gerou.
 * A sessão só pode ser instalada depois desta correlação; um corpo truncado ou
 * divergente mantém a mesma chave idempotente disponível para retry.
 */
export function confirmedDailyPredictionData(response, attempt, currentSession) {
  if (!response?.prediction || !response.dailySession || !attempt) fail("confirmation.structure");
  const current = validateDailySession(currentSession);
  const next = validateDailySession(response.dailySession);
  const pending = current.pendingPrediction;
  const candidateId = attempt.candidateId === null ? null : String(attempt.candidateId || "");
  const skipped = candidateId === null;
  if (!UUID_PATTERN.test(String(attempt.predictionId || ""))
    || attempt.editionId !== current.edition.id
    || !pending || attempt.slot !== pending.slot
    || (candidateId !== null && (!candidateId || !pending.candidateIds.includes(candidateId)))) {
    fail("confirmation.attempt");
  }

  const confirmation = response.prediction;
  if (confirmation.id !== attempt.predictionId
    || confirmation.slot !== attempt.slot
    || confirmation.candidateId !== candidateId
    || confirmation.skipped !== skipped
    || !PREDICTION_STATUSES.has(confirmation.status)) fail("confirmation.prediction");
  if (!sameRecord(next.edition, current.edition) || !sameRecord(next.catalog, current.catalog)
    || !sameRecord(next.rounds, current.rounds)
    || !samePrefix(current.answers, next.answers)
    || !samePrefix(current.predictions, next.predictions)) {
    fail("confirmation.session");
  }
  const acceptedRows = next.predictions.filter(({ predictionId }) => predictionId === attempt.predictionId);
  const accepted = next.predictions.find(({ slot }) => slot === attempt.slot);
  if (acceptedRows.length !== 1 || acceptedRows[0] !== accepted
    || accepted.candidateId !== candidateId || accepted.skipped !== skipped) {
    fail("confirmation.progress");
  }
  if (confirmation.status === "created") {
    const expectedPredictionProgress = {
      responded: current.predictionProgress.responded + 1,
      predicted: current.predictionProgress.predicted + (skipped ? 0 : 1),
      skipped: current.predictionProgress.skipped + (skipped ? 1 : 0),
      total: current.predictionProgress.total,
    };
    if (!sameRecord(next.answers, current.answers)
      || !sameRecord(next.progress, current.progress)
      || next.predictions.length !== current.predictions.length + 1
      || accepted !== next.predictions[current.predictions.length]
      || !sameRecord(next.predictionProgress, expectedPredictionProgress)
      || next.status !== current.status
      || !sameRecord(next.round, current.round)
      || !sameRecord(next.completion, current.completion)) {
      fail("confirmation.created");
    }
  } else if (next.predictionProgress.responded < current.predictionProgress.responded + 1) {
    // Um replay pode observar avanços reais de outra aba, mas nunca regressão,
    // troca de prefixo ou ausência da aposta idempotente correlacionada.
    fail("confirmation.alreadyProcessed");
  }
  return { prediction: confirmation, dailySession: next };
}

export function validateDailyPredictionResults(payload) {
  if (!payload || payload.baselinePercent !== 25 || !payload.score || !Array.isArray(payload.sessions)) fail("estrutura");
  const totals = { correct: 0, scored: 0, attempted: 0, skipped: 0, ties: 0, noSample: 0 };
  const editionIds = new Set();
  const editionDates = new Set();
  const answerIds = new Set();
  const predictionIds = new Set();
  let previousDate = null;

  for (const session of payload.sessions) {
    const { edition } = session || {};
    if (!edition || !DATE_PATTERN.test(String(edition.date || ""))
      || edition.topicId !== DAILY_TOPIC || edition.rulesetId !== DAILY_RULESET_ID
      || edition.rulesetVersion !== DAILY_RULESET_VERSION || edition.catalogSchema !== DAILY_CATALOG_SCHEMA
      || !HASH_PATTERN.test(String(edition.catalogHash || ""))
      || !HASH_PATTERN.test(String(edition.snapshotHash || ""))
      || edition.id !== `${DAILY_RULESET_ID}:v${DAILY_RULESET_VERSION}:${DAILY_TOPIC}:${edition.date}:${edition.catalogHash.slice(0, 16)}`
      || !Number.isSafeInteger(edition.candidateCount) || edition.candidateCount < SELECTED_CANDIDATES
      || edition.totalRounds !== DAILY_ROUNDS || edition.cardsPerRound !== DAILY_CARDS
      || editionIds.has(edition.id) || editionDates.has(edition.date)
      || (previousDate && edition.date >= previousDate)
      || !Number.isSafeInteger(session.completedPlayers) || session.completedPlayers < 0
      || session.methodology !== dailyMethodologyForDate(edition.date)
      || !Object.hasOwn(session, "sampleNotice")
      || session.sampleNotice !== expectedSampleNotice(session.completedPlayers)
      || typeof session.completed !== "boolean"
      || !Array.isArray(session.catalog) || session.catalog.length !== SELECTED_CANDIDATES
      || !Array.isArray(session.rounds) || session.rounds.length !== DAILY_ROUNDS) fail("sessions");

    const opensAt = instant(edition.opensAt, "edition.opensAt");
    const closesAt = instant(edition.closesAt, "edition.closesAt");
    const publishedAt = instant(session.publishedAt, "publishedAt");
    const openClock = saoPauloWallClock(opensAt);
    const closeClock = saoPauloWallClock(closesAt);
    if (opensAt >= closesAt || publishedAt < closesAt
      || openClock.date !== edition.date || openClock.time !== "00:00:00"
      || closeClock.date !== nextDate(edition.date) || closeClock.time !== "00:00:00") fail("edition.window");

    editionIds.add(edition.id);
    editionDates.add(edition.date);
    previousDate = edition.date;
    const catalogIds = session.catalog.map(({ id }) => String(id || ""));
    const catalog = new Set(catalogIds);
    if (catalog.size !== SELECTED_CANDIDATES
      || session.catalog.some((candidate) => !String(candidate?.id || "").trim() || !String(candidate?.name || "").trim())) fail("catalog");

    const partition = [];
    let preferenceGap = false;
    let predictionGap = false;
    let preferenceCount = 0;
    let predictionCount = 0;
    for (const [index, round] of session.rounds.entries()) {
      if (round?.slot !== index + 1 || !Array.isArray(round.candidateIds) || round.candidateIds.length !== DAILY_CARDS
        || new Set(round.candidateIds).size !== DAILY_CARDS || round.candidateIds.some((id) => !catalog.has(id))
        || !Array.isArray(round.choices) || round.choices.length !== DAILY_CARDS || !RESULT_TYPES.has(round.result)) fail("rounds");
      partition.push(...round.candidateIds);
      const countTotal = round.choices.reduce((total, choice, choiceIndex) => {
        if (choice?.candidateId !== round.candidateIds[choiceIndex]
          || !Number.isSafeInteger(choice.count) || choice.count < 0
          || !Number.isFinite(choice.percent) || choice.percent < 0 || choice.percent > 100) fail("choices");
        const expectedPercent = session.completedPlayers
          ? Number(((choice.count / session.completedPlayers) * 100).toFixed(1))
          : 0;
        if (choice.percent !== expectedPercent) fail("choices.percent");
        return total + choice.count;
      }, 0);
      if (countTotal !== session.completedPlayers) fail("choices.total");
      const expected = expectedRoundResult(round, session.completedPlayers);
      if (JSON.stringify(round.leaderIds) !== JSON.stringify(expected.leaderIds)
        || round.winnerId !== expected.winnerId || round.outcome !== expected.outcome) fail("outcome");

      let answeredAt = null;
      if (round.preference === null) {
        preferenceGap = true;
      } else {
        if (preferenceGap || !UUID_PATTERN.test(String(round.preference?.answerId || ""))
          || answerIds.has(round.preference.answerId)
          || !round.candidateIds.includes(round.preference?.candidateId)) fail("preference");
        answeredAt = instant(round.preference.answeredAt, "preference.answeredAt");
        if (answeredAt < opensAt || answeredAt >= closesAt) fail("preference.window");
        answerIds.add(round.preference.answerId);
        preferenceCount += 1;
      }

      if (round.prediction === null) {
        predictionGap = true;
        if (round.result !== "not-answered") fail("prediction.missing");
        continue;
      }
      const prediction = round.prediction;
      if (predictionGap || round.preference === null
        || !UUID_PATTERN.test(String(prediction.predictionId || ""))
        || predictionIds.has(prediction.predictionId)
        || prediction.skipped !== (prediction.candidateId === null)
        || (!prediction.skipped && !round.candidateIds.includes(prediction.candidateId))) fail("prediction");
      const respondedAt = instant(prediction.respondedAt, "prediction.respondedAt");
      if (respondedAt < answeredAt || respondedAt >= closesAt) fail("prediction.window");
      predictionIds.add(prediction.predictionId);
      predictionCount += 1;
      const expectedResult = prediction.skipped
        ? "skipped"
        : expected.outcome === "decided"
          ? prediction.candidateId === expected.winnerId ? "correct" : "incorrect"
          : expected.outcome;
      if (round.result !== expectedResult) fail("result");
      if (round.result === "skipped") totals.skipped += 1;
      else {
        totals.attempted += 1;
        if (round.result === "correct" || round.result === "incorrect") totals.scored += 1;
        if (round.result === "correct") totals.correct += 1;
        if (round.result === "tie") totals.ties += 1;
        if (round.result === "no-sample") totals.noSample += 1;
      }
    }
    if (partition.length !== SELECTED_CANDIDATES || new Set(partition).size !== SELECTED_CANDIDATES
      || partition.some((id) => !catalog.has(id)) || catalogIds.some((id) => !partition.includes(id))) fail("rounds.partition");
    if (session.completed !== (preferenceCount === DAILY_ROUNDS)
      || (session.completed && session.completedPlayers === 0)
      || predictionCount > preferenceCount) fail("completed");
  }

  for (const [field, value] of Object.entries(totals)) {
    if (integer(payload.score[field], `score.${field}`) !== value) fail(`score.${field}`);
  }
  const accuracyPercent = totals.scored ? Number(((totals.correct / totals.scored) * 100).toFixed(1)) : null;
  if (payload.score.accuracyPercent !== accuracyPercent) fail("score.accuracyPercent");
  return payload;
}
