import test from "node:test";
import assert from "node:assert/strict";
import { approvedChromas, preservedChromaAlternatives } from "./approved-chromas.js";

test("approved Chroma batch maps exactly 35 current catalog people", () => {
  assert.equal(approvedChromas.length, 35);
  assert.equal(new Set(approvedChromas.map(({ personId }) => personId)).size, 35);
  assert.ok(approvedChromas.every(({ image }) => /^\/chromas\/approved\/\d{3}_[a-z0-9-]+\.jpg$/.test(image)));
  assert.ok(approvedChromas.every(({ aiEdited }) => aiEdited));
  assert.ok(approvedChromas.every(({ distinctPhotoVerified }) => !distinctPhotoVerified));
  assert.ok(approvedChromas.every(({ inventoryEligible }) => !inventoryEligible));
  assert.ok(!approvedChromas.some(({ personId }) => personId === "126"));
});

test("a Chroma can only enter inventory after a different source photo is verified", () => {
  assert.ok(approvedChromas.every(({ distinctPhotoVerified, inventoryEligible }) => distinctPhotoVerified || !inventoryEligible));
});

test("second Flávio art remains recorded without becoming another person", () => {
  assert.deepEqual(preservedChromaAlternatives, [{
    personId: "002",
    person: "Flávio Bolsonaro",
    sourceId: "002b",
    look: "L03",
    lookName: "Holofote Dramático",
    status: "preserved-outside-app",
  }]);
});
