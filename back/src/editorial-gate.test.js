import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSET_STATUSES,
  CONTENT_STATUSES,
  PUBLIC_CANDIDATE_SCHEMA_V1,
  PUBLIC_CANDIDATE_SCHEMA_V2,
  assetApprovalFingerprint,
  candidateContentFingerprint,
  candidatePublicContent,
  candidatePublicPayload,
  candidatePublicSnapshot,
  candidateRoutingFingerprint,
  createCandidateRegistry,
  sha256Fingerprint,
} from "./editorial-gate.js";
import { textBlobFingerprint } from "./editorial-integrity.js";
import { createGitReviewedStateVerifier } from "./editorial-history.js";
import {
  attachTestAttestations,
  TEST_GIT_BLOB,
  testGovernancePolicy,
} from "../test-support/editorial-attestation-fixtures.js";

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
  reviewedAt: "2026-09-16",
  reviewStatus: "pending",
  photo: "",
};

function attestedInputs(input, options) {
  return input.loadRepositoryFile ? input : attachTestAttestations(input, options);
}

function createTestRegistry(input, options) {
  return createCandidateRegistry({ ...attestedInputs(input, options), now: TEST_NOW });
}

function rewriteAttestation(inputs, dimension, mutate) {
  const decision = inputs.ledger.decisions[0][dimension];
  const path = decision.attestation.path;
  const record = JSON.parse(inputs.repositoryFiles.get(path));
  mutate(record);
  const text = `${JSON.stringify(record, null, 2)}\n`;
  inputs.repositoryFiles.set(path, text);
  decision.attestation.blobSha256 = textBlobFingerprint(text, path);
}

function audit(dimension) {
  return {
    decidedBy: "editor-humano",
    decidedAt: "2026-09-16",
  };
}

function approvedInputs({
  candidate = structuredClone(CANDIDATE),
  decidedBy = "editor-humano",
  decidedAt = "2026-09-16",
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
        },
        cardArt: {
          status: "approved",
          fingerprint: assetApprovalFingerprint(cardAsset),
          decidedBy,
          decidedAt,
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
  assert.equal(candidateContentFingerprint(CANDIDATE), sha256Fingerprint(JSON.stringify(projected)));
  for (const [field, value] of Object.entries(projected)) {
    const changedValue = Array.isArray(value)
      ? [...value, field === "sources" ? { label: "Outra fonte", url: "https://example.test/outra" } : "Outro fato"]
      : typeof value === "number" ? value + 1 : field === "id" ? `${value}-alterado` : `${value || ""} alterado`;
    assert.notEqual(
      candidateContentFingerprint({ ...CANDIDATE, [field]: changedValue }),
      candidateContentFingerprint(CANDIDATE),
      `o campo público ${field} precisa invalidar a aprovação`,
    );
  }
  const rerouted = { ...CANDIDATE, group: "influencia" };
  assert.equal(candidateContentFingerprint(rerouted), candidateContentFingerprint(CANDIDATE));
  assert.notEqual(candidateRoutingFingerprint(rerouted), candidateRoutingFingerprint(CANDIDATE));
});

