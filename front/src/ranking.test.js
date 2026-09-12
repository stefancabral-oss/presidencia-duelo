import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RANKING_SUBTITLE,
  compareRankStats,
  sortCandidatesByRank,
} from "./ranking.js";

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
