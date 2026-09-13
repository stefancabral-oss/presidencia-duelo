import assert from "node:assert/strict";
import { test } from "node:test";
import { candidateForMode, MODES, parseVice, VICE_STORAGE_KEY } from "./vice-mode.js";

const candidate = {
  id: "lula",
  name: "Luiz Inácio Lula da Silva",
  party: "PT",
  vice: "Geraldo Alckmin (PSB)",
  photo: "/candidates/lula.jpg",
  initials: "LS",
};

test("parseVice extracts name, party and initials", () => {
  assert.deepEqual(parseVice(candidate.vice), { name: "Geraldo Alckmin", party: "PSB", initials: "GA" });
});

test("vice mode swaps the person while preserving the chapa id", () => {
  const vice = candidateForMode(candidate, "vices");
  assert.equal(vice.id, candidate.id);
  assert.equal(vice.name, "Geraldo Alckmin");
  assert.equal(vice.vice, "Luiz Inácio Lula da Silva (PT)");
  assert.equal(vice.mateLabel, "Presidente");
  assert.equal(vice.photo, null);
  assert.match(VICE_STORAGE_KEY, /vices/);
});

test("the active legacy pool is presented as people", () => {
  assert.equal(MODES.presidentes.label, "Pessoas");
  assert.equal(MODES.presidentes.singular, "pessoa");
  assert.equal(MODES.presidentes.prompt, "Toque na pessoa preferida");
});
