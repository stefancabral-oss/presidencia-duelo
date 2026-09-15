import assert from "node:assert/strict";
import test from "node:test";
import { CANDIDATES, TOPICS, candidateBelongsToTopic, candidatesForTopic } from "./candidates.js";

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
  }
});
