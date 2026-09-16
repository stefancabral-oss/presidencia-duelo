import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, requestJson } from "./api.js";

async function withFetch(fakeFetch, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch;
  try {
    await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("requestJson accepts a successful 204 without trying to parse JSON", async () => {
  await withFetch(
    async () => ({
      ok: true,
      status: 204,
      json: async () => { throw new Error("204 não tem corpo"); },
    }),
    async () => assert.equal(await requestJson("/api/auth/logout"), null),
  );
});

test("requestJson preserves HTTP status, code and body", async () => {
  const body = { error: "ranking desatualizado", code: "PLAYER_VERSION_CONFLICT", current: 0 };
  await withFetch(
    async () => ({ ok: false, status: 409, json: async () => body }),
    async () => assert.rejects(
      requestJson("/api/round-vote"),
      (error) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "PLAYER_VERSION_CONFLICT");
        assert.deepEqual(error.body, body);
        assert.equal(error.unreachable, false);
        return true;
      },
    ),
  );
});

test("requestJson preserves the 429 retry delay from body or header", async () => {
  await withFetch(
    async () => ({
      ok: false,
      status: 429,
      headers: { get: () => "120" },
      json: async () => ({ error: "limite", code: "VOTE_RATE_LIMITED", retryAfterSeconds: 60 }),
    }),
    async () => assert.rejects(requestJson("/api/round-vote"), (error) => {
      assert.equal(error.retryAfterSeconds, 60);
      return true;
    }),
  );
  await withFetch(
    async () => ({ ok: false, status: 429, headers: { get: () => "120" }, json: async () => ({ error: "limite" }) }),
    async () => assert.rejects(requestJson("/api/round-vote"), (error) => {
      assert.equal(error.retryAfterSeconds, 120);
      return true;
    }),
  );
});

test("requestJson distinguishes malformed success payloads from network failures", async () => {
  await withFetch(
    async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("JSON inválido"); } }),
    async () => assert.rejects(
      requestJson("/api/ranking"),
      (error) => {
        assert.equal(error.status, 200);
        assert.equal(error.code, "BAD_PAYLOAD");
        assert.equal(error.unreachable, false);
        return true;
      },
    ),
  );

  await withFetch(
    async () => { throw new TypeError("fetch failed"); },
    async () => assert.rejects(
      requestJson("/api/ranking"),
      (error) => {
        assert.equal(error.status, 0);
        assert.equal(error.code, "NETWORK");
        assert.equal(error.unreachable, true);
        return true;
      },
    ),
  );
});

test("an aborted response body remains a timeout, not BAD_PAYLOAD", async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  globalThis.setTimeout = (callback) => {
    callback();
    return 1;
  };
  globalThis.clearTimeout = () => {};
  globalThis.fetch = async (_url, { signal }) => ({
    ok: true,
    status: 200,
    json: async () => { throw signal.reason || new DOMException("aborted", "AbortError"); },
  });

  try {
    await assert.rejects(
      requestJson("/api/round-vote"),
      (error) => {
        assert.equal(error.status, 0);
        assert.equal(error.code, "TIMEOUT");
        assert.equal(error.unreachable, true);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});
