import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { emptyStats } from "../../shared/elo.js";
import { saveState, STORAGE_KEY } from "./storage.js";
import {
  COVERAGE_DUELS,
  candidatePairs,
  coveragePool,
  eloGapWeight,
  excludeLastPair,
  isSamePair,
  normalizePairCount,
  pairKey,
  pairWeight,
  pickPair,
  rarityWeight,
  recordPair,
  sampleWeighted,
  shownPairTotal,
  takeNextPair,
  unseenCandidateIds,
} from "./matchmaking.js";

const gameSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "game.js"), "utf8");

function ids(...list) {
  return list.map((id) => ({ id }));
}

function pairState(candidateIds, overrides = {}) {
  const state = emptyStats(candidateIds);
  state.pairCount = {};
  state.lastPair = null;
  return Object.assign(state, overrides);
}

function samePairSet(pair, expected) {
  return isSamePair(pair, expected);
}

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test("pairKey is order-insensitive and canonical", () => {
  assert.equal(pairKey("lula", "zema"), pairKey("zema", "lula"));
  assert.equal(pairKey("a", "b"), "a|b");
});

test("normalizePairCount migrates missing or junk fields to empty", () => {
  assert.deepEqual(normalizePairCount(undefined), {});
  assert.deepEqual(normalizePairCount(null), {});
  assert.deepEqual(normalizePairCount([]), {});
  assert.deepEqual(normalizePairCount("nope"), {});
  assert.deepEqual(normalizePairCount({ "a|b": 2, bad: 1, "a|a": 3, "c|b": "4", "x|y": -1 }), {
    "a|b": 2,
    "b|c": 4,
  });
});

test("recordPair increments the canonical key", () => {
  assert.deepEqual(recordPair({}, ["zema", "lula"]), { "lula|zema": 1 });
  assert.deepEqual(recordPair({ "lula|zema": 1 }, ["lula", "zema"]), { "lula|zema": 2 });
});

test("pairWeight is rarity times Elo proximity 1/(1+|Δ|/100)", () => {
  assert.equal(eloGapWeight(0), 1);
  assert.equal(eloGapWeight(100), 0.5);
  assert.equal(eloGapWeight(-200), 1 / 3);
  assert.equal(rarityWeight(0), 1);
  assert.equal(rarityWeight(3), 0.25);
  assert.equal(pairWeight(0, 0), 1);
  assert.equal(pairWeight(1, 100), 0.5 * 0.5);
  assert.ok(pairWeight(0, 10) > pairWeight(0, 400));
  assert.ok(pairWeight(0, 0) > pairWeight(5, 0));
});

test("sampleWeighted follows the cumulative weights", () => {
  const items = ["close", "far"];
  const weights = [0.9, 0.1];
  assert.equal(sampleWeighted(items, weights, () => 0), "close");
  assert.equal(sampleWeighted(items, weights, () => 0.899), "close");
  assert.equal(sampleWeighted(items, weights, () => 0.9), "far");
  assert.equal(sampleWeighted(items, weights, () => 0.999), "far");
});

test("excludeLastPair drops the rematch and keeps other pairs", () => {
  const pairs = candidatePairs(["a", "b", "c"]);
  const filtered = excludeLastPair(pairs, ["b", "a"]);
  assert.equal(filtered.length, 2);
  assert.ok(filtered.every((pair) => !isSamePair(pair, ["a", "b"])));
});

test("excludeLastPair keeps the only pair when the roster has two names", () => {
  assert.deepEqual(excludeLastPair([["a", "b"]], ["a", "b"]), [["a", "b"]]);
});

test("pickPair never returns lastPair when another pair exists", () => {
  const candidates = ids("a", "b", "c");
  const state = pairState(["a", "b", "c"], { lastPair: ["a", "b"] });
  for (let i = 0; i < 80; i++) {
    const pair = pickPair(candidates, state, lcg(i + 1));
    assert.equal(samePairSet(pair, ["a", "b"]), false);
    assert.ok(pair[0] !== pair[1]);
  }
});

