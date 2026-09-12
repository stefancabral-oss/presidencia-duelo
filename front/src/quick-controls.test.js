import assert from "node:assert/strict";
import { test } from "node:test";
import {
  QUICK_CONTROLS_HINT_KEY,
  hasSeenQuickControlsHint,
  keyboardPickSide,
  markQuickControlsHintSeen,
  swipePickSide,
} from "./quick-controls.js";

test("arrow keys map to the matching duel-card side", () => {
  assert.equal(keyboardPickSide({ key: "ArrowLeft", target: {} }), "left");
  assert.equal(keyboardPickSide({ key: "ArrowRight", target: {} }), "right");
  assert.equal(keyboardPickSide({ key: "Enter", target: {} }), null);
});

test("arrow shortcuts are ignored while typing", () => {
  assert.equal(keyboardPickSide({ key: "ArrowLeft", target: { tagName: "input" } }), null);
  assert.equal(keyboardPickSide({ key: "ArrowRight", target: { isContentEditable: true } }), null);
});

test("horizontal swipe requires 60px and maps direction to card side", () => {
  assert.equal(swipePickSide(100, 41), null);
  assert.equal(swipePickSide(100, 40), "left");
  assert.equal(swipePickSide(100, 160), "right");
  assert.equal(swipePickSide(100, 100), null);
});

test("first-visit hint is persisted without breaking when storage is blocked", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  assert.equal(hasSeenQuickControlsHint(storage), false);
  assert.equal(markQuickControlsHintSeen(storage), true);
  assert.equal(values.get(QUICK_CONTROLS_HINT_KEY), "1");
  assert.equal(hasSeenQuickControlsHint(storage), true);
  assert.equal(markQuickControlsHintSeen({ setItem() { throw new Error("blocked"); } }), false);
});
