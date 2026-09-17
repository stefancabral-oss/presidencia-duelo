import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
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
import {
  EDITORIAL_AUTHORITY_RECEIPT_RULESET_V1,
  approvalAuthorityFromEnvironment,
  approvalAuthorityRequestFingerprint,
  authorityReceiptSigningPayload,
  createEd25519ApprovalAuthority,
  isEd25519ApprovalAuthority,
  verifyApprovalAuthorityReceipt,
} from "./editorial-authority.js";
import { textBlobFingerprint } from "./editorial-integrity.js";
import { createGitReviewedStateVerifier } from "./editorial-history.js";
import { createRepositoryFileAccess } from "./repository-files.js";
import {
  attachTestAttestations,
  createTestApprovalAuthority,
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
  const inputs = attestedInputs(input, options);
  const authority = createTestApprovalAuthority(inputs);
  return createCandidateRegistry({
    ...inputs,
    now: TEST_NOW,
    verifyApprovalAuthority: authority.verifier,
  });
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

function rewriteStructuredEvidence(inputs, dimension, mutate) {
  const decision = inputs.ledger.decisions[0][dimension];
  const attestationPath = decision.attestation.path;
  const attestation = JSON.parse(inputs.repositoryFiles.get(attestationPath));
  const evidencePath = attestation.evidence[0].path;
  const evidence = JSON.parse(inputs.repositoryFiles.get(evidencePath));
  mutate(evidence);
  const evidenceText = `${JSON.stringify(evidence, null, 2)}\n`;
  inputs.repositoryFiles.set(evidencePath, evidenceText);
  attestation.evidence[0].blobSha256 = textBlobFingerprint(evidenceText, evidencePath);
  const attestationText = `${JSON.stringify(attestation, null, 2)}\n`;
  inputs.repositoryFiles.set(attestationPath, attestationText);
  decision.attestation.blobSha256 = textBlobFingerprint(attestationText, attestationPath);
}

function signedAuthorityFor(attestations, {
  authorizedAt = "2026-09-16T12:00:00.000Z",
  now = TEST_NOW,
} = {}) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const issuer = "fixture-authority.example";
  const keyId = "fixture-ed25519-1";
  const receipts = attestations.map((attestation) => {
    const unsigned = {
      schemaVersion: 1,
      ruleset: EDITORIAL_AUTHORITY_RECEIPT_RULESET_V1,
      issuer,
      keyId,
      requestFingerprint: approvalAuthorityRequestFingerprint(attestation),
      authorizedAt,
    };
    return {
      ...unsigned,
      signature: sign(null, Buffer.from(JSON.stringify(authorityReceiptSigningPayload(unsigned))), privateKey).toString("base64url"),
    };
  });
  const publicKeyJwk = publicKey.export({ format: "jwk" });
  return {
    publicKeyJwk,
    issuer,
    keyId,
    receipts,
    verifier: createEd25519ApprovalAuthority({ publicKeyJwk, issuer, keyId, receipts, now }),
  };
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
    topicIds: ["eleicoes-2026"],
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
  const authority = createTestApprovalAuthority(inputs);
  const registry = createCandidateRegistry({
    ...inputs,
    now: TEST_NOW,
    verifyApprovalAuthority: authority.verifier,
  });
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
    () => {
      const inputs = attestedInputs(approvedInputs());
      const authority = createTestApprovalAuthority(inputs);
      return createCandidateRegistry({
        ...inputs,
        now: () => new Date("invalid"),
        verifyApprovalAuthority: authority.verifier,
      });
    },
    /clock deve retornar uma data válida/,
  );
  assert.throws(
    () => {
      const inputs = attestedInputs(approvedInputs({ decidedAt: "2026-09-17" }));
      const authority = createTestApprovalAuthority(inputs);
      return createCandidateRegistry({
        ...inputs,
        now: () => new Date("2026-09-17T02:30:00.000Z"),
        verifyApprovalAuthority: authority.verifier,
      });
    },
    /não pode estar no futuro/,
  );
  const boundaryInputs = attestedInputs(approvedInputs({ decidedAt: "2026-09-17" }));
  const boundaryNow = () => new Date("2026-09-17T03:30:00.000Z");
  const boundaryAuthority = createTestApprovalAuthority(boundaryInputs, {
    authorizedAt: "2026-09-17T03:30:00.000Z",
    now: boundaryNow,
  });
  assert.equal(createCandidateRegistry({
    ...boundaryInputs,
    now: boundaryNow,
    verifyApprovalAuthority: boundaryAuthority.verifier,
  }).candidates[0].eligible, true);
});

