import assert from "node:assert/strict";
import test from "node:test";
import { confirmedVoteData } from "./vote-response.js";

const candidates = ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() }));
const ranking = candidates.map((candidate, index) => ({
  ...candidate,
  elo: index ? 999 : 1003,
  wins: index ? 0 : 3,
  losses: index ? 1 : 0,
  decisions: index ? 1 : 3,
  zebras: 0,
  winRate: index ? 0 : 100,
  rank: index + 1,
}));

function response(overrides = {}) {
  return {
    duels: 12,
    ranking,
    player: { duels: 4, version: 4, ranking, rankingPolicy: { id: "majority" } },
    round: { id: "round-1" },
    vote: {
      id: "round-1",
      status: "created",
      comparisons: 3,
      personalFeedback: {
        primaryEvent: "confirm",
        zebra: false,
        outcomes: candidates.map(({ id }) => ({
          id,
          result: id === "a" ? "winner" : "loser",
          delta: id === "a" ? 3 : -1,
          elo: id === "a" ? 1003 : 999,
          previousTier: { id: "contender", label: "No páreo", level: 2 },
          tier: { id: "contender", label: "No páreo", level: 2 },
          tierChange: null,
        })),
      },
    },
    ...overrides,
  };
}

const attempt = { roundId: "round-1", winnerId: "a", candidateIds: ["a", "b", "c", "d"] };

test("only a complete matching confirmation can advance UI progress", () => {
  const data = confirmedVoteData(response(), candidates, attempt, { globalDuels: 11, personalDuels: 3, playerVersion: 3 });
  assert.equal(data.globalDuels, 12);
  assert.equal(data.personalDuels, 4);
  assert.equal(data.playerVersion, 4);
  assert.match(data.channels.personal.message, /A/);
});

test("truncated, stale or divergent 200 responses are rejected", () => {
  const missingCounter = response();
  delete missingCounter.player.duels;
  assert.throws(() => confirmedVoteData(missingCounter, candidates, attempt), /player\.duels/);
  assert.throws(() => confirmedVoteData(response({ vote: {} }), candidates, attempt), /rodada divergente/);
  assert.throws(
    () => confirmedVoteData(response(), candidates, { ...attempt, winnerId: "b" }),
    /rodada divergente/,
  );
  assert.throws(
    () => confirmedVoteData(response(), candidates, attempt, { globalDuels: 12, personalDuels: 4, playerVersion: 4 }),
    /progresso sem avanço/,
  );
});
