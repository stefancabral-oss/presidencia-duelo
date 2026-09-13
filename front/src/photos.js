/**
 * Warm a small set of local photos. Large/remote catalogs must load on demand
 * so opening the app does not fire hundreds of image requests at once.
 */
export function preloadPhotos(candidates, createImage = () => new Image(), limit = 12) {
  const images = [];
  const localPhotos = candidates.filter((candidate) => candidate?.photo?.startsWith("/"));
  for (const candidate of localPhotos.slice(0, Math.max(0, limit))) {
    const img = createImage();
    img.src = candidate.photo;
    images.push(img);
  }
  return images;
}
