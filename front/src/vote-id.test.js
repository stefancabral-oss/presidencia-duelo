import test from "node:test";
import assert from "node:assert/strict";
import { createVoteId } from "./vote-id.js";

test("createVoteId delegates to cryptographic randomUUID", () => {
  const expected = "9ec92a08-c726-4c39-9fff-1e18048b1dc5";
  assert.equal(createVoteId({ randomUUID: () => expected }), expected);
});

test("createVoteId refuses an insecure fallback", () => {
  assert.throws(() => createVoteId({}), /identificador seguro/);
});
