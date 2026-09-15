import test from "node:test";
import assert from "node:assert/strict";
import { approvedBasicCards, preservedChromaAlternatives } from "./approved-chromas.js";

test("approved basic-card batch maps exactly 35 current catalog people", () => {
  assert.equal(approvedBasicCards.length, 35);
  assert.equal(new Set(approvedBasicCards.map(({ personId }) => personId)).size, 35);
  assert.ok(approvedBasicCards.every(({ image }) => /^\/chromas\/approved\/\d{3}_[a-z0-9-]+\.jpg$/.test(image)));
  assert.ok(approvedBasicCards.every(({ aiEdited }) => aiEdited));
  assert.ok(approvedBasicCards.every(({ edition }) => edition === "basic"));
  assert.ok(!approvedBasicCards.some(({ personId }) => personId === "126"));
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
