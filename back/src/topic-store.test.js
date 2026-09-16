import assert from "node:assert/strict";
import test from "node:test";
import {
  accessTokenHash,
  buildDailyCatalogSnapshot,
  createRecoveryKey,
  createSessionToken,
  feedbackChannelsFromSnapshots,
  globalEventFromFeedback,
  normalizeVoteId,
  persistedRoundCandidates,
  persistedRoundChannels,
  rankingEventFromSnapshots,
  rankingFromRows,
  roundFeedbackFromSnapshots,
  recoveryKeyHash,
  validateTopic,
  validateRoundVote,
  validateVote,
  validateMaterializedDailyEdition,
  validateDailyCutRecord,
  validateDailyCutResults,
  materializeDailyEdition,
} from "./topic-store.js";
import { buildDailyEdition, DAILY_SESSION_RULESET } from "./daily-session.js";
import { PUBLIC_CANDIDATE_SCHEMA_V1, candidateProjectorBySchema } from "./candidates.js";

const FUTURE_CANDIDATE_SCHEMA = "candidate-public-v2";

const FUTURE_DAILY_RULESET = Object.freeze({
  ...DAILY_SESSION_RULESET,
  id: "daily-four-card-v2",
  version: 2,
  catalogSchema: FUTURE_CANDIDATE_SCHEMA,
});

function resolveTestDailyRuleset(id, version) {
  if (id === DAILY_SESSION_RULESET.id && Number(version) === DAILY_SESSION_RULESET.version) return DAILY_SESSION_RULESET;
  if (id === FUTURE_DAILY_RULESET.id && Number(version) === FUTURE_DAILY_RULESET.version) return FUTURE_DAILY_RULESET;
  throw new Error(`ruleset de teste desconhecido: ${id}@${version}`);
}

function resolveTestCandidateProjector(schema) {
  if (schema === PUBLIC_CANDIDATE_SCHEMA_V1) return candidateProjectorBySchema(schema);
  if (schema === FUTURE_CANDIDATE_SCHEMA) {
    const v1 = candidateProjectorBySchema(PUBLIC_CANDIDATE_SCHEMA_V1);
    return (candidate) => ({ ...v1(candidate), taxonomy: candidate.taxonomy || { schema: "v2" } });
  }
  throw new Error(`schema público de teste desconhecido: ${schema}`);
}

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

test("daily choices persist the authoritative candidate order while free choices are canonical", () => {
  const candidateIds = ["zeta", "alpha", "delta", "beta"];
  assert.deepEqual(persistedRoundCandidates(candidateIds, "daily"), candidateIds);
  assert.deepEqual(persistedRoundCandidates(candidateIds, "free"), ["alpha", "beta", "delta", "zeta"]);
  assert.deepEqual(candidateIds, ["zeta", "alpha", "delta", "beta"]);
});

test("materialized daily editions validate ruleset, catalog hash and every ordered slot", () => {
  const definition = buildDailyEdition({
    topicId: "eleicoes-2026",
    candidateIds: Array.from({ length: 40 }, (_, index) => `candidate-${String(index + 1).padStart(2, "0")}`),
    dateKey: "2026-09-16",
  });
  const row = {
    id: definition.id,
    edition_date: definition.date,
    topic_id: definition.topicId,
    ruleset_id: definition.rulesetId,
    ruleset_version: definition.rulesetVersion,
    catalog_schema: definition.catalogSchema,
    catalog_hash: definition.catalogHash,
    catalog_ids: definition.catalogIds,
    catalog_snapshot: buildDailyCatalogSnapshot(definition.catalogIds.map((id) => ({ id, name: id }))).candidates,
    catalog_snapshot_hash: buildDailyCatalogSnapshot(definition.catalogIds.map((id) => ({ id, name: id }))).hash,
    candidate_count: definition.candidateCount,
    total_rounds: definition.totalRounds,
    cards_per_round: definition.cardsPerRound,
    opens_at: definition.opensAt,
    closes_at: definition.closesAt,
  };
  const rounds = definition.rounds.map((round) => ({
    slot: round.slot,
    candidate_ids: round.candidateIds,
    selection_hash: round.selectionHash,
  }));
  assert.deepEqual(validateMaterializedDailyEdition(row, rounds).rounds[0].candidateIds, definition.rounds[0].candidateIds);
  assert.throws(
    () => validateMaterializedDailyEdition({ ...row, catalog_hash: "0".repeat(64) }, rounds),
    /integridade/,
  );
  assert.throws(
    () => validateMaterializedDailyEdition(row, rounds.map((round, index) => index ? round : { ...round, candidate_ids: [...round.candidate_ids].reverse() })),
    /integridade/,
  );
});

