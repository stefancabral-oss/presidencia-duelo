import assert from "node:assert/strict";
import { test } from "node:test";
import { preloadPhotos } from "./photos.js";

const candidates = [
  { id: "lula", photo: "/candidates/lula.jpg" },
  { id: "zema", photo: "/candidates/zema.jpg" },
];

test("preloadPhotos assigns local candidate photos to new Image objects", () => {
  const created = [];
  const images = preloadPhotos(candidates, () => {
    const img = { src: "" };
    created.push(img);
    return img;
  });

  assert.equal(images.length, 2);
  assert.equal(created.length, 2);
  assert.deepEqual(
    created.map((img) => img.src),
    ["/candidates/lula.jpg", "/candidates/zema.jpg"],
  );
});

test("preloadPhotos skips entries without a photo URL", () => {
  const created = [];
  const images = preloadPhotos([{ id: "x" }, { id: "y", photo: "/y.jpg" }], () => {
    const img = { src: "" };
    created.push(img);
    return img;
  });

  assert.equal(images.length, 1);
  assert.equal(created[0].src, "/y.jpg");
});

test("preloadPhotos leaves remote catalogs on demand and caps local preloads", () => {
  const list = [
    { id: "remote", photo: "https://commons.wikimedia.org/photo.jpg" },
    { id: "a", photo: "/a.jpg" },
    { id: "b", photo: "/b.jpg" },
  ];
  const images = preloadPhotos(list, () => ({ src: "" }), 1);
  assert.equal(images.length, 1);
  assert.equal(images[0].src, "/a.jpg");
});