test("versioned policy validates only the declared reviewer claim", () => {
  for (const decidedBy of ["\u200b", "nome com espaço", "-invalido", "invalido--login", "invalido-"]) {
    assert.throws(() => createTestRegistry(approvedInputs({ decidedBy })), /login GitHub válido/);
  }
  assert.throws(
    () => createTestRegistry(approvedInputs({ decidedBy: "usuario-valido-mas-nao-autorizado" })),
    /não consta como revisor declarado na política versionada/,
  );
});

test("repository declarations default-deny without externally injected authority", () => {
  const inputs = attestedInputs(approvedInputs());
  const denied = createCandidateRegistry({ ...inputs, now: TEST_NOW });
  assert.equal(denied.authority.externalVerifierConfigured, false);
  assert.equal(denied.authority.verifiedDecisions, 0);
  assert.equal(denied.authority.deniedDecisions, 2);
  assert.equal(denied.candidates[0].publication.content.status, "pending");
  assert.equal(denied.candidates[0].publication.content.authorityDenied, true);
  assert.equal(denied.candidates[0].publication.cardArt.status, "missing");
  assert.equal(denied.candidates[0].publication.cardArt.authorityDenied, true);
  assert.equal(denied.candidates[0].eligible, false);
  assert.equal(denied.candidatesForTopic("eleicoes-2026").length, 0);

  let untrustedCallbackInvoked = false;
  const callbackFailure = createCandidateRegistry({
    ...inputs,
    now: TEST_NOW,
    verifyApprovalAuthority: () => {
      untrustedCallbackInvoked = true;
      throw new Error("serviço externo indisponível");
    },
  });
  assert.equal(untrustedCallbackInvoked, false);
  assert.equal(callbackFailure.candidates[0].eligible, false);
  assert.equal(callbackFailure.authority.deniedDecisions, 2);
});

test("unbranded callbacks, fake receipts and cloned proofs cannot authorize", () => {
  const inputs = attestedInputs(approvedInputs());
  const contentDecision = inputs.ledger.decisions[0].content;
  const contentAttestation = JSON.parse(inputs.repositoryFiles.get(contentDecision.attestation.path));
  const genuineAuthority = createTestApprovalAuthority(inputs);
  const genuineReceipt = verifyApprovalAuthorityReceipt(genuineAuthority.verifier, contentAttestation);
  assert.equal(isEd25519ApprovalAuthority(genuineAuthority.verifier), true);
  assert.ok(genuineReceipt);

  const malloryReceipt = {
    schemaVersion: 1,
    ruleset: EDITORIAL_AUTHORITY_RECEIPT_RULESET_V1,
    issuer: "mallory.example",
    keyId: "mallory-key",
    requestFingerprint: approvalAuthorityRequestFingerprint(contentAttestation),
    authorizedAt: "2026-09-16T12:00:00.000Z",
    signature: "A".repeat(86),
  };
  const invalidReceipt = {
    ...malloryReceipt,
    authorizedAt: "data-inválida",
    signature: "assinatura-inválida",
  };
  const clonedGenuineReceipt = structuredClone(genuineReceipt);
  const wrappedGenuineVerifier = (attestation) => genuineAuthority.verifier(attestation);
  const forgeries = [
    ["boolean true", () => true],
    ["objeto Mallory", () => malloryReceipt],
    ["data/assinatura inválidas", () => invalidReceipt],
    ["clone de receipt genuíno", () => clonedGenuineReceipt],
    ["wrapper de verifier genuíno", wrappedGenuineVerifier],
    ["objeto direto", malloryReceipt],
  ];

  for (const [label, forgedAuthority] of forgeries) {
    assert.equal(isEd25519ApprovalAuthority(forgedAuthority), false, label);
    const denied = createCandidateRegistry({
      ...inputs,
      now: TEST_NOW,
      verifyApprovalAuthority: forgedAuthority,
    });
    assert.equal(denied.authority.externalVerifierConfigured, false, label);
    assert.equal(denied.authority.verifiedDecisions, 0, label);
    assert.equal(denied.authority.deniedDecisions, 2, label);
    assert.equal(denied.candidates[0].eligible, false, label);
    assert.equal(denied.candidates[0].publication.content.audit, null, label);
  }

  assert.equal(verifyApprovalAuthorityReceipt(() => clonedGenuineReceipt, contentAttestation), null);
  assert.equal(verifyApprovalAuthorityReceipt(wrappedGenuineVerifier, contentAttestation), null);
});

