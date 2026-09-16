import assert from "node:assert/strict";
import test from "node:test";
import { CANDIDATES, TOPICS, candidateBelongsToTopic, candidatesForTopic, serializeCandidate } from "./candidates.js";

test("the rebuild exposes one active topic and two announced expansions", () => {
  assert.deepEqual(TOPICS.filter(({ active }) => active).map(({ id }) => id), ["eleicoes-2026"]);
  assert.deepEqual(TOPICS.filter(({ active }) => !active).map(({ id }) => id), ["influenciadores", "escandalos"]);
});

test("the 125-person catalog keeps only approved-photo profiles playable", () => {
  assert.equal(CANDIDATES.length, 125);
  assert.equal(candidatesForTopic("eleicoes-2026").length, 54);
  assert.equal(candidatesForTopic("influenciadores").length, 14);
  assert.equal(candidateBelongsToTopic("lula", "eleicoes-2026"), true);
  assert.equal(candidateBelongsToTopic("lula", "influenciadores"), false);
  assert.equal(candidateBelongsToTopic("anitta", "influenciadores"), true);
  assert.equal(candidateBelongsToTopic("anitta", "eleicoes-2026"), true);
  assert.equal(candidateBelongsToTopic("acm-neto", "eleicoes-2026"), false);
  assert.ok(candidatesForTopic("eleicoes-2026").every(({ photoApproved, photo }) => photoApproved && photo));
  assert.ok(candidatesForTopic("influenciadores").every(({ photoApproved, photo }) => photoApproved && photo));
});

test("every candidate exposes a reviewable editorial profile", () => {
  for (const candidate of CANDIDATES) {
    assert.equal(typeof candidate.bio, "string");
    assert.equal(Array.isArray(candidate.facts), true);
    assert.equal(Array.isArray(candidate.sources), true);
    assert.match(candidate.reviewStatus, /^(pending|reviewed|published)$/);
    assert.equal(candidate.sources.length > 0, true);
    assert.equal(typeof candidate.role, "string");
    assert.equal(typeof candidate.primaryArea, "string");
    assert.equal(typeof candidate.taxonomyProvenance, "object");
  }
});

test("serializes the real catalog through the public API allowlist", () => {
  const serialized = CANDIDATES.map(serializeCandidate);
  assert.equal(serialized.length, 125);
  assert.ok(serialized.every((candidate) => (
    !("affiliation" in candidate) && !("area" in candidate) && !("office" in candidate)
  )));

  const lula = serialized.find(({ id }) => id === "lula");
  assert.equal(lula.party, "PT");
  assert.equal(lula.taxonomyProvenance.party.status, "extracted");

  const antonia = serialized.find(({ id }) => id === "antonia-fontenelle");
  assert.equal(antonia.role, "Influenciadora digital e candidata a deputada federal (RJ)");
  assert.equal(antonia.party, "PSDB");
  assert.equal(antonia.primaryArea, "Comunicação digital");
  assert.equal(antonia.taxonomyProvenance.primaryArea.status, "inferred");
});
