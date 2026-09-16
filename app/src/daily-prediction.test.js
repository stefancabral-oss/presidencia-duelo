import assert from "node:assert/strict";
import test from "node:test";
import { confirmedDailyPredictionData, validateDailyPredictionResults } from "./daily-prediction.js";

const catalog = Array.from({ length: 40 }, (_, index) => ({
  id: `candidate-${index + 1}`,
  name: `Candidate ${index + 1}`,
}));
const ruleset = {
  id: "daily-four-card-v1",
  version: 1,
  timeZone: "America/Sao_Paulo",
  rounds: 10,
  cardsPerRound: 4,
  selection: "sha256-ranked-catalog-v1",
  catalogSchema: "candidate-public-v1",
  quota: { id: "editorial-day-v2", totalChoices: 30, dailyChoices: 10, freeChoices: 20 },
};
const edition = {
  id: `daily-four-card-v1:v1:eleicoes-2026:2026-09-16:${"a".repeat(16)}`,
  date: "2026-09-16",
  topicId: "eleicoes-2026",
  rulesetId: ruleset.id,
  rulesetVersion: ruleset.version,
  catalogSchema: ruleset.catalogSchema,
  catalogHash: "a".repeat(64),
  snapshotHash: "b".repeat(64),
  candidateCount: 54,
  totalRounds: 10,
  cardsPerRound: 4,
  opensAt: "2026-09-16T03:00:00.000Z",
  closesAt: "2026-09-17T03:00:00.000Z",
};

function uuid(prefix, slot) {
  return `${prefix}50e8400-e29b-41d4-a716-${String(slot).padStart(12, "0")}`;
}

function closedPayload() {
  const completedPlayers = 10;
  const rounds = Array.from({ length: 10 }, (_, index) => {
    const candidateIds = catalog.slice(index * 4, index * 4 + 4).map(({ id }) => id);
    const counts = index === 1 ? [4, 4, 1, 1] : [4, 3, 2, 1];
    const leaderIds = index === 1 ? candidateIds.slice(0, 2) : [candidateIds[0]];
    const preference = index < 4 ? {
      answerId: uuid("5", index + 1),
      candidateId: candidateIds[1],
      answeredAt: `2026-09-16T${String(index + 12).padStart(2, "0")}:00:00.000Z`,
    } : null;
    const prediction = index < 3 ? {
      predictionId: uuid("6", index + 1),
      candidateId: index === 2 ? null : candidateIds[0],
      skipped: index === 2,
      respondedAt: `2026-09-16T${String(index + 12).padStart(2, "0")}:01:00.000Z`,
    } : null;
    return {
      slot: index + 1,
      candidateIds,
      choices: candidateIds.map((candidateId, choiceIndex) => ({
        candidateId,
        count: counts[choiceIndex],
        percent: counts[choiceIndex] * 10,
      })),
      leaderIds,
      winnerId: index === 1 ? null : candidateIds[0],
      outcome: index === 1 ? "tie" : "decided",
      preference,
      prediction,
      result: index === 0 ? "correct" : index === 1 ? "tie" : index === 2 ? "skipped" : "not-answered",
    };
  });
  return {
    baselinePercent: 25,
    score: { correct: 1, scored: 1, attempted: 2, skipped: 1, ties: 1, noSample: 0, accuracyPercent: 100 },
    sessions: [{
      edition: { ...edition },
      methodology: "entre quem concluiu a rodada de 16/09",
      completedPlayers,
      sampleNotice: "Recorte de baixa participação; apresente contagens, não uma conclusão populacional.",
      publishedAt: "2026-09-17T03:00:01.000Z",
      catalog: catalog.map((candidate) => ({ ...candidate })),
      completed: false,
      rounds,
    }],
  };
}

function currentClosedPayload() {
  const payload = closedPayload();
  const current = payload.sessions[0].edition;
  current.rulesetId = "daily-four-card-v2";
  current.rulesetVersion = 2;
  current.catalogSchema = "candidate-public-v2";
  current.id = `daily-four-card-v2:v2:eleicoes-2026:${current.date}:${current.catalogHash.slice(0, 16)}`;
  return payload;
}

function pendingSession() {
  return {
    ruleset,
    edition: { ...edition },
    status: "active",
    progress: { answered: 1, total: 10 },
    catalog: catalog.map((candidate) => ({ ...candidate })),
    rounds: Array.from({ length: 10 }, (_, index) => ({
      slot: index + 1,
      candidateIds: catalog.slice(index * 4, index * 4 + 4).map(({ id }) => id),
    })),
    answers: [{
      slot: 1,
      answerId: uuid("5", 1),
      winnerId: "candidate-1",
      answeredAt: "2026-09-16T12:00:00.000Z",
    }],
    predictions: [],
    predictionProgress: { responded: 0, predicted: 0, skipped: 0, total: 1 },
    pendingPrediction: { slot: 1, candidateIds: catalog.slice(0, 4).map(({ id }) => id) },
    round: { slot: 2, candidateIds: catalog.slice(4, 8).map(({ id }) => id) },
    completion: null,
    cut: {
      status: "pending",
      availableAt: edition.closesAt,
      methodology: "entre quem concluiu a rodada de 16/09",
    },
  };
}

