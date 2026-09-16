import assert from "node:assert/strict";
import test from "node:test";
import { revokeSessionBeforeClearing } from "./logout.js";

test("logout clears the local session only after server revocation succeeds", async () => {
  const calls = [];
  await revokeSessionBeforeClearing("pms_session", {
    endSession: async (token) => calls.push(["revoke", token]),
    clearLocalSession: () => calls.push(["clear"]),
  });
  assert.deepEqual(calls, [["revoke", "pms_session"], ["clear"]]);
});

test("logout keeps the local session when server revocation fails", async () => {
  let cleared = false;
  await assert.rejects(
    revokeSessionBeforeClearing("pms_session", {
      endSession: async () => { throw new Error("offline"); },
      clearLocalSession: () => { cleared = true; },
    }),
    /offline/,
  );
  assert.equal(cleared, false);
});
