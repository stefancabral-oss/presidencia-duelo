import { ELO_START } from "../../shared/elo.js";

/** Minimum opening coverage window retained for the original 12-name roster. */
export const COVERAGE_DUELS = 12;
/** Elo gap in `1 / (1 + |Δelo| / scale)` — closer ratings get a higher weight. */
export const ELO_GAP_SCALE = 100;

/**
 * `pairCount` is a **show** history, not a vote history.
 *
 * `nextDuel` records a pair when it appears on the cards. This is show history,
 * so it remains independent from the vote counters. A missing persisted field
 * migrates to `{}`.
 */

export function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function parsePairKey(key) {
  if (typeof key !== "string") return null;
  const parts = key.split("|");
  if (parts.length !== 2) return null;
  const [a, b] = parts;
  if (!a || !b || a === b) return null;
  return [a, b];
}

/** Missing / junk `pairCount` becomes an empty map. Keys are canonical `a|b`. */
export function normalizePairCount(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const pair = parsePairKey(key);
    if (!pair) continue;
    const n = Math.trunc(Number(value));
    if (!Number.isFinite(n) || n <= 0) continue;
    const canonical = pairKey(pair[0], pair[1]);
    out[canonical] = (out[canonical] || 0) + n;
  }
  return out;
}

export function recordPair(pairCount, pair) {
  if (!Array.isArray(pair) || pair.length < 2 || pair[0] === pair[1]) {
    return normalizePairCount(pairCount);
  }
  const key = pairKey(pair[0], pair[1]);
  const current = normalizePairCount(pairCount);
  current[key] = (current[key] || 0) + 1;
  return current;
}

export function shownPairTotal(pairCount) {
  let n = 0;
  for (const value of Object.values(pairCount || {})) {
    const c = Math.trunc(Number(value));
    if (Number.isFinite(c) && c > 0) n += c;
  }
  return n;
}

export function eloGapWeight(deltaElo) {
  return 1 / (1 + Math.abs(Number(deltaElo) || 0) / ELO_GAP_SCALE);
}

export function rarityWeight(count) {
  return 1 / (1 + Math.max(0, Number(count) || 0));
}

/** Rarely seen pairs and small Elo gaps score higher. */
export function pairWeight(count, deltaElo) {
  return rarityWeight(count) * eloGapWeight(deltaElo);
}

export function isSamePair(left, right) {
  if (!left || !right || left.length < 2 || right.length < 2) return false;
  return (
    (left[0] === right[0] && left[1] === right[1]) ||
    (left[0] === right[1] && left[1] === right[0])
  );
}

export function candidatePairs(ids, pairAllowed = () => true) {
  const pairs = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (pairAllowed(ids[i], ids[j])) pairs.push([ids[i], ids[j]]);
    }
  }
  return pairs;
}

/** Large catalogs need enough duels to show every person at least once. */
export function coverageDuelLimit(candidateCount) {
  const count = Math.max(0, Math.trunc(Number(candidateCount) || 0));
  return Math.max(COVERAGE_DUELS, Math.ceil(count / 2));
}

/** Drop `lastPair` unless it is the only pair (two-candidate roster). */
export function excludeLastPair(pairs, lastPair) {
  if (!lastPair) return pairs;
  const filtered = pairs.filter((pair) => !isSamePair(pair, lastPair));
  return filtered.length ? filtered : pairs;
}

export function unseenCandidateIds(ids, pairCount) {
  const seen = new Set();
  for (const [key, value] of Object.entries(pairCount || {})) {
    const c = Math.trunc(Number(value));
    if (!Number.isFinite(c) || c <= 0) continue;
    const pair = parsePairKey(key);
    if (!pair) continue;
    seen.add(pair[0]);
    seen.add(pair[1]);
  }
  return ids.filter((id) => !seen.has(id));
}

/**
 * While some names are still missing in the first `COVERAGE_DUELS` shows,
 * keep at least one unseen id. If remaining shows are fewer than unseen
 * names, prefer two unseen (otherwise the last slot cannot finish coverage).
 */
export function coveragePool(pairs, unseen, remainingShows) {
  if (!unseen.length || remainingShows <= 0) return pairs;
  const unseenSet = new Set(unseen);
  const withUnseen = pairs.filter(([a, b]) => unseenSet.has(a) || unseenSet.has(b));
  const withTwo = pairs.filter(([a, b]) => unseenSet.has(a) && unseenSet.has(b));
  if (unseen.length > remainingShows && withTwo.length) return withTwo;
  if (withUnseen.length) return withUnseen;
  return pairs;
}

export function sampleWeighted(items, weights, rng) {
  if (!items.length) return null;
  let total = 0;
  for (const w of weights) total += w;
  if (!(total > 0)) return items[items.length - 1];
  let cursor = rng() * total;
  for (let i = 0; i < items.length; i++) {
    cursor -= weights[i];
    if (cursor < 0) return items[i];
  }
  return items[items.length - 1];
}

function shufflePair(pair, rng) {
  return rng() < 0.5 ? [pair[0], pair[1]] : [pair[1], pair[0]];
}

function ratingOf(ratings, id) {
  const n = Number(ratings?.[id]);
  return Number.isFinite(n) ? n : ELO_START;
}

/**
 * Weighted pair draw: rarity × Elo proximity, minus `lastPair`,
 * with a coverage filter sized to the active catalog.
 */
export function pickPair(candidates, state, rng = Math.random, pairAllowed = () => true) {
  const ids = candidates.map((c) => c.id);
  if (ids.length < 2) return [ids[0] || "", ids[0] || ""];

  const pairCount = state.pairCount || {};
  const ratings = state.ratings || {};
  const coverageDuels = coverageDuelLimit(ids.length);
  let pairs = excludeLastPair(candidatePairs(ids, pairAllowed), state.lastPair);
  if (!pairs.length) return [ids[0] || "", ids[0] || ""];

  const shown = shownPairTotal(pairCount);
  if (shown < coverageDuels) {
    const unseen = unseenCandidateIds(ids, pairCount);
    pairs = coveragePool(pairs, unseen, coverageDuels - shown);
  }

  const weights = pairs.map(([a, b]) =>
    pairWeight(pairCount[pairKey(a, b)] || 0, ratingOf(ratings, a) - ratingOf(ratings, b)),
  );
  const picked = sampleWeighted(pairs, weights, rng);
  return shufflePair(picked, rng);
}

/** Pick, record the appearance, and set `lastPair` — same steps as `nextDuel`. */
export function takeNextPair(candidates, state, rng = Math.random, pairAllowed = () => true) {
  const pair = pickPair(candidates, state, rng, pairAllowed);
  state.pairCount = recordPair(state.pairCount, pair);
  state.lastPair = pair;
  return pair;
}
