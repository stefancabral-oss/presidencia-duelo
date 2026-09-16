const SCOPES = ["global-ranking", "daily-distribution", "prediction-reveal", "mirror-comparison"];

export function capabilityFixture(availableScopes = SCOPES, { validUntil = "2099-01-01T00:00:00.000Z" } = {}) {
  const allowed = new Set(availableScopes);
  const count = SCOPES.filter((scope) => allowed.has(scope)).length;
  return {
    contract: "aggregate-publication-capabilities-v1",
    mode: count === 0 ? "personal-only" : count === SCOPES.length ? "authorized" : "scoped",
    scopes: Object.fromEntries(SCOPES.map((scope) => [scope, allowed.has(scope)
      ? { status: "available", validUntil }
      : { status: "withheld" }])),
  };
}

function personalRound(round) {
  if (!round) return round;
  const { globalEvent: _globalEvent, feedback: _feedback, ...personal } = round;
  if (Object.hasOwn(round, "personalFeedback")) personal.feedback = round.personalFeedback;
  return personal;
}

export function voteResponseV2(payload, { aggregate = true } = {}) {
  const result = {
    contractVersion: 2,
    player: payload.player,
    round: personalRound(payload.round),
    vote: personalRound(payload.vote),
    publicAggregate: aggregate
      ? {
        status: "available",
        scope: "global-ranking",
        snapshot: {
          topicId: payload.topicId || "eleicoes-2026",
          duels: payload.duels,
          rankingPolicy: payload.rankingPolicy,
          ranking: payload.ranking,
        },
        event: payload.round?.globalEvent || payload.vote?.globalEvent || null,
      }
      : { status: "withheld", scope: "global-ranking" },
  };
  if (Object.hasOwn(payload, "dailySession")) result.dailySession = payload.dailySession;
  return result;
}
