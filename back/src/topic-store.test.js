import assert from "node:assert/strict";
import test from "node:test";
import {
  accessTokenHash,
  createRecoveryKey,
  createSessionToken,
  feedbackChannelsFromSnapshots,
  globalEventFromFeedback,
  normalizeVoteId,
  persistedRoundChannels,
  rankingEventFromSnapshots,
  rankingFromRows,
  roundFeedbackFromSnapshots,
  recoveryKeyHash,
  validateTopic,
  validateRoundVote,
  validateVote,
} from "./topic-store.js";

test("only active curated topics accept votes", () => {
  assert.equal(validateTopic("eleicoes-2026"), "eleicoes-2026");
  assert.throws(() => validateTopic("influenciadores"), /indisponível/);
  assert.throws(() => validateVote("eleicoes-2026", "lula", "lula"), /voto inválido/);
  assert.throws(() => validateVote("eleicoes-2026", "lula", "acm-neto"), /voto inválido/);
  assert.doesNotThrow(() => validateVote("eleicoes-2026", "lula", "jair-bolsonaro"));
});

test("four-card rounds require four unique playable candidates and the winner", () => {
  assert.deepEqual(
    validateRoundVote("eleicoes-2026", "lula", ["lula", "jair-bolsonaro", "anitta", "neymar-jr"]),
    { topic: "eleicoes-2026", candidateIds: ["lula", "jair-bolsonaro", "anitta", "neymar-jr"] },
  );
  assert.throws(() => validateRoundVote("eleicoes-2026", "lula", ["lula", "lula", "anitta", "neymar-jr"]), /rodada inválida/);
  assert.throws(() => validateRoundVote("eleicoes-2026", "lula", ["jair-bolsonaro", "anitta", "neymar-jr", "ludmilla"]), /rodada inválida/);
  assert.throws(() => validateRoundVote("eleicoes-2026", "lula", ["lula", "jair-bolsonaro", "anitta", "acm-neto"]), /rodada inválida/);
});

test("vote ids remain idempotent UUIDs", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";
  assert.equal(normalizeVoteId(id.toUpperCase()), id);
  assert.throws(() => normalizeVoteId("vote-1"), /voteId inválido/);
});

test("player recovery credentials are random and stored as hashes", () => {
  const key = createRecoveryKey(() => Buffer.alloc(32, 7));
  assert.match(key, /^pm2_/);
  assert.equal(recoveryKeyHash(key).length, 64);
  assert.equal(recoveryKeyHash(key).includes(key), false);
});

test("signed-in sessions are opaque, random and stored only as hashes", () => {
  const token = createSessionToken(() => Buffer.alloc(32, 9));
  assert.match(token, /^pms_/);
  assert.equal(accessTokenHash(token).length, 64);
  assert.equal(accessTokenHash(token).includes(token), false);
  assert.throws(() => accessTokenHash("google-id-token"), /sessão inválida/);
});

test("topic ranking exposes only candidates from that curation", () => {
  const result = rankingFromRows("eleicoes-2026", 2, [
    { candidate_id: "lula", rating: 1016, wins: 1, losses: 0, zebras: 0 },
    { candidate_id: "jair-bolsonaro", rating: 984, wins: 0, losses: 1, zebras: 0 },
    { candidate_id: "not-in-topic", rating: 4000, wins: 999, losses: 0, zebras: 0 },
  ]);
  assert.equal(result.topicId, "eleicoes-2026");
  assert.equal(result.ranking.length, 54);
  assert.equal(result.ranking[0].id, "lula");
  assert.equal(result.ranking[0].party, "PT");
  assert.equal(result.ranking[0].primaryArea, "Política institucional");
  assert.equal("affiliation" in result.ranking[0], false);
  assert.equal(result.ranking[0].decisions, 1);
  assert.equal(result.ranking.find(({ id }) => id === "tarcisio-de-freitas").decisions, 0);
});

test("unplayed candidates have no rank and do not consume competition positions", () => {
  const result = rankingFromRows("eleicoes-2026", 2, [
    { candidate_id: "lula", rating: 1016, wins: 1, losses: 0, zebras: 0 },
    { candidate_id: "jair-bolsonaro", rating: 984, wins: 0, losses: 1, zebras: 0 },
  ]);
  const played = result.ranking.slice(0, 2);
  const unplayed = result.ranking.slice(2);

  assert.deepEqual(played.map(({ id, rank }) => [id, rank]), [
    ["lula", 1],
    ["jair-bolsonaro", 2],
  ]);
  assert.equal(unplayed.length, 52);
  assert.equal(unplayed.every(({ decisions, elo, rank }) => decisions === 0 && elo === 1000 && rank === null), true);
});

test("ranking sound events are derived from transactional before/after snapshots", () => {
  const candidate = (id, elo, decisions = 1, wins = 1, losses = 0) => ({ id, elo, decisions, wins, losses });

  assert.equal(
    rankingEventFromSnapshots(
      [candidate("a", 1040), candidate("b", 1020)],
      [candidate("b", 1060, 2, 2), candidate("a", 1040)],
      "b",
    ),
    "leader",
  );
  assert.equal(
    rankingEventFromSnapshots(
      [candidate("a", 1040), candidate("b", 1020)],
      [candidate("a", 1080, 2, 2), candidate("b", 1020)],
      "a",
    ),
    "leaderDefense",
  );
  assert.equal(
    rankingEventFromSnapshots(
      [candidate("a", 1040), candidate("b", 1020), candidate("c", 1000), candidate("d", 980)],
      [candidate("a", 1040), candidate("c", 1030, 2, 2), candidate("b", 1020), candidate("d", 980)],
      "c",
    ),
    "overtake",
  );
  assert.equal(
    rankingEventFromSnapshots(
      [candidate("a", 1040), candidate("b", 1020), candidate("c", 1000)],
      [candidate("a", 1040), candidate("c", 1030, 2, 2), candidate("b", 1020)],
      "c",
    ),
    "recovery",
  );

  const played = Array.from({ length: 11 }, (_, index) => candidate(`p${index + 1}`, 1200 - index * 10));
  const newcomer = candidate("new", 1000, 0, 0, 0);
  assert.equal(
    rankingEventFromSnapshots([...played, newcomer], [...played, candidate("new", 900)], "new"),
    "confirm",
  );
  assert.equal(rankingEventFromSnapshots(played, played, "p2", { zebra: true }), "zebra");
});

