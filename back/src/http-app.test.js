import assert from "node:assert/strict";
import test from "node:test";
import { authorizedAggregatePublication } from "../test-support/aggregate-publication-fixtures.js";
import { createHttpApp, configuredAppOrigins, isAllowedBrowserOrigin, networkPseudonym, normalizedNetworkIdentity } from "./http-app.js";
import { createEditorialTestRegistry } from "../test-support/editorial-fixtures.js";

function fakeStore(overrides = {}) {
  return {
    health: async () => {},
    ranking: async () => ({ ranking: [] }),
    createPlayer: async () => ({ recoveryKey: "pm2_test" }),
    playerRanking: async () => ({ ranking: [] }),
    dailySession: async () => ({ status: "active" }),
    dailyCut: async () => ({ status: "published" }),
    dailyVote: async () => ({ ok: true }),
    dailyPrediction: async () => ({ ok: true }),
    dailyPredictionResults: async () => ({ score: {}, sessions: [] }),
    signInWithGoogle: async () => ({}),
    signOut: async () => {},
    roundVote: async () => ({ ok: true }),
    ...overrides,
  };
}

const googleIdentity = { configured: false, verify: async () => ({ subject: "test" }) };

async function withServer(app, run) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("browser origins are exact in production and loopback-only in development", () => {
  const origins = configuredAppOrigins("https://polimatch.com.br,https://preview.example");
  assert.equal(isAllowedBrowserOrigin("https://polimatch.com.br", origins, { production: true }), true);
  assert.equal(isAllowedBrowserOrigin("https://evil.example", origins, { production: true }), false);
  assert.equal(isAllowedBrowserOrigin("http://localhost:5174", origins, { production: false }), true);
  assert.equal(isAllowedBrowserOrigin("http://localhost:5174", origins, { production: true }), false);
  assert.equal(isAllowedBrowserOrigin(undefined, origins, { production: true }), true);
});

test("the production default allows only the canonical apex origin", () => {
  const origins = configuredAppOrigins();
  assert.deepEqual([...origins], ["https://polimatch.com.br"]);
  assert.equal(isAllowedBrowserOrigin("https://www.polimatch.com.br", origins, { production: true }), false);
});

test("network pseudonyms are stable hashes and do not expose the address", () => {
  const first = networkPseudonym("::ffff:203.0.113.9", "a-test-secret-with-enough-entropy");
  const repeated = networkPseudonym("203.0.113.9", "a-test-secret-with-enough-entropy");
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, repeated);
  assert.equal(first.includes("203.0.113.9"), false);
});

test("IPv6 privacy addresses share a /64 issuance identity and invalid values cannot mint identities", () => {
  assert.equal(normalizedNetworkIdentity("2001:db8:abcd:12::1"), "ipv6:2001:0db8:abcd:0012::/64");
  assert.equal(
    networkPseudonym("2001:db8:abcd:12::1", "a-test-secret-with-enough-entropy"),
    networkPseudonym("2001:db8:abcd:12:ffff:eeee:dddd:cccc", "a-test-secret-with-enough-entropy"),
  );
  assert.notEqual(
    networkPseudonym("2001:db8:abcd:12::1", "a-test-secret-with-enough-entropy"),
    networkPseudonym("2001:db8:abcd:13::1", "a-test-secret-with-enough-entropy"),
  );
  assert.equal(normalizedNetworkIdentity("attacker-controlled-value"), "unknown");
  assert.equal(
    networkPseudonym("attacker-a", "a-test-secret-with-enough-entropy"),
    networkPseudonym("attacker-b", "a-test-secret-with-enough-entropy"),
  );
});

test("production requires dedicated network secret and explicit trusted-proxy topology", () => {
  assert.throws(
    () => createHttpApp({ store: fakeStore(), googleIdentity, env: { NODE_ENV: "production" } }),
    /VOTER_NETWORK_SECRET/,
  );
  assert.throws(
    () => createHttpApp({ store: fakeStore(), googleIdentity, env: { NODE_ENV: "production", VOTER_NETWORK_SECRET: "x".repeat(32) } }),
    /TRUST_PROXY_HOPS/,
  );
  assert.throws(
    () => createHttpApp({ store: fakeStore(), googleIdentity, env: { NODE_ENV: "production", VOTER_NETWORK_SECRET: "x".repeat(32), TRUST_PROXY_HOPS: "not-a-number" } }),
    /TRUST_PROXY_HOPS/,
  );
});