test("only valid Ed25519 receipts from injected external configuration authorize decisions", () => {
  const inputs = attestedInputs(approvedInputs());
  const attestations = ["content", "cardArt"].map((dimension) => {
    const decision = inputs.ledger.decisions[0][dimension];
    return JSON.parse(inputs.repositoryFiles.get(decision.attestation.path));
  });
  const authority = signedAuthorityFor(attestations);
  const registry = createCandidateRegistry({
    ...inputs,
    now: TEST_NOW,
    verifyApprovalAuthority: authority.verifier,
  });
  assert.equal(registry.authority.externalVerifierConfigured, true);
  assert.equal(registry.authority.verifiedDecisions, 2);
  assert.equal(registry.authority.deniedDecisions, 0);
  assert.equal(registry.candidates[0].eligible, true);
  assert.equal(
    registry.candidates[0].publication.content.audit.authorityReceipt.authorizedAt,
    "2026-09-16T12:00:00.000Z",
  );
  assert.equal(
    registry.candidates[0].publication.content.audit.authorityReceipt.requestFingerprint,
    approvalAuthorityRequestFingerprint(attestations[0]),
  );

  const fromEnvironment = approvalAuthorityFromEnvironment({
    EDITORIAL_AUTHORITY_PUBLIC_JWK: JSON.stringify(authority.publicKeyJwk),
    EDITORIAL_AUTHORITY_ISSUER: authority.issuer,
    EDITORIAL_AUTHORITY_KEY_ID: authority.keyId,
    EDITORIAL_AUTHORITY_RECEIPTS: JSON.stringify(authority.receipts),
  }, { now: TEST_NOW });
  assert.equal(isEd25519ApprovalAuthority(fromEnvironment), true);
  assert.equal(
    verifyApprovalAuthorityReceipt(fromEnvironment, attestations[0]).requestFingerprint,
    authority.receipts[0].requestFingerprint,
  );
  assert.equal(
    verifyApprovalAuthorityReceipt(fromEnvironment, { ...attestations[0], decidedAt: "2026-09-15" }),
    null,
  );
  assert.equal(approvalAuthorityFromEnvironment({}), null);
  assert.throws(
    () => approvalAuthorityFromEnvironment({ EDITORIAL_AUTHORITY_ISSUER: authority.issuer }),
    /configuração externa.*incompleta/,
  );
  const forgedReceipts = structuredClone(authority.receipts);
  const finalSignatureCharacter = forgedReceipts[0].signature.at(-1);
  forgedReceipts[0].signature = `${forgedReceipts[0].signature.slice(0, -1)}${finalSignatureCharacter === "A" ? "B" : "A"}`;
  assert.throws(
    () => createEd25519ApprovalAuthority({ ...authority, receipts: forgedReceipts, now: TEST_NOW }),
    /não foi assinado|assinatura Ed25519 inválida/,
  );

  const beforeDecision = signedAuthorityFor(attestations, {
    authorizedAt: "2026-09-15T23:59:59.999Z",
  });
  const chronologicallyDenied = createCandidateRegistry({
    ...inputs,
    now: TEST_NOW,
    verifyApprovalAuthority: beforeDecision.verifier,
  });
  assert.equal(chronologicallyDenied.authority.verifiedDecisions, 0);
  assert.equal(chronologicallyDenied.authority.deniedDecisions, 2);
  assert.equal(chronologicallyDenied.candidates[0].eligible, false);

  assert.throws(
    () => signedAuthorityFor(attestations, { authorizedAt: "2026-09-16T12:00:00.001Z" }),
    /não pode ser autorizado no futuro/,
  );
});

