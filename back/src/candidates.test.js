import assert from "node:assert/strict";
import test from "node:test";
import { CANDIDATES, TOPICS, candidateBelongsToTopic, candidatesForTopic } from "./candidates.js";

test("the rebuild exposes one active topic and two announced expansions", () => {
  assert.deepEqual(TOPICS.filter(({ active }) => active).map(({ id }) => id), ["eleicoes-2026"]);
  assert.deepEqual(TOPICS.filter(({ active }) => !active).map(({ id }) => id), ["influenciadores", "escandalos"]);
});

test("the curated 125-person catalog replaces the rejected 360-person catalog", () => {
  assert.equal(CANDIDATES.length, 125);
  assert.equal(candidatesForTopic("eleicoes-2026").length, 100);
  assert.equal(candidatesForTopic("influenciadores").length, 25);
  assert.equal(candidateBelongsToTopic("lula", "eleicoes-2026"), true);
  assert.equal(candidateBelongsToTopic("lula", "influenciadores"), false);
  assert.equal(candidateBelongsToTopic("anitta", "influenciadores"), true);
});

test("every candidate exposes a reviewable editorial profile", () => {
  for (const candidate of CANDIDATES) {
    assert.equal(typeof candidate.bio, "string");
    assert.equal(Array.isArray(candidate.facts), true);
    assert.equal(Array.isArray(candidate.sources), true);
    assert.match(candidate.reviewStatus, /^(pending|reviewed|published)$/);
    assert.equal(candidate.sources.length > 0, true);
  }
});
