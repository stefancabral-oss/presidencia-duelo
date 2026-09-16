import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import { TOPICS } from "../src/candidates.js";
import { assetApprovalFingerprint, candidateContentFingerprint, createCandidateRegistry, sha256Fingerprint } from "../src/editorial-gate.js";
import {
  attachTestAttestations,
  createTestApprovalAuthority,
  TEST_AUTHORITY_NOW,
} from "./editorial-attestation-fixtures.js";

export const TEST_CANDIDATE_IDS = Object.freeze([
  "lula",
  "jair-bolsonaro",
  "anitta",
  "neymar-jr",
  "tarcisio-de-freitas",
]);

function audit(label) {
  return {
    decidedBy: "fixture-automatizada",
    decidedAt: "2026-09-16",
  };
}

export function createEditorialTestRegistry({
  candidateIds = TEST_CANDIDATE_IDS,
  approvedCandidateIds = candidateIds,
  documentaryPhotoIds = [],
} = {}) {
  const wanted = new Set(candidateIds);
  const approved = new Set(approvedCandidateIds);
  const withPhoto = new Set(documentaryPhotoIds);
  const catalog = CATALOG.filter(({ id }) => wanted.has(id));
  if (catalog.length !== wanted.size) throw new Error("fixture editorial referencia candidato inexistente");
  if ([...approved, ...withPhoto].some((id) => !wanted.has(id))) throw new Error("fixture editorial aprova candidato fora do catálogo injetado");

  const assets = [];
  const decisions = catalog.filter(({ id }) => approved.has(id)).map((candidate) => {
    const cardFingerprint = sha256Fingerprint(`fixture-card:${candidate.id}:v1`);
    const cardAsset = {
      candidateId: candidate.id,
      kind: "cardArt",
      path: `/fixtures/${candidate.id}-card.jpg`,
      fingerprint: cardFingerprint,
      version: "fixture-v1",
    };
    assets.push(cardAsset);
    const documentaryPhoto = withPhoto.has(candidate.id)
      ? (() => {
        const fingerprint = sha256Fingerprint(`fixture-photo:${candidate.id}:v1`);
        const photoAsset = {
          candidateId: candidate.id,
          kind: "documentaryPhoto",
          path: `/fixtures/${candidate.id}-photo.jpg`,
          fingerprint,
          source: "Fixture automatizada",
          license: "Uso exclusivo em teste",
        };
        assets.push(photoAsset);
        return { status: "approved", fingerprint: assetApprovalFingerprint(photoAsset), ...audit("Foto documental de fixture") };
      })()
      : { status: "missing", fingerprint: null, ...audit("Ausência de foto na fixture") };
    return {
      candidateId: candidate.id,
      content: {
        status: "approved",
        fingerprint: candidateContentFingerprint(candidate),
        ...audit("Conteúdo editorial de fixture"),
      },
      cardArt: { status: "approved", fingerprint: assetApprovalFingerprint(cardAsset), ...audit("Arte de carta de fixture") },
      documentaryPhoto,
    };
  });

  const inputs = attachTestAttestations({
    catalog,
    topics: TOPICS,
    ledger: { schemaVersion: 1, decisions },
    assetRegistry: { schemaVersion: 1, assets },
  });
  const authority = createTestApprovalAuthority(inputs);
  return createCandidateRegistry({
    ...inputs,
    now: TEST_AUTHORITY_NOW,
    verifyApprovalAuthority: authority.verifier,
  });
}

export function createApprovedTestRegistry(candidateIds = TEST_CANDIDATE_IDS, { documentaryPhotoIds = [] } = {}) {
  return createEditorialTestRegistry({ candidateIds, approvedCandidateIds: candidateIds, documentaryPhotoIds });
}