test("disallowed browser origins are rejected before player issuance", async () => {
  let issued = 0;
  const app = createHttpApp({
    store: fakeStore({ createPlayer: async () => { issued += 1; return { recoveryKey: "never" }; } }),
    googleIdentity,
    env: { NODE_ENV: "production", VOTER_NETWORK_SECRET: "x".repeat(32), TRUST_PROXY_HOPS: "0" },
  });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/player`, { method: "POST", headers: { Origin: "https://evil.example" } });
    const body = await response.json();
    assert.equal(response.status, 403);
    assert.equal(body.code, "CORS_ORIGIN_DENIED");
    assert.equal(issued, 0);
  });
});

test("allowed player issuance receives only a network pseudonym", async () => {
  let received;
  const app = createHttpApp({
    store: fakeStore({ createPlayer: async (value) => { received = value; return { recoveryKey: "pm2_test" }; } }),
    googleIdentity,
    env: { NODE_ENV: "production", VOTER_NETWORK_SECRET: "x".repeat(32), TRUST_PROXY_HOPS: "0" },
  });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/player`, { method: "POST", headers: { Origin: "https://polimatch.com.br" } });
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://polimatch.com.br");
    assert.match(received.networkHash, /^[a-f0-9]{64}$/);
    assert.equal(JSON.stringify(received).includes("127.0.0.1"), false);
  });
});

test("the public API never leaks pending candidates or private approval evidence", async () => {
  const candidateRegistry = createEditorialTestRegistry({
    candidateIds: ["lula", "jair-bolsonaro"],
    approvedCandidateIds: ["lula"],
  });
  const app = createHttpApp({ store: fakeStore(), googleIdentity, candidateRegistry, env: {} });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/candidates?topic=eleicoes-2026`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.candidates.map(({ id }) => id), ["lula"]);
    assert.equal(body.candidates[0].publication.content.status, "approved");
    assert.equal(body.candidates[0].publication.cardArt.status, "approved");
    assert.equal(body.candidates[0].publication.documentaryPhoto.status, "missing");
    assert.equal(body.candidates[0].photo, "");
    assert.equal(JSON.stringify(body).includes("jair-bolsonaro"), false);
    assert.equal(JSON.stringify(body).includes("fingerprint"), false);
    assert.equal(JSON.stringify(body).includes("decidedBy"), false);

    const health = await (await fetch(`${baseUrl}/api/health`)).json();
    assert.equal(health.candidates, 2);
    assert.equal(health.playableCandidates, 1);
  });
});

test("the candidate API stays closed for inactive and unknown topics", async () => {
  const candidateRegistry = createEditorialTestRegistry({
    candidateIds: ["anitta"],
    approvedCandidateIds: ["anitta"],
  });
  const app = createHttpApp({ store: fakeStore(), googleIdentity, candidateRegistry, env: {} });
  await withServer(app, async (baseUrl) => {
    for (const topic of ["influenciadores", "desconhecido"]) {
      const response = await fetch(`${baseUrl}/api/candidates?topic=${topic}`);
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.topicId, topic);
      assert.deepEqual(body.candidates, []);
    }
  });
});

test("aggregate capabilities are no-store and default to personal-only", async () => {
  const app = createHttpApp({ store: fakeStore(), googleIdentity, env: {} });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/capabilities`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(body.mode, "personal-only");
    assert.deepEqual(Object.fromEntries(Object.entries(body.scopes).map(([scope, value]) => [scope, value.status])), {
      "global-ranking": "withheld",
      "daily-distribution": "withheld",
      "prediction-reveal": "withheld",
      "mirror-comparison": "withheld",
    });
  });
});

test("withheld aggregate reads are rejected before any store access", async () => {
  const calls = [];
  const app = createHttpApp({
    store: fakeStore({
      ranking: async () => { calls.push("ranking"); return {}; },
      dailyCut: async () => { calls.push("daily-cut"); return {}; },
      dailyPredictionResults: async () => { calls.push("prediction-reveal"); return {}; },
    }),
    googleIdentity,
    env: {},
  });
  await withServer(app, async (baseUrl) => {
    for (const [path, scope, headers] of [
      ["/api/ranking", "global-ranking", {}],
      ["/api/daily-cut?date=2026-09-16", "daily-distribution", {}],
      ["/api/daily-prediction-results", "prediction-reveal", { Authorization: "Bearer pm2_player" }],
    ]) {
      const response = await fetch(`${baseUrl}${path}`, { headers });
      const body = await response.json();
      assert.equal(response.status, 403);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(body.code, "AGGREGATE_PUBLICATION_WITHHELD");
      assert.equal(body.scope, scope);
    }
  });
  assert.deepEqual(calls, []);
});

