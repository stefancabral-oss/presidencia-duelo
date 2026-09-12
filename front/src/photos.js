/**
 * Warm the browser cache for every candidate photo so later duel swaps
 * do not refetch and flash a blank <img>.
 */
export function preloadPhotos(candidates, createImage = () => new Image()) {
  const images = [];
  for (const candidate of candidates) {
    if (!candidate?.photo) continue;
    const img = createImage();
    img.src = candidate.photo;
    images.push(img);
  }
  return images;
}
