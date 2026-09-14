import assert from "node:assert/strict";
import test from "node:test";
import { catalogForTopic, displayRanking, filterRanking, nextBalancedPair, nextPair, rankingForCatalog, rankingHighlights, shortName, shuffledCandidates, voteFeedback } from "./domain.js";

const people = [
  { id: "a", name: "Ana Um" },
  { id: "b", name: "Bruno Dois" },
  { id: "c", name: "Carlos Três" },
];

test("catalogForTopic keeps the full catalog or an explicit editorial subset", () => {
  assert.deepEqual(catalogForTopic(people).map(({ id }) => id), ["a", "b", "c"]);
  assert.deepEqual(catalogForTopic(people, ["c", "a"]).map(({ id }) => id), ["c", "a"]);
});

test("nextPair always returns two different people", () => {
  const pair = nextPair(people, [], () => 0);
  assert.equal(pair.length, 2);
  assert.notEqual(pair[0].id, pair[1].id);
});

test("balanced pairs consume the shuffled deck before repeating people", () => {
  const first = nextBalancedPair(people, people);
  const second = nextBalancedPair(people, first.queue, first.pair.map(({ id }) => id), () => 0);
  assert.deepEqual(first.pair.map(({ id }) => id), ["a", "b"]);
  assert.equal(first.queue.length, 1);
  assert.equal(new Set(second.pair.map(({ id }) => id)).size, 2);
  assert.equal(second.pair.some(({ id }) => id === "c"), true);
});

test("shuffle preserves every candidate exactly once", () => {
  assert.deepEqual(shuffledCandidates(people, () => 0).map(({ id }) => id).sort(), ["a", "b", "c"]);
});

test("rankingForCatalog hides people outside the approved catalog", () => {
  const result = rankingForCatalog({ ranking: [{ id: "x" }, { id: "b" }] }, people);
  assert.deepEqual(result, [{ id: "b" }]);
});

test("shortName keeps the first and last names", () => {
  assert.equal(shortName("Luiz Inácio Lula da Silva"), "Luiz Silva");
});

test("personal ranking hides people the player has not compared", () => {
  const ranking = [
    { id: "a", elo: 1016, wins: 1, losses: 0, decisions: 1 },
    { id: "b", elo: 1000, wins: 0, losses: 0, decisions: 0 },
    { id: "c", elo: 984, wins: 0, losses: 1, decisions: 1 },
  ];
  assert.deepEqual(displayRanking(ranking, { personal: true }).map(({ id, displayRank }) => [id, displayRank]), [["a", 1], ["c", 2]]);
});

test("untested people have no false ordinal position in the general ranking", () => {
  const ranking = [{ id: "a", elo: 1000, wins: 0, losses: 0, decisions: 0 }];
  assert.equal(displayRanking(ranking)[0].displayRank, null);
});

test("ranking search ignores accents and includes affiliation", () => {
  const ranking = [
    { name: "João Exemplo", affiliation: "Partido Um" },
    { name: "Maria Teste", affiliation: "União Brasil" },
  ];
  assert.deepEqual(filterRanking(ranking, "joao"), [ranking[0]]);
  assert.deepEqual(filterRanking(ranking, "uniao"), [ranking[1]]);
});

test("ranking highlights make both positive and negative choices visible", () => {
  const ranking = [
    { id: "a", elo: 1030, wins: 3, losses: 0, decisions: 3, winRate: 100 },
    { id: "b", elo: 970, wins: 0, losses: 3, decisions: 3, winRate: 0 },
    { id: "c", elo: 1000, wins: 1, losses: 1, decisions: 2, winRate: 50 },
  ];
  const highlights = rankingHighlights(ranking);
  assert.deepEqual(highlights.chosen.map(({ id }) => id), ["a", "c"]);
  assert.deepEqual(highlights.rejected.map(({ id }) => id), ["b", "c"]);
});

test("vote feedback exposes real Elo and zebra without blocking the next duel", () => {
  assert.equal(
    voteFeedback("Ana", { winnerDelta: 18, winRate: 63, zebra: true }),
    "Ana confirmado · +18 Elo · 63% nos duelos · Zebra!",
  );
});
