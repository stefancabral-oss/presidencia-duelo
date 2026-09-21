import assert from "node:assert/strict";
import test from "node:test";
import { createCivicClient } from "./civic/client.js";
import { createCivicMock } from "./civic/mock-transport.js";
import { createCivicStore } from "./civic/store.js";
import { createUfPreference, UF_PREFERENCE_KEY } from "./civic/uf-preference.js";
import { candidacyId } from "../../shared/civic-contract.js";

const PRESIDENT_1 = candidacyId("test-2032", "BR", "president", "1");
const PRESIDENT_2 = candidacyId("test-2032", "BR", "president", "2");
const GOVERNOR = candidacyId("test-2032", "SP", "governor", "1");

function memoryStorage() {
  const map = new Map();
  return { map, getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}

function harness({ delayMs = 0, now = () => 1_000_000 } = {}) {
  const mock = createCivicMock({ delayMs });
  const client = createCivicClient({ fetchImpl: mock.fetch, resolveUrl: (path) => path, retries: 0 });
  const storage = memoryStorage();
  const preference = createUfPreference({ storage });
  const store = createCivicStore({ client, preference, now });
  const events = [];
  store.subscribe((state, area) => events.push([area, state[area]?.status ?? state.jurisdiction]));
  return { mock, client, storage, preference, store, events };
}

test("diretório: carrega, pagina e marca vazio sem inventar denominador", async () => {
  const { store } = harness();
  await store.loadDirectory({ contestId: "president", limit: 1 });
  let state = store.getState();
  assert.equal(state.directory.status, "ready");
  assert.equal(state.directory.data.items.length, 1);
  assert.equal(state.directory.revision, 1);
  await store.loadMoreDirectory({ contestId: "president", limit: 1 });
  state = store.getState();
  assert.equal(state.directory.data.items.length, 2);
  assert.equal(state.directory.data.nextCursor, null);
  await store.loadDirectory({ contestId: "president", search: "ninguém" });
  state = store.getState();
  assert.equal(state.directory.status, "empty");
  assert.deepEqual(state.directory.data.coverage, { official: 2, imported: 2, published: 2, unpublished: 0 });
});

test("resposta antiga nunca sobrescreve um filtro mais recente", async () => {
  const { store } = harness({ delayMs: (url) => (url.includes("contestId=president") ? 40 : 0) });
  const slow = store.loadDirectory({ contestId: "president" });
  const fast = store.loadDirectory({ contestId: "governor" });
  const [slowApplied, fastApplied] = await Promise.all([slow, fast]);
  assert.equal(slowApplied, false);
  assert.equal(fastApplied, true);
  const state = store.getState();
  assert.equal(state.directory.status, "ready");
  assert.deepEqual([...new Set(state.directory.data.items.map((item) => item.contestId))], ["governor"]);
});

test("trocar UF durante uma leitura descarta a resposta do recorte anterior e persiste a escolha", async () => {
  const { store, storage, mock } = harness({ delayMs: (url) => (url.includes("jurisdiction=SP") ? 40 : 0) });
  const pending = store.loadContests("SP");
  store.setJurisdiction("BR");
  const contests = store.loadContests("BR");
  await Promise.all([pending, contests]);
  const state = store.getState();
  assert.equal(state.jurisdiction, "BR");
  assert.deepEqual(state.contests.data.contests.map((contest) => contest.jurisdiction), ["BR"]);
  assert.equal(storage.getItem(UF_PREFERENCE_KEY), "BR");
  assert.deepEqual([...storage.map.keys()], [UF_PREFERENCE_KEY], "nenhuma outra chave gravada");
  assert.ok(mock.calls.every((call) => !/recoveryKey|token|vote/i.test(call.url)), "URLs sem sinais do jogador");
});

test("falha de atualização preserva a última versão permitida como desatualizada, com Retry-After", async () => {
  const { store, mock } = harness({ now: () => 5_000 });
  await store.loadDirectory({ contestId: "president" });
  mock.setScenario("directory", "unavailable");
  await store.loadDirectory({ contestId: "president" });
  const state = store.getState();
  assert.equal(state.directory.status, "ready");
  assert.equal(state.directory.stale, true);
  assert.equal(state.directory.error.kind, "unavailable");
  assert.equal(state.directory.retryAt, 10_000);
  assert.equal(state.directory.data.items.length, 2);
  assert.equal(await store.retry("directory"), false, "respeita Retry-After antes de repetir");
});

test("retirada (410) invalida a entrada local e some da lista carregada", async () => {
  const { store, mock } = harness();
  await store.loadDirectory({ contestId: "president" });
  await store.loadCandidacy(PRESIDENT_1);
  mock.setScenario("candidacy", "withdrawn");
  await store.loadCandidacy(PRESIDENT_1);
  const state = store.getState();
  assert.equal(state.candidacy.status, "error");
  assert.equal(state.candidacy.error.kind, "withdrawn");
  assert.equal(state.candidacy.data, null);
  assert.deepEqual(state.directory.data.items.map((item) => item.id), [PRESIDENT_2]);
});

test("comparação incompatível conhecida é recusada com explicação e sem requisição", async () => {
  const { store, mock } = harness();
  await store.loadDirectory({ contestId: "president" });
  await store.loadCandidacy(GOVERNOR);
  const before = mock.calls.length;
  await store.loadComparison([PRESIDENT_1, GOVERNOR]);
  const state = store.getState();
  assert.equal(state.comparison.status, "error");
  assert.equal(state.comparison.error.kind, "invalid");
  assert.match(state.comparison.error.message, /mesma disputa/);
  assert.equal(mock.calls.length, before);
  await store.loadComparison([PRESIDENT_1, PRESIDENT_2]);
  assert.equal(store.getState().comparison.status, "ready");
  assert.equal(store.getState().comparison.data.records.candidacies.length, 2);
});

test("edição: ausência é vazio, não erro; pendente, corrigido e desatualizado permanecem distintos", async () => {
  const { store, mock } = harness({ now: () => Date.parse("2032-09-01T12:00:00.000Z") });
  await store.loadCurrentEdition("BR");
  assert.equal(store.getState().edition.status, "empty");
  await store.loadCurrentEdition("SP");
  assert.equal(store.getState().edition.status, "ready");
  assert.equal(store.getState().edition.data.edition.id, "edition-a");
  mock.setScenario("event", "corrected");
  await store.loadEvent("event-a");
  assert.equal(store.getState().event.data.history.at(-1).action, "correct");
  assert.equal(store.getState().event.data.event.revision, 2);
  mock.setScenario("event", "stale");
  await store.loadEvent("event-a", { revision: 1 });
  assert.equal(store.getState().event.stale, true);
  mock.setScenario("event", "pending");
  await store.loadEvent("event-a", { revision: 2 });
  assert.equal(store.getState().event.data.records.coverage.find((row) => row.slot === "right").state, "pending");
  mock.setScenario("event", "restricted");
  await store.loadEvent("event-a", { revision: 3 });
  assert.equal(store.getState().event.status, "error");
  assert.equal(store.getState().event.error.kind, "restricted");
});

test("abortar limpa leituras em voo sem deixar estado carregando", async () => {
  const { store } = harness({ delayMs: 50 });
  const pending = store.loadDirectory({ contestId: "president" });
  store.abort("directory");
  assert.equal(store.getState().directory.status, "idle");
  assert.equal(await pending, false);
});
