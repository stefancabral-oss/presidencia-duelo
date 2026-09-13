import assert from "node:assert/strict";
import { test } from "node:test";
import { createTournamentPickLock } from "./tournament-pick-lock.js";

function cards() {
  return [{ disabled: false }, { disabled: false }];
}

test("concurrent clicks on either card commit only one match", () => {
  const queued = [];
  const lock = createTournamentPickLock({ schedule: (callback) => queued.push(callback) });
  const pair = cards();
  let commits = 0;
  const action = {
    cards: pair,
    commit: () => { commits += 1; return true; },
    render: () => {},
  };

  assert.equal(lock.run(action), true);
  assert.equal(lock.run(action), false);
  assert.equal(commits, 1);
  assert.deepEqual(pair.map((card) => card.disabled), [true, true]);
  queued[0]();
  assert.deepEqual(pair.map((card) => card.disabled), [false, false]);
});

test("render failure still releases both tournament cards", () => {
  const queued = [];
  const lock = createTournamentPickLock({ schedule: (callback) => queued.push(callback) });
  const pair = cards();
  lock.run({ cards: pair, commit: () => true, render: () => { throw new Error("render"); } });

  assert.throws(() => queued[0](), /render/);
  assert.equal(lock.locked, false);
  assert.deepEqual(pair.map((card) => card.disabled), [false, false]);
});

test("rejected picks unlock immediately", () => {
  const pair = cards();
  const lock = createTournamentPickLock();
  assert.equal(lock.run({ cards: pair, commit: () => false, render: () => {} }), false);
  assert.equal(lock.locked, false);
  assert.deepEqual(pair.map((card) => card.disabled), [false, false]);
});
