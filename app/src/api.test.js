import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, loadDailyPredictionResults, requestJson, submitDailyPrediction, submitDailyVote } from "./api.js";

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

test("daily vote requests never send a client candidate list", async () => {
  let request;
  await withFetch(
    async (_url, options) => {
      request = options;
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
    async () => submitDailyVote(
      "550e8400-e29b-41d4-a716-446655440000",
      "edition-1",
      4,
      "lula",
      "eleicoes-2026",
      { recoveryKey: "pm2_player", version: 3 },
    ),
  );
  assert.deepEqual(JSON.parse(request.body), {
    answerId: "550e8400-e29b-41d4-a716-446655440000",
    editionId: "edition-1",
    slot: 4,
    winnerId: "lula",
    topicId: "eleicoes-2026",
    playerVersion: 3,
    predictionContractVersion: 1,
  });
});

test("daily predictions have a separate idempotent contract and explicit skip", async () => {
  const requests = [];
  const predictionId = "650e8400-e29b-41d4-a716-446655440000";
  await withFetch(
    async (_url, options) => {
      requests.push({ url: _url, options, body: JSON.parse(options.body) });
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    },
    async () => {
      await submitDailyPrediction(predictionId, "edition-1", 2, "candidate-8", "eleicoes-2026", {
        recoveryKey: "pm2_private",
      });
      await submitDailyPrediction(predictionId, "edition-1", 2, null, "eleicoes-2026", {
        recoveryKey: "pm2_private",
      });
    },
  );
  assert.deepEqual(requests.map(({ body }) => body), [{
    predictionId,
    editionId: "edition-1",
    slot: 2,
    decision: "predict",
    candidateId: "candidate-8",
    topicId: "eleicoes-2026",
  }, {
    predictionId,
    editionId: "edition-1",
    slot: 2,
    decision: "skip",
    candidateId: null,
    topicId: "eleicoes-2026",
  }]);
  assert.ok(requests.every(({ options }) => options.headers.Authorization === "Bearer pm2_private"));
});

test("prediction results are loaded only in the player's bearer scope", async () => {
  let request;
  await withFetch(
    async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, json: async () => ({ baselinePercent: 25, score: {}, sessions: [] }) };
    },
    async () => loadDailyPredictionResults("pm2_private", "eleicoes-2026"),
  );
  assert.match(request.url, /daily-prediction-results/);
  assert.equal(request.options.headers.Authorization, "Bearer pm2_private");
});
