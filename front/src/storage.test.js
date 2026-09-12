import assert from "node:assert/strict";
import { test } from "node:test";
import { saveState, STORAGE_KEY } from "./storage.js";

test("saveState writes JSON when setItem works", () => {
  const store = new Map();
  const storage = {
    setItem(key, value) {
      store.set(key, value);
    },
  };
  const state = { duels: 3, lastPair: ["a", "b"] };
  assert.equal(saveState(state, storage), true);
  assert.equal(store.get(STORAGE_KEY), JSON.stringify(state));
});

test("saveState swallows setItem throws and continues in memory", () => {
  const storage = {
    setItem() {
      throw new Error("QuotaExceededError");
    },
  };
  assert.equal(saveState({ duels: 1 }, storage), false);
});

test("saveState does not throw when localStorage is missing", () => {
  assert.equal(saveState({ duels: 0 }, undefined), false);
});
