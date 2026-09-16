const DATE = "2026-09-16";
const OPENS_AT = "2026-09-16T03:00:00.000Z";
const CLOSES_AT = "2026-09-17T03:00:00.000Z";

export const DAILY_RULESET = Object.freeze({
  id: "daily-four-card-v1",
  version: 1,
  timeZone: "America/Sao_Paulo",
  rounds: 10,
  cardsPerRound: 4,
  selection: "sha256-ranked-catalog-v1",
  catalogSchema: "candidate-public-v1",
  quota: Object.freeze({ id: "editorial-day-v2", totalChoices: 30, dailyChoices: 10, freeChoices: 20 }),
});

function answerId(slot) {
  return `550e8400-e29b-41d4-a716-${String(slot).padStart(12, "0")}`;
}

function predictionId(slot) {
  return `650e8400-e29b-41d4-a716-${String(slot).padStart(12, "0")}`;
}

export function completedDailySession(candidates) {
  const ids = candidates.map(({ id }) => id);
  if (ids.length < 4) throw new Error("o fixture diário requer ao menos quatro candidatos");
  return {
    ruleset: DAILY_RULESET,
    edition: {
      id: `daily-four-card-v1:v1:eleicoes-2026:${DATE}:e2e-completed`,
      date: DATE,
      topicId: "eleicoes-2026",
      rulesetId: DAILY_RULESET.id,
      rulesetVersion: DAILY_RULESET.version,
      catalogSchema: DAILY_RULESET.catalogSchema,
      catalogHash: "a".repeat(64),
      snapshotHash: "b".repeat(64),
      candidateCount: Math.max(40, ids.length),
      totalRounds: 10,
      cardsPerRound: 4,
      opensAt: OPENS_AT,
      closesAt: CLOSES_AT,
    },
    status: "completed",
    progress: { answered: 10, total: 10 },
    catalog: Array.from({ length: 40 }, (_, index) => ({
      ...candidates[index % candidates.length],
      id: `daily-snapshot-${index + 1}`,
      name: `${candidates[index % candidates.length].name} snapshot ${index + 1}`,
    })),
    answers: Array.from({ length: 10 }, (_, index) => ({
      slot: index + 1,
      answerId: answerId(index + 1),
      winnerId: `daily-snapshot-${index + 1}`,
      answeredAt: `2026-09-16T${String(index + 10).padStart(2, "0")}:00:00.000Z`,
    })),
    predictions: Array.from({ length: 10 }, (_, index) => ({
      slot: index + 1,
      predictionId: predictionId(index + 1),
      candidateId: `daily-snapshot-${index + 2}`,
      skipped: false,
      respondedAt: `2026-09-16T${String(index + 10).padStart(2, "0")}:01:00.000Z`,
    })),
    predictionProgress: { responded: 10, predicted: 10, skipped: 0, total: 10 },
    pendingPrediction: null,
    round: null,
    completion: { completedAt: "2026-09-16T22:00:00.000Z" },
    cut: {
      status: "pending",
      availableAt: CLOSES_AT,
      methodology: "entre quem concluiu a rodada de 16/09",
    },
  };
}