test("attestations require structured candidate-scoped evidence and verified captures", () => {
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

  const arbitraryEvidence = attestedInputs(approvedInputs());
  const arbitraryAttestation = JSON.parse(arbitraryEvidence.repositoryFiles.get(
    arbitraryEvidence.ledger.decisions[0].content.attestation.path,
  ));
  arbitraryEvidence.repositoryFiles.set(arbitraryAttestation.evidence[0].path, "x");
  rewriteAttestation(arbitraryEvidence, "content", (record) => {
    record.evidence[0].blobSha256 = textBlobFingerprint("x", record.evidence[0].path);
  });
  assert.throws(() => createTestRegistry(arbitraryEvidence), /não contém JSON válido/);

  const extraNestedField = attestedInputs(approvedInputs());
  rewriteStructuredEvidence(extraNestedField, "content", (record) => { record.reviewedItems[0].x = true; });
  assert.throws(() => createTestRegistry(extraNestedField), /campos inválidos.*x/);

  const trivialReviewNote = attestedInputs(approvedInputs());
  rewriteStructuredEvidence(trivialReviewNote, "content", (record) => { record.reviewedItems[0].note = "x"; });
  assert.throws(() => createTestRegistry(trivialReviewNote), /note deve ser texto substantivo/);

  const wrongBinding = attestedInputs(approvedInputs());
  rewriteStructuredEvidence(wrongBinding, "content", (record) => { record.candidateId = "outro-candidato"; });
  assert.throws(() => createTestRegistry(wrongBinding), /não está ligado ao candidato\/dimensão/);

  const tamperedReference = attestedInputs(approvedInputs());
  const referenceAttestation = JSON.parse(tamperedReference.repositoryFiles.get(
    tamperedReference.ledger.decisions[0].content.attestation.path,
  ));
  const referenceEvidence = JSON.parse(tamperedReference.repositoryFiles.get(referenceAttestation.evidence[0].path));
  tamperedReference.repositoryFiles.set(
    referenceEvidence.references[0].path,
    "Captura editorial adulterada com conteúdo materialmente diferente.",
  );
  assert.throws(() => createTestRegistry(tamperedReference), /blobSha256 não corresponde à captura/);

  const trivialReference = attestedInputs(approvedInputs());
  rewriteStructuredEvidence(trivialReference, "content", (record) => {
    const reference = record.references[0];
    trivialReference.repositoryFiles.set(reference.path, "x");
    reference.blobSha256 = textBlobFingerprint("x", reference.path);
  });
  assert.throws(() => createTestRegistry(trivialReference), /captura textual substantiva/);

  const externalUrlWithoutCapture = attestedInputs(approvedInputs());
  rewriteStructuredEvidence(externalUrlWithoutCapture, "content", (record) => {
    record.references[0].sourceUrl = "https://example.test/revisao";
    record.references[0].path = "https://example.test/revisao";
  });
  assert.throws(() => createTestRegistry(externalUrlWithoutCapture), /captura interna no escopo exato/);

  const capturedExternalUrl = attestedInputs(approvedInputs());
  rewriteStructuredEvidence(capturedExternalUrl, "content", (record) => {
    record.references[0].sourceUrl = "https://example.test/revisao";
  });
  assert.equal(createTestRegistry(capturedExternalUrl).candidates[0].eligible, true);

  const currentSymlink = attestedInputs(approvedInputs());
  const symlinkAttestation = JSON.parse(currentSymlink.repositoryFiles.get(
    currentSymlink.ledger.decisions[0].content.attestation.path,
  ));
  const regularStat = currentSymlink.statRepositoryFile;
  currentSymlink.statRepositoryFile = (repositoryPath) => (
    repositoryPath === symlinkAttestation.evidence[0].path
      ? { isFile: false, isSymbolicLink: true, mode: 0o777 }
      : regularStat(repositoryPath)
  );
  assert.throws(() => createTestRegistry(currentSymlink), /deve ser arquivo regular, nunca symlink/);

  for (const unsafePath of ["https://example.test/revisao", "app/public/brand/logo-volumetric.png", "shared/editorial-evidence/outro/content/review.json"]) {
    const unrelated = attestedInputs(approvedInputs());
    rewriteAttestation(unrelated, "content", (record) => {
      record.evidence[0].path = unsafePath;
      record.evidence[0].blobSha256 = sha256Fingerprint("irrelevante");
    });
    unrelated.repositoryFiles.set(unsafePath, "irrelevante");
    assert.throws(() => createTestRegistry(unrelated), /path deve apontar para o registro JSON estruturado/);
  }
});

