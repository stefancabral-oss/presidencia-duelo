import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { AGGREGATE_PUBLIC_COPY_POLICY } from "../../shared/aggregate-publication-copy.js";
import {
  AGGREGATE_AUTHORITY_RECEIPT_RULESET,
  AGGREGATE_CONTROLS_FINGERPRINT,
  AGGREGATE_COPY_POLICY_FINGERPRINT,
  AGGREGATE_PUBLICATION_SCOPES,
  aggregateCopyPolicyFingerprint,
  aggregatePublicationAuthorityFromEnvironment,
  aggregateReceiptSigningPayload,
  createAggregatePublicationAuthority,
  projectVoteResponseV2,
  withheldAggregatePublicationAuthority,
} from "./aggregate-publication.js";

const NOW = new Date("2026-09-16T12:00:00.000Z");
const RELEASE_REVISION = "f".repeat(40);

function signedAuthority(scopes = AGGREGATE_PUBLICATION_SCOPES, overrides = {}) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const issuer = "external-election-counsel";
  const keyId = "legal-2026-01";
  const environment = "production";
  const receipts = scopes.map((scope, index) => {
    const receipt = {
      schemaVersion: 1,
      ruleset: AGGREGATE_AUTHORITY_RECEIPT_RULESET,
      issuer,
      keyId,
      decisionId: `decision-${index + 1}`,
      environment,
      subject: "eleicoes-2026",
      scope,
      validFrom: "2026-09-16T00:00:00.000Z",
      validUntil: "2026-09-17T00:00:00.000Z",
      authorizedAt: "2026-09-15T12:00:00.000Z",
      controlsFingerprint: AGGREGATE_CONTROLS_FINGERPRINT,
      copyPolicyFingerprint: AGGREGATE_COPY_POLICY_FINGERPRINT,
      releaseRevision: RELEASE_REVISION,
      signature: "pending",
      ...overrides,
    };
    receipt.signature = sign(null, Buffer.from(JSON.stringify(aggregateReceiptSigningPayload(receipt))), privateKey).toString("base64url");
    return receipt;
  });
  return {
    publicKeyJwk: publicKey.export({ format: "jwk" }),
    issuer,
    keyId,
    environment,
    releaseRevision: RELEASE_REVISION,
    receipts,
    now: () => new Date(NOW),
  };
}

test("aggregate publication is withheld without external authority", () => {
  const authority = withheldAggregatePublicationAuthority();
  assert.equal(authority.capabilities().mode, "personal-only");
  for (const scope of AGGREGATE_PUBLICATION_SCOPES) {
    assert.equal(authority.allows(scope), false);
    assert.deepEqual(authority.capabilities().scopes[scope], { status: "withheld" });
  }
});

test("each signed scope is independent and unknown scopes fail closed", () => {
  const config = signedAuthority(["global-ranking", "prediction-reveal"]);
  const authority = createAggregatePublicationAuthority(config);
  assert.equal(authority.capabilities().mode, "scoped");
  assert.equal(authority.allows("global-ranking"), true);
  assert.equal(authority.allows("prediction-reveal"), true);
  assert.equal(authority.allows("daily-distribution"), false);
  assert.equal(authority.allows("mirror-comparison"), false);
  assert.deepEqual(authority.capabilities().scopes["global-ranking"], {
    status: "available",
    validUntil: "2026-09-17T00:00:00.000Z",
  });

  const invalid = signedAuthority(["global-ranking", "not-a-scope"]);
  assert.equal(createAggregatePublicationAuthority(invalid).capabilities().mode, "personal-only");
});

test("capabilities expire at the signed boundary without a restart", () => {
  let instant = new Date(NOW);
  const config = signedAuthority(["global-ranking"]);
  config.now = () => new Date(instant);
  const authority = createAggregatePublicationAuthority(config);
  assert.equal(authority.allows("global-ranking"), true);
  assert.equal(authority.capabilities().scopes["global-ranking"].status, "available");
  instant = new Date("2026-09-17T00:00:00.000Z");
  assert.equal(authority.allows("global-ranking"), false);
  assert.deepEqual(authority.capabilities().scopes["global-ranking"], { status: "withheld" });
});

