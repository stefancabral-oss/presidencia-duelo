/**
 * Local ranking order: higher Elo first; equal Elo breaks ties by more wins.
 *
 * Win rate stays visible on each row, but is not a sort key. A 1–0 (100%)
 * record should not outrank 9–1 (90%) at the same Elo — absolute wins is
 * the more stable, sample-size-aware tiebreak, and it already matches the
 * existing sort. The subtitle copy is kept in this module so UI text and
 * comparator cannot drift apart.
 */
export const RANK_SORT_CRITERIA = {
  ELO: "elo",
  WINS: "wins",
  ZEBRAS: "zebras",
};

export const RANKING_SUBTITLE =
  "Elo, do maior para o menor; vitórias como desempate. Ranking pessoal neste aparelho.";

const SORT_LABELS = {
  [RANK_SORT_CRITERIA.ELO]: "Elo",
  [RANK_SORT_CRITERIA.WINS]: "Vitórias",
  [RANK_SORT_CRITERIA.ZEBRAS]: "Zebras",
};

export function normalizeRankSort(sort = {}) {
  const criterion = Object.values(RANK_SORT_CRITERIA).includes(sort.criterion)
    ? sort.criterion
    : RANK_SORT_CRITERIA.ELO;
  return { criterion, direction: sort.direction === "asc" ? "asc" : "desc" };
}

export function rankSortSummary(sort = {}) {
  const normalized = normalizeRankSort(sort);
  const direction = normalized.direction === "asc" ? "menor para o maior" : "maior para o menor";
  const tie = normalized.criterion === RANK_SORT_CRITERIA.ELO
    ? "vitórias"
    : "Elo";
  return `${SORT_LABELS[normalized.criterion]}, do ${direction}; ${tie} como desempate.`;
}

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

function numericMetric(stats, criterion) {
  const value = Number(stats?.[criterion]);
  return Number.isFinite(value) ? value : 0;
}

export function compareRankStats(a, b, sort = {}) {
  const { criterion, direction } = normalizeRankSort(sort);
  const primaryDelta = numericMetric(a, criterion) - numericMetric(b, criterion);
  if (primaryDelta !== 0) return direction === "asc" ? primaryDelta : -primaryDelta;

  const tieBreakers = criterion === RANK_SORT_CRITERIA.ELO
    ? [RANK_SORT_CRITERIA.WINS]
    : [RANK_SORT_CRITERIA.ELO, RANK_SORT_CRITERIA.WINS];
  for (const tieBreaker of tieBreakers) {
    if (tieBreaker === criterion) continue;
    const delta = numericMetric(a, tieBreaker) - numericMetric(b, tieBreaker);
    if (delta !== 0) return -delta;
  }
  return 0;
}

export function sortCandidatesByRank(candidates, getStats, sort = {}) {
  return candidates.slice().sort((left, right) => {
    const statsOrder = compareRankStats(getStats(left.id), getStats(right.id), sort);
    if (statsOrder !== 0) return statsOrder;
    return String(left.name || left.id).localeCompare(String(right.name || right.id), "pt-BR");
  });
}
