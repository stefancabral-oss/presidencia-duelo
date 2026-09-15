import assert from "node:assert/strict";
import test from "node:test";
import { PHOTO_SLOT_COUNT, candidatePhoto, portraitSlot } from "./photos.js";

test("all 125 people have a stable replaceable portrait slot", () => {
  assert.equal(PHOTO_SLOT_COUNT, 125);
  assert.equal(portraitSlot(1), "/portraits/001.jpg?v=test");
  assert.equal(portraitSlot(55), "/portraits/055.jpg?v=test");
  assert.equal(portraitSlot(125), "/portraits/125.jpg?v=test");
  assert.equal(portraitSlot(126), "");
});

test("only a portrait explicitly supplied by the curator is shown", () => {
  assert.equal(candidatePhoto({ personId: 55, photo: "https://cdn.example/carmen.jpg" }), "");
  assert.equal(candidatePhoto({ personId: 1, photo: "/candidates/legacy.jpg" }), "/chromas/approved/001_luiz-inacio-lula-da-silva.jpg?v=test");
  assert.equal(candidatePhoto({ personId: 101 }), "/portraits/101.jpg?v=test");
});