test("published daily cuts carry and validate their own selected public snapshot", () => {
  const candidates = Array.from({ length: 40 }, (_, index) => ({
    id: `cut-${String(index + 1).padStart(2, "0")}`,
    name: `Pessoa ${index + 1}`,
    summary: `Metadado histórico ${index + 1}`,
    ...(index === 0 ? {
      secret: "não persistir",
      fingerprint: "internal-only",
      photoApproved: true,
      topicIds: ["eleicoes-2026"],
      publication: { audit: { reviewer: "interno", decidedBy: "editor", basis: "rascunho" } },
    } : {}),
  }));
  const definition = buildDailyEdition({
    topicId: "eleicoes-2026",
    candidateIds: candidates.map(({ id }) => id),
    dateKey: "2026-09-16",
  });
  const fullSnapshot = buildDailyCatalogSnapshot(candidates);
  const materialized = validateMaterializedDailyEdition({
    id: definition.id,
    edition_date: definition.date,
    topic_id: definition.topicId,
    ruleset_id: definition.rulesetId,
    ruleset_version: definition.rulesetVersion,
    catalog_schema: definition.catalogSchema,
    catalog_hash: definition.catalogHash,
    catalog_ids: definition.catalogIds,
    catalog_snapshot: fullSnapshot.candidates,
    catalog_snapshot_hash: fullSnapshot.hash,
    candidate_count: definition.candidateCount,
    total_rounds: definition.totalRounds,
    cards_per_round: definition.cardsPerRound,
    opens_at: definition.opensAt,
    closes_at: definition.closesAt,
  }, definition.rounds.map((round) => ({
    slot: round.slot,
    candidate_ids: round.candidateIds,
    selection_hash: round.selectionHash,
  })));
  const results = {
    editionSnapshotHash: materialized.edition.snapshotHash,
    catalogSnapshotHash: fullSnapshot.hash,
    catalog: fullSnapshot.candidates,
    rounds: materialized.rounds.map((round) => ({
      slot: round.slot,
      candidateIds: round.candidateIds,
      choices: round.candidateIds.map((candidateId) => ({ candidateId, count: 0 })),
    })),
  };

  const validated = validateDailyCutResults(materialized, results, { completedPlayers: 0, completedAnswers: 0 });
  assert.equal(validated.catalog.length, 40);
  assert.equal(validated.catalog.find(({ id }) => id === candidates[0].id).summary, "Metadado histórico 1");
  assert.deepEqual(validated.catalog[0].topicIds, ["eleicoes-2026"]);
  for (const field of ["secret", "fingerprint", "photoApproved", "publication"]) {
    assert.equal(Object.hasOwn(validated.catalog[0], field), false, `${field} vazou no recorte diário`);
  }
  assert.throws(
    () => validateDailyCutResults(materialized, {
      ...results,
      catalog: results.catalog.map((candidate, index) => index ? candidate : { ...candidate, name: "Nome adulterado" }),
    }, { completedPlayers: 0, completedAnswers: 0 }),
    /integridade/,
  );
  assert.throws(
    () => validateDailyCutResults(materialized, {
      ...results,
      rounds: results.rounds.map((round, index) => index ? round : {
        ...round,
        choices: round.choices.map((choice, choiceIndex) => choiceIndex ? choice : { ...choice, count: -1 }),
      }),
    }, { completedPlayers: 0, completedAnswers: 0 }),
    /integridade/,
  );

  const tenPlayers = structuredClone(results);
  for (const round of tenPlayers.rounds) round.choices[0].count = 10;
  const stored = {
    ruleset_id: materialized.edition.rulesetId,
    methodology: "entre quem concluiu a rodada de 16/09",
    completed_players: 10,
    completed_answers: 100,
    results: tenPlayers,
    published_at: materialized.edition.closesAt,
  };
  const validatedStored = validateDailyCutRecord(materialized, stored, {
    observedAt: "2026-09-17T03:01:00.000Z",
  });
  assert.equal(validatedStored.completedAnswers, 100);
  assert.throws(
    () => validateDailyCutRecord(materialized, { ...stored, completed_answers: 99 }, {
      observedAt: "2026-09-17T03:01:00.000Z",
    }),
    /integridade/,
  );

  const uneven = structuredClone(tenPlayers);
  uneven.rounds[0].choices[0].count = 9;
  uneven.rounds[1].choices[0].count = 11;
  assert.throws(
    () => validateDailyCutRecord(materialized, { ...stored, results: uneven }, {
      observedAt: "2026-09-17T03:01:00.000Z",
    }),
    /integridade/,
  );
  for (const tampered of [
    { ...stored, ruleset_id: "daily-four-card-forged" },
    { ...stored, methodology: "entre qualquer pessoa" },
    { ...stored, published_at: "2026-09-17T02:59:59.999Z" },
    { ...stored, published_at: "2026-09-17T03:06:00.001Z" },
  ]) {
    assert.throws(
      () => validateDailyCutRecord(materialized, tampered, { observedAt: "2026-09-17T03:01:00.000Z" }),
      /integridade/,
    );
  }
});

