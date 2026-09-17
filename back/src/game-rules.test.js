import test from "node:test";
import assert from "node:assert/strict";
import { FINISHES, nextFinish, uncertainPair } from "./game-rules.js";

test("finishes are universal, equally acquired and never purchasable", () => {
  assert.equal(new Set(FINISHES.map(item => item.id)).size, 12);
  assert.ok(FINISHES.every(item => item.acquisitionClass === "daily" && item.purchasable === false && !item.candidateId));
  const first = nextFinish([], "player:edition");
  assert.deepEqual(nextFinish([], "player:edition"), first);
  assert.notEqual(nextFinish([first.id], "player:edition").id, first.id);
  assert.equal(nextFinish(FINISHES.map(item => item.id), "seed"), null);
});
test("tiebreak serves the most uncertain missing pair, not a random or already resolved pair", () => {
  const votes = [{ winnerId: "a", loserId: "b" }, { winnerId: "a", loserId: "c" }, { winnerId: "c", loserId: "a" }];
  assert.deepEqual(uncertainPair(["a", "b", "c"], votes).pair.candidateIds, ["b", "c"]);
  assert.equal(uncertainPair(["a", "b", "c"], votes).remaining, 18);
  assert.ok(uncertainPair(["b", "a"], [{ winnerId: "a", loserId: "b" }]).pair);
  const balanced = Array.from({ length: 200 }, (_, index) => ({ winnerId: index % 2 ? "a" : "b", loserId: index % 2 ? "b" : "a" }));
  assert.deepEqual(uncertainPair(["b", "a"], balanced), { pair: null, remaining: 0 });
  for (let a = 0; a <= 7; a++) {
    const measured = Array.from({ length: 7 }, (_, index) => ({ winnerId: index < a ? "a" : "b", loserId: index < a ? "b" : "a" }));
    assert.equal(uncertainPair(["a", "b"], measured).remaining, 0);
  }
});
