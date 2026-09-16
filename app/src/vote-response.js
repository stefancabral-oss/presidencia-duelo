import { rankingForCatalog, roundFeedbackChannels } from "./domain.js";

export const LEGACY_REPLAY_MESSAGE = "Escolha já confirmada. O detalhamento pessoal desta rodada anterior não está disponível.";

function nonNegativeInteger(value, field) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`resposta de voto inválida: ${field}`);
  }
  return value;
}

function requireCompleteRanking(rows, candidates, field) {
  const ids = rows.map(({ id }) => id);
  const uniqueIds = new Set(ids);
  const expectedIds = new Set(candidates.map(({ id }) => id));
  if (ids.length !== candidates.length || uniqueIds.size !== ids.length
    || candidates.some(({ id }) => !uniqueIds.has(id)) || ids.some((id) => !expectedIds.has(id))) {
    throw new TypeError(`resposta de voto inválida: ${field} incompleto`);
  }
  for (const row of rows) {
    const { elo, wins, losses, decisions, winRate } = row;
    const rankIsValid = decisions === 0
      ? row.rank === null
      : typeof row.rank === "number" && Number.isSafeInteger(row.rank) && row.rank > 0;
    if (!String(row.name || "").trim() || typeof elo !== "number" || !Number.isFinite(elo)
      || ![wins, losses, decisions].every((value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
      || decisions !== wins + losses || typeof winRate !== "number" || !Number.isFinite(winRate)
      || winRate < 0 || winRate > 100 || !rankIsValid) {
      throw new TypeError(`resposta de voto inválida: métricas de ${field}`);
    }
  }
}

function validTier(tier) {
  return Boolean(tier && String(tier.id || "").trim() && String(tier.label || "").trim()
    && typeof tier.level === "number" && Number.isSafeInteger(tier.level));
}

function sameOrderedIds(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((id, index) => id === expected[index]);
}

function isNeutralLegacyPersonalFeedback(feedback) {
  if (!feedback || Object.keys(feedback).sort().join(",") !== "outcomes,primaryEvent,rankingEvent,zebra") return false;
  return feedback.rankingEvent === "confirm"
    && feedback.primaryEvent === "confirm"
    && feedback.zebra === false
    && Array.isArray(feedback.outcomes)
    && feedback.outcomes.length === 0;
}

function requireMatchingRound(response, { roundId, winnerId, candidateIds }) {
  const expectedCandidates = new Set(candidateIds);
  const outcomes = response.vote?.personalFeedback?.outcomes;
  const outcomeIds = Array.isArray(outcomes) ? outcomes.map(({ id }) => id) : [];
  const uniqueOutcomeIds = new Set(outcomeIds);
  const winners = Array.isArray(outcomes) ? outcomes.filter(({ result }) => result === "winner") : [];
  const losers = Array.isArray(outcomes) ? outcomes.filter(({ result }) => result === "loser") : [];
  const completeOutcomes = Array.isArray(outcomes) && outcomes.every((outcome) => (
    outcome && typeof outcome.delta === "number" && Number.isFinite(outcome.delta)
      && typeof outcome.elo === "number" && Number.isFinite(outcome.elo)
      && validTier(outcome.previousTier)
      && validTier(outcome.tier)
      && [null, "up", "down"].includes(outcome.tierChange ?? null)
      && (outcome.rank === null || outcome.rank === undefined
        || (typeof outcome.rank === "number" && Number.isSafeInteger(outcome.rank) && outcome.rank > 0))
      && (outcome.previousRank === null || outcome.previousRank === undefined
        || (typeof outcome.previousRank === "number" && Number.isSafeInteger(outcome.previousRank) && outcome.previousRank > 0))
  ));
  const status = response.vote?.status;
  const legacyReplay = status === "alreadyProcessed"
    && response.vote?.feedbackScope === "legacy-global"
    && isNeutralLegacyPersonalFeedback(response.vote?.personalFeedback);
  const personalFeedbackIsComplete = response.vote?.feedbackScope === "personal"
    && outcomeIds.length === 4 && uniqueOutcomeIds.size === 4
    && outcomeIds.every((id) => expectedCandidates.has(id))
    && winners.length === 1 && winners[0]?.id === winnerId && losers.length === 3
    && completeOutcomes && typeof response.vote.personalFeedback?.zebra === "boolean"
    && Boolean(String(response.vote.personalFeedback?.primaryEvent || "").trim());
  if (!roundId || candidateIds.length !== 4 || new Set(candidateIds).size !== 4 || !expectedCandidates.has(winnerId)
    || response.round?.id !== roundId || response.vote?.id !== roundId
    || response.round?.status !== status || !["created", "alreadyProcessed"].includes(status)
    || response.round?.winnerId !== winnerId || response.vote?.winnerId !== winnerId
    || !sameOrderedIds(response.round?.candidateIds, candidateIds)
    || !sameOrderedIds(response.vote?.candidateIds, candidateIds)
    || response.vote?.comparisons !== 3
    || (!legacyReplay && !personalFeedbackIsComplete)) {
    throw new TypeError("resposta de voto inválida: rodada divergente");
  }
  return { legacyReplay };
}

export function confirmedVoteData(response, candidates, attempt, current = {}, { feedbackCandidates = candidates } = {}) {
  if (!response || !Array.isArray(response.ranking) || !Array.isArray(response.player?.ranking)) {
    throw new TypeError("resposta de voto inválida: rankings");
  }
  requireCompleteRanking(response.ranking, candidates, "ranking");
  requireCompleteRanking(response.player.ranking, candidates, "player.ranking");
  const { legacyReplay } = requireMatchingRound(response, attempt);

  const globalDuels = nonNegativeInteger(response.duels, "duels");
  const personalDuels = nonNegativeInteger(response.player.duels, "player.duels");
  const playerVersion = nonNegativeInteger(response.player.version, "player.version");
  if (globalDuels <= Number(current.globalDuels || 0)
    || personalDuels <= Number(current.personalDuels || 0)
    || playerVersion <= Number(current.playerVersion || 0)) {
    throw new TypeError("resposta de voto inválida: progresso sem avanço");
  }

  const channels = roundFeedbackChannels(response.vote, feedbackCandidates, attempt.winnerId);
  if (legacyReplay) channels.personal.message = LEGACY_REPLAY_MESSAGE;
  return {
    ranking: rankingForCatalog(response, candidates),
    personalRanking: rankingForCatalog(response.player, candidates),
    personalRankingPolicy: response.player.rankingPolicy || current.personalRankingPolicy || null,
    globalDuels,
    personalDuels,
    playerVersion,
    channels,
  };
}