test("an existing edition remains available when the current editorial catalog shrinks", async () => {
  const definition = buildDailyEdition({
    topicId: "eleicoes-2026",
    candidateIds: Array.from({ length: 40 }, (_, index) => `snapshot-${String(index + 1).padStart(2, "0")}`),
    dateKey: "2026-09-16",
  });
  const row = {
    id: definition.id,
    edition_date: definition.date,
    topic_id: definition.topicId,
    ruleset_id: definition.rulesetId,
    ruleset_version: definition.rulesetVersion,
    catalog_schema: definition.catalogSchema,
    catalog_hash: definition.catalogHash,
    catalog_ids: definition.catalogIds,
    catalog_snapshot: buildDailyCatalogSnapshot(definition.catalogIds.map((id) => ({ id, name: id }))).candidates,
    catalog_snapshot_hash: buildDailyCatalogSnapshot(definition.catalogIds.map((id) => ({ id, name: id }))).hash,
    candidate_count: definition.candidateCount,
    total_rounds: definition.totalRounds,
    cards_per_round: definition.cardsPerRound,
    opens_at: definition.opensAt,
    closes_at: definition.closesAt,
  };
  const rounds = definition.rounds.map((round) => ({
    slot: round.slot,
    candidate_ids: round.candidateIds,
    selection_hash: round.selectionHash,
  }));
  const fakeClient = {
    async query(sql) {
      if (sql.includes("pg_advisory_xact_lock")) return { rowCount: 1, rows: [{}] };
      if (sql.includes("FROM daily_editions")) return { rowCount: 1, rows: [row] };
      if (sql.includes("FROM daily_edition_rounds")) return { rowCount: 10, rows: rounds };
      throw new Error(`consulta inesperada: ${sql}`);
    },
  };
  let catalogReads = 0;
  const materialized = await materializeDailyEdition(fakeClient, "eleicoes-2026", "2026-09-16", {
    ruleset: FUTURE_DAILY_RULESET,
    rulesetResolver: resolveTestDailyRuleset,
    projectorResolver: resolveTestCandidateProjector,
    candidateCatalog: () => {
      catalogReads += 1;
      return [];
    },
  });
  assert.equal(catalogReads, 0);
  assert.equal(materialized.edition.catalogHash, definition.catalogHash);
  assert.equal(materialized.edition.rulesetId, DAILY_SESSION_RULESET.id);
  assert.equal(materialized.edition.catalogSchema, PUBLIC_CANDIDATE_SCHEMA_V1);
  assert.deepEqual(materialized.catalog, row.catalog_snapshot);
  assert.equal(materialized.catalog.some((candidate) => Object.hasOwn(candidate, "taxonomy")), false);
  assert.equal(materialized.rounds.length, 10);
  const historicalCut = validateDailyCutResults(materialized, {
    editionSnapshotHash: materialized.edition.snapshotHash,
    catalogSnapshotHash: materialized.edition.snapshotHash,
    catalog: materialized.catalog,
    rounds: materialized.rounds.map((round) => ({
      slot: round.slot,
      candidateIds: round.candidateIds,
      choices: round.candidateIds.map((candidateId) => ({ candidateId, count: 0 })),
    })),
  }, {
    completedPlayers: 0,
    completedAnswers: 0,
    projectorResolver: resolveTestCandidateProjector,
  });
  assert.deepEqual(historicalCut.catalog, row.catalog_snapshot);
  assert.equal(historicalCut.catalog.some((candidate) => Object.hasOwn(candidate, "taxonomy")), false);
});