test("bad signatures, stale periods, policy drift and duplicate scopes fail closed", () => {
  const forged = signedAuthority(["global-ranking"]);
  forged.receipts[0].signature = "forged";
  const cases = [
    forged,
    signedAuthority(["global-ranking"], { validUntil: "2026-09-16T12:00:00.000Z" }),
    signedAuthority(["global-ranking"], { controlsFingerprint: `sha256:${"0".repeat(64)}` }),
    signedAuthority(["global-ranking"], { copyPolicyFingerprint: `sha256:${"1".repeat(64)}` }),
    signedAuthority(["global-ranking"], { environment: "staging" }),
    signedAuthority(["global-ranking"], { releaseRevision: "a".repeat(40) }),
  ];
  for (const config of cases) {
    assert.equal(createAggregatePublicationAuthority(config).capabilities().mode, "personal-only");
  }

  const duplicated = signedAuthority(["global-ranking", "global-ranking"]);
  assert.equal(createAggregatePublicationAuthority(duplicated).capabilities().mode, "personal-only");
});

test("partial or malformed environment configuration never authorizes a scope", () => {
  assert.equal(aggregatePublicationAuthorityFromEnvironment({ NODE_ENV: "production" }).capabilities().mode, "personal-only");
  assert.equal(aggregatePublicationAuthorityFromEnvironment({
    NODE_ENV: "production",
    AGGREGATE_AUTHORITY_PUBLIC_JWK: "{}",
  }).capabilities().mode, "personal-only");
  assert.equal(aggregatePublicationAuthorityFromEnvironment({
    NODE_ENV: "production",
    AGGREGATE_AUTHORITY_PUBLIC_JWK: "not-json",
    AGGREGATE_AUTHORITY_ISSUER: "issuer",
    AGGREGATE_AUTHORITY_KEY_ID: "key",
    AGGREGATE_AUTHORITY_RECEIPTS: "[]",
  }).capabilities().mode, "personal-only");
});

test("environment receipts require a pinned authority and the embedded release revision", () => {
  const config = signedAuthority(["global-ranking"]);
  const environment = {
    NODE_ENV: config.environment,
    AGGREGATE_AUTHORITY_RECEIPTS: JSON.stringify(config.receipts),
  };
  const trustedAuthorities = [{
    issuer: config.issuer,
    keyId: config.keyId,
    publicKeyJwk: config.publicKeyJwk,
  }];
  assert.equal(aggregatePublicationAuthorityFromEnvironment(environment, {
    now: config.now,
    trustedAuthorities,
    releaseRevision: config.releaseRevision,
  }).allows("global-ranking"), true);
  assert.equal(aggregatePublicationAuthorityFromEnvironment({
    ...environment,
    SOURCE_COMMIT: config.releaseRevision,
    AGGREGATE_AUTHORITY_PUBLIC_JWK: JSON.stringify(config.publicKeyJwk),
  }, { now: config.now, releaseRevision: config.releaseRevision }).allows("global-ranking"), false);
  assert.equal(aggregatePublicationAuthorityFromEnvironment(environment, {
    now: config.now,
    trustedAuthorities,
    releaseRevision: "a".repeat(40),
  }).allows("global-ranking"), false);
  assert.equal(aggregatePublicationAuthorityFromEnvironment(environment, {
    now: config.now,
    trustedAuthorities,
    releaseRevision: "",
  }).allows("global-ranking"), false);
});

test("the receipt fingerprint changes with any candidate public copy change", () => {
  assert.equal(AGGREGATE_PUBLIC_COPY_POLICY.reviewStatus, "candidate-pending-human-review");
  assert.equal(aggregateCopyPolicyFingerprint(AGGREGATE_PUBLIC_COPY_POLICY), AGGREGATE_COPY_POLICY_FINGERPRINT);
  const changed = structuredClone(AGGREGATE_PUBLIC_COPY_POLICY);
  changed.scopes["global-ranking"].copy.homeCta = "Texto público alterado";
  assert.notEqual(aggregateCopyPolicyFingerprint(changed), AGGREGATE_COPY_POLICY_FINGERPRINT);
});

