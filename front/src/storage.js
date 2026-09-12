export const STORAGE_KEY = "presidencia-duelo-v1";
export const STORAGE_UNAVAILABLE_MESSAGE = "ranking não será salvo neste navegador";

/**
 * Persist ranking state. Returns false when the browser blocks or fills storage
 * so the game can keep going in memory.
 */
export function saveState(state, storage, key = STORAGE_KEY) {
  try {
    const store = storage ?? globalThis.localStorage;
    store.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
