const APPROVED_PHOTO_IDS = new Set([
  1, 3, 4, 6, 7, 8, 9, 11, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
  27, 28, 29, 30, 31, 32, 33, 34, 36, 38, 39, 40, 41, 43, 48, 49, 50, 52, 60,
  63, 64, 65, 66, 73, 75, 77, 78, 79, 80, 81, 83, 85, 87, 88, 89, 90, 91, 92,
  95, 98, 99, 101, 102, 103, 104, 105, 106, 107, 108, 111, 112, 113, 115, 116,
  117, 118, 120, 121, 122, 123, 124, 125,
]);

export const APPROVED_PHOTO_COUNT = APPROVED_PHOTO_IDS.size;

export function candidatePhoto(candidate = {}) {
  const suppliedPhoto = String(candidate.photo || "").trim();
  if (suppliedPhoto && !suppliedPhoto.startsWith("/candidates/")) return suppliedPhoto;

  const personId = Number(candidate.personId);
  if (!Number.isInteger(personId) || !APPROVED_PHOTO_IDS.has(personId)) return "";
  return `/portraits/${String(personId).padStart(3, "0")}.jpg`;
}
