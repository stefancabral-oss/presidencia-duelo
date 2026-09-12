/**
 * One-level undo for the last local duel.
 * Snapshot the two candidates' stats before `applyElo`, then restore them.
 */

export function isUndoSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  const { winnerId, loserId, ratingsBefore } = snapshot;
  if (!winnerId || !loserId || winnerId === loserId) return false;
  if (!ratingsBefore || typeof ratingsBefore !== "object") return false;
  return (
    Number.isFinite(Number(ratingsBefore[winnerId])) &&
    Number.isFinite(Number(ratingsBefore[loserId]))
  );
}

export function lastDuelFromParsed(parsed) {
  const snap = parsed?.lastDuel;
  return isUndoSnapshot(snap) ? snap : null;
}

function statBefore(map, id) {
  return Math.max(0, Math.trunc(Number(map?.[id]) || 0));
}

export function snapshotDuel(state, winnerId, loserId, pair) {
  return {
    winnerId,
    loserId,
    pair: Array.isArray(pair) && pair.length === 2 ? [pair[0], pair[1]] : [winnerId, loserId],
    ratingsBefore: {
      [winnerId]: Number(state.ratings[winnerId]),
      [loserId]: Number(state.ratings[loserId]),
    },
    winsBefore: {
      [winnerId]: statBefore(state.wins, winnerId),
      [loserId]: statBefore(state.wins, loserId),
    },
    lossesBefore: {
      [winnerId]: statBefore(state.losses, winnerId),
      [loserId]: statBefore(state.losses, loserId),
    },
    zebrasBefore: {
      [winnerId]: statBefore(state.zebras, winnerId),
      [loserId]: statBefore(state.zebras, loserId),
    },
    duelsBefore: Math.max(0, Math.trunc(Number(state.duels) || 0)),
  };
}

function restoreId(state, id, snapshot) {
  state.ratings[id] = Number(snapshot.ratingsBefore[id]);
  state.wins[id] = statBefore(snapshot.winsBefore, id);
  state.losses[id] = statBefore(snapshot.lossesBefore, id);
  if (!state.zebras || typeof state.zebras !== "object") state.zebras = {};
  state.zebras[id] = statBefore(snapshot.zebrasBefore, id);
}

/** Revert Elo, W/L, zebras, and the duel counter from a last-duel snapshot. */
export function restoreDuel(state, snapshot) {
  if (!isUndoSnapshot(snapshot)) return false;
  restoreId(state, snapshot.winnerId, snapshot);
  restoreId(state, snapshot.loserId, snapshot);
  state.duels = Math.max(0, Math.trunc(Number(snapshot.duelsBefore) || 0));
  return true;
}

export function undoPair(snapshot) {
  if (!isUndoSnapshot(snapshot)) return null;
  if (Array.isArray(snapshot.pair) && snapshot.pair.length === 2) {
    return [snapshot.pair[0], snapshot.pair[1]];
  }
  return [snapshot.winnerId, snapshot.loserId];
}