test("round feedback exposes real gains, losses and Elo tier crossings", () => {
  const before = [{ id: "a", elo: 1040 }, { id: "b", elo: 985 }, { id: "c", elo: 910 }, { id: "d", elo: 905 }];
  const after = [{ id: "a", elo: 1088 }, { id: "b", elo: 969 }, { id: "c", elo: 894 }, { id: "d", elo: 889 }];
  const feedback = roundFeedbackFromSnapshots(before, after, ["a", "b", "c", "d"], "a", "confirm");
  assert.equal(feedback.primaryEvent, "tierUp");
  assert.deepEqual(feedback.outcomes.map(({ delta }) => delta), [48, -16, -16, -16]);
  assert.equal(feedback.outcomes[0].tier.label, "Em ascensão");
  assert.equal(feedback.outcomes[0].tierChange, "up");
  assert.equal(feedback.outcomes[1].tierChange, "down");
  assert.equal(feedback.outcomes[2].tier.id, "recovery");
});

test("personal feedback is contractually derived from personal snapshots, never global ones", () => {
  const candidateIds = ["a", "b", "c", "d"];
  const snapshot = (winnerElo, loserElo, winnerRank) => [
    { id: "a", elo: winnerElo, wins: 1, losses: 0, decisions: 1, rank: winnerRank },
    ...candidateIds.slice(1).map((id, index) => ({ id, elo: loserElo - index, wins: 0, losses: 1, decisions: 1, rank: winnerRank + index + 1 })),
  ];
  const channels = feedbackChannelsFromSnapshots({
    personalBefore: snapshot(1000, 1000, 4),
    personalAfter: snapshot(1018, 994, 1),
    globalBefore: snapshot(1100, 1060, 8),
    globalAfter: snapshot(1145, 1045, 3),
    candidateIds,
    winnerId: "a",
  });

  assert.equal(channels.personalFeedback.outcomes.find(({ id }) => id === "a").delta, 18);
  assert.equal(channels.winnerDelta, 18);
  assert.equal(channels.globalFeedback.outcomes.find(({ id }) => id === "a").delta, 45);
  assert.equal(channels.globalEvent.winnerDelta, 45);
  assert.notDeepEqual(channels.personalFeedback, channels.globalFeedback);
});

test("global feedback is secondary and appears only for a relevant public event", () => {
  const confirm = { rankingEvent: "confirm", primaryEvent: "confirm", zebra: false, outcomes: [] };
  assert.equal(globalEventFromFeedback({ feedback: confirm }), null);
  const leader = { ...confirm, rankingEvent: "leader", primaryEvent: "leader" };
  assert.deepEqual(globalEventFromFeedback({ rankingEvent: "leader", winnerDelta: 17, feedback: leader }), {
    scope: "global",
    rankingEvent: "leader",
    winnerDelta: 17,
    zebra: false,
    feedback: leader,
  });
});

test("an idempotent legacy round is never relabelled as personal feedback", () => {
  const legacyFeedback = {
    rankingEvent: "top10",
    primaryEvent: "top10",
    zebra: false,
    outcomes: [{ id: "lula", result: "winner", delta: 45, elo: 1100 }],
  };
  const channels = persistedRoundChannels({
    ranking_event: "top10",
    feedback: legacyFeedback,
    feedback_scope: "legacy-global",
    winner_delta: 45,
    zebra: false,
    global_ranking_event: null,
    global_feedback: null,
  });

  assert.deepEqual(channels.personalFeedback, {
    rankingEvent: "confirm",
    primaryEvent: "confirm",
    zebra: false,
    outcomes: [],
  });
  assert.deepEqual(channels.feedback, channels.personalFeedback);
  assert.notDeepEqual(channels.personalFeedback, legacyFeedback);
  assert.equal(channels.rankingEvent, "confirm");
  assert.equal(channels.globalEvent.scope, "global");
  assert.equal(channels.globalEvent.rankingEvent, "top10");
  assert.deepEqual(channels.globalEvent.feedback, legacyFeedback);
});

test("a persisted personal round restores personal and public channels independently", () => {
  const personalFeedback = {
    rankingEvent: "leader",
    primaryEvent: "leader",
    zebra: false,
    outcomes: [{ id: "lula", result: "winner", delta: 18, elo: 1018 }],
  };
  const globalFeedback = {
    rankingEvent: "top10",
    primaryEvent: "top10",
    zebra: false,
    outcomes: [{ id: "lula", result: "winner", delta: 12, elo: 1110 }],
  };
  const channels = persistedRoundChannels({
    ranking_event: "leader",
    feedback: personalFeedback,
    feedback_scope: "personal",
    winner_delta: 18,
    zebra: false,
    global_ranking_event: "top10",
    global_feedback: globalFeedback,
  });

  assert.deepEqual(channels.personalFeedback, personalFeedback);
  assert.deepEqual(channels.feedback, personalFeedback);
  assert.equal(channels.rankingEvent, "leader");
  assert.deepEqual(channels.globalEvent.feedback, globalFeedback);
});
