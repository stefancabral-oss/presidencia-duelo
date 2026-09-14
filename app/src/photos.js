const PHOTO_SLOT_MIN = 1;
const PHOTO_SLOT_MAX = 125;
const ASSET_VERSION = typeof __POLIMATCH_ASSET_VERSION__ === "undefined" ? "test" : __POLIMATCH_ASSET_VERSION__;

export const PHOTO_SLOT_COUNT = PHOTO_SLOT_MAX;

export function portraitSlot(personId) {
  const slot = Number(personId);
  if (!Number.isInteger(slot) || slot < PHOTO_SLOT_MIN || slot > PHOTO_SLOT_MAX) return "";
  return `/portraits/${String(slot).padStart(3, "0")}.jpg?v=${encodeURIComponent(ASSET_VERSION)}`;
}

export function candidatePhoto(candidate = {}) {
  const suppliedPhoto = String(candidate.photo || "").trim();
  if (/^https?:\/\//i.test(suppliedPhoto)) return suppliedPhoto;
  return portraitSlot(candidate.personId);
}
