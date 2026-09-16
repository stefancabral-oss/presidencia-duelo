import assert from "node:assert/strict";
import test from "node:test";
import { confirmedVoteData, LEGACY_REPLAY_MESSAGE } from "./vote-response.js";

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
    contractVersion: 2,
    publicAggregate: {
      status: "available",
      scope: "global-ranking",
      snapshot: { topicId: "eleicoes-2026", duels: 12, rankingPolicy: { id: "elo-v1" }, ranking },
      event: null,
    },
    player: { duels: 4, version: 4, ranking, rankingPolicy: { id: "majority" } },
    round: {
      id: "round-1",
      status: "created",
      winnerId: "a",
      candidateIds: ["a", "b", "c", "d"],
    },
    vote: {
      id: "round-1",
      status: "created",
      winnerId: "a",
      candidateIds: ["a", "b", "c", "d"],
      comparisons: 3,
      feedbackScope: "personal",
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

test("withheld aggregates preserve personal progress without accepting hidden public fields", () => {
  const personalOnly = response({ publicAggregate: { status: "withheld", scope: "global-ranking" } });
  const currentRanking = [{ id: "previous-public-snapshot" }];
  const data = confirmedVoteData(personalOnly, candidates, attempt, {
    ranking: currentRanking,
    globalDuels: 99,
    personalDuels: 3,
    playerVersion: 3,
  });
  assert.equal(data.aggregateAvailable, false);
  assert.equal(data.globalDuels, 99);
  assert.equal(data.ranking, currentRanking);
  assert.equal(data.channels.global, null);
  assert.equal(data.personalDuels, 4);

  const leakedRoot = response({
    publicAggregate: { status: "withheld", scope: "global-ranking" },
    ranking,
  });
  assert.throws(() => confirmedVoteData(leakedRoot, candidates, attempt), /rankings/);
  const leakedEvent = response({ publicAggregate: { status: "withheld", scope: "global-ranking" } });
  leakedEvent.vote.globalEvent = { feedback: { outcomes: [] } };
  assert.throws(() => confirmedVoteData(leakedEvent, candidates, attempt), /rankings/);
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
  const reordered = response();
  reordered.round.candidateIds = ["b", "a", "c", "d"];
  reordered.vote.candidateIds = ["b", "a", "c", "d"];
  assert.throws(() => confirmedVoteData(reordered, candidates, attempt), /rodada divergente/);
  assert.throws(
    () => confirmedVoteData(response(), candidates, attempt, { globalDuels: 12, personalDuels: 4, playerVersion: 4 }),
    /progresso sem avanço/,
  );
});

test("numeric response fields never coerce null and ranks match played state", () => {
  for (const field of ["elo", "wins", "losses", "decisions", "winRate"]) {
    const invalid = response();
    invalid.publicAggregate.snapshot.ranking = invalid.publicAggregate.snapshot.ranking
      .map((row, index) => (index ? { ...row } : { ...row, [field]: null }));
    assert.throws(() => confirmedVoteData(invalid, candidates, attempt), /métricas de ranking/);
  }

  const nullOutcome = response();
  nullOutcome.vote.personalFeedback.outcomes = nullOutcome.vote.personalFeedback.outcomes
    .map((outcome, index) => (index ? { ...outcome } : { ...outcome, delta: null }));
  assert.throws(() => confirmedVoteData(nullOutcome, candidates, attempt), /rodada divergente/);

  const unplayedCandidate = { id: "e", name: "E" };
  const unplayedRanking = {
    ...unplayedCandidate,
    elo: 1000,
    wins: 0,
    losses: 0,
    decisions: 0,
    zebras: 0,
    winRate: 0,
    rank: null,
  };
  const withUnplayed = response();
  withUnplayed.publicAggregate.snapshot.ranking = [
    ...withUnplayed.publicAggregate.snapshot.ranking.map((row) => ({ ...row })),
    { ...unplayedRanking },
  ];
  withUnplayed.player = {
    ...withUnplayed.player,
    ranking: [...withUnplayed.player.ranking.map((row) => ({ ...row })), { ...unplayedRanking }],
  };
  const extendedCandidates = [...candidates, unplayedCandidate];
  assert.doesNotThrow(() => confirmedVoteData(withUnplayed, extendedCandidates, attempt));

  withUnplayed.player.ranking.at(-1).rank = 1;
  assert.throws(() => confirmedVoteData(withUnplayed, extendedCandidates, attempt), /métricas de player\.ranking/);

  const playedWithoutRank = response();
  playedWithoutRank.publicAggregate.snapshot.ranking = playedWithoutRank.publicAggregate.snapshot.ranking
    .map((row, index) => (index ? { ...row } : { ...row, rank: null }));
  assert.throws(() => confirmedVoteData(playedWithoutRank, candidates, attempt), /métricas de ranking/);
});

test("only an exact legacy replay may omit personal outcomes", () => {
  const legacy = response();
  const globalFeedback = {
    ...legacy.vote.personalFeedback,
    rankingEvent: "top10",
    primaryEvent: "top10",
  };
  const neutralPersonalFeedback = {
    rankingEvent: "confirm",
    primaryEvent: "confirm",
    zebra: false,
    outcomes: [],
  };
  legacy.round.status = "alreadyProcessed";
  Object.assign(legacy.vote, {
    status: "alreadyProcessed",
    feedbackScope: "legacy-global",
    feedback: neutralPersonalFeedback,
    personalFeedback: neutralPersonalFeedback,
  });
  legacy.publicAggregate.event = {
    scope: "global",
    rankingEvent: "top10",
    winnerDelta: 3,
    zebra: false,
    feedback: globalFeedback,
  };

  const data = confirmedVoteData(legacy, candidates, attempt);
  assert.equal(data.channels.personal.message, LEGACY_REPLAY_MESSAGE);
  assert.deepEqual(data.channels.personal.outcomes, []);
  assert.match(data.channels.global.message, /Top 10/);

  for (const mutate of [
    (payload) => { payload.round.status = "created"; payload.vote.status = "created"; },
    (payload) => { payload.vote.feedbackScope = "personal"; },
    (payload) => { payload.vote.personalFeedback = { ...neutralPersonalFeedback, source: "legacy" }; },
  ]) {
    const invalid = structuredClone(legacy);
    mutate(invalid);
    assert.throws(() => confirmedVoteData(invalid, candidates, attempt), /rodada divergente/);
  }
});

test("a newly created response can never omit personal outcomes", () => {
  const created = response();
  created.vote.personalFeedback = {
    rankingEvent: "confirm",
    primaryEvent: "confirm",
    zebra: false,
    outcomes: [],
  };
  assert.throws(() => confirmedVoteData(created, candidates, attempt), /rodada divergente/);
});
