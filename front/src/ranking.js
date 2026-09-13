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

export function formatZebraCount(count) {
  const n = Math.max(0, Math.trunc(Number(count)));
  if (!Number.isFinite(n)) return "0 zebras";
  return n === 1 ? "1 zebra" : `${n} zebras`;
}

/** Ranking row subtitle: available profile details, W/L, and zebra count. */
export function rankMetaText({ party, vice, wins, losses, zebras = 0 }) {
  const record = `${wins}V / ${losses}D`;
  const n = Math.max(0, Math.trunc(Number(zebras) || 0));
  const details = [];
  if (party) details.push(party);
  if (vice) details.push(`vice ${vice}`);
  details.push(record);
  if (n > 0) details.push(formatZebraCount(n));
  return details.join(" · ");
}

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
