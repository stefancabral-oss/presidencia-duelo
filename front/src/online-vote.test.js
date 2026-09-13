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
  assert.deepEqual(response, { response: { ok: true }, applied: true });
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

test("a controlled late response does not apply to an invalidated session", async () => {
  let resolveRemote;
  let current = true;
  let localUpdates = 0;
  const remote = new Promise((resolve) => { resolveRemote = resolve; });
  const pending = commitOnlineVote(
    () => remote,
    () => { localUpdates += 1; },
    () => current,
  );

  current = false;
  resolveRemote({ vote: { id: "persisted-on-server" } });
  const result = await pending;

  assert.equal(localUpdates, 0);
  assert.equal(result.applied, false);
  assert.equal(result.response.vote.id, "persisted-on-server");
});