test("a new editorial date adopts the active ruleset only when no edition exists", async () => {
  const editionsByDate = new Map();
  const roundsByEdition = new Map();
  const fakeClient = {
    async query(sql, parameters = []) {
      if (sql.includes("pg_advisory_xact_lock")) return { rowCount: 1, rows: [{}] };
      if (sql.includes("FROM daily_editions") && sql.includes("WHERE topic_id")) {
        const row = editionsByDate.get(parameters[1]);
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
      }
      if (sql.includes("INSERT INTO daily_editions")) {
        const [id, date, topicId, rulesetId, rulesetVersion, catalogHash, catalogIds,
          catalogSchema, catalogSnapshot, catalogSnapshotHash, candidateCount, totalRounds, cardsPerRound, opensAt, closesAt] = parameters;
        const row = {
          id,
          edition_date: date,
          topic_id: topicId,
          ruleset_id: rulesetId,
          ruleset_version: rulesetVersion,
          catalog_schema: catalogSchema,
          catalog_hash: catalogHash,
          catalog_ids: catalogIds,
          catalog_snapshot: JSON.parse(catalogSnapshot),
          catalog_snapshot_hash: catalogSnapshotHash,
          candidate_count: candidateCount,
          total_rounds: totalRounds,
          cards_per_round: cardsPerRound,
          opens_at: opensAt,
          closes_at: closesAt,
        };
        editionsByDate.set(date, row);
        return { rowCount: 1, rows: [{ id }] };
      }
      if (sql.includes("INSERT INTO daily_edition_rounds")) {
        const [editionId, slot, candidateIds, selectionHash] = parameters;
        const rows = roundsByEdition.get(editionId) || [];
        rows.push({ slot, candidate_ids: candidateIds, selection_hash: selectionHash });
        roundsByEdition.set(editionId, rows);
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes("FROM daily_editions WHERE id")) {
        const row = [...editionsByDate.values()].find(({ id }) => id === parameters[0]);
        return { rowCount: row ? 1 : 0, rows: row ? [row] : [] };
      }
      if (sql.includes("FROM daily_edition_rounds")) {
        const rows = roundsByEdition.get(parameters[0]) || [];
        return { rowCount: rows.length, rows };
      }
      throw new Error(`consulta inesperada: ${sql}`);
    },
  };
  const candidateCatalog = () => Array.from({ length: 40 }, (_, index) => ({
    id: `v2-${String(index + 1).padStart(2, "0")}`,
    name: `V2 Candidate ${index + 1}`,
    taxonomy: { schema: "v2", position: index + 1 },
  }));
  const created = await materializeDailyEdition(fakeClient, "eleicoes-2026", "2026-09-17", {
    candidateCatalog,
    ruleset: FUTURE_DAILY_RULESET,
    rulesetResolver: resolveTestDailyRuleset,
    projectorResolver: resolveTestCandidateProjector,
  });
  assert.equal(created.edition.rulesetId, FUTURE_DAILY_RULESET.id);
  assert.equal(created.edition.rulesetVersion, 2);
  assert.equal(created.edition.catalogSchema, FUTURE_CANDIDATE_SCHEMA);
  assert.deepEqual(created.catalog[0].taxonomy, { schema: "v2", position: 1 });

  const reloaded = await materializeDailyEdition(fakeClient, "eleicoes-2026", "2026-09-17", {
    candidateCatalog: () => { throw new Error("catálogo ativo não deveria ser relido"); },
    ruleset: DAILY_SESSION_RULESET,
    rulesetResolver: resolveTestDailyRuleset,
    projectorResolver: resolveTestCandidateProjector,
  });
  assert.equal(reloaded.edition.id, created.edition.id);
  assert.equal(reloaded.edition.rulesetId, FUTURE_DAILY_RULESET.id);
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
