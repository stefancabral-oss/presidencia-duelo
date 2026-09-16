import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSET_STATUSES,
  CONTENT_STATUSES,
  assetApprovalFingerprint,
  candidateContentFingerprint,
  candidatePublicContent,
  candidatePublicPayload,
  createCandidateRegistry,
  sha256Fingerprint,
} from "./editorial-gate.js";

const TOPICS = [{ id: "eleicoes-2026", active: true }];
const CANDIDATE = {
  personId: 1,
  id: "pessoa-teste",
  name: "Pessoa de Teste",
  displayName: "Pessoa",
  group: "politica",
  role: "Cargo público",
  affiliation: "Partido",
  office: "Cargo público",
  party: "Partido",
  area: "Política",
  location: "Brasil",
  summary: "Resumo verificável.",
  bio: "Biografia verificável.",
  relevance2026: "Relevância verificável.",
  facts: ["Fato verificável."],
  highlight: "Destaque verificável.",
  controversy: "Ponto de atenção verificável.",
  sources: [{ label: "Fonte", url: "https://example.test/fonte" }],
};

function audit(dimension) {
  return {
    decidedBy: "editor-humano",
    decidedAt: "2026-09-16",
    basis: [{ label: `Evidência ${dimension}`, reference: `https://example.test/${dimension}` }],
  };
}

function registryFor({ contentStatus, cardArtStatus, documentaryPhotoStatus, candidate = CANDIDATE } = {}) {
  const assets = [];
  const cardFingerprint = sha256Fingerprint("arte-fixture-v1");
  const photoFingerprint = sha256Fingerprint("foto-fixture-v1");
  let cardAsset;
  let photoAsset;
  if (cardArtStatus !== "missing") {
    cardAsset = {
      candidateId: candidate.id,
      kind: "cardArt",
      path: "/fixtures/card-art.jpg",
      fingerprint: cardFingerprint,
      version: "fixture-v1",
    };
    assets.push(cardAsset);
  }
  if (documentaryPhotoStatus !== "missing") {
    photoAsset = {
      candidateId: candidate.id,
      kind: "documentaryPhoto",
      path: "/fixtures/documentary-photo.jpg",
      fingerprint: photoFingerprint,
      source: "Arquivo de teste",
      license: "Licença de teste",
    };
    assets.push(photoAsset);
  }
  return createCandidateRegistry({
    catalog: [candidate],
    topics: TOPICS,
    assetRegistry: { schemaVersion: 1, assets },
    ledger: {
      schemaVersion: 1,
      decisions: [{
        candidateId: candidate.id,
        content: {
          status: contentStatus,
          fingerprint: candidateContentFingerprint(candidate),
          ...audit("content"),
        },
        cardArt: {
          status: cardArtStatus,
          fingerprint: cardArtStatus === "missing" ? null : assetApprovalFingerprint(cardAsset),
          ...audit("cardArt"),
        },
        documentaryPhoto: {
          status: documentaryPhotoStatus,
          fingerprint: documentaryPhotoStatus === "missing" ? null : assetApprovalFingerprint(photoAsset),
          ...audit("documentaryPhoto"),
        },
      }],
    },
  });
}

for (const contentStatus of CONTENT_STATUSES) {
  for (const cardArtStatus of ASSET_STATUSES) {
    for (const documentaryPhotoStatus of ASSET_STATUSES) {
      test(`publication states stay independent: ${contentStatus}/${cardArtStatus}/${documentaryPhotoStatus}`, () => {
        const registry = registryFor({ contentStatus, cardArtStatus, documentaryPhotoStatus });
        const candidate = registry.candidates[0];
        assert.equal(candidate.publication.content.status, contentStatus);
        assert.equal(candidate.publication.cardArt.status, cardArtStatus);
        assert.equal(candidate.publication.documentaryPhoto.status, documentaryPhotoStatus);
        const eligible = contentStatus === "approved" && cardArtStatus === "approved";
        assert.equal(candidate.eligible, eligible);
        assert.equal(registry.candidatesForTopic("eleicoes-2026").length, eligible ? 1 : 0);
        assert.equal(candidate.photo, documentaryPhotoStatus === "approved" ? "/fixtures/documentary-photo.jpg" : "");
      });
    }
  }
}

test("pending content or missing card art is never playable", () => {
  const pending = registryFor({ contentStatus: "pending", cardArtStatus: "approved", documentaryPhotoStatus: "approved" });
  const missingArt = registryFor({ contentStatus: "approved", cardArtStatus: "missing", documentaryPhotoStatus: "approved" });
  assert.equal(pending.candidateBelongsToTopic(CANDIDATE.id, "eleicoes-2026"), false);
  assert.equal(missingArt.candidateBelongsToTopic(CANDIDATE.id, "eleicoes-2026"), false);
});

