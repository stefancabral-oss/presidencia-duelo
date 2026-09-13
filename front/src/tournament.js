export const TOURNAMENT_SIZE = 12;
export const TOURNAMENT_STORAGE_KEY = "presidencia-duelo-tournament-v1";
export const POLIMATCH_URL = "https://polimatch.com.br/";

const ROUND_NAMES = ["Primeira rodada", "Quartas de final", "Semifinais", "Final"];

export function shuffleCandidates(candidateIds, random = Math.random) {
  const shuffled = [...candidateIds];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function pairEntrants(entrants) {
  const matches = [];
  for (let i = 0; i < entrants.length; i += 2) {
    matches.push({ candidates: [entrants[i], entrants[i + 1]], winner: null });
  }
  return matches;
}

export function createTournament(candidateIds, random = Math.random) {
  if (!Array.isArray(candidateIds) || candidateIds.length < TOURNAMENT_SIZE) {
    throw new Error(`O torneio precisa de ${TOURNAMENT_SIZE} candidatos.`);
  }
  const entrants = shuffleCandidates(candidateIds, random).slice(0, TOURNAMENT_SIZE);
  return {
    version: 1,
    entrants,
    byes: entrants.slice(8),
    rounds: [{ name: ROUND_NAMES[0], matches: pairEntrants(entrants.slice(0, 8)) }],
    roundIndex: 0,
    champion: null,
  };
}

export function currentTournamentMatch(tournament) {
  if (!tournament || tournament.champion) return null;
  const round = tournament.rounds[tournament.roundIndex];
  return round?.matches.find((match) => !match.winner) || null;
}

export function tournamentPick(tournament, winnerId) {
  const match = currentTournamentMatch(tournament);
  if (!match || !match.candidates.includes(winnerId)) return false;
  match.winner = winnerId;

  const round = tournament.rounds[tournament.roundIndex];
  if (round.matches.some((item) => !item.winner)) return true;

  const winners = round.matches.map((item) => item.winner);
  if (winners.length === 1) {
    tournament.champion = winners[0];
    return true;
  }

  const entrants = tournament.roundIndex === 0
    ? tournament.byes.flatMap((bye, index) => [bye, winners[index]])
    : winners;
  tournament.roundIndex += 1;
  tournament.rounds.push({
    name: ROUND_NAMES[tournament.roundIndex],
    matches: pairEntrants(entrants),
  });
  return true;
}

export function completedTournamentDuels(tournament) {
  return tournament?.rounds?.reduce(
    (total, round) => total + round.matches.filter((match) => match.winner).length,
    0,
  ) || 0;
}

export function formatTournamentShareText(candidate, { url = POLIMATCH_URL } = {}) {
  const affiliation = candidate.party ? ` (${candidate.party})` : "";
  return [
    "Meu vencedor — PoliMatch",
    `Meu vencedor é ${candidate.name}${affiliation}.`,
    "Não é pesquisa oficial.",
    `Jogue também: ${url}`,
  ].join("\n");
}

function sameIds(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((id, index) => id === expected[index]);
}

function validRound(round, expectedEntrants, expectedName, requireComplete) {
  if (!round || round.name !== expectedName || !Array.isArray(round.matches)) return false;
  const expectedMatches = pairEntrants(expectedEntrants);
  if (round.matches.length !== expectedMatches.length) return false;

  let foundIncomplete = false;
  for (let index = 0; index < round.matches.length; index += 1) {
    const match = round.matches[index];
    if (!match || !sameIds(match.candidates, expectedMatches[index].candidates)) return false;
    if (match.winner == null) {
      foundIncomplete = true;
    } else {
      if (foundIncomplete || !match.candidates.includes(match.winner)) return false;
    }
  }
  return !requireComplete || round.matches.every((match) => match.winner != null);
}

export function isValidTournament(tournament, candidateIds) {
  if (!tournament || tournament.version !== 1 || !Array.isArray(tournament.entrants)
    || !Array.isArray(candidateIds)) return false;
  const allowed = new Set(candidateIds);
  const entrants = new Set(tournament.entrants);
  if (tournament.entrants.length !== TOURNAMENT_SIZE || entrants.size !== TOURNAMENT_SIZE) return false;
  if (!tournament.entrants.every((id) => allowed.has(id))) return false;
  if (!Array.isArray(tournament.byes) || !Array.isArray(tournament.rounds)) return false;
  if (!sameIds(tournament.byes, tournament.entrants.slice(8))) return false;
  if (!Number.isInteger(tournament.roundIndex) || tournament.roundIndex < 0
    || tournament.roundIndex >= ROUND_NAMES.length
    || tournament.rounds.length !== tournament.roundIndex + 1) return false;

  let expectedEntrants = tournament.entrants.slice(0, 8);
  for (let roundIndex = 0; roundIndex <= tournament.roundIndex; roundIndex += 1) {
    const round = tournament.rounds[roundIndex];
    const isPriorRound = roundIndex < tournament.roundIndex;
    if (!validRound(round, expectedEntrants, ROUND_NAMES[roundIndex], isPriorRound)) return false;

    const winners = round.matches.map((match) => match.winner);
    if (isPriorRound) {
      expectedEntrants = roundIndex === 0
        ? tournament.byes.flatMap((bye, index) => [bye, winners[index]])
        : winners;
    }
  }

  const currentRound = tournament.rounds[tournament.roundIndex];
  const currentComplete = currentRound.matches.every((match) => match.winner != null);
  const isFinal = tournament.roundIndex === ROUND_NAMES.length - 1;
  if (isFinal && currentComplete) {
    return tournament.champion === currentRound.matches[0].winner;
  }
  return !currentComplete && tournament.champion == null;
}

export function loadOrCreateTournament(serialized, candidateIds, random = Math.random) {
  if (serialized == null || serialized === "") {
    return { tournament: createTournament(candidateIds, random), recovered: false };
  }
  try {
    const parsed = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
    if (isValidTournament(parsed, candidateIds)) {
      return { tournament: parsed, recovered: false };
    }
  } catch {
    // Invalid persisted data is replaced with a playable bracket below.
  }
  return { tournament: createTournament(candidateIds, random), recovered: true };
}
