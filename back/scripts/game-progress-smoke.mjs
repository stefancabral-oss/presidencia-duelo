import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import { createApprovedTestRegistry } from "../test-support/editorial-fixtures.js";
import { createTopicStore } from "../src/topic-store.js";

// Run only against the disposable database provided by the integration workflow.
const connection = process.env.DATABASE_URL;
if (!connection) throw new Error("DATABASE_URL is required (disposable test database)");
const approvedRegistry = createApprovedTestRegistry(CATALOG.map(person => person.id));
const withdrawn = new Set();
const registry = { ...approvedRegistry, candidatesForTopic: topic => approvedRegistry.candidatesForTopic(topic).filter(person => !withdrawn.has(person.id)) };
const store = createTopicStore(connection, { candidateRegistry: registry, clock: () => new Date("2032-09-17T15:00:00Z"), collectionEnabled: true });
const audit = new pg.Pool({ connectionString: connection });
await store.init();
const player = await store.createPlayer({ networkHash: "e".repeat(64) });
const other = await store.createPlayer({ networkHash: "f".repeat(64) });
let version = 0;
try {
  const first = await store.pairRound(player.recoveryKey, "eleicoes-2026", "warmup");
  assert.equal(first.remaining, 3);
  assert.deepEqual(await store.pairRound(player.recoveryKey, "eleicoes-2026", "warmup"), first);
  const request = { recoveryKey: player.recoveryKey, roundId: first.round.id, winnerId: first.round.candidateIds[0], playerVersion: version };
  await assert.rejects(store.pairVote({ ...request, recoveryKey: other.recoveryKey }), /não emitida/);
  const [created, replay] = await Promise.all([store.pairVote(request), store.pairVote(request)]);
  assert.equal(created.round.comparisons, 1);
  assert.equal(replay.round.status, "alreadyProcessed");
  assert.deepEqual(created.round.personalFeedback, replay.round.personalFeedback);
  version = created.player.version;
  withdrawn.add(request.winnerId);
  assert.equal((await store.pairVote(request)).round.status, "alreadyProcessed", "withdrawal cannot revoke a confirmed receipt");
  withdrawn.clear();
  const oldPending = await store.pairRound(other.recoveryKey, "eleicoes-2026", "warmup");
  withdrawn.add(oldPending.round.candidateIds[0]);
  const replacement = await store.pairRound(other.recoveryKey, "eleicoes-2026", "warmup");
  assert.notEqual(replacement.round.id, oldPending.round.id);
  assert.deepEqual(await store.pairRound(other.recoveryKey, "eleicoes-2026", "warmup"), replacement);
  withdrawn.clear();
  const beforeDiscard = await store.playerRanking(player.recoveryKey, "eleicoes-2026");
  await assert.rejects(store.discard({ ...request, candidateId: request.winnerId }), /fora da rodada/);
  const discard = { ...request, candidateId: first.round.candidateIds[1] };
  assert.equal((await store.discard(discard)).status, "created");
  assert.equal((await store.discard(discard)).status, "alreadyProcessed");
  await assert.rejects(store.discard({ ...discard, candidateId: null }), /outra decisão/);
  assert.deepEqual(await store.playerRanking(player.recoveryKey, "eleicoes-2026"), beforeDiscard);
  for (let i = 0; i < 2; i++) {
    const pair = await store.pairRound(player.recoveryKey, "eleicoes-2026", "warmup");
    const result = await store.pairVote({ recoveryKey: player.recoveryKey, roundId: pair.round.id, winnerId: pair.round.candidateIds[0], playerVersion: version });
    version = result.player.version;
    if (i === 0) await store.discard({ recoveryKey: player.recoveryKey, roundId: pair.round.id, candidateId: null });
    if (i === 1) {
      assert.equal((await store.discardMetrics(player.recoveryKey)).rounds, 2, "unoffered historic/client round must not dilute completion");
      await store.offerDiscard(player.recoveryKey, pair.round.id);
    }
  }
  assert.equal((await store.pairRound(player.recoveryKey, "eleicoes-2026", "warmup")).status, "completed");
  const quota = await audit.query("SELECT used FROM abuse_quota_counters WHERE scope='player-free-editorial-day-v2' AND subject_hash=(SELECT player_id::text FROM choice_rounds WHERE round_id=$1)", [first.round.id]);
  assert.deepEqual(quota.rows.map(row => Number(row.used)), [3], "three warmup votes, including retries, consume exactly three of the twenty shared non-daily choices");
  assert.deepEqual(await store.discardMetrics(player.recoveryKey), { editionId: null, rounds: 3, completed: 1, skipped: 1, pending: 1, completionRate: 1 / 3 });
  assert.equal((await store.discardMetrics(other.recoveryKey)).rounds, 0);
  assert.equal((await store.collection(player.recoveryKey)).items.length, 0);
  let session = await store.dailySession(player.recoveryKey, "eleicoes-2026");
  for (let i = 0; i < 10; i++) {
    // Test-only minute reset; no daily quota or production database is touched.
    await audit.query("DELETE FROM abuse_quota_counters WHERE scope='player-round-minute'");
    const result = await store.dailyVote({ recoveryKey: player.recoveryKey, topicId: "eleicoes-2026", editionId: session.edition.id,
      slot: session.round.slot, winnerId: session.round.candidateIds[0], answerId: randomUUID(), playerVersion: version });
    session = result.dailySession; version = result.player.version;
  }
  assert.equal(session.status, "completed");
  const rewards = await Promise.all([store.collection(player.recoveryKey), store.collection(player.recoveryKey)]);
  assert.equal(rewards[0].items.length, 1);
  assert.deepEqual(rewards[0], rewards[1]);
  assert.equal((await store.collection(other.recoveryKey)).items.length, 0);
  assert.equal((await store.mirrorComparison(player.recoveryKey)).status, "pending");
  const mirror = await store.mirrorComparison(player.recoveryKey, { now: new Date("2032-09-18T15:00:00Z") });
  assert.equal(mirror.status, "published");
  assert.equal(mirror.comparison.aligned, 10);
  assert.equal(mirror.comparison.completedPlayers, 1);
  assert.equal(mirror.mirror.axes.length, 3);
  assert.equal((await store.mirrorComparison(other.recoveryKey, { now: new Date("2032-09-18T15:00:00Z") })).status, "pending");
  const restarted = createTopicStore(connection, { candidateRegistry: registry, collectionEnabled: true });
  try { await restarted.init(); assert.equal((await restarted.collection(player.recoveryKey)).items.length, 1); }
  finally { await restarted.close(); }
  const previousWarmup = await store.createPlayer({ networkHash: "1".repeat(64) });
  const recentWarmup = await store.createPlayer({ networkHash: "2".repeat(64) });
  const warmupSubject = `warmup-${randomUUID()}`;
  const oldPair = await store.pairRound(previousWarmup.recoveryKey, "eleicoes-2026", "warmup");
  await store.pairVote({ recoveryKey: previousWarmup.recoveryKey, roundId: oldPair.round.id,
    winnerId: oldPair.round.candidateIds[0], playerVersion: 0 });
  const warmupAccount = await store.signInWithGoogle({ identity: { subject: warmupSubject, displayName: "Jogador" },
    currentToken: previousWarmup.recoveryKey, topicId: "eleicoes-2026" });
  const stalePair = await store.pairRound(warmupAccount.sessionToken, "eleicoes-2026", "warmup");
  const anonymousPair = await store.pairRound(recentWarmup.recoveryKey, "eleicoes-2026", "warmup");
  await store.pairVote({ recoveryKey: recentWarmup.recoveryKey, roundId: anonymousPair.round.id,
    winnerId: anonymousPair.round.candidateIds[0], playerVersion: 0 });
  const warmupMerge = await store.signInWithGoogle({ identity: { subject: warmupSubject, displayName: "Jogador" },
    currentToken: recentWarmup.recoveryKey, topicId: "eleicoes-2026" });
  assert.equal(warmupMerge.player.duels, 2);
  const finalPair = await store.pairRound(warmupMerge.sessionToken, "eleicoes-2026", "warmup");
  assert.equal(finalPair.remaining, 1);
  assert.notEqual(finalPair.round.id, stalePair.round.id);
  assert.notDeepEqual(finalPair.round.candidateIds, oldPair.round.candidateIds);
  await store.pairVote({ recoveryKey: warmupMerge.sessionToken, roundId: finalPair.round.id,
    winnerId: finalPair.round.candidateIds[0], playerVersion: warmupMerge.player.version });
  assert.equal((await store.pairRound(warmupMerge.sessionToken, "eleicoes-2026", "warmup")).status, "completed");
  console.log("Game PostgreSQL: pair issuance/replay/ownership, three-round opening, separate discard, 10/10 reward, concurrency and restart passed.");
} finally { await store.close(); await audit.end(); }
