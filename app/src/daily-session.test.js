import assert from "node:assert/strict";
import test from "node:test";
import { confirmedDailyVoteData, dailyMethodologyForDate, dailyPendingPredictionCandidates, dailyRoundCandidates, dailySessionRoundChanged, validateDailySession } from "./daily-session.js";

const candidates = Array.from({ length: 40 }, (_, index) => ({ id: `candidate-${index + 1}`, name: `Candidate ${index + 1}` }));

function activeSession(answered = 0, predictionResponded = answered) {
  const date = "2026-09-16";
  return {
    ruleset: {
      id: "daily-four-card-v1",
      version: 1,
      timeZone: "America/Sao_Paulo",
      rounds: 10,
      cardsPerRound: 4,
      selection: "sha256-ranked-catalog-v1",
      catalogSchema: "candidate-public-v1",
      quota: { id: "editorial-day-v2", totalChoices: 30, dailyChoices: 10, freeChoices: 20 },
    },
    edition: {
      id: "daily-four-card-v1:v1:eleicoes-2026:2026-09-16:abcdef0123456789",
      date,
      topicId: "eleicoes-2026",
      rulesetId: "daily-four-card-v1",
      rulesetVersion: 1,
      catalogSchema: "candidate-public-v1",
      catalogHash: "a".repeat(64),
      snapshotHash: "b".repeat(64),
      candidateCount: 54,
      totalRounds: 10,
      cardsPerRound: 4,
      opensAt: "2026-09-16T03:00:00.000Z",
      closesAt: "2026-09-17T03:00:00.000Z",
    },
    status: "active",
    progress: { answered, total: 10 },
    catalog: candidates.map((candidate) => ({ ...candidate })),
    rounds: Array.from({ length: 10 }, (_, index) => ({
      slot: index + 1,
      candidateIds: candidates.slice(index * 4, index * 4 + 4).map(({ id }) => id),
    })),
    answers: Array.from({ length: answered }, (_, index) => ({
      slot: index + 1,
      answerId: `550e8400-e29b-41d4-a716-${String(index + 1).padStart(12, "0")}`,
      winnerId: candidates[index * 4].id,
      answeredAt: `2026-09-16T${String(index + 10).padStart(2, "0")}:00:00.000Z`,
    })),
    predictions: Array.from({ length: predictionResponded }, (_, index) => ({
      slot: index + 1,
      predictionId: `650e8400-e29b-41d4-a716-${String(index + 1).padStart(12, "0")}`,
      candidateId: index % 2 ? null : candidates[index * 4 + 1].id,
      skipped: Boolean(index % 2),
      respondedAt: `2026-09-16T${String(index + 10).padStart(2, "0")}:01:00.000Z`,
    })),
    predictionProgress: {
      responded: predictionResponded,
      predicted: Array.from({ length: predictionResponded }, (_, index) => index).filter((index) => !(index % 2)).length,
      skipped: Array.from({ length: predictionResponded }, (_, index) => index).filter((index) => Boolean(index % 2)).length,
      total: answered,
    },
    pendingPrediction: predictionResponded < answered
      ? { slot: predictionResponded + 1, candidateIds: candidates.slice(predictionResponded * 4, predictionResponded * 4 + 4).map(({ id }) => id) }
      : null,
    round: { slot: answered + 1, candidateIds: candidates.slice(answered * 4, answered * 4 + 4).map(({ id }) => id) },
    completion: null,
    cut: {
      status: "pending",
      availableAt: "2026-09-17T03:00:00.000Z",
      methodology: "entre quem concluiu a rodada de 16/09",
    },
  };
}

function currentSession(answered = 0, predictionResponded = answered) {
  const session = activeSession(answered, predictionResponded);
  session.ruleset.id = "daily-four-card-v2";
  session.ruleset.version = 2;
  session.ruleset.catalogSchema = "candidate-public-v2";
  session.edition.id = "daily-four-card-v2:v2:eleicoes-2026:2026-09-16:abcdef0123456789";
  session.edition.rulesetId = session.ruleset.id;
  session.edition.rulesetVersion = session.ruleset.version;
  session.edition.catalogSchema = session.ruleset.catalogSchema;
  return session;
}

