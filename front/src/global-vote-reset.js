import { RECOVERY_KEY_STORAGE } from "./player-sync.js";
import { STORAGE_KEY } from "./storage.js";
import { TOURNAMENT_STORAGE_KEY } from "./tournament.js";
import { VICE_STORAGE_KEY } from "./vice-mode.js";

export const GLOBAL_VOTE_RESET_ID = "2026-09-13-all-votes-v1";
export const GLOBAL_VOTE_RESET_MARKER = "polimatch-global-vote-reset-v1";

export function resetGlobalVoteDataOnce(storage = globalThis.localStorage) {
  try {
    if (storage.getItem(GLOBAL_VOTE_RESET_MARKER) === GLOBAL_VOTE_RESET_ID) return false;
    const keys = [STORAGE_KEY, VICE_STORAGE_KEY, RECOVERY_KEY_STORAGE];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(`${TOURNAMENT_STORAGE_KEY}-`)) keys.push(key);
    }
    for (const key of new Set(keys)) storage.removeItem(key);
    storage.setItem(GLOBAL_VOTE_RESET_MARKER, GLOBAL_VOTE_RESET_ID);
    return true;
  } catch {
    return false;
  }
}
