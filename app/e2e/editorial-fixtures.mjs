import { curatedPortraitPath } from "../../shared/curated-portraits.js";

export function approvedEditorialCandidate(candidate, { documentaryPhoto = true } = {}) {
  const fixtureImage = curatedPortraitPath(candidate.personId) || "/brand/logo-volumetric.png";
  return {
    ...candidate,
    cardArt: fixtureImage,
    photo: documentaryPhoto ? fixtureImage : "",
    reviewStatus: "approved",
    reviewedAt: "2026-09-16",
    publication: {
      content: { status: "approved", reviewedAt: "2026-09-16" },
      cardArt: { status: "approved", image: fixtureImage, version: "fixture-v1" },
      documentaryPhoto: documentaryPhoto
        ? {
          status: "approved",
          image: fixtureImage,
          source: "Acervo da fixture E2E",
          license: "Uso exclusivo em teste",
        }
        : { status: "missing", image: "", source: "", license: "" },
    },
  };
}

export function approvedEditorialCandidates(candidates, optionsFor = () => ({})) {
  return candidates.map((candidate, index) => approvedEditorialCandidate(candidate, optionsFor(candidate, index)));
}
