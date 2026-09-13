import test from "node:test";
import assert from "node:assert/strict";
import {
  ApiRequestError,
  createPlayer,
  fetchCandidates,
  fetchPlayerState,
  isUnknownVoteConfirmation,
  normalizeApiBase,
  postVote,
  replacePlayerState,
  requestJson,
} from "./api.js";

test("legacy deployments migrate to the first-party API domain", () => {
  assert.equal(
    normalizeApiBase("https://api-polimatch.e7h3.com/"),
    "https://api.polimatch.com.br",
  );
  assert.equal(normalizeApiBase("https://api.example.com/"), "https://api.example.com");
  assert.equal(normalizeApiBase(""), "");
});

function jsonResponse(data, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => data };
}

test("requestJson returns decoded JSON on success", async () => {
  const data = await requestJson("/api/health", {
    fetchImpl: async () => jsonResponse({ ok: true }),
    timeoutMs: 50,
  });
  assert.deepEqual(data, { ok: true });
});

test("requestJson aborts reads after the configured timeout", async () => {
  const fetchImpl = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });

  await assert.rejects(
    requestJson("/api/health", { fetchImpl, timeoutMs: 5 }),
    (error) => error instanceof ApiRequestError
      && error.kind === "timeout"
      && error.confirmationUnknown === false,
  );
});

test("a transport failure while posting leaves vote confirmation unknown", async () => {
  const error = await postVote("a", "b", "presidentes", {
    voteId: "9ec92a08-c726-4c39-9fff-1e18048b1dc5",
    fetchImpl: async () => { throw new TypeError("network down"); },
    timeoutMs: 50,
  }).catch((caught) => caught);

  assert.equal(error.kind, "network");
  assert.equal(isUnknownVoteConfirmation(error), true);
});

test("an HTTP rejection is a confirmed failure that may be retried", async () => {
  const error = await postVote("a", "b", "presidentes", {
    voteId: "9ec92a08-c726-4c39-9fff-1e18048b1dc5",
    fetchImpl: async () => jsonResponse({}, { ok: false, status: 422 }),
    timeoutMs: 50,
  }).catch((caught) => caught);

  assert.equal(error.kind, "http");
  assert.equal(error.status, 422);
  assert.equal(isUnknownVoteConfirmation(error), false);
});

test("postVote includes the idempotency key in its request body", async () => {
  let sent;
  await postVote("a", "b", "presidentes", {
    voteId: "9ec92a08-c726-4c39-9fff-1e18048b1dc5",
    fetchImpl: async (_url, request) => {
      sent = JSON.parse(request.body);
      return jsonResponse({ ok: true });
    },
  });

  assert.deepEqual(sent, {
    voteId: "9ec92a08-c726-4c39-9fff-1e18048b1dc5",
    winnerId: "a",
    loserId: "b",
    mode: "presidentes",
  });
});

test("candidate validation still rejects an empty response", async () => {
  await assert.rejects(
    fetchCandidates({ fetchImpl: async () => jsonResponse({ candidates: [] }) }),
    (error) => error.kind === "invalid-response",
  );
});

test("player API sends the opaque recovery key only as a bearer credential", async () => {
  const requests = [];
  const fetchImpl = async (url, request) => {
    requests.push({ url, request });
    return jsonResponse(url.endsWith("/api/player")
      ? { recoveryKey: "pm1_created" }
      : { version: 0, state: { duels: 0 } });
  };
  await createPlayer({ fetchImpl });
  await fetchPlayerState("pm1_secret", "presidentes", { fetchImpl });
  await replacePlayerState("pm1_secret", "presidentes", 0, { duels: 0 }, { fetchImpl });

  assert.equal(requests[0].request.method, "POST");
  assert.equal(requests[1].request.headers.Authorization, "Bearer pm1_secret");
  assert.equal(requests[2].request.headers.Authorization, "Bearer pm1_secret");
  assert.deepEqual(JSON.parse(requests[2].request.body), {
    mode: "presidentes", version: 0, state: { duels: 0 },
  });
});

test("authenticated votes carry recovery credential and expected player version", async () => {
  let request;
  await postVote("a", "b", "presidentes", {
    voteId: "9ec92a08-c726-4c39-9fff-1e18048b1dc5",
    recoveryKey: "pm1_secret",
    playerVersion: 8,
    fetchImpl: async (_url, options) => {
      request = options;
      return jsonResponse({ ok: true });
    },
  });
  assert.equal(request.headers.Authorization, "Bearer pm1_secret");
  assert.equal(JSON.parse(request.body).playerVersion, 8);
});