test("repository evidence reader rejects a symlinked ancestor escaping the repository", () => {
  const container = mkdtempSync(path.join(tmpdir(), "polimatch-editorial-files-"));
  const repositoryRoot = path.join(container, "repository");
  const outsideRoot = path.join(container, "outside");
  mkdirSync(repositoryRoot);
  mkdirSync(outsideRoot);
  writeFileSync(path.join(outsideRoot, "review.json"), "evidência externa que não pertence ao repositório");
  try {
    symlinkSync(outsideRoot, path.join(repositoryRoot, "linked-evidence"), "junction");
    const access = createRepositoryFileAccess(repositoryRoot);
    assert.throws(
      () => access.statRepositoryFile("linked-evidence/review.json"),
      /caminho usa symlink no repositório/,
    );
    assert.throws(
      () => access.loadRepositoryFile("linked-evidence/review.json"),
      /caminho usa symlink no repositório/,
    );
  } finally {
    rmSync(container, { recursive: true, force: true });
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
  const repositoryBytes = (repositoryPath) => {
    if (inputs.repositoryFiles.has(repositoryPath)) return Buffer.from(inputs.repositoryFiles.get(repositoryPath));
    if (repositoryPath === "shared/elections-2026.json") return Buffer.from(JSON.stringify(inputs.catalog));
    if (repositoryPath === "shared/editorial-asset-registry.json") return Buffer.from(JSON.stringify(inputs.assetRegistry));
    if (repositoryPath === "shared/editorial-governance-policy.json") return Buffer.from(JSON.stringify(inputs.governancePolicy));
    if (repositoryPath === "app/public/fixtures/card-art.jpg") return Buffer.from("arte-fixture-v1");
    throw new Error(`arquivo Git inesperado: ${repositoryPath}`);
  };
  const runGit = (args) => {
    if (args[0] === "cat-file") return Buffer.alloc(0);
    if (args[0] === "merge-base") return Buffer.alloc(0);
    if (args[0] === "ls-tree") return `100644 blob ${TEST_GIT_BLOB}\t${args[3]}\n`;
    if (args[0] === "show") return repositoryBytes(args[1].slice(args[1].indexOf(":") + 1));
    throw new Error(`git inesperado: ${args.join(" ")}`);
  };
  assert.equal(createGitReviewedStateVerifier({ runGit })(attestation), true);
  assert.equal(createGitReviewedStateVerifier({ runGit })(cardAttestation), true);
  assert.throws(
    () => createGitReviewedStateVerifier({ runGit: (args) => {
      if (args[0] === "ls-tree" && args[3] === evidencePath) {
        return `100644 blob ${"3".repeat(40)}\t${evidencePath}\n`;
      }
      return runGit(args);
    } })(attestation),
    /gitBlob diverge/,
  );
  assert.throws(
    () => createGitReviewedStateVerifier({ runGit: (args) => {
      if (args[0] === "ls-tree" && args[3] === evidencePath) {
        return `120000 blob ${TEST_GIT_BLOB}\t${evidencePath}\n`;
      }
      return runGit(args);
    } })(attestation),
    /modo Git não permitido/,
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
    /revisor declarado não corresponde à policy do commit revisado/,
  );
});

test("the real Git verifier ignores replace refs and rejects historical symlink blobs", () => {
  const repositoryRoot = mkdtempSync(path.join(tmpdir(), "polimatch-editorial-git-"));
  const git = (args, { input, encoding = "utf8" } = {}) => execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding,
    input,
    env: process.env,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  });
  const writeRepositoryFile = (repositoryPath, contents) => {
    const absolutePath = path.join(repositoryRoot, ...repositoryPath.split("/"));
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents);
  };

  try {
    git(["init", "--quiet"]);
    git(["config", "user.name", "Editorial Test"]);
    git(["config", "user.email", "editorial-test@example.invalid"]);
    git(["config", "commit.gpgsign", "false"]);

    const inputs = attestedInputs(approvedInputs());
    const decision = inputs.ledger.decisions[0].content;
    const attestation = JSON.parse(inputs.repositoryFiles.get(decision.attestation.path));
    const evidencePath = attestation.evidence[0].path;
    const evidence = JSON.parse(inputs.repositoryFiles.get(evidencePath));
    const reference = evidence.references[0];
    const referenceText = inputs.repositoryFiles.get(reference.path);

    writeRepositoryFile(reference.path, referenceText);
    reference.gitBlob = git(["hash-object", reference.path]).trim();
    const evidenceText = `${JSON.stringify(evidence, null, 2)}\n`;
    writeRepositoryFile(evidencePath, evidenceText);
    attestation.evidence[0].gitBlob = git(["hash-object", evidencePath]).trim();
    attestation.evidence[0].blobSha256 = textBlobFingerprint(evidenceText, evidencePath);
    writeRepositoryFile("shared/elections-2026.json", `${JSON.stringify(inputs.catalog, null, 2)}\n`);
    writeRepositoryFile("shared/editorial-governance-policy.json", `${JSON.stringify(inputs.governancePolicy, null, 2)}\n`);
    git(["add", "--", "shared"]);
    git(["commit", "--quiet", "-m", "reviewed editorial state"]);
    const reviewedCommit = git(["rev-parse", "HEAD"]).trim();
    attestation.reviewedCommit = reviewedCommit;

    writeRepositoryFile(
      "shared/editorial-governance-policy.json",
      `${JSON.stringify(testGovernancePolicy(["outro-editor"]), null, 2)}\n`,
    );
    git(["add", "--", "shared/editorial-governance-policy.json"]);
    git(["commit", "--quiet", "-m", "forged replacement state"]);
    const forgedCommit = git(["rev-parse", "HEAD"]).trim();
    git(["replace", reviewedCommit, forgedCommit]);
    assert.match(git(["show", `${reviewedCommit}:shared/editorial-governance-policy.json`]), /outro-editor/);

    const hostileEnvironment = {
      ...process.env,
      GIT_NO_REPLACE_OBJECTS: "0",
      GIT_DIR: path.join(repositoryRoot, "attacker-git-dir"),
      GIT_WORK_TREE: path.join(repositoryRoot, "attacker-work-tree"),
      GIT_OBJECT_DIRECTORY: path.join(repositoryRoot, "attacker-objects"),
      GIT_ALTERNATE_OBJECT_DIRECTORIES: path.join(repositoryRoot, "attacker-alternates"),
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "core.repositoryformatversion",
      GIT_CONFIG_VALUE_0: "99",
    };
    assert.equal(createGitReviewedStateVerifier({ repositoryRoot, environment: hostileEnvironment })(attestation), true);

    git(["replace", "-d", reviewedCommit]);
    git(["checkout", "--quiet", "--detach", reviewedCommit]);
    const symlinkBlob = git(["hash-object", "-w", "--stdin"], { input: evidenceText }).trim();
    git(["update-index", "--add", "--cacheinfo", `120000,${symlinkBlob},${evidencePath}`]);
    git(["commit", "--quiet", "-m", "historical symlink evidence"]);
    const symlinkCommit = git(["rev-parse", "HEAD"]).trim();
    const symlinkAttestation = structuredClone(attestation);
    symlinkAttestation.reviewedCommit = symlinkCommit;
    symlinkAttestation.evidence[0].gitBlob = symlinkBlob;
    assert.throws(
      () => createGitReviewedStateVerifier({ repositoryRoot })(symlinkAttestation),
      /modo Git não permitido.*120000 blob/,
    );
  } finally {
    assert.equal(path.resolve(repositoryRoot).startsWith(path.resolve(tmpdir())), true);
    rmSync(repositoryRoot, { recursive: true, force: true });
  }
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