function rawVote(overrides = {}) {
  const personalFeedback = {
    rankingEvent: "leader",
    primaryEvent: "leader",
    zebra: false,
    outcomes: [{ id: "a", result: "winner", delta: 10, elo: 1010 }],
  };
  const globalFeedback = {
    rankingEvent: "podium",
    primaryEvent: "podium",
    zebra: false,
    outcomes: [{ id: "a", result: "winner", delta: 20, elo: 1400, rank: 2 }],
  };
  const round = {
    id: "round-1",
    status: "created",
    winnerId: "a",
    candidateIds: ["a", "b", "c", "d"],
    winnerDelta: 10,
    zebra: false,
    rankingEvent: "leader",
    feedback: personalFeedback,
    personalFeedback,
    feedbackScope: "personal",
    globalEvent: { scope: "global", feedback: globalFeedback },
    comparisons: 3,
  };
  return {
    topicId: "eleicoes-2026",
    duels: 90,
    rankingPolicy: { id: "elo-v1" },
    ranking: [{ id: "a", rank: 1, elo: 1400 }],
    player: { duels: 4, version: 4, ranking: [{ id: "a", rank: 1, elo: 1010 }] },
    round,
    vote: round,
    ...overrides,
  };
}

test("contract V2 withholds every aggregate field while preserving personal action", () => {
  const response = projectVoteResponseV2(rawVote(), withheldAggregatePublicationAuthority());
  assert.equal(response.contractVersion, 2);
  assert.deepEqual(response.publicAggregate, { status: "withheld", scope: "global-ranking" });
  assert.equal(Object.hasOwn(response, "ranking"), false);
  assert.equal(Object.hasOwn(response, "duels"), false);
  assert.equal(Object.hasOwn(response.round, "globalEvent"), false);
  assert.equal(Object.hasOwn(response.vote, "globalEvent"), false);
  assert.equal(response.round.personalFeedback.primaryEvent, "leader");
  assert.equal(response.player.duels, 4);

  const changedGlobal = rawVote({
    duels: 999999,
    ranking: [{ id: "other", rank: 1, elo: 9000 }],
  });
  changedGlobal.round.globalEvent = { scope: "global", feedback: { secret: "changed" } };
  changedGlobal.round.feedback = { secret: "aggregate-feedback-must-not-leak" };
  changedGlobal.vote = changedGlobal.round;
  assert.deepEqual(
    projectVoteResponseV2(changedGlobal, withheldAggregatePublicationAuthority()),
    response,
  );
});

test("contract V2 allowlists nested personal state against future aggregate fields", () => {
  const raw = rawVote({
    dailySession: {
      status: "active",
      aggregateSecret: "daily-leak",
      progress: { answered: 1, total: 10, aggregateSecret: "progress-leak" },
    },
  });
  raw.player.aggregateSecret = "player-leak";
  raw.player.ranking[0].aggregateSecret = "ranking-leak";
  raw.round.personalFeedback.aggregateSecret = "feedback-leak";
  raw.round.personalFeedback.outcomes[0].aggregateSecret = "outcome-leak";
  raw.vote = raw.round;
  const response = projectVoteResponseV2(raw, withheldAggregatePublicationAuthority());
  assert.equal(JSON.stringify(response).includes("aggregateSecret"), false);
  assert.deepEqual(response.dailySession, { status: "active", progress: { answered: 1, total: 10 } });
  assert.equal(response.player.ranking[0].id, "a");
  assert.equal(response.round.personalFeedback.primaryEvent, "leader");
});

test("authorized contract V2 contains aggregates only inside publicAggregate", () => {
  const authority = createAggregatePublicationAuthority(signedAuthority(["global-ranking"]));
  const raw = rawVote({ dailySession: { status: "active" } });
  const response = projectVoteResponseV2(raw, authority);
  assert.equal(response.publicAggregate.status, "available");
  assert.deepEqual(response.publicAggregate.snapshot.ranking, raw.ranking);
  assert.deepEqual(response.publicAggregate.event, raw.round.globalEvent);
  assert.equal(Object.hasOwn(response, "ranking"), false);
  assert.equal(Object.hasOwn(response.round, "globalEvent"), false);
  assert.deepEqual(response.dailySession, { status: "active" });
});