function predictionConfirmation(current = pendingSession()) {
  const next = structuredClone(current);
  next.predictions.push({
    slot: 1,
    predictionId: uuid("6", 1),
    candidateId: "candidate-2",
    skipped: false,
    respondedAt: "2026-09-16T12:01:00.000Z",
  });
  next.predictionProgress = { responded: 1, predicted: 1, skipped: 0, total: 1 };
  next.predictionProgress.total = next.answers.length;
  next.pendingPrediction = next.predictions.length < next.answers.length ? {
    slot: next.predictions.length + 1,
    candidateIds: [...next.rounds[next.predictions.length].candidateIds],
  } : null;
  return {
    prediction: {
      id: uuid("6", 1),
      status: "created",
      slot: 1,
      candidateId: "candidate-2",
      skipped: false,
    },
    dailySession: next,
  };
}

const attempt = {
  predictionId: uuid("6", 1),
  editionId: edition.id,
  slot: 1,
  candidateId: "candidate-2",
};

test("closed prediction results validate the complete sealed cut contract", () => {
  const valid = closedPayload();
  assert.equal(validateDailyPredictionResults(valid), valid);
});

test("prediction history accepts current v2 editions while retaining sealed v1 results", () => {
  const historical = closedPayload();
  const current = currentClosedPayload();
  assert.equal(validateDailyPredictionResults(historical), historical);
  assert.equal(validateDailyPredictionResults(current), current);
});

test("ties are disclosed and excluded from accuracy", () => {
  const valid = closedPayload();
  assert.equal(validateDailyPredictionResults(valid), valid);
  assert.equal(valid.sessions[0].rounds[1].outcome, "tie");
  assert.equal(valid.score.ties, 1);
  assert.equal(valid.score.scored, 1);
});

test("a forged distribution or score fails closed", () => {
  const forgedDistribution = closedPayload();
  forgedDistribution.sessions[0].rounds[0].choices[0].count = 5;
  assert.throws(() => validateDailyPredictionResults(forgedDistribution), /choices/);
  const forgedScore = closedPayload();
  forgedScore.score.correct = 0;
  assert.throws(() => validateDailyPredictionResults(forgedScore), /score/);
});

test("ACCEPTED_INVALID_REVEAL rejects reinterpreted editions, broken partitions and incoherent history", () => {
  const corruptions = [
    (value) => { value.sessions[0].edition.topicId = "forged-topic"; },
    (value) => { value.sessions[0].edition.rulesetVersion = 2; },
    (value) => { value.sessions[0].edition.catalogHash = "c".repeat(64); },
    (value) => { value.sessions[0].edition.snapshotHash = "not-a-hash"; },
    (value) => { value.sessions[0].edition.candidateCount = 39; },
    (value) => { value.sessions[0].publishedAt = "2026-09-17T02:59:59.999Z"; },
    (value) => { value.sessions[0].methodology = "parcial ao vivo"; },
    (value) => { value.sessions[0].sampleNotice = null; },
    (value) => { value.sessions[0].catalog[39].id = value.sessions[0].catalog[0].id; },
    (value) => {
      const repeated = value.sessions[0].rounds[0].candidateIds[0];
      value.sessions[0].rounds[1].candidateIds[0] = repeated;
      value.sessions[0].rounds[1].choices[0].candidateId = repeated;
    },
    (value) => { value.sessions[0].completed = true; },
    (value) => { value.sessions[0].rounds[0].preference = null; },
    (value) => { value.sessions[0].rounds[0].preference.answeredAt = "2026-09-17T03:00:00.000Z"; },
    (value) => { value.sessions[0].rounds[0].prediction.respondedAt = "2026-09-16T11:59:59.000Z"; },
  ];
  for (const corrupt of corruptions) {
    const invalid = closedPayload();
    corrupt(invalid);
    assert.throws(() => validateDailyPredictionResults(invalid), /resultado de apostas inválido/);
  }
});

test("a prediction 200 is correlated exactly with its idempotent attempt", () => {
  const current = pendingSession();
  const response = predictionConfirmation(current);
  assert.deepEqual(confirmedDailyPredictionData(response, attempt, current), response);
});

