import assert from "node:assert/strict";
import test from "node:test";
import {
  CANDIDATES,
  CURRENT_PUBLIC_CANDIDATE_SCHEMA,
  PUBLIC_CANDIDATE_SCHEMA_V1,
  PUBLIC_CANDIDATE_SCHEMA_V2,
  TOPICS,
  candidateBelongsToTopic,
  candidateProjectorBySchema,
  candidatesForTopic,
  publicCandidate,
  serializeCandidate,
} from "./candidates.js";
import { createApprovedTestRegistry } from "../test-support/editorial-fixtures.js";

test("the rebuild exposes one active topic and two announced expansions", () => {
  assert.deepEqual(TOPICS.filter(({ active }) => active).map(({ id }) => id), ["eleicoes-2026"]);
  assert.deepEqual(TOPICS.filter(({ active }) => !active).map(({ id }) => id), ["influenciadores", "escandalos"]);
});

test("the real 125-person catalog stays closed until human ledger decisions exist", () => {
  assert.equal(CANDIDATES.length, 125);
  assert.equal(candidatesForTopic("eleicoes-2026").length, 0);
  assert.equal(candidatesForTopic("influenciadores").length, 0);
  assert.equal(candidateBelongsToTopic("lula", "eleicoes-2026"), false);
  assert.equal(candidateBelongsToTopic("acm-neto", "eleicoes-2026"), false);
  assert.ok(CANDIDATES.every(({ eligible, reviewStatus, cardArt, photo }) => (
    !eligible && reviewStatus === "pending" && cardArt === "" && photo === ""
  )));
});

test("tests opt into an explicit approved registry instead of bypassing production", () => {
  const registry = createApprovedTestRegistry();
  assert.equal(candidatesForTopic("eleicoes-2026", registry).length, 5);
  assert.equal(candidatesForTopic("influenciadores", registry).length, 0);
  assert.equal(candidateBelongsToTopic("lula", "eleicoes-2026", registry), true);
  assert.equal(candidateBelongsToTopic("lula", "influenciadores", registry), false);
  assert.equal(candidateBelongsToTopic("anitta", "influenciadores", registry), false);
  assert.ok(candidatesForTopic("eleicoes-2026", registry).every(({ publication, photo }) => (
    publication.content.status === "approved"
      && publication.cardArt.status === "approved"
      && publication.documentaryPhoto.status === "missing"
      && photo === ""
  )));
});

test("every candidate exposes a reviewable editorial profile", () => {
  for (const candidate of CANDIDATES) {
    assert.equal(typeof candidate.bio, "string");
    assert.equal(Array.isArray(candidate.facts), true);
    assert.equal(Array.isArray(candidate.sources), true);
    assert.match(candidate.reviewStatus, /^(pending|approved|rejected)$/);
    assert.match(candidate.publication.cardArt.status, /^(missing|approved|rejected)$/);
    assert.match(candidate.publication.documentaryPhoto.status, /^(missing|approved|rejected)$/);
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
  for (const field of ["secret", "fingerprint", "eligible", "publication", "photoApproved", "group", "area", "affiliation", "office"]) {
    assert.equal(Object.hasOwn(projected, field), false, `${field} vazou na projeção pública`);
  }
  assert.equal(CURRENT_PUBLIC_CANDIDATE_SCHEMA, PUBLIC_CANDIDATE_SCHEMA_V2);
  assert.deepEqual(candidateProjectorBySchema(PUBLIC_CANDIDATE_SCHEMA_V2)(CANDIDATES[0]), projected);
  assert.deepEqual(serializeCandidate(CANDIDATES[0]), projected);

  const historicalCandidate = {
    personId: 1,
    id: "pessoa-historica",
    name: "Pessoa Histórica",
    displayName: "Pessoa",
    affiliation: "PARTIDO",
    photo: "/pessoa.webp",
    role: "PARTIDO",
    summary: "Resumo histórico.",
    office: "Cargo histórico",
    party: "PARTIDO",
    location: "Brasil",
    bio: "Biografia histórica.",
    relevance2026: "Relevância histórica.",
    facts: ["Fato histórico."],
    highlight: "Destaque histórico.",
    controversy: "Ponto de atenção histórico.",
    sources: [{ label: "Fonte", url: "https://example.test/fonte" }],
    reviewedAt: "2026-09-13",
    reviewStatus: "pending",
    topicIds: ["eleicoes-2026"],
  };
  const historicalV1 = candidateProjectorBySchema(PUBLIC_CANDIDATE_SCHEMA_V1)(historicalCandidate);
  assert.equal(
    JSON.stringify(historicalV1),
    '{"personId":1,"id":"pessoa-historica","name":"Pessoa Histórica","displayName":"Pessoa","affiliation":"PARTIDO","photo":"/pessoa.webp","role":"PARTIDO","summary":"Resumo histórico.","office":"Cargo histórico","party":"PARTIDO","location":"Brasil","bio":"Biografia histórica.","relevance2026":"Relevância histórica.","facts":["Fato histórico."],"highlight":"Destaque histórico.","controversy":"Ponto de atenção histórico.","sources":[{"label":"Fonte","url":"https://example.test/fonte"}],"reviewedAt":"2026-09-13","reviewStatus":"pending","topicIds":["eleicoes-2026"]}',
  );
  assert.throws(
    () => candidateProjectorBySchema(PUBLIC_CANDIDATE_SCHEMA_V1)(CANDIDATES[0]),
    /candidate-public-v1; campos ausentes: affiliation, office/,
  );
  assert.throws(
    () => candidateProjectorBySchema(PUBLIC_CANDIDATE_SCHEMA_V1)({ ...historicalCandidate, office: undefined }),
    /campos ausentes: office/,
  );
  assert.throws(() => candidateProjectorBySchema("candidate-public-v999"), /não suportado/);
});