test("approved content and card art remain playable without a documentary photo", () => {
  const registry = registryFor({ contentStatus: "approved", cardArtStatus: "approved", documentaryPhotoStatus: "missing" });
  const candidate = registry.candidatesForTopic("eleicoes-2026")[0];
  assert.equal(candidate.id, CANDIDATE.id);
  assert.equal(candidate.cardArt, "/fixtures/card-art.jpg");
  assert.equal(candidate.photo, "");
  assert.equal(candidate.publication.documentaryPhoto.status, "missing");
});

test("a later content edit invalidates its approval fingerprint", () => {
  const approved = registryFor({ contentStatus: "approved", cardArtStatus: "approved", documentaryPhotoStatus: "missing" });
  const original = approved.candidates[0];
  const changed = { ...CANDIDATE, controversy: "Texto alterado depois da aprovação." };
  const assets = {
    schemaVersion: 1,
    assets: [{
      candidateId: CANDIDATE.id,
      kind: "cardArt",
      path: "/fixtures/card-art.jpg",
      fingerprint: original.publication.cardArt.assetFingerprint,
      version: "fixture-v1",
    }],
  };
  const ledger = {
    schemaVersion: 1,
    decisions: [{
      candidateId: CANDIDATE.id,
      content: {
        status: "approved",
        fingerprint: original.publication.content.fingerprint,
        ...audit("content"),
      },
      cardArt: {
        status: "approved",
        fingerprint: original.publication.cardArt.fingerprint,
        ...audit("cardArt"),
      },
    }],
  };
  const registry = createCandidateRegistry({ catalog: [changed], topics: TOPICS, ledger, assetRegistry: assets });
  assert.equal(registry.candidates[0].publication.content.status, "pending");
  assert.equal(registry.candidates[0].publication.content.invalidated, true);
  assert.equal(registry.candidatesForTopic("eleicoes-2026").length, 0);
});

test("the public API content projection is the single fingerprint source", () => {
  const projected = candidatePublicContent(CANDIDATE);
  for (const [field, value] of Object.entries(projected)) {
    const changedValue = Array.isArray(value)
      ? [...value, field === "sources" ? { label: "Outra fonte", url: "https://example.test/outra" } : "Outro fato"]
      : typeof value === "number" ? value + 1 : `${value || ""} alterado`;
    assert.notEqual(
      candidateContentFingerprint({ ...CANDIDATE, [field]: changedValue }),
      candidateContentFingerprint(CANDIDATE),
      `o campo público ${field} precisa invalidar a aprovação`,
    );
  }
  assert.notEqual(candidateContentFingerprint({ ...CANDIDATE, group: "influencia" }), candidateContentFingerprint(CANDIDATE));
});

test("the reusable public payload strips audit and fingerprints", () => {
  const candidate = registryFor({
    contentStatus: "approved",
    cardArtStatus: "approved",
    documentaryPhotoStatus: "approved",
  }).candidates[0];
  const payload = candidatePublicPayload(candidate);
  const serialized = JSON.stringify(payload);
  assert.equal(payload.publication.content.status, "approved");
  assert.equal(payload.publication.documentaryPhoto.source, "Arquivo de teste");
  assert.equal(serialized.includes("fingerprint"), false);
  assert.equal(serialized.includes("decidedBy"), false);
  assert.equal(serialized.includes("basis"), false);
  assert.equal(serialized.includes("audit"), false);
});

test("inactive and unknown topics never expose an eligible candidate", () => {
  const candidate = { ...CANDIDATE, group: "influencia" };
  const cardAsset = {
    candidateId: candidate.id,
    kind: "cardArt",
    path: "/fixtures/card-art.jpg",
    fingerprint: sha256Fingerprint("arte-fixture-v1"),
    version: "fixture-v1",
  };
  const registry = createCandidateRegistry({
    catalog: [candidate],
    topics: [...TOPICS, { id: "influenciadores", active: false }],
    ledger: {
      schemaVersion: 1,
      decisions: [{
        candidateId: candidate.id,
        content: {
          status: "approved",
          fingerprint: candidateContentFingerprint(candidate),
          ...audit("content"),
        },
        cardArt: {
          status: "approved",
          fingerprint: assetApprovalFingerprint(cardAsset),
          ...audit("cardArt"),
        },
      }],
    },
    assetRegistry: {
      schemaVersion: 1,
      assets: [cardAsset],
    },
  });
  assert.equal(registry.candidates[0].eligible, true);
  assert.deepEqual(registry.candidatesForTopic("influenciadores"), []);
  assert.deepEqual(registry.candidatesForTopic("desconhecido"), []);
  assert.equal(registry.candidateBelongsToTopic(candidate.id, "influenciadores"), false);
});

