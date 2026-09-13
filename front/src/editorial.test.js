import assert from "node:assert/strict";
import { test } from "node:test";
import CANDIDATES from "../../shared/candidates.json" with { type: "json" };
import PROFILES from "../../shared/person-profiles.json" with { type: "json" };
import { editorialSummary, enrichCandidateEditorial, validateEditorialProfile } from "../../shared/editorial.js";

test("every catalog entry has a sourced editorial profile", () => {
  assert.equal(PROFILES.length, CANDIDATES.length);
  assert.deepEqual(new Set(PROFILES.map(({ id }) => id)), new Set(CANDIDATES.map(({ id }) => id)));
  assert.equal(PROFILES.every(validateEditorialProfile), true);
});

test("short card summaries are factual, derived, and have a safe fallback", () => {
  assert.equal(editorialSummary({ role: "Deputada federal", area: "Política" }), "Deputada federal com atuação em política.");
  assert.equal(editorialSummary({}), "Figura pública.");
  const enriched = enrichCandidateEditorial({ id: "a", name: "Pessoa" }, { role: "jornalista", area: "Comunicação" });
  assert.equal(enriched.role, "jornalista");
  assert.equal(enriched.summary, "Jornalista com atuação em comunicação.");
});
