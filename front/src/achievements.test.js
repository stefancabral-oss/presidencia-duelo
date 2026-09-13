import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { emptyStats } from "../../shared/elo.js";
import { saveState, STORAGE_KEY } from "./storage.js";
import {
  ACHIEVEMENT_IDS,
  COMBO_WINDOW_MS,
  COMPLETOU_TORNEIO,
  DUEL_THRESHOLDS,
  DUELS_10,
  DUELS_50,
  DUELS_100,
  DUELS_250,
  PRIMEIRA_ZEBRA,
  VIU_TODOS,
  achievementTitle,
  achievementToastText,
  applyCombo,
  comboLabel,
  dueDuelMilestones,
  earnedAchievementIds,
  hasSeenAllCandidates,
  isTournamentCompleted,
  liveCombo,
  migrateAchievements,
  normalizeAchievements,
  resetCombo,
  unlockAchievement,
  unlockDueAchievements,
  unlockTournamentCompleted,
} from "./achievements.js";

const gameSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "game.js"), "utf8");

function baseState(overrides = {}) {
  const state = emptyStats(["a", "b", "c"]);
  state.pairCount = {};
  state.achievements = [];
  state.combo = 0;
  state.lastVoteAt = null;
  return Object.assign(state, overrides);
}

test("duel milestone thresholds unlock at 10, 50, 100, and 250", () => {
  assert.deepEqual(DUEL_THRESHOLDS, [10, 50, 100, 250]);
  assert.deepEqual(dueDuelMilestones(0), []);
  assert.deepEqual(dueDuelMilestones(9), []);
  assert.deepEqual(dueDuelMilestones(10), [DUELS_10]);
  assert.deepEqual(dueDuelMilestones(49), [DUELS_10]);
  assert.deepEqual(dueDuelMilestones(50), [DUELS_10, DUELS_50]);
  assert.deepEqual(dueDuelMilestones(100), [DUELS_10, DUELS_50, DUELS_100]);
  assert.deepEqual(dueDuelMilestones(249), [DUELS_10, DUELS_50, DUELS_100]);
  assert.deepEqual(dueDuelMilestones(250), [DUELS_10, DUELS_50, DUELS_100, DUELS_250]);
  assert.deepEqual(dueDuelMilestones("50"), [DUELS_10, DUELS_50]);
  assert.deepEqual(dueDuelMilestones(-3), []);
  assert.deepEqual(dueDuelMilestones(Number.NaN), []);
});

test("combo increments inside 2s and resets after the window", () => {
  const state = baseState();
  assert.equal(applyCombo(state, 1_000), 1);
  assert.equal(state.combo, 1);
  assert.equal(state.lastVoteAt, 1_000);

  assert.equal(applyCombo(state, 1_000 + COMBO_WINDOW_MS), 2);
  assert.equal(applyCombo(state, 1_000 + COMBO_WINDOW_MS + 500), 3);
  assert.equal(applyCombo(state, 1_000 + COMBO_WINDOW_MS + 500 + COMBO_WINDOW_MS + 1), 1);
});

test("comboLabel shows x5 combo at the top only from x2 up", () => {
  assert.equal(COMBO_WINDOW_MS, 2000);
  assert.equal(comboLabel(0), "");
  assert.equal(comboLabel(1), "");
  assert.equal(comboLabel(2), "x2 combo");
  assert.equal(comboLabel(5), "x5 combo");
  assert.equal(comboLabel("5"), "x5 combo");
  assert.equal(liveCombo(5, 1_000, 2_500), 5);
  assert.equal(liveCombo(5, 1_000, 3_001), 0);
  assert.equal(liveCombo(1, 1_000, 1_500), 0);
});

test("unlockAchievement is idempotent and ignores unknown ids", () => {
  const state = baseState();
  assert.equal(unlockAchievement(state, DUELS_10), true);
  assert.deepEqual(state.achievements, [DUELS_10]);
  assert.equal(unlockAchievement(state, DUELS_10), false);
  assert.deepEqual(state.achievements, [DUELS_10]);
  assert.equal(unlockAchievement(state, "nope"), false);
  assert.equal(unlockAchievement(null, DUELS_10), false);
  assert.equal(achievementTitle(PRIMEIRA_ZEBRA), "Primeira zebra");
  assert.equal(achievementToastText(DUELS_10), "Marco: 10 duelos!");
});

test("unlockDueAchievements grants zebra, coverage, and duel badges once", () => {
  const state = baseState({
    duels: 10,
    zebras: { a: 1, b: 0 },
    pairCount: { "a|b": 1, "a|c": 1, "b|c": 1 },
  });
  const first = unlockDueAchievements(state, { candidateIds: ["a", "b", "c"] });
  assert.deepEqual(first, [DUELS_10, PRIMEIRA_ZEBRA, VIU_TODOS]);
  const second = unlockDueAchievements(state, { candidateIds: ["a", "b", "c"] });
  assert.deepEqual(second, []);
  assert.deepEqual(state.achievements, [DUELS_10, PRIMEIRA_ZEBRA, VIU_TODOS]);
});

