const PHOTO_SLOT_MIN = 1;
const PHOTO_SLOT_MAX = 125;
const ASSET_VERSION = typeof __POLIMATCH_ASSET_VERSION__ === "undefined" ? "test" : __POLIMATCH_ASSET_VERSION__;
const LOCAL_ASSET_PATH_PATTERN = /^\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*$/;

export const PHOTO_SLOT_COUNT = PHOTO_SLOT_MAX;

export function portraitSlot(personId) {
  const slot = Number(personId);
  if (!Number.isInteger(slot) || slot < PHOTO_SLOT_MIN || slot > PHOTO_SLOT_MAX) return "";
  return `/portraits/${String(slot).padStart(3, "0")}.jpg?v=${encodeURIComponent(ASSET_VERSION)}`;
}

function approvedLocalAsset(asset = {}) {
  const image = String(asset.image || "");
  if (asset.status !== "approved" || !LOCAL_ASSET_PATH_PATTERN.test(image)) return "";
  return `${image}${image.includes("?") ? "&" : "?"}v=${encodeURIComponent(ASSET_VERSION)}`;
}

export function candidateCardArt(candidate = {}) {
  return candidateDocumentaryPhoto(candidate) || approvedLocalAsset(candidate.publication?.cardArt);
}

export function candidateDocumentaryPhoto(candidate = {}) {
  const asset = candidate.publication?.documentaryPhoto;
  return approvedLocalAsset(asset?.status === "restored" ? { ...asset, status: "approved" } : asset);
}