test("a reloaded player resumes the exact authoritative slot", () => {
  const session = activeSession(4);
  assert.equal(validateDailySession(session, candidates), session);
  assert.equal(session.round.slot, 5);
  assert.deepEqual(dailyRoundCandidates(session, candidates).map(({ id }) => id), session.round.candidateIds);
});

test("the client accepts both sealed v1 replays and current v2 editions without mixing identities", () => {
  const historical = activeSession(2);
  assert.equal(validateDailySession(historical), historical);
  const current = currentSession(2);
  assert.equal(validateDailySession(current), current);

  const mixed = currentSession(2);
  mixed.edition.rulesetId = "daily-four-card-v1";
  assert.throws(() => validateDailySession(mixed), /edition/);
});

test("ten answers close the daily session and preserve the declared cut", () => {
  const session = activeSession(10);
  session.status = "completed";
  session.round = null;
  session.completion = { completedAt: "2026-09-16T22:00:00.000Z" };
  assert.equal(validateDailySession(session, candidates), session);
  assert.equal(dailyMethodologyForDate(session.edition.date), "entre quem concluiu a rodada de 16/09");
});

test("the pending prediction reuses the exact four cards and supports a legacy backlog", () => {
  const session = activeSession(4, 3);
  assert.equal(validateDailySession(session), session);
  assert.equal(session.pendingPrediction.slot, 4);
  assert.deepEqual(
    dailyPendingPredictionCandidates(session).map(({ id }) => id),
    session.pendingPrediction.candidateIds,
  );
  const forgedGap = structuredClone(session);
  forgedGap.predictions.pop();
  forgedGap.predictionProgress.responded -= 1;
  forgedGap.predictionProgress.predicted -= 1;
  forgedGap.pendingPrediction.slot -= 1;
  forgedGap.pendingPrediction.candidateIds = [...forgedGap.rounds[2].candidateIds];
  assert.equal(validateDailySession(forgedGap), forgedGap);
  assert.equal(forgedGap.pendingPrediction.slot, 3);
});

test("client-side session validation rejects skips, reshuffles and forged catalogs", () => {
  const skipped = activeSession(4);
  skipped.round.slot = 6;
  assert.throws(() => validateDailySession(skipped, candidates), /round/);
  const duplicate = activeSession(0);
  duplicate.round.candidateIds[3] = duplicate.round.candidateIds[0];
  assert.throws(() => validateDailySession(duplicate, candidates), /round/);
  const foreign = activeSession(0);
  foreign.round.candidateIds[3] = "not-in-catalog";
  assert.throws(() => validateDailySession(foreign, candidates), /round/);
  const brokenPartition = activeSession(0);
  brokenPartition.rounds[1].candidateIds[0] = brokenPartition.rounds[0].candidateIds[0];
  assert.throws(() => validateDailySession(brokenPartition), /rounds\.partition/);
  const wrongAnswerContext = activeSession(1, 0);
  wrongAnswerContext.answers[0].winnerId = wrongAnswerContext.rounds[1].candidateIds[0];
  assert.throws(() => validateDailySession(wrongAnswerContext), /answers/);
  const duplicateAnswerId = activeSession(2, 0);
  duplicateAnswerId.answers[1].answerId = duplicateAnswerId.answers[0].answerId;
  assert.throws(() => validateDailySession(duplicateAnswerId), /answers/);
  const duplicatePredictionId = activeSession(2, 2);
  duplicatePredictionId.predictions[1].predictionId = duplicatePredictionId.predictions[0].predictionId;
  assert.throws(() => validateDailySession(duplicatePredictionId), /predictions/);
  const wrongPredictionContext = activeSession(2, 2);
  wrongPredictionContext.predictions[1].candidateId = wrongPredictionContext.rounds[0].candidateIds[0];
  wrongPredictionContext.predictions[1].skipped = false;
  assert.throws(() => validateDailySession(wrongPredictionContext), /predictions/);
  const reinterpreted = activeSession(0);
  reinterpreted.ruleset.catalogSchema = "candidate-public-v2";
  assert.throws(() => validateDailySession(reinterpreted, candidates), /ruleset/);
});

