import assert from "node:assert/strict";
import test from "node:test";
import { aggregateScopeAvailable, nextAggregateCapabilityExpiry, PERSONAL_ONLY_CAPABILITIES, validateCapabilities } from "./capabilities.js";

const NOW = Date.parse("2026-09-16T12:00:00.000Z");
const VALID_UNTIL = "2026-09-16T13:00:00.000Z";

test("personal-only capabilities withhold every aggregate surface", () => {
  const result = validateCapabilities(JSON.parse(JSON.stringify(PERSONAL_ONLY_CAPABILITIES)), { now: NOW });
  assert.equal(result.mode, "personal-only");
  assert.equal(aggregateScopeAvailable(result, "global-ranking"), false);
  assert.equal(aggregateScopeAvailable(result, "prediction-reveal"), false);
});

test("partial capabilities preserve independent scopes", () => {
  const value = JSON.parse(JSON.stringify(PERSONAL_ONLY_CAPABILITIES));
  value.mode = "scoped";
  value.scopes["global-ranking"] = { status: "available", validUntil: VALID_UNTIL };
  const result = validateCapabilities(value, { now: NOW });
  assert.equal(aggregateScopeAvailable(result, "global-ranking", NOW), true);
  assert.equal(aggregateScopeAvailable(result, "daily-distribution"), false);
  assert.equal(nextAggregateCapabilityExpiry(result, NOW), Date.parse(VALID_UNTIL));
  assert.equal(aggregateScopeAvailable(result, "global-ranking", Date.parse(VALID_UNTIL)), false);
  const expired = validateCapabilities(value, { now: Date.parse(VALID_UNTIL) });
  assert.equal(expired.mode, "personal-only");
  assert.deepEqual(expired.scopes["global-ranking"], { status: "withheld" });
});

test("unknown, missing or internally inconsistent capability responses fail closed", () => {
  const unknown = JSON.parse(JSON.stringify(PERSONAL_ONLY_CAPABILITIES));
  unknown.scopes.unknown = { status: "available" };
  assert.throws(() => validateCapabilities(unknown, { now: NOW }), /inválidas/);
  const inconsistent = JSON.parse(JSON.stringify(PERSONAL_ONLY_CAPABILITIES));
  inconsistent.mode = "authorized";
  assert.throws(() => validateCapabilities(inconsistent, { now: NOW }), /inválidas/);
  const missingExpiry = JSON.parse(JSON.stringify(PERSONAL_ONLY_CAPABILITIES));
  missingExpiry.mode = "scoped";
  missingExpiry.scopes["global-ranking"] = { status: "available" };
  assert.throws(() => validateCapabilities(missingExpiry, { now: NOW }), /inválidas/);
  assert.equal(aggregateScopeAvailable(null, "global-ranking"), false);
});