test("aggregate scope grants are independent", async () => {
  const calls = [];
  const app = createHttpApp({
    store: fakeStore({
      ranking: async () => { calls.push("ranking"); return { ranking: [] }; },
      dailyCut: async () => { calls.push("daily-cut"); return {}; },
      dailyPredictionResults: async () => { calls.push("prediction-reveal"); return {}; },
    }),
    googleIdentity,
    env: {},
    aggregatePublication: authorizedAggregatePublication({ scopes: ["global-ranking"] }),
  });
  await withServer(app, async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/api/ranking`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/daily-cut?date=2026-09-16`)).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/daily-prediction-results`, {
      headers: { Authorization: "Bearer pm2_player" },
    })).status, 403);
  });
  assert.deepEqual(calls, ["ranking"]);
});

test("vote responses use contract V2 and never expose withheld aggregate state", async () => {
  const personalFeedback = { rankingEvent: "confirm", primaryEvent: "confirm", zebra: false, outcomes: [] };
  const raw = {
    topicId: "eleicoes-2026",
    duels: 44,
    ranking: [{ id: "public-leader", rank: 1, elo: 4000 }],
    player: { duels: 1, version: 1, ranking: [{ id: "personal-choice", rank: 1, elo: 1010 }] },
    round: {
      id: "round-1",
      status: "created",
      winnerId: "personal-choice",
      candidateIds: ["personal-choice", "b", "c", "d"],
      personalFeedback,
      feedback: personalFeedback,
      feedbackScope: "personal",
      globalEvent: { feedback: { secretLeader: "public-leader" } },
      comparisons: 3,
    },
  };
  raw.vote = raw.round;
  const app = createHttpApp({ store: fakeStore({ roundVote: async () => raw }), googleIdentity, env: {} });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/round-vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer pm2_player" },
      body: JSON.stringify({}),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(body.contractVersion, 2);
    assert.deepEqual(body.publicAggregate, { status: "withheld", scope: "global-ranking" });
    assert.equal(Object.hasOwn(body, "ranking"), false);
    assert.equal(Object.hasOwn(body, "duels"), false);
    assert.equal(Object.hasOwn(body.round, "globalEvent"), false);
    assert.equal(JSON.stringify(body).includes("public-leader"), false);
    assert.equal(body.player.ranking[0].id, "personal-choice");
  });
});

test("round writes require a player bearer token before reaching the store", async () => {
  let writes = 0;
  const app = createHttpApp({ store: fakeStore({ roundVote: async () => { writes += 1; return {}; } }), googleIdentity, env: {} });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/round-vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.code, "PLAYER_SESSION_REQUIRED");
    assert.equal(writes, 0);
  });
});

test("daily reads are scoped to the bearer token and receive the injected clock", async () => {
  const calls = [];
  const now = new Date("2026-09-16T02:59:59.000Z");
  const app = createHttpApp({
    store: fakeStore({ dailySession: async (...args) => { calls.push(args); return { status: "active" }; } }),
    googleIdentity,
    env: {},
    clock: () => now,
  });
  await withServer(app, async (baseUrl) => {
    const missing = await fetch(`${baseUrl}/api/daily-session`);
    assert.equal(missing.status, 401);
    const response = await fetch(`${baseUrl}/api/daily-session?topic=eleicoes-2026`, {
      headers: { Authorization: "Bearer pm2_private-player" },
    });
    assert.equal(response.status, 200);
  });
  assert.deepEqual(calls, [["pm2_private-player", "eleicoes-2026", { now }]]);
});

test("daily votes forward only edition, slot and winner, never a client card order", async () => {
  let received;
  const now = new Date("2026-09-16T12:00:00.000Z");
  const app = createHttpApp({
    store: fakeStore({ dailyVote: async (input) => { received = input; return { ok: true }; } }),
    googleIdentity,
    env: {},
    clock: () => now,
    aggregatePublication: authorizedAggregatePublication({ scopes: ["prediction-reveal"], now }),
  });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/daily-vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer pm2_player" },
      body: JSON.stringify({
        answerId: "550e8400-e29b-41d4-a716-446655440000",
        editionId: "edition-1",
        slot: 3,
        winnerId: "lula",
        candidateIds: ["ordem", "forjada", "pelo", "cliente"],
        playerVersion: 2,
        predictionContractVersion: 1,
      }),
    });
    assert.equal(response.status, 200);
  });
  assert.deepEqual(received, {
    answerId: "550e8400-e29b-41d4-a716-446655440000",
    editionId: "edition-1",
    slot: 3,
    winnerId: "lula",
    topicId: "eleicoes-2026",
    recoveryKey: "pm2_player",
    playerVersion: 2,
    predictionContractVersion: 1,
    now,
  });
  assert.equal(Object.hasOwn(received, "candidateIds"), false);
});

test("personal-only daily votes ignore a stale client's prediction contract and preserve the session", async () => {
  let received;
  const app = createHttpApp({
    store: fakeStore({ dailyVote: async (input) => {
      received = input;
      return { dailySession: { status: "active", progress: { answered: 2, total: 10 } } };
    } }),
    googleIdentity,
    env: {},
  });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/daily-vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer pm2_player" },
      body: JSON.stringify({
        answerId: "550e8400-e29b-41d4-a716-446655440000",
        editionId: "edition-1",
        slot: 2,
        winnerId: "lula",
        playerVersion: 1,
        predictionContractVersion: 1,
      }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.dailySession, { status: "active", progress: { answered: 2, total: 10 } });
    assert.deepEqual(body.publicAggregate, { status: "withheld", scope: "global-ranking" });
  });
  assert.equal(received.predictionContractVersion, undefined);
});

test("daily predictions forward only the separate prediction contract", async () => {
  const calls = [];
  const now = new Date("2026-09-16T12:00:00.000Z");
  const app = createHttpApp({
    store: fakeStore({ dailyPrediction: async (input) => { calls.push(input); return { ok: true }; } }),
    googleIdentity,
    env: {},
    clock: () => now,
    aggregatePublication: authorizedAggregatePublication({ scopes: ["prediction-reveal"], now }),
  });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/daily-prediction`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer pm2_player" },
      body: JSON.stringify({
        predictionId: "550e8400-e29b-41d4-a716-446655440001",
        editionId: "edition-1",
        slot: 3,
        decision: "predict",
        candidateId: "lula",
        answerId: "forged-answer",
        candidateIds: ["forged", "client", "card", "order"],
        playerVersion: 99,
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
  assert.deepEqual(calls, [{
    predictionId: "550e8400-e29b-41d4-a716-446655440001",
    editionId: "edition-1",
    slot: 3,
    decision: "predict",
    candidateId: "lula",
    topicId: "eleicoes-2026",
    recoveryKey: "pm2_player",
    now,
  }]);
});

test("withheld daily predictions are rejected before the store", async () => {
  let writes = 0;
  const app = createHttpApp({
    store: fakeStore({ dailyPrediction: async () => { writes += 1; return {}; } }),
    googleIdentity,
    env: {},
  });
  await withServer(app, async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/api/daily-prediction`, { method: "POST" })).status, 401);
    const response = await fetch(`${baseUrl}/api/daily-prediction`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer pm2_player" },
      body: JSON.stringify({ predictionId: "550e8400-e29b-41d4-a716-446655440001" }),
    });
    const body = await response.json();
    assert.equal(response.status, 403);
    assert.equal(body.code, "AGGREGATE_PUBLICATION_WITHHELD");
    assert.equal(body.scope, "prediction-reveal");
  });
  assert.equal(writes, 0);
});

test("cumulative prediction results are private and clocked", async () => {
  const calls = [];
  const now = new Date("2026-09-17T03:00:00.000Z");
  const app = createHttpApp({
    store: fakeStore({
      dailyPredictionResults: async (...args) => {
        calls.push(args);
        return { baselinePercent: 25, score: { correct: 1, scored: 1 }, sessions: [] };
      },
    }),
    googleIdentity,
    env: {},
    clock: () => now,
    aggregatePublication: authorizedAggregatePublication({ scopes: ["prediction-reveal"], now }),
  });
  await withServer(app, async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/api/daily-prediction-results`)).status, 401);
    const response = await fetch(`${baseUrl}/api/daily-prediction-results`, {
      headers: { Authorization: "Bearer pm2_player" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).baselinePercent, 25);
  });
  assert.deepEqual(calls, [["pm2_player", "eleicoes-2026", { now }]]);
});

