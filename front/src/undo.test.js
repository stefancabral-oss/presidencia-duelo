import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { applyElo, emptyStats } from "../../shared/elo.js";
import { saveState, STORAGE_KEY } from "./storage.js";
import {
  isUndoSnapshot,
  lastDuelFromParsed,
  restoreDuel,
  snapshotDuel,
  undoPair,
} from "./undo.js";

const gameSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "game.js"), "utf8");

function duelState(overrides = {}) {
  const state = emptyStats(["a", "b", "c"]);
  state.ratings.a = 1000;
  state.ratings.b = 1000;
  state.ratings.c = 1111;
  state.wins.c = 7;
  state.losses.c = 2;
  state.zebras.c = 4;
  state.duels = 9;
  return Object.assign(state, overrides);
}

test("isUndoSnapshot requires two distinct ids and finite ratingsBefore", () => {
  assert.equal(isUndoSnapshot(null), false);
  assert.equal(isUndoSnapshot({}), false);
  assert.equal(isUndoSnapshot({ winnerId: "a", loserId: "a", ratingsBefore: { a: 1 } }), false);
  assert.equal(isUndoSnapshot({ winnerId: "a", loserId: "b", ratingsBefore: { a: 1000 } }), false);
  assert.equal(
    isUndoSnapshot({ winnerId: "a", loserId: "b", ratingsBefore: { a: Number.NaN, b: 1000 } }),
    false,
  );
  assert.equal(
    isUndoSnapshot({ winnerId: "a", loserId: "b", ratingsBefore: { a: 1000, b: 1000 } }),
    true,
  );
});

test("lastDuelFromParsed keeps a valid snapshot and drops junk", () => {
  const snap = snapshotDuel(duelState(), "a", "b", ["a", "b"]);
  assert.deepEqual(lastDuelFromParsed({ lastDuel: snap }), snap);
  assert.equal(lastDuelFromParsed({ lastDuel: { winnerId: "a" } }), null);
  assert.equal(lastDuelFromParsed({}), null);
  assert.equal(lastDuelFromParsed(undefined), null);
});

test("snapshotDuel copies primitives so applyElo cannot mutate the snapshot", () => {
  const state = duelState();
  state.ratings.b = 1050;
  const snap = snapshotDuel(state, "a", "b", ["b", "a"]);
  assert.deepEqual(snap.ratingsBefore, { a: 1000, b: 1050 });
  assert.deepEqual(snap.winsBefore, { a: 0, b: 0 });
  assert.deepEqual(snap.lossesBefore, { a: 0, b: 0 });
  assert.deepEqual(snap.zebrasBefore, { a: 0, b: 0 });
  assert.equal(snap.duelsBefore, 9);
  assert.deepEqual(snap.pair, ["b", "a"]);

  applyElo(state, "a", "b");
  assert.equal(snap.ratingsBefore.a, 1000);
  assert.equal(snap.ratingsBefore.b, 1050);
  assert.equal(snap.zebrasBefore.a, 0);
  assert.equal(snap.duelsBefore, 9);
});

test("restoreDuel after an equal-Elo pick reverts ratings, W/L, zebras, and duels", () => {
  const state = duelState();
  const snap = snapshotDuel(state, "a", "b", ["a", "b"]);
  applyElo(state, "a", "b");
  assert.equal(state.ratings.a, 1016);
  assert.equal(state.ratings.b, 984);
  assert.equal(state.wins.a, 1);
  assert.equal(state.losses.b, 1);
  assert.equal(state.duels, 10);
  assert.equal(state.zebras.a, 0);

  assert.equal(restoreDuel(state, snap), true);
  assert.equal(state.ratings.a, 1000);
  assert.equal(state.ratings.b, 1000);
  assert.equal(state.wins.a, 0);
  assert.equal(state.wins.b, 0);
  assert.equal(state.losses.a, 0);
  assert.equal(state.losses.b, 0);
  assert.equal(state.zebras.a, 0);
  assert.equal(state.zebras.b, 0);
  assert.equal(state.duels, 9);
  assert.equal(state.ratings.c, 1111);
  assert.equal(state.wins.c, 7);
  assert.equal(state.zebras.c, 4);
});

