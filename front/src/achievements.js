/**
 * Badges, combo, and extra achievements (#17).
 *
 * Persist in the same localStorage blob as `achievements: []`, plus
 * `combo` / `lastVoteAt` for the 2 s sequência window.
 *
 * Tournament mode calls `unlockTournamentCompleted` when a champion is chosen.
 */

import { unseenCandidateIds } from "./matchmaking.js";

export const DUEL_THRESHOLDS = [10, 50, 100, 250];
export const COMBO_WINDOW_MS = 2000;
export const COMBO_DISPLAY_MIN = 2;

export const DUELS_10 = "duels-10";
export const DUELS_50 = "duels-50";
export const DUELS_100 = "duels-100";
export const DUELS_250 = "duels-250";
export const PRIMEIRA_ZEBRA = "primeira-zebra";
export const VIU_TODOS = "viu-todos";
export const COMPLETOU_TORNEIO = "completou-torneio";

export const ACHIEVEMENT_IDS = [
  DUELS_10,
  DUELS_50,
  DUELS_100,
  DUELS_250,
  PRIMEIRA_ZEBRA,
  VIU_TODOS,
  COMPLETOU_TORNEIO,
];

export const ACHIEVEMENTS = {
  [DUELS_10]: { id: DUELS_10, title: "10 duelos", toast: "Marco: 10 duelos!" },
  [DUELS_50]: { id: DUELS_50, title: "50 duelos", toast: "Marco: 50 duelos!" },
  [DUELS_100]: { id: DUELS_100, title: "100 duelos", toast: "Marco: 100 duelos!" },
  [DUELS_250]: { id: DUELS_250, title: "250 duelos", toast: "Marco: 250 duelos!" },
  [PRIMEIRA_ZEBRA]: {
    id: PRIMEIRA_ZEBRA,
    title: "Primeira zebra",
    toast: "Conquista: Primeira zebra!",
  },
  [VIU_TODOS]: {
    id: VIU_TODOS,
    title: "Viu todos os candidatos",
    toast: "Conquista: Viu todos os candidatos!",
  },
  [COMPLETOU_TORNEIO]: {
    id: COMPLETOU_TORNEIO,
    title: "Completou um torneio",
    toast: "Conquista: Completou um torneio!",
  },
};

export function duelAchievementId(threshold) {
  return `duels-${threshold}`;
}

export function isKnownAchievement(id) {
  return Object.hasOwn(ACHIEVEMENTS, id);
}

export function achievementTitle(id) {
  return ACHIEVEMENTS[id]?.title || "";
}

export function achievementToastText(id) {
  return ACHIEVEMENTS[id]?.toast || "";
}

export function normalizeAchievements(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    if (typeof item !== "string" || !isKnownAchievement(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function normalizeCombo(value) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function normalizeTimestamp(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function hasAnyZebra(zebras) {
  if (!zebras || typeof zebras !== "object") return false;
  return Object.values(zebras).some((n) => Math.trunc(Number(n) || 0) > 0);
}

export function hasSeenAllCandidates(candidateIds, pairCount) {
  const ids = Array.isArray(candidateIds) ? candidateIds.filter(Boolean) : [];
  if (ids.length < 2) return false;
  return unseenCandidateIds(ids, pairCount).length === 0;
}

/**
 * Detect tournament completion from persisted compatibility flags.
 */
export function isTournamentCompleted(state) {
  if (!state || typeof state !== "object") return false;
  if (state.tournamentCompleted === true) return true;
  if (typeof state.tournamentWinner === "string" && state.tournamentWinner) return true;
  const t = state.tournament;
  if (!t || typeof t !== "object") return false;
  if (t.completed === true) return true;
  if (typeof t.winner === "string" && t.winner) return true;
  return false;
}

export function dueDuelMilestones(duels) {
  const played = Math.max(0, Math.trunc(Number(duels) || 0));
  return DUEL_THRESHOLDS.filter((n) => played >= n).map(duelAchievementId);
}

export function earnedAchievementIds({
  duels,
  zebras,
  pairCount,
  candidateIds,
  tournamentState,
} = {}) {
  const ids = dueDuelMilestones(duels);
  if (hasAnyZebra(zebras)) ids.push(PRIMEIRA_ZEBRA);
  if (hasSeenAllCandidates(candidateIds, pairCount)) ids.push(VIU_TODOS);
  if (isTournamentCompleted(tournamentState)) ids.push(COMPLETOU_TORNEIO);
  return ids;
}

/** Idempotent: returns true only the first time `id` is stored. */
export function unlockAchievement(state, id) {
  if (!state || typeof state !== "object" || !isKnownAchievement(id)) return false;
  const list = normalizeAchievements(state.achievements);
  if (list.includes(id)) {
    state.achievements = list;
    return false;
  }
  list.push(id);
  state.achievements = list;
  return true;
}

/** Public hook for #15: unlock "Completou um torneio" once a bracket ends. */
export function unlockTournamentCompleted(state) {
  return unlockAchievement(state, COMPLETOU_TORNEIO);
}

export function unlockDueAchievements(state, { candidateIds } = {}) {
  if (!state || typeof state !== "object") return [];
  const newly = [];
  for (const id of earnedAchievementIds({
    duels: state.duels,
    zebras: state.zebras,
    pairCount: state.pairCount,
    candidateIds,
    tournamentState: state,
  })) {
    if (unlockAchievement(state, id)) newly.push(id);
  }
  return newly;
}

/**
 * Restore (or migrate) achievements from a persisted blob.
 * Legacy saves without `achievements` get due badges from current
 * duels / zebras / pair coverage, without replaying toasts.
 */
export function migrateAchievements(parsed, context = {}) {
  const achievements = normalizeAchievements(parsed?.achievements);
  const due = earnedAchievementIds({
    duels: context.duels ?? parsed?.duels,
    zebras: context.zebras ?? parsed?.zebras,
    pairCount: context.pairCount ?? parsed?.pairCount,
    candidateIds: context.candidateIds,
    tournamentState: parsed,
  });
  for (const id of due) {
    if (!achievements.includes(id)) achievements.push(id);
  }
  return {
    achievements,
    combo: normalizeCombo(parsed?.combo),
    lastVoteAt: normalizeTimestamp(parsed?.lastVoteAt),
  };
}

export function comboLabel(combo) {
  const n = Math.max(0, Math.trunc(Number(combo) || 0));
  if (n < COMBO_DISPLAY_MIN) return "";
  return `x${n} combo`;
}

export function liveCombo(combo, lastVoteAt, now = Date.now()) {
  const n = normalizeCombo(combo);
  const last = normalizeTimestamp(lastVoteAt);
  if (n < COMBO_DISPLAY_MIN || last == null) return 0;
  if (now - last > COMBO_WINDOW_MS) return 0;
  return n;
}

export function applyCombo(state, now = Date.now()) {
  const prev = normalizeCombo(state.combo);
  const last = normalizeTimestamp(state.lastVoteAt);
  const next = last != null && now - last <= COMBO_WINDOW_MS ? prev + 1 : 1;
  state.combo = next;
  state.lastVoteAt = now;
  return next;
}