function rngSequence(values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

test("pickPair favors a close-Elo pair over a lopsided favorite-vs-lantern", () => {
  const candidates = ids("fav", "peer", "lantern");
  const state = pairState(["fav", "peer", "lantern"], {
    ratings: { fav: 1500, peer: 1490, lantern: 800 },
  });
  const closeW = pairWeight(0, 10);
  const blowoutW = pairWeight(0, 700);
  assert.ok(closeW > blowoutW * 5);

  // candidatePairs order: fav-peer (close), fav-lantern, peer-lantern.
  // rng=0 lands in the first (highest) bucket.
  const pair = pickPair(candidates, state, rngSequence([0, 0.2]));
  assert.ok(samePairSet(pair, ["fav", "peer"]));

  let close = 0;
  const n = 500;
  for (let i = 0; i < n; i++) {
    if (samePairSet(pickPair(candidates, state), ["fav", "peer"])) close += 1;
  }
  // P(close) ≈ 0.78 vs uniform 1/3.
  assert.ok(close > n * 0.55, `close Elo pair won ${close}/${n}`);
});

test("pickPair favors a rarely seen pair when Elo gaps match", () => {
  const candidates = ids("a", "b", "c");
  const state = pairState(["a", "b", "c"], {
    pairCount: { "a|b": 8, "a|c": 8 },
  });
  assert.ok(pairWeight(0, 0) > pairWeight(8, 0) * 5);

  // Order: a-b (common), a-c (common), b-c (rare, most of the mass).
  const total = pairWeight(8, 0) + pairWeight(8, 0) + pairWeight(0, 0);
  const rareStart = (pairWeight(8, 0) + pairWeight(8, 0)) / total;
  const pair = pickPair(candidates, state, rngSequence([rareStart + 0.01, 0.2]));
  assert.ok(samePairSet(pair, ["b", "c"]));

  let rare = 0;
  const n = 500;
  for (let i = 0; i < n; i++) {
    if (samePairSet(pickPair(candidates, state), ["b", "c"])) rare += 1;
  }
  assert.ok(rare > n * 0.55, `rare pair won ${rare}/${n}`);
});

test("coveragePool forces two unseen names when remaining shows are tight", () => {
  const pairs = candidatePairs(["a", "b", "c", "d"]);
  const pool = coveragePool(pairs, ["c", "d"], 1);
  assert.equal(pool.length, 1);
  assert.ok(isSamePair(pool[0], ["c", "d"]));
});

test("first 12 shown pairs cover all 12 candidates", () => {
  const candidateIds = Array.from({ length: 12 }, (_, i) => `c${i}`);
  const candidates = ids(...candidateIds);
  const seeds = [1, 7, 99, 12345, 99991];
  for (const seed of seeds) {
    const state = pairState(candidateIds);
    const seen = new Set();
    let previous = null;
    for (let i = 0; i < COVERAGE_DUELS; i++) {
      const pair = takeNextPair(candidates, state, lcg(seed * 1000 + i));
      assert.ok(pair[0] !== pair[1]);
      if (previous) assert.equal(samePairSet(pair, previous), false);
      previous = pair;
      seen.add(pair[0]);
      seen.add(pair[1]);
    }
    assert.equal(seen.size, 12, `seed ${seed} covered ${seen.size}`);
    assert.equal(shownPairTotal(state.pairCount), 12);
    assert.deepEqual(unseenCandidateIds(candidateIds, state.pairCount), []);
  }
});

test("coverage beats a tempting close-Elo rematch among already-seen names", () => {
  const candidates = ids("a", "b", "c", "d");
  const state = pairState(["a", "b", "c", "d"], {
    ratings: { a: 1500, b: 1500, c: 800, d: 800 },
    pairCount: { "a|b": 11 },
    lastPair: ["a", "b"],
  });
  // 11 shows already, unseen c+d, one slot left → must be c vs d
  for (let i = 0; i < 40; i++) {
    const pair = pickPair(candidates, state, lcg(300 + i));
    assert.ok(samePairSet(pair, ["c", "d"]), `got ${pair}`);
  }
});

test("takeNextPair records the show and updates lastPair", () => {
  const candidates = ids("a", "b", "c");
  const state = pairState(["a", "b", "c"]);
  const first = takeNextPair(candidates, state, () => 0);
  assert.equal(shownPairTotal(state.pairCount), 1);
  assert.ok(isSamePair(state.lastPair, first));
  const second = takeNextPair(candidates, state, () => 0);
  assert.equal(samePairSet(second, first), false);
  assert.equal(shownPairTotal(state.pairCount), 2);
});

test("saveState persists pairCount with the rest of ranking state", () => {
  const state = pairState(["a", "b"], { pairCount: { "a|b": 3 }, duels: 3 });
  const store = new Map();
  assert.equal(
    saveState(state, {
      setItem(key, value) {
        store.set(key, value);
      },
    }),
    true,
  );
  const parsed = JSON.parse(store.get(STORAGE_KEY));
  assert.deepEqual(normalizePairCount(parsed.pairCount), { "a|b": 3 });
  assert.equal(parsed.duels, 3);
});

test("game loads pairCount, records each show, and no longer samples uniformly", () => {
  assert.match(gameSrc, /pairCount: \{\}/);
  assert.match(gameSrc, /pairCount: normalizePairCount\(parsed\.pairCount\)/);
  assert.match(gameSrc, /takeNextPair\(candidates, state\)/);
  assert.doesNotMatch(gameSrc, /Math\.random\(\) \* ids\.length/);
  assert.doesNotMatch(gameSrc, /function randomPair/);
});
