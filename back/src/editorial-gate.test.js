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
const TEST_NOW = () => new Date("2026-09-16T12:00:00.000Z");
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

function createTestRegistry(input) {
  return createCandidateRegistry({ ...input, now: TEST_NOW });
}

function audit(dimension) {
  return {
    decidedBy: "editor-humano",
    decidedAt: "2026-09-16",
    basis: [{ label: `Evidência ${dimension}`, reference: `https://example.test/${dimension}` }],
  };
}

function approvedInputs({
  candidate = structuredClone(CANDIDATE),
  decidedBy = "editor-humano",
  decidedAt = "2026-09-16",
  contentBasis = [{ label: "Fonte primária", reference: "https://example.test/conteudo" }],
  cardBasis = [{ label: "Gate visual", reference: "docs/editorial/evidencia.md#arte" }],
  version = "fixture-v1",
} = {}) {
  const cardAsset = {
    candidateId: candidate.id,
    kind: "cardArt",
    path: "/fixtures/card-art.jpg",
    fingerprint: sha256Fingerprint("arte-fixture-v1"),
    version,
  };
  return {
    catalog: [candidate],
    topics: [{ id: "eleicoes-2026", active: true }],
    assetRegistry: { schemaVersion: 1, assets: [cardAsset] },
    ledger: {
      schemaVersion: 1,
      decisions: [{
        candidateId: candidate.id,
        content: {
          status: "approved",
          fingerprint: candidateContentFingerprint(candidate),
          decidedBy,
          decidedAt,
          basis: contentBasis,
        },
        cardArt: {
          status: "approved",
          fingerprint: assetApprovalFingerprint(cardAsset),
          decidedBy,
          decidedAt,
          basis: cardBasis,
        },
      }],
    },
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
  return createTestRegistry({
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
  const registry = createTestRegistry({ catalog: [changed], topics: TOPICS, ledger, assetRegistry: assets });
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

test("approved candidates and public payloads are independent deeply frozen snapshots", () => {
  const inputs = approvedInputs();
  const registry = createTestRegistry(inputs);
  const candidate = registry.candidates[0];
  const payload = candidatePublicPayload(candidate);
  const originalFingerprint = candidate.publication.content.fingerprint;
  const originalSource = candidate.sources[0].url;

  assert.notStrictEqual(candidate.sources, inputs.catalog[0].sources);
  assert.notStrictEqual(candidate.sources[0], inputs.catalog[0].sources[0]);
  assert.notStrictEqual(payload.sources, candidate.sources);
  assert.notStrictEqual(payload.sources[0], candidate.sources[0]);
  assert.throws(() => { candidate.sources[0].url = "https://attacker.invalid/candidate"; }, TypeError);
  assert.throws(() => { payload.sources[0].url = "https://attacker.invalid/payload"; }, TypeError);
  assert.throws(() => { candidate.publication.content.audit.basis[0].reference = "https://attacker.invalid/audit"; }, TypeError);

  inputs.catalog[0].sources[0].url = "https://attacker.invalid/input";
  inputs.ledger.decisions[0].content.status = "rejected";
  inputs.ledger.decisions[0].content.basis[0].reference = "https://attacker.invalid/ledger";
  inputs.assetRegistry.assets[0].version = "attacker-v2";
  inputs.topics[0].active = false;

  assert.equal(candidate.sources[0].url, originalSource);
  assert.equal(payload.sources[0].url, originalSource);
  assert.equal(candidate.publication.content.status, "approved");
  assert.equal(candidate.publication.cardArt.version, "fixture-v1");
  assert.equal(candidate.publication.content.fingerprint, originalFingerprint);
  assert.equal(registry.candidatesForTopic("eleicoes-2026").length, 1);
});

test("a nested public-content edit requires a new fingerprint and registry", () => {
  const inputs = approvedInputs();
  inputs.catalog[0].sources[0].url = "https://example.test/fonte-atualizada";
  const registry = createTestRegistry(inputs);
  assert.equal(registry.candidates[0].publication.content.status, "pending");
  assert.equal(registry.candidates[0].publication.content.invalidated, true);
  assert.equal(registry.candidatesForTopic("eleicoes-2026").length, 0);
});

test("registry lookup facades expose no mutation path", () => {
  const registry = createTestRegistry(approvedInputs());
  const topic = registry.topicsById.get("eleicoes-2026");
  const candidate = registry.candidatesById.get(CANDIDATE.id);

  assert.equal(typeof registry.topicsById.set, "undefined");
  assert.equal(typeof registry.topicsById.delete, "undefined");
  assert.equal(typeof registry.topicsById.clear, "undefined");
  assert.equal(typeof registry.candidatesById.set, "undefined");
  assert.equal(typeof registry.candidatesById.delete, "undefined");
  assert.equal(typeof registry.candidatesById.clear, "undefined");
  assert.throws(() => registry.candidatesById.set("forjado", {}), TypeError);
  assert.throws(() => { registry.candidatesById.get = () => ({ eligible: true }); }, TypeError);
  assert.throws(() => { topic.active = false; }, TypeError);
  assert.throws(() => { candidate.eligible = false; }, TypeError);
  assert.deepEqual([...registry.topicsById.values()].map(({ id }) => id), ["eleicoes-2026"]);
  assert.equal(registry.candidateBelongsToTopic(CANDIDATE.id, "eleicoes-2026"), true);
  assert.equal(registry.candidateBelongsToTopic("forjado", "eleicoes-2026"), false);
});

test("decision dates use an injected clock and cannot be future-dated", () => {
  assert.equal(createTestRegistry(approvedInputs()).candidates[0].eligible, true);
  assert.throws(
    () => createTestRegistry(approvedInputs({ decidedAt: "2026-09-17" })),
    /não pode estar no futuro/,
  );
  assert.throws(
    () => createCandidateRegistry({ ...approvedInputs(), now: () => new Date("invalid") }),
    /clock deve retornar uma data válida/,
  );
  assert.throws(
    () => createCandidateRegistry({
      ...approvedInputs({ decidedAt: "2026-09-17" }),
      now: () => new Date("2026-09-17T02:30:00.000Z"),
    }),
    /não pode estar no futuro/,
  );
  assert.equal(createCandidateRegistry({
    ...approvedInputs({ decidedAt: "2026-09-17" }),
    now: () => new Date("2026-09-17T03:30:00.000Z"),
  }).candidates[0].eligible, true);
});

test("approver identity and evidence reject invisible or unsafe metadata", () => {
  for (const decidedBy of ["\u200b", "nome com espaço", "-invalido", "invalido--login", "invalido-"]) {
    assert.throws(() => createTestRegistry(approvedInputs({ decidedBy })), /login GitHub válido/);
  }
  for (const label of ["\u200b", "Evidência\nquebrada", "\u00a0"]) {
    assert.throws(
      () => createTestRegistry(approvedInputs({ contentBasis: [{ label, reference: "https://example.test/fonte" }] })),
      /basis.label deve ser texto visível/,
    );
  }
  for (const reference of ["\u200b", "http://example.test/fonte", "../segredo.md", "docs/../segredo.md", "/absoluto.md"] ) {
    assert.throws(
      () => createTestRegistry(approvedInputs({ contentBasis: [{ label: "Fonte", reference }] })),
      /basis.reference deve ser URL HTTPS ou caminho seguro/,
    );
  }
  const executableMetadata = approvedInputs();
  executableMetadata.ledger.decisions[0].content.basis[0].extra = () => "mutável";
  assert.throws(() => createTestRegistry(executableMetadata), /somente valores JSON/);
});

test("asset provenance metadata must remain visible and safe", () => {
  for (const version of ["\u200b", "versão\nforjada", "\u00a0"]) {
    assert.throws(() => createTestRegistry(approvedInputs({ version })), /versão visível/);
  }

  for (const [field, value] of [["source", "\u200b"], ["license", "licença\nforjada"]]) {
    const inputs = approvedInputs();
    const photoAsset = {
      candidateId: CANDIDATE.id,
      kind: "documentaryPhoto",
      path: "/fixtures/documentary-photo.jpg",
      fingerprint: sha256Fingerprint("foto-fixture-v1"),
      source: "Acervo público",
      license: "CC BY 4.0",
      [field]: value,
    };
    inputs.assetRegistry.assets.push(photoAsset);
    assert.throws(() => createTestRegistry(inputs), /fonte e licença visíveis/);
  }

  const unsafePath = approvedInputs();
  unsafePath.assetRegistry.assets[0].path = "/fixtures/\u200bcard.jpg";
  assert.throws(() => createTestRegistry(unsafePath), /path inseguro/);
});

test("unknown catalog fields fail until their editorial policy is explicit", () => {
  const candidate = { ...structuredClone(CANDIDATE), primaryArea: "Política nacional" };
  assert.throws(
    () => createTestRegistry(approvedInputs({ candidate })),
    /campo de catálogo sem política editorial: primaryArea/,
  );
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
  const registry = createTestRegistry({
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
  const registry = createTestRegistry({ catalog: [CANDIDATE], topics: TOPICS, ledger, assetRegistry });
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
    () => createTestRegistry({ ...base, ledger: { schemaVersion: 1, decisions: [{ candidateId: "desconhecido", content: {} }] } }),
    /candidato desconhecido/,
  );
  assert.throws(
    () => createTestRegistry({ ...base, ledger: { schemaVersion: 2, decisions: [] } }),
    /schemaVersion 1/,
  );
  assert.throws(
    () => createTestRegistry({ ...base, ledger: { schemaVersion: 1, decisions: [{ candidateId: CANDIDATE.id, content: { status: "approved" } }] } }),
    /decidedBy/,
  );
  assert.throws(
    () => createTestRegistry({
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
    () => createTestRegistry({
      ...base,
      assetRegistry: { schemaVersion: 1, assets: [{ candidateId: "desconhecido", kind: "cardArt" }] },
      ledger: { schemaVersion: 1, decisions: [] },
    }),
    /candidato desconhecido/,
  );
  assert.throws(
    () => createTestRegistry({
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
