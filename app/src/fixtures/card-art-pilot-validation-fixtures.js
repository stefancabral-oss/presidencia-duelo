import { createHash } from "node:crypto";
import { CARD_ART_PILOT_CODES, cardArtPilotBatchIdentity } from "../card-art-pilot-validation.js";
import {
  CARD_ART_PILOT_BUNDLE_PROTOCOL,
  CARD_ART_PILOT_RECEIPT_PROTOCOL,
  cardArtPilotCustodyFromBundle,
  cardArtPilotReceiptRegistrySha256,
  cardArtPilotReceiptSha256
} from "../card-art-pilot-participant-validation.js";

function scenarioMetrics() {
  return {
    validResponses: 20,
    recognized: 16,
    recognitionRate: 0.8,
    favorece: 2,
    neutra: 16,
    prejudica: 2,
    favoreceRate: 0.1,
    neutraRate: 0.8,
    prejudicaRate: 0.1
  };
}

function approvedReview(role) {
  return {
    status: "approved",
    reviewedBy: `${role} Reviewer`,
    reviewedAt: "2026-09-16T01:45:00Z",
    notes: "fixture"
  };
}

function assetResult(blindCode) {
  return {
    blindCode,
    validResponses: 40,
    recognition: {
      correct: 32,
      incorrect: 4,
      unknown: 4,
      rate: 0.8
    },
    neutrality: {
      favorece: 4,
      neutra: 32,
      prejudica: 4,
      favoreceRate: 0.1,
      neutraRate: 0.8,
      prejudicaRate: 0.1,
      balancePercentagePoints: 0
    },
    byDisplayScenario: {
      "mobile-390x844": scenarioMetrics(),
      "desktop-1000x800": scenarioMetrics()
    },
    identityReview: approvedReview("Identity"),
    dignityReview: approvedReview("Dignity")
  };
}

export function validResultFixture(decision = "iterar", manifest = readyManifestFixture()) {
  const receiptRegistry = receiptRegistryFixture(manifest);
  const bundle = validParticipantBundleFixture(manifest, receiptRegistry);
  return {
    protocol: "card-art-pilot-176-v2",
    issue: 176,
    batch: cardArtPilotBatchIdentity(manifest),
    custody: cardArtPilotCustodyFromBundle(bundle, receiptRegistry),
    generatedAt: "2026-09-16T02:30:00Z",
    sample: {
      participantCount: 40,
      displayScenarios: {
        "mobile-390x844": 20,
        "desktop-1000x800": 20
      },
      externalRecruitment: {
        externalParticipantsOnly: true,
        productionTeamExcluded: true,
        attestedBy: "Research Lead",
        attestedAt: "2026-09-16T01:30:00Z"
      },
      privacy: {
        containsParticipantRecords: false,
        minimumPublishedCellSize: 5,
        crossTabsPublished: false,
        rawExportsDeletedAfterConsolidation: true
      },
      strata: {
        regional: {
          published: [
            { key: "sudeste", participantCount: 20 },
            { key: "nordeste", participantCount: 15 }
          ],
          suppressedCount: 5
        },
        familiarity: {
          published: [
            { key: "media", participantCount: 20 },
            { key: "alta", participantCount: 15 }
          ],
          suppressedCount: 5
        }
      }
    },
    assets: CARD_ART_PILOT_CODES.map(assetResult),
    decision: {
      value: decision,
      decidedBy: "Decision Owner",
      decidedAt: "2026-09-16T02:00:00Z",
      rationale: "fixture coerente"
    }
  };
}