test("the closed daily cut is public but never opened before its editorial date closes", async () => {
  const calls = [];
  const now = new Date("2026-09-17T03:00:00.000Z");
  const app = createHttpApp({
    store: fakeStore({ dailyCut: async (...args) => { calls.push(args); return { status: "published", completedPlayers: 0 }; } }),
    googleIdentity,
    env: {},
    clock: () => now,
    aggregatePublication: authorizedAggregatePublication({ scopes: ["daily-distribution"], now }),
  });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/daily-cut?date=2026-09-16`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).completedPlayers, 0);
  });
  assert.deepEqual(calls, [["eleicoes-2026", "2026-09-16", { now }]]);
});

test("internal failures are logged by request id without leaking their message", async () => {
  const logs = [];
  const app = createHttpApp({
    store: fakeStore({ ranking: async () => { throw new Error("postgres://admin:secret@db/internal"); } }),
    googleIdentity,
    env: {},
    logger: { error: (entry) => logs.push(entry) },
    aggregatePublication: authorizedAggregatePublication({ scopes: ["global-ranking"] }),
  });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/ranking`);
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.equal(body.error, "erro interno");
    assert.equal(body.code, "INTERNAL_ERROR");
    assert.equal(body.requestId, response.headers.get("x-request-id"));
    assert.equal(JSON.stringify(body).includes("admin:secret"), false);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].requestId, body.requestId);
    assert.match(logs[0].error, /admin:secret/);
    assert.equal(JSON.stringify(logs[0]).includes("authorization"), false);
  });
});

