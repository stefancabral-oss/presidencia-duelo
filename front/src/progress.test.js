import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { saveState, STORAGE_KEY } from "./storage.js";
import {
  GOAL_LADDER,
  INITIAL_GOAL,
  acceptGoal,
  celebrationLead,
  continueLabel,
  escalateGoal,
  leaderLine,
  migrateProgress,
  nextGoal,
  normalizeGoal,
  progressPercent,
  remainingDuels,
  remainingText,
  resolveGoal,
  shouldCelebrate,
} from "./progress.js";

const gameSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "game.js"), "utf8");

test("remainingText uses the issue copy and Portuguese singular/plural", () => {
  assert.equal(remainingText(18, 30), "Faltam 12 duelos para o seu ranking ficar confiável");
  assert.equal(remainingText(29, 30), "Falta 1 duelo para o seu ranking ficar confiável");
  assert.equal(remainingText(0, 30), "Faltam 30 duelos para o seu ranking ficar confiável");
  assert.equal(remainingText(30, 30), "Meta atingida — seu ranking já está confiável");
  assert.equal(remainingText(100, 100), "Seu ranking já está confiável");
});

test("remainingDuels never goes negative and ignores junk counts", () => {
  assert.equal(remainingDuels(12, 30), 18);
  assert.equal(remainingDuels(30, 30), 0);
  assert.equal(remainingDuels(48, 30), 0);
  assert.equal(remainingDuels(-4, 30), 30);
  assert.equal(remainingDuels("19", "30"), 11);
  assert.equal(remainingDuels(Number.NaN, 30), 30);
});

test("progressPercent clamps to 0–100 when duels undershoot or overshoot", () => {
  assert.equal(progressPercent(0, 30), 0);
  assert.equal(progressPercent(15, 30), 50);
  assert.equal(progressPercent(30, 30), 100);
  assert.equal(progressPercent(90, 30), 100);
  assert.equal(progressPercent(-8, 30), 0);
  assert.equal(progressPercent("9", 30), 30);
  assert.equal(progressPercent(Number.NaN, 60), 0);
});

test("goal escalation walks 30 → 60 → 100 and then stops", () => {
  assert.deepEqual(GOAL_LADDER, [30, 60, 100]);
  assert.equal(INITIAL_GOAL, 30);
  assert.equal(nextGoal(30), 60);
  assert.equal(nextGoal(60), 100);
  assert.equal(nextGoal(100), null);
  assert.equal(escalateGoal(30), 60);
  assert.equal(escalateGoal(60), 100);
  assert.equal(escalateGoal(100), 100);
  assert.equal(escalateGoal(99), 60);
  assert.equal(normalizeGoal(undefined), 30);
  assert.equal(normalizeGoal("60"), 60);
});

test("resolveGoal and migrateProgress skip rungs already passed", () => {
  assert.equal(resolveGoal(0), 30);
  assert.equal(resolveGoal(29), 30);
  assert.equal(resolveGoal(30), 60);
  assert.equal(resolveGoal(59), 60);
  assert.equal(resolveGoal(60), 100);
  assert.equal(resolveGoal(140), 100);

  assert.deepEqual(migrateProgress({}, 18), { progressGoal: 30, celebratedGoal: null });
  assert.deepEqual(migrateProgress({}, 40), { progressGoal: 60, celebratedGoal: null });
  assert.deepEqual(migrateProgress({}, 100), { progressGoal: 100, celebratedGoal: 100 });
  assert.deepEqual(migrateProgress({ progressGoal: 30, celebratedGoal: 30 }, 30), {
    progressGoal: 30,
    celebratedGoal: 30,
  });
  assert.deepEqual(migrateProgress({ progressGoal: 60 }, 45), {
    progressGoal: 60,
    celebratedGoal: null,
  });
});

test("shouldCelebrate fires once per goal until acceptGoal advances the ladder", () => {
  assert.equal(shouldCelebrate(29, 30, null), false);
  assert.equal(shouldCelebrate(30, 30, null), true);
  assert.equal(shouldCelebrate(31, 30, null), true);
  assert.equal(shouldCelebrate(30, 30, 30), false);

  const state = { progressGoal: 30, celebratedGoal: null, duels: 30 };
  acceptGoal(state);
  assert.equal(state.progressGoal, 60);
  assert.equal(state.celebratedGoal, 30);
  assert.equal(shouldCelebrate(30, state.progressGoal, state.celebratedGoal), false);

  state.progressGoal = 100;
  state.duels = 100;
  acceptGoal(state);
  assert.equal(state.progressGoal, 100);
  assert.equal(state.celebratedGoal, 100);
});

test("celebration copy names the current #1 and the next goal", () => {
  assert.equal(
    celebrationLead(30),
    "Você chegou a 30 duelos. Seu ranking já tem uma amostra confiável.",
  );
  assert.equal(continueLabel(30), "Nova meta: 60 duelos");
  assert.equal(continueLabel(60), "Nova meta: 100 duelos");
  assert.equal(continueLabel(100), "Continuar duelos");
  assert.equal(leaderLine("Lula"), "No momento, o 1º lugar é Lula.");
  assert.equal(leaderLine("  "), "O 1º lugar ainda está em disputa.");
});

test("saveState persists the current goal with the rest of ranking state", () => {
  const store = new Map();
  const state = { duels: 18, progressGoal: 30, celebratedGoal: null };
  assert.equal(
    saveState(state, {
      setItem(key, value) {
        store.set(key, value);
      },
    }),
    true,
  );
  const parsed = JSON.parse(store.get(STORAGE_KEY));
  assert.equal(parsed.progressGoal, 30);
  assert.equal(parsed.duels, 18);
});

test("game wires progress to state.duels, reset, and keeps Continue/Fechar", () => {
  assert.match(gameSrc, /id="duel-progress"/);
  assert.match(gameSrc, /id="goal-modal"/);
  assert.match(gameSrc, /remainingText\(state\.duels/);
  assert.match(gameSrc, /progressPercent\(state\.duels/);
  assert.match(gameSrc, /migrateProgress\(parsed, merged\.duels\)/);
  assert.match(gameSrc, /acceptGoal\(state\)/);
  assert.match(gameSrc, /renderProgress\(\)/);
  assert.match(gameSrc, /maybeShowGoalMoment\(\)/);
  assert.match(gameSrc, /hideGoalMoment\(\)/);
  assert.match(gameSrc, /progressGoal: INITIAL_GOAL/);
  assert.match(gameSrc, /id="goal-continue"/);
  assert.match(gameSrc, /id="goal-dismiss"/);
  assert.match(gameSrc, /id="goal-podium"/);
});
