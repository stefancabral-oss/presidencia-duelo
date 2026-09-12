export const ELO_K = 32;
export const ELO_START = 1000;
/** Underdog win: loser was this many Elo points (or more) ahead before the duel. */
export const ZEBRA_THRESHOLD = 50;

export function expectedScore(ra, rb) {
  return 1 / (1 + 10 ** ((rb - ra) / 400));
}

/** Rounded Elo deltas from the same formula `applyElo` writes into `state.ratings`. */
export function ratingDeltas(ra, rb) {
  const ea = expectedScore(ra, rb);
  const eb = 1 - ea;
  return {
    winnerDelta: Math.round(ra + ELO_K * (1 - ea)) - ra,
    loserDelta: Math.round(rb + ELO_K * (0 - eb)) - rb,
  };
}

/**
 * Upset if the loser out-rated the winner by `threshold` before the duel.
 * Missing / non-finite ratings are not zebras.
 */
export function isZebra(winnerRating, loserRating, threshold = ZEBRA_THRESHOLD) {
  const winner = Number(winnerRating);
  const loser = Number(loserRating);
  const bar = Number(threshold);
  if (!Number.isFinite(winner) || !Number.isFinite(loser) || !Number.isFinite(bar)) {
    return false;
  }
  return loser - winner >= bar;
}

export function incrementZebraCount(zebras, winnerId) {
  const next = zebras && typeof zebras === "object" ? zebras : {};
  next[winnerId] = (Number(next[winnerId]) || 0) + 1;
  return next;
}

export function applyElo(state, winnerId, loserId) {
  const ra = state.ratings[winnerId];
  const rb = state.ratings[loserId];
  const zebra = isZebra(ra, rb);
  const deltas = ratingDeltas(ra, rb);
  state.ratings[winnerId] = ra + deltas.winnerDelta;
  state.ratings[loserId] = rb + deltas.loserDelta;
  state.wins[winnerId] += 1;
  state.losses[loserId] += 1;
  state.duels += 1;
  if (zebra) {
    state.zebras = incrementZebraCount(state.zebras, winnerId);
  }
  return { ...deltas, zebra };
}

export function emptyStats(candidateIds) {
  const ratings = {};
  const wins = {};
  const losses = {};
  const zebras = {};
  for (const id of candidateIds) {
    ratings[id] = ELO_START;
    wins[id] = 0;
    losses[id] = 0;
    zebras[id] = 0;
  }
  return { ratings, wins, losses, zebras, duels: 0 };
}

/** Merge persisted stats; a missing `zebras` field becomes 0 per candidate. */
export function mergeStats(base, parsed = {}) {
  return {
    ratings: { ...base.ratings, ...(parsed.ratings || {}) },
    wins: { ...base.wins, ...(parsed.wins || {}) },
    losses: { ...base.losses, ...(parsed.losses || {}) },
    zebras: { ...base.zebras, ...(parsed.zebras || {}) },
    duels: parsed.duels || 0,
  };
}
