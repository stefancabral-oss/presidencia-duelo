import assert from "node:assert/strict";
import test from "node:test";
import { createPressGesture } from "./press-gesture.js";

function fakeClock() {
  let callback = null;
  return {
    setTimer(fn) { callback = fn; return 1; },
    clearTimer() { callback = null; },
    fire() { callback?.(); callback = null; },
  };
}

test("a quick press remains a vote", () => {
  const calls = [];
  const clock = fakeClock();
  const gesture = createPressGesture({ onTap: () => calls.push("tap"), onHold: () => calls.push("hold"), setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  gesture.pointerDown({ clientX: 0, clientY: 0, button: 0 });
  gesture.pointerEnd();
  assert.equal(gesture.click({}), "tap");
  assert.deepEqual(calls, ["tap"]);
});

test("holding opens information and suppresses the following vote", () => {
  const calls = [];
  const clock = fakeClock();
  const gesture = createPressGesture({ onTap: () => calls.push("tap"), onHold: () => calls.push("hold"), setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  gesture.pointerDown({ clientX: 0, clientY: 0, button: 0 });
  clock.fire();
  gesture.pointerEnd();
  assert.equal(gesture.click({ detail: 1 }), "hold");
  assert.deepEqual(calls, ["hold"]);
});

test("keyboard activation after a held modal closes is a vote", () => {
  const calls = [];
  const clock = fakeClock();
  const gesture = createPressGesture({ onTap: () => calls.push("tap"), onHold: () => calls.push("hold"), setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  gesture.pointerDown({ clientX: 0, clientY: 0, button: 0 });
  clock.fire();
  gesture.pointerEnd();

  assert.equal(gesture.click({ detail: 0 }), "tap");
  assert.deepEqual(calls, ["hold", "tap"]);
});

test("scrolling cancels a pending hold", () => {
  const calls = [];
  const clock = fakeClock();
  const gesture = createPressGesture({ onHold: () => calls.push("hold"), setTimer: clock.setTimer, clearTimer: clock.clearTimer });
  gesture.pointerDown({ clientX: 0, clientY: 0, button: 0 });
  gesture.pointerMove({ clientX: 30, clientY: 0 });
  clock.fire();
  assert.deepEqual(calls, []);
});
