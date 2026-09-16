import { CARD_ART_PILOT_CODES, cardArtPilotManifestSha256 } from "../card-art-pilot-validation.js";

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
    reviewedAt: "2026-09-16T12:00:00Z",
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
  return {
    protocol: "card-art-pilot-176-v2",
    issue: 176,
    batch: {
      manifestSha256: cardArtPilotManifestSha256(manifest)
    },
    generatedAt: "2026-09-16T15:00:00Z",
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
        attestedAt: "2026-09-16T12:30:00Z"
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
      decidedAt: "2026-09-16T14:00:00Z",
      rationale: "fixture coerente"
    }
  };
}

export function readyManifestFixture() {
  return {
    version: "batch-2-ready",
    status: "pilot-ready-for-human-decision",
    issue: 176,
    tool: "Fixture image generator",
    generatedOn: "2026-09-16",
    styleGuide: "docs/design/CARD_ART_NEUTRALITY_GUIDE.md",
    styleGuideAtGeneration: "pilot-2",
    currentStyleGuideVersion: "pilot-2",
    collectionAllowed: true,
    scaleDecisionAllowed: true,
    commonPrompt: "locked fixture prompt",
    assets: CARD_ART_PILOT_CODES.map((blindCode, index) => ({
      blindCode,
      personId: String(index + 1).padStart(3, "0"),
      slug: `fixture-person-${index + 1}`,
      file: `${blindCode}.png`,
      width: 1120,
      height: 1400,
      sha256: String(index + 1).padStart(64, "0"),
      sourceOutput: `fixture-output-${blindCode}.png`,
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
}
