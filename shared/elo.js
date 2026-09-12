export const ELO_K = 32;
export const ELO_START = 1000;

export function expectedScore(ra, rb) {
  return 1 / (1 + 10 ** ((rb - ra) / 400));
}

export function applyElo(state, winnerId, loserId) {
  const ra = state.ratings[winnerId];
  const rb = state.ratings[loserId];
  const ea = expectedScore(ra, rb);
  const eb = expectedScore(rb, ra);
  state.ratings[winnerId] = Math.round(ra + ELO_K * (1 - ea));
  state.ratings[loserId] = Math.round(rb + ELO_K * (0 - eb));
  state.wins[winnerId] += 1;
  state.losses[loserId] += 1;
  state.duels += 1;
}

export function emptyStats(candidateIds) {
  const ratings = {};
  const wins = {};
  const losses = {};
  for (const id of candidateIds) {
    ratings[id] = ELO_START;
    wins[id] = 0;
    losses[id] = 0;
  }
  return { ratings, wins, losses, duels: 0 };
}
