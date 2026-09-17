import assert from "node:assert/strict";
import test from "node:test";
import manifest from "../../shared/photo-recovery-manifest.json" with { type: "json" };
import { EDITORIAL_CANDIDATE_REGISTRY, PRODUCTION_CANDIDATE_REGISTRY, PUBLIC_CANDIDATE_SCHEMA_V2 } from "./candidates.js";
import { withPhotoRecovery, RECOVERY_NOTICE } from "./photo-recovery.js";
import { loadRepositoryFile } from "./repository-files.js";
import { buildDailyCatalogSnapshot } from "./topic-store.js";
import { candidateCardArt } from "../../app/src/photos.js";

test("all 54 recovered portraits survive the daily snapshot and render as local photos", () => {
  const candidates = PRODUCTION_CANDIDATE_REGISTRY.candidatesForTopic("eleicoes-2026");
  const snapshot = buildDailyCatalogSnapshot(candidates);
  assert.equal(snapshot.candidates.length, 54);
  for (const candidate of snapshot.candidates) {
    const authorized = manifest.photos.find(({ id }) => id === candidate.id);
    assert.equal(candidate.name, authorized.name);
    assert.equal(candidateCardArt(candidate), `${authorized.image}?v=test`);
    assert.equal(candidate.publication.content.status, "pending");
    assert.equal(candidate.reviewedAt, "");
    assert.equal(candidate.bio, RECOVERY_NOTICE);
    assert.deepEqual(candidate.facts, []);
    assert.deepEqual(candidate.sources, []);
    assert.equal(candidate.party, null);
    assert.equal(candidate.primaryArea, null);
    assert.equal(candidate.contextAffiliation, null);
  }
  const historical = buildDailyCatalogSnapshot(candidates, { catalogSchema: PUBLIC_CANDIDATE_SCHEMA_V2 });
  assert.equal(Object.hasOwn(historical.candidates[0], "publication"), false);
});

test("recovery fails closed for changed photo bytes, identity, path or duplicate ID", () => {
  const recover = (value, loader = loadRepositoryFile) => withPhotoRecovery(EDITORIAL_CANDIDATE_REGISTRY, value, loader);
  const changed = (edit) => { const value = structuredClone(manifest); edit(value); return value; };
  assert.throws(() => recover(manifest, () => Buffer.from("different image")), /alterada/);
  for (const edit of [
    (value) => { value.photos[0].name = "Outra pessoa"; },
    (value) => { value.photos[0].personId = 999; },
    (value) => { value.photos[0].image = "/portraits/../secret.jpg"; },
    (value) => { value.photos.push(value.photos[0]); },
  ]) assert.throws(() => recover(changed(edit)), /identidade fotográfica/);
  assert.equal(PRODUCTION_CANDIDATE_REGISTRY.candidateBelongsToTopic("lula", "influenciadores"), false);
});

test("a subsequent explicit rejection takes precedence over photo recovery", () => {
  const first = manifest.photos[0];
  const rejected = { ...EDITORIAL_CANDIDATE_REGISTRY.candidatesById.get(first.id), publication: { content: { status: "rejected" } } };
  const registry = {
    ...EDITORIAL_CANDIDATE_REGISTRY,
    candidates: [rejected], candidatesById: new Map([[first.id, rejected]]),
  };
  const recovered = withPhotoRecovery(registry, { ...manifest, photos: [first] }, loadRepositoryFile);
  assert.equal(recovered.candidatesForTopic("eleicoes-2026").length, 0);
});