test("an identity change invalidates the previous player's daily slot even while free mode is visible", () => {
  const previousPlayer = activeSession(4);
  const nextPlayer = activeSession(0);
  assert.equal(dailySessionRoundChanged(previousPlayer, nextPlayer), true);
  assert.deepEqual(dailyRoundCandidates(nextPlayer, candidates).map(({ id }) => id), nextPlayer.round.candidateIds);
  assert.equal(dailySessionRoundChanged(nextPlayer, structuredClone(nextPlayer)), false);
});

test("a daily confirmation advances only the authoritative edition and slot", () => {
  const candidateIds = candidates.slice(0, 4).map(({ id }) => id);
  const winnerId = candidateIds[0];
  const ranking = candidates.map((candidate, index) => {
    const inRound = index < 4;
    const winner = candidate.id === winnerId;
    return {
      ...candidate,
      elo: winner ? 1048 : inRound ? 984 : 1000,
      wins: winner ? 3 : 0,
      losses: inRound && !winner ? 1 : 0,
      decisions: winner ? 3 : inRound ? 1 : 0,
      winRate: winner ? 100 : 0,
      rank: winner ? 1 : inRound ? 2 : null,
    };
  });
  const answerId = "550e8400-e29b-41d4-a716-000000000001";
  const feedback = {
    rankingEvent: "confirm",
    primaryEvent: "confirm",
    zebra: false,
    outcomes: candidateIds.map((id) => ({
      id,
      result: id === winnerId ? "winner" : "loser",
      delta: id === winnerId ? 48 : -16,
      elo: id === winnerId ? 1048 : 984,
      previousTier: { id: "contender", label: "No páreo", level: 2 },
      tier: { id: "contender", label: "No páreo", level: 2 },
      tierChange: null,
    })),
  };
  const round = {
    id: answerId,
    status: "created",
    winnerId,
    candidateIds,
    comparisons: 3,
    feedbackScope: "personal",
    personalFeedback: feedback,
  };
  const response = {
    contractVersion: 2,
    publicAggregate: {
      status: "available",
      scope: "global-ranking",
      snapshot: { topicId: "eleicoes-2026", duels: 1, rankingPolicy: { id: "elo-v1" }, ranking },
      event: null,
    },
    player: { duels: 1, version: 1, ranking },
    round,
    vote: { ...round },
    dailySession: activeSession(1, 0),
  };
  const attempt = {
    gameMode: "daily",
    roundId: answerId,
    editionId: activeSession(0).edition.id,
    slot: 1,
    winnerId,
    candidateIds,
  };
  const confirmed = confirmedDailyVoteData(response, candidates, attempt, {
    globalDuels: 0,
    personalDuels: 0,
    playerVersion: 0,
    dailySession: activeSession(0),
  });
  assert.equal(confirmed.dailySession.round.slot, 2);
  assert.equal(confirmed.dailySession.pendingPrediction.slot, 1);

  const forged = structuredClone(response);
  forged.dailySession.answers[0].winnerId = candidateIds[1];
  assert.throws(
    () => confirmedDailyVoteData(forged, candidates, attempt, {
      globalDuels: 0, personalDuels: 0, playerVersion: 0, dailySession: activeSession(0),
    }),
    /vote\.progress/,
  );

  const multiTab = structuredClone(response);
  multiTab.publicAggregate.snapshot.duels = 2;
  multiTab.player.version = 2;
  multiTab.player.duels = 2;
  multiTab.dailySession = activeSession(2, 1);
  const advanced = confirmedDailyVoteData(multiTab, candidates, attempt, {
    globalDuels: 0,
    personalDuels: 0,
    playerVersion: 0,
    dailySession: activeSession(0),
  });
  assert.equal(advanced.dailySession.progress.answered, 2);

  const missingAttempt = structuredClone(multiTab);
  missingAttempt.dailySession.answers[0].answerId = "550e8400-e29b-41d4-a716-000000000099";
  assert.throws(
    () => confirmedDailyVoteData(missingAttempt, candidates, attempt, {
      globalDuels: 0, personalDuels: 0, playerVersion: 0, dailySession: activeSession(0),
    }),
    /vote\.progress/,
  );
});
