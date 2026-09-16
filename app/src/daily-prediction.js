const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RESULT_TYPES = new Set(["correct", "incorrect", "tie", "no-sample", "skipped", "not-answered"]);

function fail(field) {
  throw new TypeError(`resultado de apostas inválido: ${field}`);
}

function integer(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) fail(field);
  return value;
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

export function validateDailyPredictionResults(payload) {
  if (!payload || payload.baselinePercent !== 25 || !payload.score || !Array.isArray(payload.sessions)) fail("estrutura");
  const totals = { correct: 0, scored: 0, attempted: 0, skipped: 0, ties: 0, noSample: 0 };
  const editionIds = new Set();
  let previousDate = null;

  for (const session of payload.sessions) {
    const { edition } = session || {};
    if (!edition || !String(edition.id || "").trim() || !DATE_PATTERN.test(String(edition.date || ""))
      || edition.totalRounds !== 10 || edition.cardsPerRound !== 4
      || !Number.isFinite(Date.parse(edition.closesAt)) || editionIds.has(edition.id)
      || (previousDate && edition.date > previousDate)
      || !Number.isSafeInteger(session.completedPlayers) || session.completedPlayers < 0
      || !Number.isFinite(Date.parse(session.publishedAt)) || !Array.isArray(session.catalog)
      || !Array.isArray(session.rounds) || session.rounds.length !== edition.totalRounds) fail("sessions");
    editionIds.add(edition.id);
    previousDate = edition.date;
    const catalogIds = session.catalog.map(({ id }) => String(id || ""));
    const catalog = new Set(catalogIds);
    if (catalog.size !== session.catalog.length
      || session.catalog.some((candidate) => !String(candidate?.id || "").trim() || !String(candidate?.name || "").trim())) fail("catalog");

    for (const [index, round] of session.rounds.entries()) {
      if (round?.slot !== index + 1 || !Array.isArray(round.candidateIds) || round.candidateIds.length !== 4
        || new Set(round.candidateIds).size !== 4 || round.candidateIds.some((id) => !catalog.has(id))
        || !Array.isArray(round.choices) || round.choices.length !== 4 || !RESULT_TYPES.has(round.result)) fail("rounds");
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

      if (round.preference !== null) {
        if (!UUID_PATTERN.test(String(round.preference?.answerId || ""))
          || !round.candidateIds.includes(round.preference?.candidateId)
          || !Number.isFinite(Date.parse(round.preference?.answeredAt))) fail("preference");
      }
      if (round.prediction === null) {
        if (round.result !== "not-answered") fail("prediction.missing");
        continue;
      }
      const prediction = round.prediction;
      if (!UUID_PATTERN.test(String(prediction.predictionId || ""))
        || prediction.skipped !== (prediction.candidateId === null)
        || (!prediction.skipped && !round.candidateIds.includes(prediction.candidateId))
        || !Number.isFinite(Date.parse(prediction.respondedAt))) fail("prediction");
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
  }

  for (const [field, value] of Object.entries(totals)) {
    if (integer(payload.score[field], `score.${field}`) !== value) fail(`score.${field}`);
  }
  const accuracyPercent = totals.scored ? Number(((totals.correct / totals.scored) * 100).toFixed(1)) : null;
  if (payload.score.accuracyPercent !== accuracyPercent) fail("score.accuracyPercent");
  return payload;
}