test("restoreDuel reverts a zebra count after an underdog win", () => {
  const state = duelState();
  state.ratings.a = 1000;
  state.ratings.b = 1100;
  state.zebras.a = 2;
  const snap = snapshotDuel(state, "a", "b", ["a", "b"]);
  const result = applyElo(state, "a", "b");
  assert.equal(result.zebra, true);
  assert.equal(state.zebras.a, 3);
  assert.ok(state.duels > snap.duelsBefore);

  assert.equal(restoreDuel(state, snap), true);
  assert.equal(state.ratings.a, 1000);
  assert.equal(state.ratings.b, 1100);
  assert.equal(state.wins.a, 0);
  assert.equal(state.losses.b, 0);
  assert.equal(state.zebras.a, 2);
  assert.equal(state.duels, 9);
});

test("restoreDuel still works when state.zebras was missing after the pick", () => {
  const state = duelState();
  state.ratings.a = 980;
  state.ratings.b = 1040;
  const snap = snapshotDuel(state, "a", "b", ["a", "b"]);
  applyElo(state, "a", "b");
  delete state.zebras;
  assert.equal(restoreDuel(state, snap), true);
  assert.equal(state.zebras.a, 0);
  assert.equal(state.zebras.b, 0);
});

test("one-level undo restores only the last snapshot, not an earlier pick", () => {
  const state = duelState();
  state.duels = 0;
  applyElo(state, "a", "b");
  const second = snapshotDuel(state, "a", "c", ["a", "c"]);
  applyElo(state, "a", "c");
  assert.equal(state.wins.a, 2);
  assert.equal(state.duels, 2);

  assert.equal(restoreDuel(state, second), true);
  assert.equal(state.wins.a, 1);
  assert.equal(state.losses.c, 2);
  assert.equal(state.duels, 1);
  assert.equal(state.ratings.b, 984);
  assert.equal(state.losses.b, 1);
});

test("restoreDuel leaves pairCount unchanged (show history, not vote history)", () => {
  const state = duelState();
  state.pairCount = { "a|b": 2, "a|c": 1 };
  const snap = snapshotDuel(state, "a", "b", ["a", "b"]);
  applyElo(state, "a", "b");
  assert.equal(restoreDuel(state, snap), true);
  assert.deepEqual(state.pairCount, { "a|b": 2, "a|c": 1 });
});

test("restoreDuel returns false and leaves state alone for a bad snapshot", () => {
  const state = duelState();
  applyElo(state, "a", "b");
  const before = structuredClone(state);
  assert.equal(restoreDuel(state, { winnerId: "a" }), false);
  assert.deepEqual(state, before);
});

test("undoPair prefers the stored pair and falls back to winner/loser", () => {
  const snap = snapshotDuel(duelState(), "a", "b", ["b", "a"]);
  assert.deepEqual(undoPair(snap), ["b", "a"]);
  delete snap.pair;
  assert.deepEqual(undoPair(snap), ["a", "b"]);
  assert.equal(undoPair(null), null);
});

test("saveState persists lastDuel with the rest of ranking state", () => {
  const state = duelState();
  state.lastDuel = snapshotDuel(state, "a", "b", ["a", "b"]);
  const store = new Map();
  assert.equal(
    saveState(state, {
      setItem(key, value) {
        store.set(key, value);
      },
    }),
    true,
  );
  const parsed = JSON.parse(store.get(STORAGE_KEY));
  assert.deepEqual(lastDuelFromParsed(parsed), state.lastDuel);
  assert.equal(parsed.duels, 9);
});

test("game wires Desfazer below the cards and undoes lastDuel locally", () => {
  assert.match(gameSrc, /id="undo-duel"/);
  assert.match(gameSrc, />Desfazer</);
  assert.match(gameSrc, /disabled/);
  assert.match(gameSrc, /snapshotDuel\(targetState, winnerId, loserId, pair\)/);
  assert.match(gameSrc, /restoreDuel\(state, snap\)/);
  assert.match(gameSrc, /state\.lastDuel = null/);
  assert.match(gameSrc, /clearTimeout\(pickTimer\)/);
  assert.match(gameSrc, /clearPickFeedback/);
  assert.doesNotMatch(gameSrc, /postUndo|deleteVote|\/api\/undo/);
});