test("truncated or divergent prediction 200 responses fail without advancing the pending slot", () => {
  const current = pendingSession();
  const original = structuredClone(current);
  const corruptions = [
    (value) => { delete value.prediction; },
    (value) => { value.prediction.id = uuid("7", 1); },
    (value) => { value.prediction.slot = 2; },
    (value) => { value.prediction.candidateId = "candidate-3"; },
    (value) => { value.prediction.skipped = true; },
    (value) => { value.prediction.status = "unknown"; },
    (value) => { value.dailySession.predictions = []; value.dailySession.predictionProgress = { responded: 0, predicted: 0, skipped: 0, total: 1 }; },
  ];
  for (const corrupt of corruptions) {
    const invalid = predictionConfirmation(current);
    corrupt(invalid);
    assert.throws(() => confirmedDailyPredictionData(invalid, attempt, current), /confirmation|sessão diária inválida/);
    assert.deepEqual(current, original);
    assert.equal(current.pendingPrediction.slot, 1);
  }
  assert.throws(
    () => confirmedDailyPredictionData(predictionConfirmation(current), { ...attempt, candidateId: "candidate-9" }, current),
    /confirmation\.attempt/,
  );
});

test("a created confirmation changes exactly one prediction and no preference", () => {
  const changedPreference = predictionConfirmation();
  changedPreference.dailySession.answers[0].winnerId = "candidate-2";
  assert.throws(
    () => confirmedDailyPredictionData(changedPreference, attempt, pendingSession()),
    /confirmation\.(session|created)/,
  );

  const addedPreference = predictionConfirmation();
  addedPreference.dailySession.answers.push({
    slot: 2,
    answerId: uuid("5", 2),
    winnerId: "candidate-5",
    answeredAt: "2026-09-16T13:00:00.000Z",
  });
  addedPreference.dailySession.progress.answered = 2;
  addedPreference.dailySession.predictionProgress.total = 2;
  addedPreference.dailySession.pendingPrediction = { slot: 2, candidateIds: [...addedPreference.dailySession.rounds[1].candidateIds] };
  addedPreference.dailySession.round = { slot: 3, candidateIds: [...addedPreference.dailySession.rounds[2].candidateIds] };
  assert.throws(
    () => confirmedDailyPredictionData(addedPreference, attempt, pendingSession()),
    /confirmation\.created/,
  );

  const backlog = pendingSession();
  backlog.answers.push({
    slot: 2,
    answerId: uuid("5", 2),
    winnerId: "candidate-5",
    answeredAt: "2026-09-16T13:00:00.000Z",
  });
  backlog.progress.answered = 2;
  backlog.predictionProgress.total = 2;
  backlog.round = { slot: 3, candidateIds: [...backlog.rounds[2].candidateIds] };
  const twoPredictions = predictionConfirmation(backlog);
  twoPredictions.dailySession.predictions.push({
    slot: 2,
    predictionId: uuid("6", 2),
    candidateId: "candidate-6",
    skipped: false,
    respondedAt: "2026-09-16T13:01:00.000Z",
  });
  twoPredictions.dailySession.predictionProgress = { responded: 2, predicted: 2, skipped: 0, total: 2 };
  twoPredictions.dailySession.pendingPrediction = null;
  assert.throws(
    () => confirmedDailyPredictionData(twoPredictions, attempt, backlog),
    /confirmation\.created/,
  );
});

test("an alreadyProcessed confirmation accepts a monotonic multi-tab tail", () => {
  const current = pendingSession();
  const replay = predictionConfirmation(current);
  replay.prediction.status = "alreadyProcessed";
  replay.dailySession.answers.push({
    slot: 2,
    answerId: uuid("5", 2),
    winnerId: "candidate-5",
    answeredAt: "2026-09-16T13:00:00.000Z",
  });
  replay.dailySession.predictions.push({
    slot: 2,
    predictionId: uuid("6", 2),
    candidateId: "candidate-6",
    skipped: false,
    respondedAt: "2026-09-16T13:01:00.000Z",
  });
  replay.dailySession.progress.answered = 2;
  replay.dailySession.predictionProgress = { responded: 2, predicted: 2, skipped: 0, total: 2 };
  replay.dailySession.pendingPrediction = null;
  replay.dailySession.round = { slot: 3, candidateIds: [...replay.dailySession.rounds[2].candidateIds] };
  assert.deepEqual(confirmedDailyPredictionData(replay, attempt, current), replay);
});

test("a completed legacy preference-only history remains a valid result", () => {
  const legacy = closedPayload();
  const session = legacy.sessions[0];
  session.completed = true;
  for (const [index, round] of session.rounds.entries()) {
    round.preference = {
      answerId: uuid("5", index + 1),
      candidateId: round.candidateIds[1],
      answeredAt: `2026-09-16T${String(index + 12).padStart(2, "0")}:00:00.000Z`,
    };
    round.prediction = null;
    round.result = "not-answered";
  }
  legacy.score = { correct: 0, scored: 0, attempted: 0, skipped: 0, ties: 0, noSample: 0, accuracyPercent: null };
  assert.equal(validateDailyPredictionResults(legacy), legacy);
});