test("candidate-public-v1 remains byte-stable and v2 is a separate strict schema", () => {
  const candidate = { ...CANDIDATE, cardArt: "", topicIds: ["eleicoes-2026"] };
  const v1 = JSON.stringify(candidatePublicSnapshot(candidate, PUBLIC_CANDIDATE_SCHEMA_V1));
  assert.equal(v1, "{\"personId\":1,\"id\":\"pessoa-teste\",\"name\":\"Pessoa de Teste\",\"displayName\":\"Pessoa\",\"affiliation\":\"Partido\",\"photo\":\"\",\"role\":\"Cargo público\",\"summary\":\"Resumo verificável.\",\"office\":\"Cargo público\",\"party\":\"Partido\",\"location\":\"Brasil\",\"bio\":\"Biografia verificável.\",\"relevance2026\":\"Relevância verificável.\",\"facts\":[\"Fato verificável.\"],\"highlight\":\"Destaque verificável.\",\"controversy\":\"Ponto de atenção verificável.\",\"sources\":[{\"label\":\"Fonte\",\"url\":\"https://example.test/fonte\"}],\"reviewedAt\":\"2026-09-16\",\"reviewStatus\":\"pending\",\"topicIds\":[\"eleicoes-2026\"]}");

  const { affiliation, office, area, ...withoutLegacyTaxonomy } = CANDIDATE;
  const provenance = Object.fromEntries(["role", "party", "primaryArea", "contextAffiliation"].map((field) => [field, {
    status: field === "contextAffiliation" ? "ambiguous" : field === "primaryArea" ? "inferred" : "extracted",
    source: `fonte#${field}`,
  }]));
  const v2Candidate = {
    ...withoutLegacyTaxonomy,
    party: "PARTIDO",
    primaryArea: "Política institucional",
    contextAffiliation: null,
    taxonomyProvenance: provenance,
  };
  const v2 = candidatePublicPayload(v2Candidate, { ruleset: PUBLIC_CANDIDATE_SCHEMA_V2 });
  assert.equal(v2.primaryArea, "Política institucional");
  assert.deepEqual(v2.taxonomyProvenance.contextAffiliation, { status: "ambiguous", source: "fonte#contextAffiliation" });
  assert.equal(Object.hasOwn(v2, "affiliation"), false);
  assert.equal(Object.hasOwn(v2, "office"), false);
  assert.deepEqual(Object.keys(candidatePublicSnapshot(v2Candidate, PUBLIC_CANDIDATE_SCHEMA_V2)), [
    "personId", "id", "name", "displayName", "photo", "role", "party", "primaryArea",
    "contextAffiliation", "taxonomyProvenance", "summary", "location", "bio", "relevance2026",
    "facts", "highlight", "controversy", "sources", "reviewedAt", "reviewStatus", "topicIds",
  ]);
  assert.equal(JSON.stringify(candidatePublicSnapshot(candidate, PUBLIC_CANDIDATE_SCHEMA_V1)), v1);
});

test("catalog and nested public content use exact typed schemas", () => {
  assert.throws(
    () => candidateContentFingerprint({ ...CANDIDATE, sources: [{ ...CANDIDATE.sources[0], tracking: "vaza" }] }),
    /campos inválidos.*tracking/,
  );
  assert.throws(() => candidateContentFingerprint({ ...CANDIDATE, facts: [{ text: "não é string" }] }), /facts\[0\].*texto visível/);
  assert.throws(() => candidateContentFingerprint({ ...CANDIDATE, office: null }), /office.*texto visível/);
  const absent = { ...CANDIDATE };
  delete absent.office;
  assert.throws(() => candidateContentFingerprint(absent), /campos inválidos.*office/);
  assert.throws(() => candidateContentFingerprint({ ...CANDIDATE, office: undefined }), /valores JSON definidos|office.*texto visível/);
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
  const inputs = attestedInputs(approvedInputs());
  const registry = createCandidateRegistry({ ...inputs, now: TEST_NOW });
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
  assert.throws(() => { candidate.publication.content.audit.attestation.evidence[0].path = "app/public/logo.svg"; }, TypeError);

  inputs.catalog[0].sources[0].url = "https://attacker.invalid/input";
  inputs.ledger.decisions[0].content.status = "rejected";
  rewriteAttestation(inputs, "content", (record) => { record.evidence[0].label = "Atacante"; });
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
    () => createCandidateRegistry({ ...attestedInputs(approvedInputs()), now: () => new Date("invalid") }),
    /clock deve retornar uma data válida/,
  );
  assert.throws(
    () => createCandidateRegistry({
      ...attestedInputs(approvedInputs({ decidedAt: "2026-09-17" })),
      now: () => new Date("2026-09-17T02:30:00.000Z"),
    }),
    /não pode estar no futuro/,
  );
  assert.equal(createCandidateRegistry({
    ...attestedInputs(approvedInputs({ decidedAt: "2026-09-17" })),
    now: () => new Date("2026-09-17T03:30:00.000Z"),
  }).candidates[0].eligible, true);
});

test("approver identity must be syntactically valid and authorized by versioned policy", () => {
  for (const decidedBy of ["\u200b", "nome com espaço", "-invalido", "invalido--login", "invalido-"]) {
    assert.throws(() => createTestRegistry(approvedInputs({ decidedBy })), /login GitHub válido/);
  }
  assert.throws(
    () => createTestRegistry(approvedInputs({ decidedBy: "usuario-valido-mas-nao-autorizado" })),
    /não está autorizado pela política versionada/,
  );
});

