import assert from "node:assert/strict";
import test from "node:test";
import { validateDailyPredictionResults } from "./daily-prediction.js";

function payload(counts = [4, 3, 2, 1], candidateId = "candidate-1") {
  const candidateIds = ["candidate-1", "candidate-2", "candidate-3", "candidate-4"];
  const choices = candidateIds.map((id, index) => ({ candidateId: id, count: counts[index], percent: counts[index] * 10 }));
  const leaders = candidateIds.filter((_, index) => counts[index] === Math.max(...counts));
  const tie = leaders.length !== 1;
  const result = tie ? "tie" : candidateId === leaders[0] ? "correct" : "incorrect";
  return {
    baselinePercent: 25,
    score: {
      correct: result === "correct" ? 1 : 0,
      scored: tie ? 0 : 1,
      attempted: 1,
      skipped: 0,
      ties: tie ? 1 : 0,
      noSample: 0,
      accuracyPercent: tie ? null : result === "correct" ? 100 : 0,
    },
    sessions: [{
      edition: {
        id: "edition-1",
        date: "2026-09-16",
        totalRounds: 10,
        cardsPerRound: 4,
        closesAt: "2026-09-17T03:00:00.000Z",
      },
      completedPlayers: 10,
      publishedAt: "2026-09-17T03:00:01.000Z",
      catalog: candidateIds.map((id) => ({ id, name: id })),
      rounds: Array.from({ length: 10 }, (_, index) => index === 0 ? {
        slot: 1,
        candidateIds,
        choices,
        leaderIds: leaders,
        winnerId: tie ? null : leaders[0],
        outcome: tie ? "tie" : "decided",
        preference: {
          answerId: "550e8400-e29b-41d4-a716-446655440000",
          candidateId: "candidate-2",
          answeredAt: "2026-09-16T12:00:00.000Z",
        },
        prediction: {
          predictionId: "650e8400-e29b-41d4-a716-446655440000",
          candidateId,
          skipped: false,
          respondedAt: "2026-09-16T12:01:00.000Z",
        },
        result,
      } : {
        slot: index + 1,
        candidateIds,
        choices,
        leaderIds: leaders,
        winnerId: tie ? null : leaders[0],
        outcome: tie ? "tie" : "decided",
        preference: null,
        prediction: null,
        result: "not-answered",
      }),
    }],
  };
}

test("closed prediction results validate a cumulative 25 percent baseline score", () => {
  const valid = payload();
  assert.equal(validateDailyPredictionResults(valid), valid);
});

test("ties are disclosed and excluded from accuracy", () => {
  const tied = payload([4, 4, 1, 1]);
  assert.equal(validateDailyPredictionResults(tied), tied);
  assert.equal(tied.score.scored, 0);
  assert.equal(tied.score.ties, 1);
});

test("a forged distribution or score fails closed", () => {
  const forgedDistribution = payload();
  forgedDistribution.sessions[0].rounds[0].choices[0].count = 5;
  assert.throws(() => validateDailyPredictionResults(forgedDistribution), /choices/);
  const forgedScore = payload();
  forgedScore.score.correct = 0;
  assert.throws(() => validateDailyPredictionResults(forgedScore), /score/);
});