test("viu todos uses pair/show coverage, not vote count", () => {
  assert.equal(hasSeenAllCandidates(["a", "b", "c"], { "a|b": 2 }), false);
  assert.equal(hasSeenAllCandidates(["a", "b", "c"], { "a|b": 1, "b|c": 1 }), true);
  assert.equal(hasSeenAllCandidates(["a"], { "a|b": 1 }), false);
  assert.equal(
    earnedAchievementIds({
      duels: 4,
      pairCount: { "a|b": 1, "b|c": 1 },
      candidateIds: ["a", "b", "c"],
    }).includes(VIU_TODOS),
    true,
  );
});

test("primeira zebra uses existing zebras state from applyElo", () => {
  assert.deepEqual(earnedAchievementIds({ duels: 1, zebras: {} }), []);
  assert.deepEqual(earnedAchievementIds({ duels: 1, zebras: { a: 0 } }), []);
  assert.deepEqual(earnedAchievementIds({ duels: 1, zebras: { a: 2 } }), [PRIMEIRA_ZEBRA]);
});

test("completou-torneio stays dormant unless a completion flag is already set", () => {
  assert.equal(isTournamentCompleted({}), false);
  assert.equal(isTournamentCompleted({ tournament: { round: 1 } }), false);
  assert.equal(isTournamentCompleted({ tournamentCompleted: true }), true);
  assert.equal(isTournamentCompleted({ tournamentWinner: "lula" }), true);
  assert.equal(isTournamentCompleted({ tournament: { completed: true } }), true);
  assert.equal(isTournamentCompleted({ tournament: { winner: "zema" } }), true);

  const state = baseState();
  assert.deepEqual(unlockDueAchievements(state, { candidateIds: ["a", "b"] }), []);
  assert.equal(unlockTournamentCompleted(state), true);
  assert.ok(state.achievements.includes(COMPLETOU_TORNEIO));
  assert.equal(unlockTournamentCompleted(state), false);

  const flagged = baseState({ tournamentCompleted: true });
  assert.deepEqual(unlockDueAchievements(flagged, { candidateIds: ["a", "b"] }), [
    COMPLETOU_TORNEIO,
  ]);
});

test("migrateAchievements fills missing array and grants already-earned badges", () => {
  assert.deepEqual(normalizeAchievements(undefined), []);
  assert.deepEqual(normalizeAchievements("nope"), []);
  assert.deepEqual(normalizeAchievements([DUELS_10, "nope", DUELS_10, 12]), [DUELS_10]);

  assert.deepEqual(migrateAchievements({}, { duels: 9, candidateIds: ["a", "b"] }), {
    achievements: [],
    combo: 0,
    lastVoteAt: null,
  });
  assert.deepEqual(
    migrateAchievements({ combo: "3", lastVoteAt: 99 }, { duels: 50, zebras: { a: 1 } }),
    {
      achievements: [DUELS_10, DUELS_50, PRIMEIRA_ZEBRA],
      combo: 3,
      lastVoteAt: 99,
    },
  );
  assert.deepEqual(
    migrateAchievements({ achievements: [DUELS_10, "junk"] }, { duels: 10 }),
    {
      achievements: [DUELS_10],
      combo: 0,
      lastVoteAt: null,
    },
  );
});

test("saveState persists achievements and combo in the same blob", () => {
  const store = new Map();
  const state = {
    duels: 10,
    achievements: [DUELS_10],
    combo: 5,
    lastVoteAt: 1_700,
  };
  assert.equal(
    saveState(state, {
      setItem(key, value) {
        store.set(key, value);
      },
    }),
    true,
  );
  const parsed = JSON.parse(store.get(STORAGE_KEY));
  assert.deepEqual(parsed.achievements, [DUELS_10]);
  assert.equal(parsed.combo, 5);
  assert.equal(parsed.lastVoteAt, 1_700);
  assert.equal(parsed.duels, 10);
});

test("resetCombo clears sequência; unlocks are not revoked", () => {
  const state = baseState({
    duels: 10,
    achievements: [DUELS_10],
    combo: 5,
    lastVoteAt: 42,
  });
  resetCombo(state);
  assert.equal(state.combo, 0);
  assert.equal(state.lastVoteAt, null);
  assert.deepEqual(state.achievements, [DUELS_10]);
  assert.deepEqual(unlockDueAchievements(state, { candidateIds: ["a", "b"] }), []);
});

test("game wires toast, combo, persistence, and tournament completion", () => {
  assert.match(gameSrc, /id="combo-banner"/);
  assert.match(gameSrc, /id="achievement-toasts"/);
  assert.match(gameSrc, /id="achievements-list"/);
  assert.match(gameSrc, /applyCombo\(targetState\)/);
  assert.match(gameSrc, /unlockDueAchievements\(state/);
  assert.match(gameSrc, /resetCombo\(state\)/);
  assert.match(gameSrc, /migrateAchievements\(parsed/);
  assert.match(gameSrc, /achievements: \[\]/);
  assert.match(gameSrc, /x5 combo|combo-label/);
  assert.match(gameSrc, /milestones stay unlocked|resetCombo/);
  assert.match(gameSrc, /unlockTournamentCompleted\(state\)/);
  assert.match(gameSrc, /tab-tournament/);
  assert.equal(ACHIEVEMENT_IDS.includes(COMPLETOU_TORNEIO), true);
});
