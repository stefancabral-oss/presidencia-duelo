import assert from "node:assert/strict";
import { test } from "node:test";
import { TOPIC_IDS } from "../../shared/topics.js";
import { CANDIDATES } from "./candidates.js";

test("API catalog exposes the five-topic metadata without changing candidate ids", () => {
  assert.equal(CANDIDATES.length, 360);
  assert.equal(new Set(CANDIDATES.map((candidate) => candidate.id)).size, 360);
  assert.ok(CANDIDATES.every((candidate) => candidate.topics.includes(TOPIC_IDS.POLITICS)));
  assert.equal(
    CANDIDATES.filter((candidate) => candidate.topics.includes(TOPIC_IDS.RACE_2026)).length,
    12,
  );
});
