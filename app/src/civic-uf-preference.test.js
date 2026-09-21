import assert from "node:assert/strict";
import test from "node:test";
import { createUfPreference, DEFAULT_JURISDICTION, isJurisdiction, JURISDICTIONS, UF_PREFERENCE_KEY } from "./civic/uf-preference.js";

function memoryStorage() {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

test("aceita Brasil e as 27 UFs, e nada mais", () => {
  assert.equal(JURISDICTIONS.length, 28);
  assert.equal(isJurisdiction("SP"), true);
  assert.equal(isJurisdiction("BR"), true);
  assert.equal(isJurisdiction("sp"), false);
  assert.equal(isJurisdiction("XX"), false);
  assert.equal(isJurisdiction(null), false);
});

test("persiste em chave própria, fora do namespace do jogo, e sobrevive à releitura", () => {
  const storage = memoryStorage();
  const changes = [];
  const preference = createUfPreference({ storage, onChange: (uf, meta) => changes.push([uf, meta.persisted]) });
  assert.equal(preference.get(), null);
  assert.equal(preference.effective(), DEFAULT_JURISDICTION);
  assert.deepEqual(preference.set("SP"), { jurisdiction: "SP", persisted: true });
  assert.equal(storage.getItem(UF_PREFERENCE_KEY), "SP");
  assert.equal(UF_PREFERENCE_KEY.startsWith("polimatch:v4:"), false);
  assert.deepEqual([...storage.map.keys()], [UF_PREFERENCE_KEY]);
  const reloaded = createUfPreference({ storage });
  assert.equal(reloaded.get(), "SP");
  reloaded.clear();
  assert.equal(reloaded.get(), null);
  assert.equal(storage.getItem(UF_PREFERENCE_KEY), null);
  assert.deepEqual(changes, [["SP", true]]);
});

test("storage indisponível ou com valor corrompido cai no fallback em memória", () => {
  const broken = {
    getItem: () => { throw new Error("bloqueado"); },
    setItem: () => { throw new Error("bloqueado"); },
    removeItem: () => { throw new Error("bloqueado"); },
  };
  const preference = createUfPreference({ storage: broken });
  assert.deepEqual(preference.set("MG"), { jurisdiction: "MG", persisted: false });
  assert.equal(preference.get(), "MG");
  assert.equal(preference.effective(), "MG");
  preference.clear();
  assert.equal(preference.effective(), DEFAULT_JURISDICTION);

  const corrupted = memoryStorage();
  corrupted.setItem(UF_PREFERENCE_KEY, "{\"gps\":true}");
  assert.equal(createUfPreference({ storage: corrupted }).get(), null);
  assert.equal(createUfPreference({ storage: null }).effective(), DEFAULT_JURISDICTION);
});

test("recorte inválido é recusado antes de tocar no storage", () => {
  const storage = memoryStorage();
  const preference = createUfPreference({ storage });
  assert.throws(() => preference.set("xx"), TypeError);
  assert.throws(() => preference.set(undefined), TypeError);
  assert.equal(storage.map.size, 0);
});