test("attestations require existing candidate-scoped internal evidence and matching blobs", () => {
  const missingAttestation = attestedInputs(approvedInputs());
  missingAttestation.repositoryFiles.delete(missingAttestation.ledger.decisions[0].content.attestation.path);
  assert.throws(() => createTestRegistry(missingAttestation), /attestation não existe no repositório/);

  const missingEvidence = attestedInputs(approvedInputs());
  const contentAttestation = JSON.parse(missingEvidence.repositoryFiles.get(
    missingEvidence.ledger.decisions[0].content.attestation.path,
  ));
  missingEvidence.repositoryFiles.delete(contentAttestation.evidence[0].path);
  assert.throws(() => createTestRegistry(missingEvidence), /evidence\[0\] não existe no repositório/);

  const tamperedEvidence = attestedInputs(approvedInputs());
  const tamperedAttestation = JSON.parse(tamperedEvidence.repositoryFiles.get(
    tamperedEvidence.ledger.decisions[0].content.attestation.path,
  ));
  tamperedEvidence.repositoryFiles.set(tamperedAttestation.evidence[0].path, "conteúdo trocado");
  assert.throws(() => createTestRegistry(tamperedEvidence), /blobSha256 não corresponde/);

  const blankEvidence = attestedInputs(approvedInputs());
  const blankAttestation = JSON.parse(blankEvidence.repositoryFiles.get(
    blankEvidence.ledger.decisions[0].content.attestation.path,
  ));
  blankEvidence.repositoryFiles.set(blankAttestation.evidence[0].path, "\n\t");
  rewriteAttestation(blankEvidence, "content", (record) => {
    record.evidence[0].blobSha256 = textBlobFingerprint("\n\t", record.evidence[0].path);
  });
  assert.throws(() => createTestRegistry(blankEvidence), /evidência textual visível e segura/);

  for (const unsafePath of ["https://example.test/revisao", "app/public/brand/logo-volumetric.png", "shared/editorial-evidence/outro/content/prova.md"]) {
    const unrelated = attestedInputs(approvedInputs());
    rewriteAttestation(unrelated, "content", (record) => {
      record.evidence[0].path = unsafePath;
      record.evidence[0].blobSha256 = sha256Fingerprint("irrelevante");
    });
    unrelated.repositoryFiles.set(unsafePath, "irrelevante");
    assert.throws(() => createTestRegistry(unrelated), /path deve apontar para evidência textual interna/);
  }
});

test("attestation identity, subject and reviewed commit are bound and locally verifiable", () => {
  const forgedIdentity = attestedInputs(approvedInputs());
  rewriteAttestation(forgedIdentity, "content", (record) => { record.decidedBy = "outro-editor"; });
  assert.throws(() => createTestRegistry(forgedIdentity), /não corresponde a decidedBy/);

  const forgedSubject = attestedInputs(approvedInputs());
  rewriteAttestation(forgedSubject, "content", (record) => { record.subject.fingerprint = sha256Fingerprint("outro"); });
  assert.throws(() => createTestRegistry(forgedSubject), /subject diverge da decisão/);

  const malformedCommit = attestedInputs(approvedInputs());
  rewriteAttestation(malformedCommit, "content", (record) => { record.reviewedCommit = "main"; });
  assert.throws(() => createTestRegistry(malformedCommit), /reviewedCommit deve ser SHA completo/);

  const unprovedCommit = attestedInputs(approvedInputs());
  assert.throws(
    () => createCandidateRegistry({
      ...unprovedCommit,
      now: TEST_NOW,
      verifyReviewedState: () => false,
    }),
    /não foi comprovada no commit revisado/,
  );
});

