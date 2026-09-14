import assert from "node:assert/strict";
import test from "node:test";
import { APPROVED_PHOTO_COUNT, candidatePhoto } from "./photos.js";

test("only technically and editorially cleared treated photos are bundled", () => {
  assert.equal(APPROVED_PHOTO_COUNT, 82);
  assert.equal(candidatePhoto({ personId: 1 }), "/portraits/001.jpg");
  assert.equal(candidatePhoto({ personId: 55 }), "");
  assert.equal(candidatePhoto({ personId: 68 }), "");
  assert.equal(candidatePhoto({ personId: 97 }), "");
});

test("a future reviewed photo from the API can override the bundled portrait", () => {
  assert.equal(candidatePhoto({ personId: 55, photo: "https://cdn.example/carmen.jpg" }), "https://cdn.example/carmen.jpg");
  assert.equal(candidatePhoto({ personId: 1, photo: "/candidates/legacy.jpg" }), "/portraits/001.jpg");
});