export function readyManifestFixture() {
  const manifest = {
    version: "batch-2-ready",
    status: "pilot-ready-for-human-decision",
    issue: 176,
    tool: "Fixture image generator",
    generatedOn: "2026-09-16",
    generatedAt: "2026-09-16T00:20:00Z",
    generationCommit: "b".repeat(40),
    styleGuide: "docs/design/CARD_ART_NEUTRALITY_GUIDE.md",
    styleGuideAtGeneration: "pilot-2",
    styleGuideCommitAtGeneration: "a".repeat(40),
    styleGuideSha256AtGeneration: "c".repeat(64),
    styleGuideVersionedAt: "2026-09-16T00:10:00Z",
    currentStyleGuideVersion: "pilot-2",
    collectionAllowed: true,
    scaleDecisionAllowed: true,
    generationContract: {
      plan: {
        path: "stages/12_quality_gate_main/evidence/card-art-pilot-176/generation-plan.json",
        commit: "c".repeat(40),
        sha256: "d".repeat(64)
      },
      receipt: {
        path: "stages/12_quality_gate_main/evidence/card-art-pilot-176/generation-receipt.json",
        commit: "b".repeat(40),
        sha256: "e".repeat(64)
      }
    },
    generationContractSchema: "stages/12_quality_gate_main/references/card-art-pilot-generation-contract.schema.json",
    participantResponseSchema: "stages/12_quality_gate_main/references/card-art-pilot-participant-response.schema.json",
    responseBundleSchema: "stages/12_quality_gate_main/references/card-art-pilot-response-bundle.schema.json",
    receiptRegistrySchema: "stages/12_quality_gate_main/references/card-art-pilot-receipt-registry.schema.json",
    commonPrompt: "locked fixture prompt",
    assets: CARD_ART_PILOT_CODES.map((blindCode, index) => ({
      blindCode,
      personId: String(index + 1).padStart(3, "0"),
      slug: `fixture-person-${index + 1}`,
      file: `${blindCode}.png`,
      generationPath: `stages/12_quality_gate_main/evidence/card-art-pilot-176/${blindCode}.png`,
      width: 1120,
      height: 1400,
      sha256: String(index + 1).padStart(64, "0"),
      sourceOutput: `fixture-output-${blindCode}.png`,
      styleAnchor: index === 0 ? null : "P01.png",
      identityReference: {
        path: `app/public/portraits/${String(index + 1).padStart(3, "0")}.jpg`,
        sha256: String(index + 101).padStart(64, "0"),
        derivation: "audited-catalog-import",
        licenseStatus: "documented",
        photoSource: `https://example.test/references/${blindCode}.jpg`,
        photographer: "Fixture Photographer",
        license: "CC BY 4.0"
      }
    }))
  };
  const receiptRegistry = receiptRegistryFixture(manifest);
  manifest.receiptRegistry = {
    protocol: receiptRegistry.protocol,
    path: "stages/12_quality_gate_main/evidence/card-art-pilot-176/receipt-registry.json",
    commit: "9".repeat(40),
    committedAt: "2026-09-16T00:26:00Z",
    sha256: cardArtPilotReceiptRegistrySha256(receiptRegistry),
    issuedCount: receiptRegistry.receiptHashes.length
  };
  return manifest;
}

export function receiptTokenFixture(index) {
  return createHash("sha256").update(`card-art-pilot-fixture-receipt-${index}`, "utf8").digest("hex");
}

export function receiptRegistryFixture(manifest = readyManifestFixture()) {
  const registry = {
    protocol: CARD_ART_PILOT_RECEIPT_PROTOCOL,
    batchVersion: manifest.version,
    assets: CARD_ART_PILOT_CODES.map((blindCode) => {
      const asset = manifest.assets.find((candidate) => candidate.blindCode === blindCode);
      return { blindCode, sha256: asset?.sha256 || "0".repeat(64) };
    }),
    receiptDomain: "f".repeat(64),
    issuedAt: "2026-09-16T00:25:00Z",
    receiptHashes: []
  };
  registry.receiptHashes = Array.from({ length: 40 }, (_, index) => cardArtPilotReceiptSha256(receiptTokenFixture(index), registry)).sort();
  return registry;
}

export function validParticipantResponseFixture(
  manifest = readyManifestFixture(),
  responseId = "a".repeat(32),
  scenarioId = "mobile-390x844",
  receipt = receiptTokenFixture(0),
  collectedAt = "2026-09-16T00:30:00Z"
) {
  const mobile = scenarioId === "mobile-390x844";
  return {
    protocol: "card-art-pilot-176-v2-participant",
    batch: cardArtPilotBatchIdentity(manifest),
    responseId,
    receipt,
    collectedAt,
    displayScenario: {
      id: scenarioId,
      viewport: mobile ? { width: 390, height: 844 } : { width: 1000, height: 800 },
      card: mobile ? { width: 183.5, height: 280 } : { width: 226, height: 316.4 },
      artWindow: mobile ? { width: 169.5, height: 162 } : { width: 206, height: 189.4 },
      image: mobile
        ? { width: 167.5, height: 160, objectFit: "cover", objectPosition: "50% 0%" }
        : { width: 204, height: 187.4, objectFit: "cover", objectPosition: "50% 0%" },
      blindPlate: mobile ? { width: 169.5, height: 105 } : { width: 206, height: 109 }
    },
    strata: {
      familiarity: "media",
      region: "sudeste"
    },
    responses: CARD_ART_PILOT_CODES.map((code) => ({
      code,
      identity: "Pessoa reconhecida",
      tone: "neutra"
    })),
    disclosureSeen: true
  };
}

export function validParticipantBundleFixture(manifest = readyManifestFixture(), receiptRegistry = receiptRegistryFixture(manifest)) {
  const responses = Array.from({ length: 40 }, (_, index) => validParticipantResponseFixture(
    manifest,
    index.toString(16).padStart(32, "0"),
    index < 20 ? "mobile-390x844" : "desktop-1000x800",
    receiptTokenFixture(index),
    new Date(Date.parse("2026-09-16T00:30:00Z") + (index * 60_000)).toISOString()
  ));
  return {
    protocol: CARD_ART_PILOT_BUNDLE_PROTOCOL,
    batch: cardArtPilotBatchIdentity(manifest),
    receiptRegistrySha256: cardArtPilotReceiptRegistrySha256(receiptRegistry),
    responses
  };
}
