import { createHash, createPublicKey, verify } from "node:crypto";
import { AGGREGATE_PUBLIC_COPY_POLICY } from "../../shared/aggregate-publication-copy.js";
import { PINNED_AGGREGATE_AUTHORITIES } from "./aggregate-publication-trust.js";
import { candidateProjectorBySchema } from "./candidates.js";
import { EMBEDDED_RELEASE_REVISION } from "./release-identity.js";

export const AGGREGATE_PUBLICATION_RULESET = "aggregate-publication-v1";
export const AGGREGATE_AUTHORITY_RECEIPT_RULESET = "aggregate-authority-receipt-v1";
export const AGGREGATE_CAPABILITIES_CONTRACT = "aggregate-publication-capabilities-v1";

export const AGGREGATE_PUBLICATION_SCOPES = Object.freeze([
  "global-ranking",
  "daily-distribution",
  "prediction-reveal",
  "mirror-comparison",
]);

const SCOPE_SET = new Set(AGGREGATE_PUBLICATION_SCOPES);
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const RELEASE_REVISION_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const TRUSTED_AUTHORITIES = new WeakSet();

const CONTROLS_POLICY = Object.freeze({
  schemaVersion: 1,
  ruleset: AGGREGATE_PUBLICATION_RULESET,
  default: "withheld",
  subject: "eleicoes-2026",
  authorityTrust: "versioned-pinned-ed25519-keyring-v1",
  releaseIdentity: "docker-build-embedded-full-source-sha-v1",
  scopes: Object.freeze({
    "global-ranking": Object.freeze([
      "GET /api/ranking",
      "publicAggregate in POST /api/round-vote",
      "publicAggregate in POST /api/daily-vote",
    ]),
    "daily-distribution": Object.freeze(["GET /api/daily-cut"]),
    "prediction-reveal": Object.freeze([
      "GET /api/daily-prediction-results",
      "POST /api/daily-prediction",
    ]),
    "mirror-comparison": Object.freeze(["future aggregate comparison in the personal mirror"]),
  }),
});

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
}

