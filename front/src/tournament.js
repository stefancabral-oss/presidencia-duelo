export const TOURNAMENT_SIZE = 12;
export const TOURNAMENT_STORAGE_KEY = "presidencia-duelo-tournament-v1";

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

export function formatTournamentShareText(candidate) {
  const affiliation = candidate.party ? ` (${candidate.party})` : "";
  return `Meu vencedor é ${candidate.name}${affiliation} — Presidência Duelo 2026\nNão é pesquisa oficial.`;
}

export function isValidTournament(tournament, candidateIds) {
  if (!tournament || tournament.version !== 1 || !Array.isArray(tournament.entrants)) return false;
  const allowed = new Set(candidateIds);
  const entrants = new Set(tournament.entrants);
  if (tournament.entrants.length !== TOURNAMENT_SIZE || entrants.size !== TOURNAMENT_SIZE) return false;
  if (!tournament.entrants.every((id) => allowed.has(id))) return false;
  if (!Array.isArray(tournament.byes) || !Array.isArray(tournament.rounds)) return false;
  if (!Number.isInteger(tournament.roundIndex) || !tournament.rounds[tournament.roundIndex]) return false;
  const matchesAreValid = tournament.rounds.every((round) =>
    Array.isArray(round.matches) && round.matches.every((match) =>
      Array.isArray(match.candidates)
      && match.candidates.length === 2
      && match.candidates.every((id) => entrants.has(id))
      && (match.winner == null || match.candidates.includes(match.winner)),
    ),
  );
  return matchesAreValid && (tournament.champion == null || entrants.has(tournament.champion));
}
