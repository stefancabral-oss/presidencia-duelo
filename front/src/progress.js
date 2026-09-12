/**
 * Visible duel-count goal so the game has a finish line.
 *
 * Lightweight in-app celebration. The shareable podium (issue #14) is
 * opened from a "Ver pódio" action without replacing Continue/Fechar.
 */

export const GOAL_LADDER = [30, 60, 100];
export const INITIAL_GOAL = 30;

export function isValidGoal(value) {
  return GOAL_LADDER.includes(Math.trunc(Number(value)));
}

export function normalizeGoal(value) {
  return isValidGoal(value) ? Math.trunc(Number(value)) : INITIAL_GOAL;
}

export function nextGoal(goal) {
  const current = normalizeGoal(goal);
  const index = GOAL_LADDER.indexOf(current);
  if (index < 0 || index >= GOAL_LADDER.length - 1) return null;
  return GOAL_LADDER[index + 1];
}

/** Advance 30 → 60 → 100. Stops escalating after 100. */
export function escalateGoal(goal) {
  return nextGoal(goal) ?? normalizeGoal(goal);
}

/**
 * Smallest ladder goal still ahead of `duels`.
 * Used when migrating saves that predate `progressGoal`.
 */
export function resolveGoal(duels, savedGoal = INITIAL_GOAL) {
  const played = Math.max(0, Math.trunc(Number(duels) || 0));
  let goal = normalizeGoal(savedGoal);
  while (played >= goal) {
    const upcoming = nextGoal(goal);
    if (upcoming == null) return goal;
    goal = upcoming;
  }
  return goal;
}

export function remainingDuels(duels, goal) {
  const played = Math.max(0, Math.trunc(Number(duels) || 0));
  return Math.max(0, normalizeGoal(goal) - played);
}

/** Progress width 0–100, even when duels overshoot the current goal. */
export function progressPercent(duels, goal) {
  const target = normalizeGoal(goal);
  const played = Math.max(0, Math.trunc(Number(duels) || 0));
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((100 * played) / target)));
}

export function remainingText(duels, goal) {
  const left = remainingDuels(duels, goal);
  if (left === 0) {
    return normalizeGoal(goal) === 100
      ? "Seu ranking já está confiável"
      : "Meta atingida — seu ranking já está confiável";
  }
  if (left === 1) {
    return "Falta 1 duelo para o seu ranking ficar confiável";
  }
  return `Faltam ${left} duelos para o seu ranking ficar confiável`;
}

export function celebrationLead(goal) {
  return `Você chegou a ${normalizeGoal(goal)} duelos. Seu ranking já tem uma amostra confiável.`;
}

export function continueLabel(goal) {
  const upcoming = nextGoal(goal);
  return upcoming ? `Nova meta: ${upcoming} duelos` : "Continuar duelos";
}

export function leaderLine(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "O 1º lugar ainda está em disputa.";
  return `No momento, o 1º lugar é ${trimmed}.`;
}

export function shouldCelebrate(duels, goal, celebratedGoal) {
  const target = normalizeGoal(goal);
  const played = Math.max(0, Math.trunc(Number(duels) || 0));
  if (played < target) return false;
  if (isValidGoal(celebratedGoal) && normalizeGoal(celebratedGoal) === target) {
    return false;
  }
  return true;
}

/**
 * Restore (or migrate) the persisted goal.
 * Existing saves without `progressGoal` jump to the next unreached rung
 * and do not replay celebrations for goals already passed.
 */
export function migrateProgress(parsed, duels) {
  const played = Math.max(0, Math.trunc(Number(duels) || 0));
  if (isValidGoal(parsed?.progressGoal)) {
    return {
      progressGoal: normalizeGoal(parsed.progressGoal),
      celebratedGoal: isValidGoal(parsed?.celebratedGoal)
        ? normalizeGoal(parsed.celebratedGoal)
        : null,
    };
  }
  const progressGoal = resolveGoal(played, INITIAL_GOAL);
  return {
    progressGoal,
    celebratedGoal: played >= progressGoal ? progressGoal : null,
  };
}

/** Mark the current goal seen and move 30 → 60 → 100 (stop after 100). */
export function acceptGoal(state) {
  const current = normalizeGoal(state.progressGoal);
  state.celebratedGoal = current;
  const upcoming = nextGoal(current);
  if (upcoming != null) state.progressGoal = upcoming;
  else state.progressGoal = current;
  return state;
}
