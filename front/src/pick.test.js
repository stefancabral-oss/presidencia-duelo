import assert from "node:assert/strict";
import { test } from "node:test";
import { runLockedPick } from "./pick.js";

test("runLockedPick schedules onDone after a successful pick", () => {
  const calls = [];
  const timer = runLockedPick(
    () => calls.push("work"),
    () => calls.push("done"),
    (fn) => {
      fn();
      return 77;
    },
    0,
  );
  assert.deepEqual(calls, ["work", "done"]);
  assert.equal(timer, 77);
});

test("runLockedPick still unlocks when work throws (save/DOM failure)", () => {
  let unlocked = false;
  assert.throws(
    () =>
      runLockedPick(
        () => {
          throw new Error("setItem blocked");
        },
        () => {
          unlocked = true;
        },
        (fn) => fn(),
        0,
      ),
    /setItem blocked/,
  );
  assert.equal(unlocked, true);
});

test("runLockedPick schedules onDone even if work throws before unlock", () => {
  const scheduled = [];
  const schedule = (fn, delay) => scheduled.push({ fn, delay });
  assert.throws(
    () =>
      runLockedPick(
        () => {
          throw new Error("boom");
        },
        () => {},
        schedule,
        420,
      ),
    /boom/,
  );
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delay, 420);
});