function fingerprint(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalValue(value))).digest("hex")}`;
}

export const AGGREGATE_CONTROLS_FINGERPRINT = fingerprint(CONTROLS_POLICY);
export const AGGREGATE_COPY_POLICY_FINGERPRINT = fingerprint(AGGREGATE_PUBLIC_COPY_POLICY);

export function aggregateCopyPolicyFingerprint(policy) {
  return fingerprint(policy);
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function canonicalInstant(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) || date.toISOString() !== value ? null : date;
}

function visibleText(value, maximum = 200) {
  return typeof value === "string" && value === value.trim() && value.length > 0 && value.length <= maximum
    && !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value);
}

export function aggregateReceiptSigningPayload(receipt) {
  return canonicalValue({
    schemaVersion: receipt.schemaVersion,
    ruleset: receipt.ruleset,
    issuer: receipt.issuer,
    keyId: receipt.keyId,
    decisionId: receipt.decisionId,
    environment: receipt.environment,
    subject: receipt.subject,
    scope: receipt.scope,
    validFrom: receipt.validFrom,
    validUntil: receipt.validUntil,
    authorizedAt: receipt.authorizedAt,
    controlsFingerprint: receipt.controlsFingerprint,
    copyPolicyFingerprint: receipt.copyPolicyFingerprint,
    releaseRevision: receipt.releaseRevision,
  });
}

function validateReceipt(receipt, { issuer, keyId, environment, releaseRevision, publicKey, now }) {
  const keys = [
    "schemaVersion",
    "ruleset",
    "issuer",
    "keyId",
    "decisionId",
    "environment",
    "subject",
    "scope",
    "validFrom",
    "validUntil",
    "authorizedAt",
    "controlsFingerprint",
    "copyPolicyFingerprint",
    "releaseRevision",
    "signature",
  ];
  if (!exactKeys(receipt, keys)
    || receipt.schemaVersion !== 1
    || receipt.ruleset !== AGGREGATE_AUTHORITY_RECEIPT_RULESET
    || receipt.issuer !== issuer
    || receipt.keyId !== keyId
    || receipt.environment !== environment
    || receipt.subject !== "eleicoes-2026"
    || !SCOPE_SET.has(receipt.scope)
    || !visibleText(receipt.decisionId)
    || receipt.controlsFingerprint !== AGGREGATE_CONTROLS_FINGERPRINT
    || receipt.copyPolicyFingerprint !== AGGREGATE_COPY_POLICY_FINGERPRINT
    || receipt.releaseRevision !== releaseRevision
    || !RELEASE_REVISION_PATTERN.test(receipt.releaseRevision)
    || !HASH_PATTERN.test(receipt.controlsFingerprint)
    || !HASH_PATTERN.test(receipt.copyPolicyFingerprint)) return null;

  const validFrom = canonicalInstant(receipt.validFrom);
  const validUntil = canonicalInstant(receipt.validUntil);
  const authorizedAt = canonicalInstant(receipt.authorizedAt);
  if (!validFrom || !validUntil || !authorizedAt
    || validFrom >= validUntil
    || authorizedAt > now
    || authorizedAt > validFrom
    || typeof receipt.signature !== "string"
    || !BASE64URL_PATTERN.test(receipt.signature)) return null;

  const signature = Buffer.from(receipt.signature, "base64url");
  if (signature.length !== 64 || signature.toString("base64url") !== receipt.signature) return null;
  const payload = Buffer.from(JSON.stringify(aggregateReceiptSigningPayload(receipt)));
  if (!verify(null, payload, publicKey, signature)) return null;
  return Object.freeze({ ...receipt });
}

function immutableCapabilities(allowedReceipts) {
  const scopes = Object.freeze(Object.fromEntries(AGGREGATE_PUBLICATION_SCOPES.map((scope) => [
    scope,
    allowedReceipts.has(scope)
      ? Object.freeze({ status: "available", validUntil: allowedReceipts.get(scope).validUntil })
      : Object.freeze({ status: "withheld" }),
  ])));
  const available = allowedReceipts.size;
  return Object.freeze({
    contract: AGGREGATE_CAPABILITIES_CONTRACT,
    mode: available === 0 ? "personal-only" : available === AGGREGATE_PUBLICATION_SCOPES.length ? "authorized" : "scoped",
    scopes,
  });
}

function authority(grants = new Map(), now = () => new Date()) {
  const receipts = new Map([...grants].filter(([scope]) => SCOPE_SET.has(scope)));
  const currentlyAllowed = () => {
    let instant;
    try {
      instant = now();
    } catch {
      return new Map();
    }
    if (!(instant instanceof Date) || Number.isNaN(instant.valueOf())) return new Map();
    return new Map([...receipts].filter(([, receipt]) => (
      instant >= new Date(receipt.validFrom) && instant < new Date(receipt.validUntil)
    )));
  };
  const result = Object.freeze({
    allows(scope) {
      return SCOPE_SET.has(scope) && currentlyAllowed().has(scope);
    },
    capabilities() {
      return immutableCapabilities(currentlyAllowed());
    },
  });
  TRUSTED_AUTHORITIES.add(result);
  return result;
}

export function withheldAggregatePublicationAuthority() {
  return authority(new Map());
}

export function isAggregatePublicationAuthority(value) {
  return Boolean(value && TRUSTED_AUTHORITIES.has(value));
}

export function createAggregatePublicationAuthority({
  publicKeyJwk,
  issuer,
  keyId,
  receipts,
  environment,
  releaseRevision,
  now = () => new Date(),
} = {}) {
  try {
    if (!exactKeys(publicKeyJwk, ["crv", "kty", "x"])
      || publicKeyJwk.kty !== "OKP"
      || publicKeyJwk.crv !== "Ed25519"
      || !visibleText(publicKeyJwk.x, 100)
      || !visibleText(issuer)
      || !visibleText(keyId)
      || !visibleText(environment)
      || !RELEASE_REVISION_PATTERN.test(String(releaseRevision || ""))
      || !Array.isArray(receipts)
      || typeof now !== "function") return withheldAggregatePublicationAuthority();
    const instant = now();
    if (!(instant instanceof Date) || Number.isNaN(instant.valueOf())) return withheldAggregatePublicationAuthority();
    const publicKey = createPublicKey({ key: publicKeyJwk, format: "jwk" });
    if (publicKey.asymmetricKeyType !== "ed25519") return withheldAggregatePublicationAuthority();

    const grants = new Map();
    for (const candidate of receipts) {
      const receipt = validateReceipt(candidate, { issuer, keyId, environment, releaseRevision, publicKey, now: instant });
      if (!receipt || grants.has(receipt.scope)) return withheldAggregatePublicationAuthority();
      grants.set(receipt.scope, receipt);
    }
    return authority(grants, now);
  } catch {
    return withheldAggregatePublicationAuthority();
  }
}

export function aggregatePublicationAuthorityFromEnvironment(environment = process.env, {
  now,
  trustedAuthorities = PINNED_AGGREGATE_AUTHORITIES,
  releaseRevision = EMBEDDED_RELEASE_REVISION,
} = {}) {
  const receiptsText = environment.AGGREGATE_AUTHORITY_RECEIPTS;
  if (typeof receiptsText !== "string" || receiptsText.length === 0
    || !Array.isArray(trustedAuthorities) || !RELEASE_REVISION_PATTERN.test(String(releaseRevision || ""))) {
    return withheldAggregatePublicationAuthority();
  }
  try {
    const receipts = JSON.parse(receiptsText);
    if (!Array.isArray(receipts) || receipts.length === 0) return withheldAggregatePublicationAuthority();
    const issuer = receipts[0]?.issuer;
    const keyId = receipts[0]?.keyId;
    const trustRoot = trustedAuthorities.find((candidate) => (
      candidate?.issuer === issuer && candidate?.keyId === keyId
    ));
    if (!trustRoot || !exactKeys(trustRoot, ["issuer", "keyId", "publicKeyJwk"])) {
      return withheldAggregatePublicationAuthority();
    }
    return createAggregatePublicationAuthority({
      publicKeyJwk: trustRoot.publicKeyJwk,
      issuer,
      keyId,
      receipts,
      environment: String(environment.AGGREGATE_DEPLOYMENT_ID || ""),
      releaseRevision: String(releaseRevision),
      ...(now === undefined ? {} : { now }),
    });
  } catch {
    return withheldAggregatePublicationAuthority();
  }
}

function selectFields(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.fromEntries(fields.filter((field) => Object.hasOwn(value, field)).map((field) => [field, value[field]]));
}

function projectTier(tier) {
  return selectFields(tier, ["id", "label", "level"]);
}

function projectFeedback(feedback) {
  if (!feedback || typeof feedback !== "object" || !Array.isArray(feedback.outcomes)) return null;
  return {
    ...selectFields(feedback, ["rankingEvent", "primaryEvent", "zebra"]),
    outcomes: feedback.outcomes.map((outcome) => {
      const projected = selectFields(outcome, ["id", "result", "delta", "elo", "previousRank", "rank", "preferenceScore", "rankBasis", "tierChange"]);
      if (Object.hasOwn(outcome || {}, "previousTier")) projected.previousTier = projectTier(outcome.previousTier);
      if (Object.hasOwn(outcome || {}, "tier")) projected.tier = projectTier(outcome.tier);
      return projected;
    }),
  };
}

function projectRankingPolicy(policy) {
  return selectFields(policy, ["id", "label", "explanation"]);
}

function projectRankingRow(row, { personal = false } = {}) {
  return selectFields(row, [
    "personId", "id", "name", "displayName", "affiliation", "party", "primaryArea", "photo",
    "elo", "wins", "losses", "decisions", "zebras", "winRate", "rank",
    ...(personal ? ["preferenceScore", "rankBasis", "layer"] : []),
  ]);
}

function projectRankingSnapshot(snapshot, { personal = false } = {}) {
  if (!snapshot || typeof snapshot !== "object" || !Array.isArray(snapshot.ranking)) return null;
  return {
    ...selectFields(snapshot, ["topicId", "duels", ...(personal ? ["version"] : [])]),
    rankingPolicy: projectRankingPolicy(snapshot.rankingPolicy),
    ranking: snapshot.ranking.map((row) => projectRankingRow(row, { personal })),
  };
}

function projectPersonalPlayer(player) {
  return projectRankingSnapshot(player, { personal: true });
}

function projectGlobalEvent(event) {
  if (!event || typeof event !== "object") return null;
  return {
    ...selectFields(event, ["scope", "rankingEvent", "winnerDelta", "zebra"]),
    feedback: projectFeedback(event.feedback),
  };
}

function projectDailySession(session) {
  if (!session || typeof session !== "object" || Array.isArray(session)) return null;
  const result = selectFields(session, ["status"]);
  if (session.ruleset && typeof session.ruleset === "object") {
    result.ruleset = selectFields(session.ruleset, ["id", "version", "timeZone", "rounds", "cardsPerRound", "selection", "catalogSchema"]);
    if (session.ruleset.quota && typeof session.ruleset.quota === "object") {
      result.ruleset.quota = selectFields(session.ruleset.quota, ["id", "totalChoices", "dailyChoices", "freeChoices"]);
    }
  }
  if (session.edition && typeof session.edition === "object") {
    result.edition = selectFields(session.edition, [
      "id", "date", "topicId", "rulesetId", "rulesetVersion", "catalogSchema", "catalogHash", "snapshotHash",
      "candidateCount", "totalRounds", "cardsPerRound", "opensAt", "closesAt",
    ]);
  }
  if (session.progress && typeof session.progress === "object") result.progress = selectFields(session.progress, ["answered", "total"]);
  if (Array.isArray(session.answers)) {
    result.answers = session.answers
      ? session.answers.map((answer) => selectFields(answer, ["slot", "answerId", "winnerId", "answeredAt"]))
      : [];
  }
  if (Array.isArray(session.predictions)) {
    result.predictions = session.predictions
      ? session.predictions.map((prediction) => selectFields(prediction, ["slot", "predictionId", "candidateId", "skipped", "respondedAt"]))
      : [];
  }
  if (session.predictionProgress && typeof session.predictionProgress === "object") {
    result.predictionProgress = selectFields(session.predictionProgress, ["responded", "predicted", "skipped", "total"]);
  }
  if (Object.hasOwn(session, "pendingPrediction")) {
    result.pendingPrediction = session.pendingPrediction === null
      ? null
      : {
        ...selectFields(session.pendingPrediction, ["slot"]),
        candidateIds: Array.isArray(session.pendingPrediction?.candidateIds) ? [...session.pendingPrediction.candidateIds] : [],
      };
  }
  if (Array.isArray(session.catalog)) {
    try {
      const projectCandidate = candidateProjectorBySchema(session.edition?.catalogSchema);
      result.catalog = session.catalog.map((candidate) => projectCandidate(candidate));
    } catch {
      result.catalog = [];
    }
  }
  if (Array.isArray(session.rounds)) {
    result.rounds = session.rounds.map((round) => ({
        ...selectFields(round, ["slot"]),
        candidateIds: Array.isArray(round?.candidateIds) ? [...round.candidateIds] : [],
      }));
  }
  if (Object.hasOwn(session, "round")) {
    result.round = session.round === null
      ? null
      : {
        ...selectFields(session.round, ["slot"]),
        candidateIds: Array.isArray(session.round?.candidateIds) ? [...session.round.candidateIds] : [],
      };
  }
  if (Object.hasOwn(session, "completion")) {
    result.completion = session.completion === null ? null : selectFields(session.completion, ["completedAt"]);
  }
  if (session.cut && typeof session.cut === "object") result.cut = selectFields(session.cut, ["status", "availableAt", "methodology"]);
  return result;
}

function personalRound(round) {
  if (!round || typeof round !== "object") return round;
  const allowed = [
    "id",
    "status",
    "winnerId",
    "candidateIds",
    "winnerDelta",
    "zebra",
    "rankingEvent",
    "feedbackScope",
    "comparisons",
  ];
  const result = Object.fromEntries(allowed.filter((key) => Object.hasOwn(round, key)).map((key) => [key, round[key]]));
  if (round.feedbackScope === "legacy-global") {
    delete result.winnerDelta;
    delete result.zebra;
    delete result.rankingEvent;
  }
  if (Array.isArray(result.candidateIds)) result.candidateIds = [...result.candidateIds];
  if (Object.hasOwn(round, "personalFeedback")) {
    result.feedback = projectFeedback(round.personalFeedback);
    result.personalFeedback = projectFeedback(round.personalFeedback);
  }
  return result;
}

export function projectVoteResponseV2(payload, publicationAuthority) {
  const trusted = isAggregatePublicationAuthority(publicationAuthority)
    ? publicationAuthority
    : withheldAggregatePublicationAuthority();
  const available = trusted.allows("global-ranking");
  const publicSnapshot = available ? projectRankingSnapshot(payload) : null;
  const response = {
    contractVersion: 2,
    player: projectPersonalPlayer(payload?.player),
    round: personalRound(payload?.round),
    vote: personalRound(payload?.vote),
    publicAggregate: available
      ? {
        status: "available",
        scope: "global-ranking",
        snapshot: publicSnapshot,
        event: projectGlobalEvent(payload?.round?.globalEvent || payload?.vote?.globalEvent),
      }
      : { status: "withheld", scope: "global-ranking" },
  };
  if (Object.hasOwn(payload || {}, "dailySession")) response.dailySession = projectDailySession(payload.dailySession);
  return response;
}
