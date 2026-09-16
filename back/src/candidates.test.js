import assert from "node:assert/strict";
import test from "node:test";
import {
  CANDIDATES,
  CURRENT_PUBLIC_CANDIDATE_SCHEMA,
  PUBLIC_CANDIDATE_SCHEMA_V1,
  TOPICS,
  candidateBelongsToTopic,
  candidateProjectorBySchema,
  candidatesForTopic,
  publicCandidate,
} from "./candidates.js";

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

test("the public candidate projection excludes eligibility and editorial audit metadata", () => {
  const projected = publicCandidate({
    ...CANDIDATES[0],
    secret: "never-public",
    fingerprint: "internal-fingerprint",
    eligible: true,
    publication: { audit: { decidedBy: "reviewer@example.com", basis: "internal" } },
  });
  assert.equal(projected.id, CANDIDATES[0].id);
  assert.equal(projected.bio, CANDIDATES[0].bio);
  assert.equal(projected.reviewStatus, CANDIDATES[0].reviewStatus);
  assert.deepEqual(projected.topicIds, CANDIDATES[0].topicIds);
  for (const field of ["secret", "fingerprint", "eligible", "publication", "photoApproved", "group", "area"]) {
    assert.equal(Object.hasOwn(projected, field), false, `${field} vazou na projeção pública`);
  }
  assert.equal(CURRENT_PUBLIC_CANDIDATE_SCHEMA, PUBLIC_CANDIDATE_SCHEMA_V1);
  assert.deepEqual(candidateProjectorBySchema(PUBLIC_CANDIDATE_SCHEMA_V1)(CANDIDATES[0]), projected);
  assert.throws(() => candidateProjectorBySchema("candidate-public-v999"), /não suportado/);
});
