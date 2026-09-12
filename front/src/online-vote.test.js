import assert from "node:assert/strict";
import { test } from "node:test";
import { commitOnlineVote } from "./online-vote.js";

test("online vote updates local statistics only after the server succeeds", async () => {
  const calls = [];
  const response = await commitOnlineVote(
    async () => {
      calls.push("remote");
      return { ok: true };
    },
    () => calls.push("local"),
  );
  assert.deepEqual(calls, ["remote", "local"]);
  assert.deepEqual(response, { ok: true });
});

test("online vote leaves local statistics untouched when the server fails", async () => {
  let localUpdates = 0;
  await assert.rejects(
    commitOnlineVote(
      async () => { throw new Error("offline"); },
      () => { localUpdates += 1; },
    ),
    /offline/,
  );
  assert.equal(localUpdates, 0);
});
