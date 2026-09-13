import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  RANKING_SUBTITLE,
  RANK_SORT_CRITERIA,
  compareRankStats,
  formatZebraCount,
  rankMetaText,
  rankSortSummary,
  sortCandidatesByRank,
} from "./ranking.js";

const gameSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "game.js"), "utf8");

test("subtitle describes wins as the visual tiebreak, not win rate", () => {
  assert.match(RANKING_SUBTITLE, /vitórias como desempate/i);
  assert.doesNotMatch(RANKING_SUBTITLE, /taxa de vitórias/i);
});

test("higher Elo ranks first regardless of wins or win rate", () => {
  const lowerEloMoreWins = { elo: 1000, wins: 20, wr: 100 };
  const higherEloFewerWins = { elo: 1100, wins: 0, wr: 0 };
  assert.ok(compareRankStats(higherEloFewerWins, lowerEloMoreWins) < 0);
  assert.ok(compareRankStats(lowerEloMoreWins, higherEloFewerWins) > 0);
});

test("equal Elo breaks ties by win count, not win rate", () => {
  // 1–0 is 100% but should not beat 8–2 (80%) at the same Elo.
  const fewWinsHighRate = { elo: 1100, wins: 1, wr: 100 };
  const moreWinsLowerRate = { elo: 1100, wins: 8, wr: 80 };
  assert.ok(compareRankStats(moreWinsLowerRate, fewWinsHighRate) < 0);
  assert.ok(compareRankStats(fewWinsHighRate, moreWinsLowerRate) > 0);
});

test("equal Elo and equal wins stay tied", () => {
  assert.equal(compareRankStats({ elo: 1000, wins: 3 }, { elo: 1000, wins: 3 }), 0);
});

test("formatZebraCount uses Portuguese singular and plural", () => {
  assert.equal(formatZebraCount(0), "0 zebras");
  assert.equal(formatZebraCount(1), "1 zebra");
  assert.equal(formatZebraCount(3), "3 zebras");
  assert.equal(formatZebraCount("2"), "2 zebras");
});

test("rankMetaText appends zebra count only when the candidate has at least one", () => {
  assert.equal(
    rankMetaText({ party: "PT", vice: "Alckmin", wins: 3, losses: 1, zebras: 0 }),
    "PT · vice Alckmin · 3V / 1D",
  );
  assert.equal(
    rankMetaText({ party: "PT", vice: "Alckmin", wins: 3, losses: 1 }),
    "PT · vice Alckmin · 3V / 1D",
  );
  assert.equal(
    rankMetaText({ party: "Novo", vice: "Girão", wins: 2, losses: 4, zebras: 1 }),
    "Novo · vice Girão · 2V / 4D · 1 zebra",
  );
  assert.equal(
    rankMetaText({ party: "PL", vice: "Gaspar", wins: 5, losses: 2, zebras: 3 }),
    "PL · vice Gaspar · 5V / 2D · 3 zebras",
  );
  assert.equal(
    rankMetaText({ party: "", vice: "", wins: 1, losses: 2, zebras: 0 }),
    "1V / 2D",
  );
});

test("default ranking subtitle stays Elo/wins sort copy", () => {
  assert.match(RANKING_SUBTITLE, /elo/i);
  assert.match(RANKING_SUBTITLE, /maior para o menor/i);
  assert.doesNotMatch(RANKING_SUBTITLE, /zebra/i);
});

test("zebra counts do not change ranking order", () => {
  assert.equal(
    compareRankStats({ elo: 1100, wins: 3, zebras: 5 }, { elo: 1100, wins: 3, zebras: 0 }),
    0,
  );
});

test("game ranking rows render zebra counts via rankMetaText", () => {
  assert.match(gameSrc, /rankMetaText\(\{ party: c\.party, vice: c\.vice, wins, losses, zebras \}\)/);
  assert.match(gameSrc, /zebras: state\.zebras\?\.\[id\] \|\| 0/);
  assert.match(gameSrc, /mergeStats\(defaultState\(candidates\), parsed\)/);
});

test("sortCandidatesByRank orders by Elo then wins", () => {
  const candidates = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const stats = {
    a: { elo: 1000, wins: 9, wr: 90 },
    b: { elo: 1100, wins: 1, wr: 50 },
    c: { elo: 1100, wins: 4, wr: 40 },
    d: { elo: 1000, wins: 2, wr: 100 },
  };
  const ranked = sortCandidatesByRank(candidates, (id) => stats[id]);
  assert.deepEqual(
    ranked.map((row) => row.id),
    ["c", "b", "a", "d"],
  );
});

test("interactive criteria and directions produce deterministic orders", () => {
  const candidates = [
    { id: "ana", name: "Ana" },
    { id: "bia", name: "Bia" },
    { id: "caio", name: "Caio" },
    { id: "davi", name: "Davi" },
  ];
  const stats = {
    ana: { elo: 1000, wins: 4, losses: 9, zebras: 1 },
    bia: { elo: 1100, wins: 2, losses: 0, zebras: 3 },
    caio: { elo: 1050, wins: 7, losses: 20, zebras: 0 },
    davi: { elo: 1100, wins: 2, losses: 99, zebras: 3 },
  };
  const idsFor = (criterion, direction = "desc") => sortCandidatesByRank(
    candidates,
    (id) => stats[id],
    { criterion, direction },
  ).map((candidate) => candidate.id);

  assert.deepEqual(idsFor(RANK_SORT_CRITERIA.ELO), ["bia", "davi", "caio", "ana"]);
  assert.deepEqual(idsFor(RANK_SORT_CRITERIA.WINS), ["caio", "ana", "bia", "davi"]);
  assert.deepEqual(idsFor(RANK_SORT_CRITERIA.ZEBRAS), ["bia", "davi", "ana", "caio"]);
  assert.deepEqual(idsFor(RANK_SORT_CRITERIA.WINS, "asc"), ["bia", "davi", "ana", "caio"]);
});

test("defeats remain display-only and summaries expose active direction", () => {
  assert.equal(
    compareRankStats(
      { elo: 1000, wins: 4, losses: 0 },
      { elo: 1000, wins: 4, losses: 999 },
      { criterion: RANK_SORT_CRITERIA.WINS },
    ),
    0,
  );
  assert.match(rankSortSummary({ criterion: "zebras", direction: "asc" }), /Zebras, do menor para o maior/);
  assert.match(gameSrc, /data-rank-sort="elo"/);
  assert.match(gameSrc, /data-rank-sort="wins"/);
  assert.match(gameSrc, /data-rank-sort="zebras"/);
  assert.match(gameSrc, /renderRankItems\(visible, visibleById,[\s\S]*rankSort\)/);
  assert.match(gameSrc, /renderRankItems\(visible, byId,[\s\S]*rankSort\)/);
});