test("aggregate authority is rechecked after each asynchronous store read", async () => {
  for (const [route, method] of [["/api/ranking", "ranking"], ["/api/daily-cut?date=2026-09-16", "dailyCut"], ["/api/daily-prediction-results", "dailyPredictionResults"]]) {
    const now = new Date("2026-09-16T12:00:00.000Z");
    let reads = 0;
    const app = createHttpApp({
      store: fakeStore({ [method]: async () => { reads += 1; now.setUTCFullYear(2028); return { secret: "aggregate" }; } }),
      googleIdentity, env: {},
      aggregatePublication: authorizedAggregatePublication({ now }),
    });
    await withServer(app, async baseUrl => {
      const response = await fetch(`${baseUrl}${route}`, { headers: { authorization: "Bearer pm2_player" } });
      assert.equal(response.status, 403, route);
      assert.equal(reads, 1, route);
      assert.equal(JSON.stringify(await response.json()).includes("secret"), false);
    });
  }
});

test("health failures use the same sanitized 5xx contract", async () => {
  const logs = [];
  const app = createHttpApp({
    store: fakeStore({ health: async () => { throw new Error("postgres host=db.internal password=secret"); } }),
    googleIdentity,
    env: {},
    logger: { error: (entry) => logs.push(entry) },
  });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.deepEqual(
      { error: body.error, code: body.code, requestId: body.requestId },
      { error: "erro interno", code: "INTERNAL_ERROR", requestId: response.headers.get("x-request-id") },
    );
    assert.equal(JSON.stringify(body).includes("password=secret"), false);
    assert.equal(logs[0].requestId, body.requestId);
    assert.match(logs[0].error, /password=secret/);
  });
});

test("quota responses expose a retry contract", async () => {
  const app = createHttpApp({
    store: fakeStore({
      createPlayer: async () => {
        const error = new Error("limite diário de novos jogadores nesta rede atingido");
        error.status = 429;
        error.code = "PLAYER_ISSUANCE_LIMIT";
        error.retryAfterSeconds = 86400;
        throw error;
      },
    }),
    googleIdentity,
    env: {},
  });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/player`, { method: "POST" });
    const body = await response.json();
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "86400");
    assert.equal(body.code, "PLAYER_ISSUANCE_LIMIT");
    assert.equal(body.retryAfterSeconds, 86400);
  });
});
