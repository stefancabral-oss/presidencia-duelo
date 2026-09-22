import assert from "node:assert/strict";
import test from "node:test";
import { CIVIC_PATHS, CivicReadError, createCivicClient, validateEnvelope } from "./civic/client.js";
import { createCivicMock } from "./civic/mock-transport.js";
import { candidacyId } from "../../shared/civic-contract.js";

function clientFor(mock, options = {}) {
  return createCivicClient({ fetchImpl: mock.fetch, resolveUrl: (path) => path, retryDelayMs: 0, wait: async () => {}, ...options });
}

const PRESIDENT_1 = candidacyId("test-2032", "BR", "president", "1");
const PRESIDENT_2 = candidacyId("test-2032", "BR", "president", "2");

test("leitura anônima: GET sem credenciais, aceitando JSON, com envelope validado", async () => {
  const seen = [];
  const mock = createCivicMock();
  const client = createCivicClient({
    fetchImpl: (url, init) => { seen.push({ url, init }); return mock.fetch(url, init); },
    resolveUrl: (path) => `https://api.test${path}`,
  });
  const envelope = await client.directory({ contestId: "president", limit: 1 });
  assert.equal(seen[0].init.credentials, "omit");
  assert.equal(seen[0].init.method, "GET");
  assert.equal(seen[0].init.headers.accept, "application/json");
  assert.equal(seen[0].url, `https://api.test${CIVIC_PATHS.directory({ contestId: "president", limit: 1 })}`);
  assert.equal(envelope.version, 1);
  assert.equal(envelope.records.candidacies.length, 1);
  assert.equal(envelope.meta.filteredCount, 2);
  assert.deepEqual(envelope.meta.coverage, { official: 2, imported: 2, published: 2, unpublished: 0 });
  assert.equal(typeof envelope.meta.nextCursor, "string");
});

test("paginação por cursor devolve a segunda página e recusa cursor obsoleto", async () => {
  const mock = createCivicMock();
  const client = clientFor(mock);
  const first = await client.directory({ contestId: "president", limit: 1 });
  const second = await client.directory({ contestId: "president", limit: 1, cursor: first.meta.nextCursor });
  assert.deepEqual([first.records.candidacies[0].id, second.records.candidacies[0].id].sort(), [PRESIDENT_1, PRESIDENT_2].sort());
  assert.equal(second.meta.nextCursor, null);
  mock.setRevision(2);
  await assert.rejects(client.directory({ contestId: "president", limit: 1, cursor: first.meta.nextCursor }), (error) => error instanceof CivicReadError && error.kind === "stale-cursor" && error.status === 409);
});

test("filtros privados e comparação incompatível são recusados antes de qualquer requisição", async () => {
  const mock = createCivicMock();
  const client = clientFor(mock);
  await assert.rejects(() => Promise.resolve().then(() => client.directory({ contestId: "president", playerId: "x" })), (error) => error.kind === "invalid");
  await assert.rejects(() => Promise.resolve().then(() => client.comparison([PRESIDENT_1])), (error) => error.kind === "invalid");
  await assert.rejects(() => Promise.resolve().then(() => client.candidacy("../../etc")), (error) => error.kind === "invalid");
  assert.equal(mock.calls.length, 0);
  await assert.rejects(client.comparison([PRESIDENT_1, "governor-x"]), (error) => error.kind === "invalid" && error.status === 400);
});

test("cada falha HTTP vira um estado distinto, com Retry-After e entidade retirada preservados", async () => {
  const mock = createCivicMock();
  const client = clientFor(mock, { retries: 0 });
  const cases = [
    ["candidacy", "withdrawn", "withdrawn", 410],
    ["candidacy", "not-found", "not-found", 404],
    ["directory", "restricted", "restricted", 403],
    ["directory", "rate-limited", "rate-limited", 429],
    ["directory", "unavailable", "unavailable", 503],
    ["directory", "schema", "schema", 0],
  ];
  for (const [area, scenario, kind, status] of cases) {
    mock.setScenario(area, scenario);
    const call = area === "candidacy" ? client.candidacy(PRESIDENT_1) : client.directory({ contestId: "president" });
    await assert.rejects(call, (error) => {
      assert.equal(error.kind, kind, scenario);
      assert.equal(error.status, status, scenario);
      if (kind === "rate-limited") assert.equal(error.retryAfterSeconds, 30);
      if (kind === "withdrawn") assert.deepEqual(error.entity, { kind: "candidacies", id: PRESIDENT_1, revision: 2 });
      if (kind === "schema") assert.match(error.detail, /candidacies\[0\]/);
      return true;
    });
    mock.setScenario(area, "ok");
  }
});

test("transporte: uma repetição automática para indisponibilidade, nenhuma para limite de consultas", async () => {
  const mock = createCivicMock();
  const client = clientFor(mock, { retries: 1 });
  mock.setScenario("directory", "unavailable");
  const before = mock.calls.length;
  await assert.rejects(client.directory({ contestId: "president" }), (error) => error.kind === "unavailable");
  assert.equal(mock.calls.length - before, 2);
  mock.setScenario("directory", "rate-limited");
  const beforeLimit = mock.calls.length;
  await assert.rejects(client.directory({ contestId: "president" }), (error) => error.kind === "rate-limited");
  assert.equal(mock.calls.length - beforeLimit, 1);
});

test("tempo esgotado, rede e cancelamento são distinguidos", async () => {
  const mock = createCivicMock();
  mock.setScenario("directory", "timeout");
  const slow = clientFor(mock, { timeoutMs: 15, retries: 0 });
  await assert.rejects(slow.directory({ contestId: "president" }), (error) => error.kind === "timeout");
  mock.setScenario("directory", "network");
  const offline = clientFor(mock, { retries: 0, isOnline: () => false });
  await assert.rejects(offline.directory({ contestId: "president" }), (error) => error.kind === "offline");
  const online = clientFor(mock, { retries: 0, isOnline: () => true });
  await assert.rejects(online.directory({ contestId: "president" }), (error) => error.kind === "network");
  mock.setScenario("directory", "timeout");
  const controller = new AbortController();
  const pending = clientFor(mock, { timeoutMs: 5000, retries: 0 }).directory({ contestId: "president" }, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (error) => error.kind === "aborted");
});

test("validateEnvelope recusa versão, registros internos, identidade de editor e cobertura inconsistente", () => {
  const base = { version: 1, revision: 1, records: {} };
  assert.throws(() => validateEnvelope({ ...base, version: 2 }), (error) => error.kind === "schema");
  assert.throws(() => validateEnvelope({ ...base, records: { changes: [] } }), (error) => /internal/.test(error.detail));
  assert.throws(() => validateEnvelope({ ...base, history: [{ revision: 1, action: "publish", at: "2032-08-01T12:00:00.000Z", reason: "x", actor: "editor" }] }), (error) => /editor/.test(error.detail));
  assert.throws(() => validateEnvelope({ ...base, coverage: { official: 1, imported: 2, published: 2, unpublished: -1 } }), (error) => error.kind === "schema");
  assert.throws(() => validateEnvelope({ ...base, extra: true }), (error) => /envelope keys/.test(error.detail));
  const ok = validateEnvelope({ ...base, coverage: null, history: [{ revision: 1, action: "publish", at: "2032-08-01T12:00:00.000Z", reason: "ok" }], freshness: { collectedAt: "2032-08-01T12:00:00.000Z", staleAfter: null } });
  assert.equal(ok.meta.coverage, null);
  assert.equal(ok.meta.history.length, 1);
  assert.equal(ok.meta.freshness.staleAfter, null);
});
