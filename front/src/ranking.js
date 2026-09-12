/**
 * Local ranking order: higher Elo first; equal Elo breaks ties by more wins.
 *
 * Win rate stays visible on each row, but is not a sort key. A 1–0 (100%)
 * record should not outrank 9–1 (90%) at the same Elo — absolute wins is
 * the more stable, sample-size-aware tiebreak, and it already matches the
 * existing sort. The subtitle copy is kept in this module so UI text and
 * comparator cannot drift apart.
 */
export const RANKING_SUBTITLE =
  "Ordenado por Elo; vitórias como desempate visual. Sempre funciona no aparelho.";

export function compareRankStats(a, b) {
  const eloDelta = a.elo - b.elo;
  if (eloDelta !== 0) return -eloDelta;
  return (b.wins || 0) - (a.wins || 0);
}

export function sortCandidatesByRank(candidates, getStats) {
  return candidates.slice().sort((left, right) =>
    compareRankStats(getStats(left.id), getStats(right.id)),
  );
}