test("the local Git verifier proves evidence blobs and reviewed content", () => {
  const inputs = attestedInputs(approvedInputs());
  const attestationPath = inputs.ledger.decisions[0].content.attestation.path;
  const attestation = JSON.parse(inputs.repositoryFiles.get(attestationPath));
  const evidencePath = attestation.evidence[0].path;
  const cardAttestationPath = inputs.ledger.decisions[0].cardArt.attestation.path;
  const cardAttestation = JSON.parse(inputs.repositoryFiles.get(cardAttestationPath));
  const cardEvidencePath = cardAttestation.evidence[0].path;
  const runGit = (args) => {
    if (args[0] === "cat-file") return Buffer.alloc(0);
    if (args[0] === "merge-base") return Buffer.alloc(0);
    if (args[0] === "rev-parse") return `${TEST_GIT_BLOB}\n`;
    if (args[0] === "show" && args[1].endsWith(`:${evidencePath}`)) return Buffer.from(inputs.repositoryFiles.get(evidencePath));
    if (args[0] === "show" && args[1].endsWith(`:${cardEvidencePath}`)) return Buffer.from(inputs.repositoryFiles.get(cardEvidencePath));
    if (args[0] === "show" && args[1].endsWith(":shared/elections-2026.json")) return Buffer.from(JSON.stringify(inputs.catalog));
    if (args[0] === "show" && args[1].endsWith(":shared/editorial-asset-registry.json")) {
      return Buffer.from(JSON.stringify(inputs.assetRegistry));
    }
    if (args[0] === "show" && args[1].endsWith(":app/public/fixtures/card-art.jpg")) {
      return Buffer.from("arte-fixture-v1");
    }
    if (args[0] === "show" && args[1].endsWith(":shared/editorial-governance-policy.json")) {
      return Buffer.from(JSON.stringify(inputs.governancePolicy));
    }
    throw new Error(`git inesperado: ${args.join(" ")}`);
  };
  assert.equal(createGitReviewedStateVerifier({ runGit })(attestation), true);
  assert.equal(createGitReviewedStateVerifier({ runGit })(cardAttestation), true);
  assert.throws(
    () => createGitReviewedStateVerifier({ runGit: (args) => (
      args[0] === "rev-parse" ? `${"3".repeat(40)}\n` : runGit(args)
    ) })(attestation),
    /gitBlob diverge/,
  );
  assert.throws(
    () => createGitReviewedStateVerifier({ runGit: (args) => {
      if (args[0] === "merge-base") throw new Error("não ancestral");
      return runGit(args);
    } })(attestation),
    /não ancestral/,
  );
  assert.throws(
    () => createGitReviewedStateVerifier({ runGit: (args) => (
      args[0] === "show" && args[1].endsWith(":shared/editorial-governance-policy.json")
        ? Buffer.from(JSON.stringify(testGovernancePolicy(["outro-editor"])))
        : runGit(args)
    ) })(attestation),
    /revisor não estava autorizado no commit revisado/,
  );
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
    /campos inválidos.*primaryArea/,
  );
});

test("candidate-public-v2 accepts only the classified taxonomy provenance shape", () => {
  const { affiliation, office, area, ...base } = CANDIDATE;
  const taxonomyProvenance = {
    role: { status: "extracted", source: "perfil.json#ocupacao" },
    party: { status: "extracted", source: "perfil.json#partido" },
    primaryArea: { status: "inferred", source: "catalogo.json#grupo" },
    contextAffiliation: { status: "ambiguous", source: "perfil.json#contexto" },
  };
  const v2 = {
    ...base,
    party: "PARTIDO",
    primaryArea: "Política institucional",
    contextAffiliation: null,
    taxonomyProvenance,
  };
  assert.match(candidateContentFingerprint(v2, { ruleset: PUBLIC_CANDIDATE_SCHEMA_V2 }), /^sha256:/);
  assert.throws(
    () => candidateContentFingerprint({
      ...v2,
      taxonomyProvenance: { ...taxonomyProvenance, primaryArea: { ...taxonomyProvenance.primaryArea, confidence: 1 } },
    }, { ruleset: PUBLIC_CANDIDATE_SCHEMA_V2 }),
    /campos inválidos.*confidence/,
  );
  assert.throws(
    () => candidateContentFingerprint({
      ...v2,
      contextAffiliation: "Vínculo inventado",
    }, { ruleset: PUBLIC_CANDIDATE_SCHEMA_V2 }),
    /deve ser null quando a proveniência é ambiguous/,
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
    /candidate deve ser um objeto|campos inválidos|candidato desconhecido/,
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
    /campos inválidos|candidato desconhecido/,
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
