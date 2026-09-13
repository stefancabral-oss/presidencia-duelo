import assert from "node:assert/strict";
import { test } from "node:test";
import { TOPIC_IDS, topicIdsForCandidate } from "../../shared/topics.js";
import { CANDIDATES } from "./candidates.js";

const APPROVED_RACE_2026_IDS = [
  "caiado",
  "clariana-barao",
  "cury",
  "edmilson-costa",
  "flavio-bolsonaro",
  "hertz-dias",
  "lula",
  "renan-santos",
  "rui-costa-pimenta",
  "samara-martins",
  "wilson-grassi",
  "zema",
];

test("API catalog exposes the five-topic metadata without changing candidate ids", () => {
  assert.equal(CANDIDATES.length, 360);
  assert.equal(new Set(CANDIDATES.map((candidate) => candidate.id)).size, 360);
  assert.ok(CANDIDATES.every((candidate) => candidate.topics.includes(TOPIC_IDS.POLITICS)));
  assert.deepEqual(
    CANDIDATES
      .filter((candidate) => candidate.topics.includes(TOPIC_IDS.RACE_2026))
      .map((candidate) => candidate.id)
      .sort(),
    APPROVED_RACE_2026_IDS,
  );
  assert.ok(APPROVED_RACE_2026_IDS.length >= 12, "Corrida 2026 precisa suportar o torneio");
});

test("party affiliation alone never adds a person to Corrida 2026", () => {
  const unapproved = CANDIDATES.find((candidate) => candidate.id === "pessoa-3");
  const withParty = { ...unapproved, party: "Partido Teste", corrida2026: false };
  assert.equal(topicIdsForCandidate(withParty).includes(TOPIC_IDS.RACE_2026), false);
  assert.equal(CANDIDATES.filter((candidate) => candidate.corrida2026 === true).length, 12);
});
