import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  TOPICS,
  TOPIC_IDS,
  candidatesForTopic,
  decorateCandidate,
  pairAllowedForTopic,
} from "../../shared/topics.js";

const root = dirname(fileURLToPath(import.meta.url));
const candidates = JSON.parse(readFileSync(join(root, "../../shared/candidates.json"), "utf8"));
const byId = Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate]));

test("the catalog exposes exactly the five approved duel topics", () => {
  assert.deepEqual(TOPICS.map((topic) => topic.label), [
    "Política em Jogo",
    "Justiça & Escândalos",
    "Direita x Esquerda",
    "Corrida 2026",
    "Em Alta",
  ]);
});

test("every topic has enough people to create duels", () => {
  for (const topic of TOPICS) {
    assert.ok(candidatesForTopic(candidates, topic.id).length >= 2, `${topic.label} sem pessoas suficientes`);
  }
  assert.equal(candidatesForTopic(candidates, TOPIC_IDS.POLITICS).length, 360);
  assert.equal(candidatesForTopic(candidates, TOPIC_IDS.JUSTICE).length, 74);
  assert.equal(candidatesForTopic(candidates, TOPIC_IDS.SIDES).length, 126);
  assert.equal(candidatesForTopic(candidates, TOPIC_IDS.RACE_2026).length, 12);
  assert.equal(candidatesForTopic(candidates, TOPIC_IDS.TRENDING).length, 62);
});

test("one person can belong to multiple topics", () => {
  const lula = decorateCandidate(candidates.find((candidate) => candidate.name === "Luiz Inácio Lula da Silva"));
  assert.deepEqual(lula.topics, [
    TOPIC_IDS.POLITICS,
    TOPIC_IDS.JUSTICE,
    TOPIC_IDS.SIDES,
    TOPIC_IDS.RACE_2026,
    TOPIC_IDS.TRENDING,
  ]);
  assert.equal(lula.politicalSide, "esquerda");
});

test("Corrida 2026 is explicit and independent from party affiliation", () => {
  const unapproved = candidates.find((candidate) => candidate.name === "Adriana Ventura");
  assert.equal(
    candidatesForTopic([{ ...unapproved, party: "Partido Teste" }], TOPIC_IDS.RACE_2026).length,
    0,
  );
  assert.equal(
    candidatesForTopic([{ ...unapproved, corrida2026: true }], TOPIC_IDS.RACE_2026).length,
    1,
  );
});

test("Direita x Esquerda only accepts cross-side pairs", () => {
  const allowed = pairAllowedForTopic(TOPIC_IDS.SIDES, byId);
  const lula = candidates.find((candidate) => candidate.name === "Luiz Inácio Lula da Silva");
  const bolsonaro = candidates.find((candidate) => candidate.name === "Jair Messias Bolsonaro");
  const boulos = candidates.find((candidate) => candidate.name === "Guilherme Boulos");
  assert.equal(allowed(lula.id, bolsonaro.id), true);
  assert.equal(allowed(lula.id, boulos.id), false);
});

test("game renders the shared selector in all playable sections and filters its active pool", () => {
  const gameSource = readFileSync(join(root, "game.js"), "utf8");
  assert.equal((gameSource.match(/topicSelectorHtml\(/g) || []).length, 3);
  assert.match(gameSource, /topicPickers: \[\.\.\.document\.querySelectorAll\("\[data-topic-selector\]"\)\]/);
  assert.match(gameSource, /setTopic\(button\.dataset\.topic\)/);
  assert.match(gameSource, /takeNextPair\(active, state, Math\.random, pairAllowedForTopic\(topicId, byId\)\)/);
  assert.match(gameSource, /presidencia-duelo-topic-v1/);
  assert.match(gameSource, /panelTournament\.classList\.contains\("active"\)\) renderTournament\(\)/);
});
