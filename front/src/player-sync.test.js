import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  RECOVERY_KEY_STORAGE,
  applyServerPlayerState,
  initializePlayerSync,
  loadRecoveryKey,
  saveRecoveryKey,
} from "./player-sync.js";

function state(duels = 0) {
  return {
    ratings: { a: 1000 }, wins: { a: duels }, losses: { a: 0 }, zebras: { a: 0 },
    duels, lastDuel: { winnerId: "a" }, achievements: ["kept-local"],
  };
}

test("recovery key storage survives reload and fails closed when blocked", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  assert.equal(saveRecoveryKey("pm1_secret", storage), true);
  assert.equal(values.get(RECOVERY_KEY_STORAGE), "pm1_secret");
  assert.equal(loadRecoveryKey(storage), "pm1_secret");
  assert.equal(loadRecoveryKey({ getItem() { throw new Error("blocked"); } }), "");
});

test("a new anonymous player seeds a non-empty local ranking once", async () => {
  const states = { presidentes: state(3), vices: state(0) };
  const calls = [];
  const result = await initializePlayerSync({
    states,
    recoveryKey: "",
    createRemotePlayer: async () => ({ recoveryKey: "pm1_new" }),
    fetchRemoteState: async (_key, mode) => ({ mode, version: 0, state: state(0) }),
    replaceRemoteState: async (key, mode, version, value) => {
      calls.push({ key, mode, version, value });
      return { mode, version: 1, state: value };
    },
  });

  assert.equal(result.recoveryKey, "pm1_new");
  assert.equal(result.versions.presidentes, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].value.duels, 3);
});

test("recovering a key restores server ranking without dropping local achievements", async () => {
  const local = state(1);
  const states = { presidentes: local };
  await initializePlayerSync({
    states,
    recoveryKey: "pm1_existing",
    createRemotePlayer: async () => { throw new Error("must not create"); },
    fetchRemoteState: async () => ({ version: 7, state: {
      ratings: { a: 1042 }, wins: { a: 4 }, losses: { a: 1 }, zebras: { a: 1 }, duels: 5,
    } }),
    replaceRemoteState: async () => { throw new Error("must not replace"); },
  });

  assert.equal(local.ratings.a, 1042);
  assert.equal(local.duels, 5);
  assert.equal(local.lastDuel, null);
  assert.deepEqual(local.achievements, ["kept-local"]);
});

test("a version conflict rejects initialization instead of overwriting newer data", async () => {
  const conflict = Object.assign(new Error("conflict"), { status: 409 });
  await assert.rejects(initializePlayerSync({
    states: { presidentes: state(2) },
    recoveryKey: "pm1_existing",
    createRemotePlayer: async () => ({ recoveryKey: "unused" }),
    fetchRemoteState: async () => ({ version: 0, state: state(0) }),
    replaceRemoteState: async () => { throw conflict; },
  }), (error) => error.status === 409);
});

test("applying server state mutates the active object so UI references stay valid", () => {
  const local = state(0);
  const returned = applyServerPlayerState(local, state(8));
  assert.equal(returned, local);
  assert.equal(local.duels, 8);
});

test("game exposes recovery UI and versions authenticated votes", () => {
  const game = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  assert.match(game, /id="copy-player-key"/);
  assert.match(game, /id="recover-player-form"/);
  assert.match(game, /playerVersion: playerVersions\[session\.mode\]/);
  assert.match(game, /applyServerPlayerState\(targetState, serverPlayer\.state\)/);
  assert.match(game, /PLAYER_VERSION_CONFLICT/);
});
