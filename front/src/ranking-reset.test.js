import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { commitPersonalReset } from "./ranking-reset.js";

test("personal reset updates remote state before clearing the screen", async () => {
  const calls = [];
  const clearedState = { duels: 0 };
  const remote = await commitPersonalReset({
    clearedState,
    resetRemote: async (value) => {
      calls.push(["remote", value]);
      return { version: 4 };
    },
    applyLocal: (value, result) => calls.push(["local", value, result]),
  });
  assert.deepEqual(calls, [
    ["remote", clearedState],
    ["local", clearedState, { version: 4 }],
  ]);
  assert.deepEqual(remote, { version: 4 });
});

test("failed remote reset leaves local ranking untouched", async () => {
  let localCalls = 0;
  await assert.rejects(commitPersonalReset({
    clearedState: { duels: 0 },
    resetRemote: async () => { throw new Error("conflict"); },
    applyLocal: () => { localCalls += 1; },
  }), /conflict/);
  assert.equal(localCalls, 0);
});

test("reset dialog is explicit, cancel is inert, and success rerenders without reload", () => {
  const game = readFileSync(new URL("./game.js", import.meta.url), "utf8");
  assert.match(game, />Zerar meu ranking</);
  assert.match(game, /O ranking geral de todos não será alterado/);
  assert.match(game, /resetCancel\.addEventListener\("click", closeResetDialog\)/);
  assert.doesNotMatch(game, /resetCancel\.addEventListener\([^\n]*resetPersonalRanking/);
  assert.match(game, /duelGeneration \+= 1/);
  assert.match(game, /renderRanking\(\);[\s\S]*renderAchievements\(\);[\s\S]*renderCombo\(\);/);
  const resetFunction = game.match(/async function resetPersonalRanking\(\) \{[\s\S]*?\n  \}/)?.[0] || "";
  assert.doesNotMatch(resetFunction, /location\.reload\(\)/);
});