test("a later asset edit invalidates its approval fingerprint", () => {
  const originalAsset = {
    candidateId: CANDIDATE.id,
    kind: "cardArt",
    path: "/fixtures/card-art.jpg",
    fingerprint: sha256Fingerprint("arte-fixture-v1"),
    version: "fixture-v1",
  };
  const ledger = {
    schemaVersion: 1,
    decisions: [{
      candidateId: CANDIDATE.id,
      content: {
        status: "approved",
        fingerprint: candidateContentFingerprint(CANDIDATE),
        ...audit("content"),
      },
      cardArt: { status: "approved", fingerprint: assetApprovalFingerprint(originalAsset), ...audit("cardArt") },
    }],
  };
  const assetRegistry = {
    schemaVersion: 1,
    assets: [{
      candidateId: CANDIDATE.id,
      kind: "cardArt",
      path: "/fixtures/card-art.jpg",
      fingerprint: sha256Fingerprint("arte-fixture-v2"),
      version: "fixture-v2",
    }],
  };
  const registry = createCandidateRegistry({ catalog: [CANDIDATE], topics: TOPICS, ledger, assetRegistry });
  assert.equal(registry.candidates[0].publication.cardArt.status, "missing");
  assert.equal(registry.candidates[0].publication.cardArt.invalidated, true);
  assert.equal(registry.candidatesForTopic("eleicoes-2026").length, 0);
});

test("asset approval fingerprints include path, version, source and license", () => {
  const card = {
    candidateId: CANDIDATE.id,
    kind: "cardArt",
    path: "/fixtures/card-art.jpg",
    fingerprint: sha256Fingerprint("mesmos bytes"),
    version: "v1",
  };
  const photo = {
    candidateId: CANDIDATE.id,
    kind: "documentaryPhoto",
    path: "/fixtures/photo.jpg",
    fingerprint: sha256Fingerprint("mesmos bytes"),
    source: "Acervo A",
    license: "Licença A",
  };
  const cardApproval = assetApprovalFingerprint(card);
  const photoApproval = assetApprovalFingerprint(photo);
  assert.notEqual(assetApprovalFingerprint({ ...card, path: "/fixtures/outra-arte.jpg" }), cardApproval);
  assert.notEqual(assetApprovalFingerprint({ ...card, version: "v2" }), cardApproval);
  assert.notEqual(assetApprovalFingerprint({ ...photo, source: "Acervo B" }), photoApproval);
  assert.notEqual(assetApprovalFingerprint({ ...photo, license: "Licença B" }), photoApproval);
});

test("unknown catalog references and malformed ledgers fail closed", () => {
  const base = { catalog: [CANDIDATE], topics: TOPICS, assetRegistry: { schemaVersion: 1, assets: [] } };
  assert.throws(
    () => createCandidateRegistry({ ...base, ledger: { schemaVersion: 1, decisions: [{ candidateId: "desconhecido", content: {} }] } }),
    /candidato desconhecido/,
  );
  assert.throws(
    () => createCandidateRegistry({ ...base, ledger: { schemaVersion: 2, decisions: [] } }),
    /schemaVersion 1/,
  );
  assert.throws(
    () => createCandidateRegistry({ ...base, ledger: { schemaVersion: 1, decisions: [{ candidateId: CANDIDATE.id, content: { status: "approved" } }] } }),
    /decidedBy/,
  );
  assert.throws(
    () => createCandidateRegistry({
      ...base,
      ledger: {
        schemaVersion: 1,
        decisions: [{
          candidateId: CANDIDATE.id,
          content: {
            status: "approved",
            fingerprint: candidateContentFingerprint(CANDIDATE),
            ...audit("content"),
            decidedAt: "2026-02-31",
          },
        }],
      },
    }),
    /data YYYY-MM-DD válida/,
  );
  assert.throws(
    () => createCandidateRegistry({
      ...base,
      assetRegistry: { schemaVersion: 1, assets: [{ candidateId: "desconhecido", kind: "cardArt" }] },
      ledger: { schemaVersion: 1, decisions: [] },
    }),
    /candidato desconhecido/,
  );
  assert.throws(
    () => createCandidateRegistry({
      ...base,
      assetRegistry: {
        schemaVersion: 1,
        assets: [{
          candidateId: CANDIDATE.id,
          kind: "cardArt",
          path: "//cdn.example/card.jpg",
          fingerprint: sha256Fingerprint("asset"),
          version: "v1",
        }],
      },
      ledger: { schemaVersion: 1, decisions: [] },
    }),
    /path inseguro/,
  );
});
