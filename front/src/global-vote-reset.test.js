import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GLOBAL_VOTE_RESET_ID,
  GLOBAL_VOTE_RESET_MARKER,
  resetGlobalVoteDataOnce,
} from "./global-vote-reset.js";
import { RECOVERY_KEY_STORAGE } from "./player-sync.js";
import { STORAGE_KEY } from "./storage.js";
import { TOURNAMENT_STORAGE_KEY } from "./tournament.js";
import { VICE_STORAGE_KEY } from "./vice-mode.js";

function memoryStorage(entries) {
  const values = new Map(entries);
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
    values,
  };
}

test("global reset removes vote data once and preserves preferences", () => {
  const storage = memoryStorage([
    [STORAGE_KEY, "president votes"],
    [VICE_STORAGE_KEY, "vice votes"],
    [RECOVERY_KEY_STORAGE, "pm1_old"],
    [`${TOURNAMENT_STORAGE_KEY}-politica`, "bracket"],
    ["presidencia-duelo-topic-v1", "economia"],
    ["polimatch-sound-enabled-v1", "0"],
  ]);

  assert.equal(resetGlobalVoteDataOnce(storage), true);
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(storage.getItem(VICE_STORAGE_KEY), null);
  assert.equal(storage.getItem(RECOVERY_KEY_STORAGE), null);
  assert.equal(storage.getItem(`${TOURNAMENT_STORAGE_KEY}-politica`), null);
  assert.equal(storage.getItem("presidencia-duelo-topic-v1"), "economia");
  assert.equal(storage.getItem("polimatch-sound-enabled-v1"), "0");
  assert.equal(storage.getItem(GLOBAL_VOTE_RESET_MARKER), GLOBAL_VOTE_RESET_ID);
  storage.setItem(STORAGE_KEY, "new votes");
  assert.equal(resetGlobalVoteDataOnce(storage), false);
  assert.equal(storage.getItem(STORAGE_KEY), "new votes");
});

test("global reset fails closed when browser storage is unavailable", () => {
  assert.equal(resetGlobalVoteDataOnce({ getItem() { throw new Error("blocked"); } }), false);
});
