import { createHash } from "node:crypto";

export const WARMUP_ROUNDS = 3;
export const FINISHES = Object.freeze([
  ["malaquita", "Malaquita"], ["porcelana", "Porcelana"], ["cobre", "Cobre"],
  ["prata", "Prata"], ["ambar", "Âmbar"], ["jade", "Jade"],
  ["safira", "Safira"], ["quartzo", "Quartzo"], ["onix", "Ônix"],
  ["perola", "Pérola"], ["aurora", "Aurora"], ["cristal", "Cristal"],
].map(([id, title]) => Object.freeze({ id, title, acquisitionClass: "daily", purchasable: false })));

export function nextFinish(owned, seed) {
  const available = FINISHES.filter(item => !owned.includes(item.id));
  return available.sort((a, b) => {
    const hash = item => createHash("sha256").update(`${seed}:${item.id}`).digest("hex");
    return hash(a).localeCompare(hash(b));
  })[0] || null;
}

// Beta(1,1) posterior variance measures uncertainty about pair preference,
// including unequal counts. This is a precision target, NOT evidence of a
// strict ordering: balanced preferences may remain ties. At seven observations
// variance is at most .025; remaining is a conservative bound, not a promise.
export const PAIR_VARIANCE_TARGET = 0.025;
export function uncertainPair(topIds, comparisons = []) {
  const pairs = [];
  for (let i = 0; i < topIds.length; i++) for (let j = i + 1; j < topIds.length; j++) {
    const ids = [topIds[i], topIds[j]].sort();
    const a = comparisons.filter(row => row.winnerId === ids[0] && row.loserId === ids[1]).length;
    const b = comparisons.filter(row => row.winnerId === ids[1] && row.loserId === ids[0]).length;
    const uncertainty = ((a + 1) * (b + 1)) / ((a + b + 2) ** 2 * (a + b + 3));
    if (uncertainty <= PAIR_VARIANCE_TARGET) continue;
    pairs.push({ candidateIds: ids, uncertainty, remaining: Math.max(0, 7 - a - b) });
  }
  pairs.sort((a, b) => b.uncertainty - a.uncertainty || a.candidateIds.join().localeCompare(b.candidateIds.join()));
  return { pair: pairs[0] || null, remaining: pairs.reduce((sum, pair) => sum + pair.remaining, 0) };
}
