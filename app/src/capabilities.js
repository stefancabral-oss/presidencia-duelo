export const AGGREGATE_SCOPE_NAMES = Object.freeze([
  "global-ranking",
  "daily-distribution",
  "prediction-reveal",
  "mirror-comparison",
]);

export const PERSONAL_ONLY_CAPABILITIES = Object.freeze({
  contract: "aggregate-publication-capabilities-v1",
  mode: "personal-only",
  scopes: Object.freeze(Object.fromEntries(AGGREGATE_SCOPE_NAMES.map((scope) => [
    scope,
    Object.freeze({ status: "withheld" }),
  ]))),
});

function canonicalInstant(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value ? timestamp : null;
}

function modeForAvailableCount(available) {
  return available === 0 ? "personal-only" : available === AGGREGATE_SCOPE_NAMES.length ? "authorized" : "scoped";
}

export function validateCapabilities(payload, { now = Date.now() } = {}) {
  if (!payload || payload.contract !== PERSONAL_ONLY_CAPABILITIES.contract
    || !["personal-only", "scoped", "authorized"].includes(payload.mode)
    || !payload.scopes || typeof payload.scopes !== "object" || Array.isArray(payload.scopes)
    || Object.keys(payload.scopes).sort().join(",") !== [...AGGREGATE_SCOPE_NAMES].sort().join(",")
    || !Number.isFinite(now)) {
    throw new TypeError("capacidades de publicação inválidas");
  }
  const scopes = {};
  let advertisedAvailable = 0;
  for (const scope of AGGREGATE_SCOPE_NAMES) {
    const value = payload.scopes[scope];
    if (!value || typeof value !== "object" || Array.isArray(value) || !["available", "withheld"].includes(value.status)) {
      throw new TypeError("capacidades de publicação inválidas");
    }
    if (value.status === "withheld") {
      if (Object.keys(value).join(",") !== "status") throw new TypeError("capacidades de publicação inválidas");
      scopes[scope] = Object.freeze({ status: "withheld" });
      continue;
    }
    if (Object.keys(value).sort().join(",") !== "status,validUntil") {
      throw new TypeError("capacidades de publicação inválidas");
    }
    const validUntil = canonicalInstant(value.validUntil);
    if (validUntil === null) throw new TypeError("capacidades de publicação inválidas");
    advertisedAvailable += 1;
    scopes[scope] = validUntil > now
      ? Object.freeze({ status: "available", validUntil: value.validUntil })
      : Object.freeze({ status: "withheld" });
  }
  if (payload.mode !== modeForAvailableCount(advertisedAvailable)) throw new TypeError("capacidades de publicação inválidas");
  const available = AGGREGATE_SCOPE_NAMES.filter((scope) => scopes[scope].status === "available").length;
  return Object.freeze({ contract: payload.contract, mode: modeForAvailableCount(available), scopes: Object.freeze(scopes) });
}

export function aggregateScopeAvailable(capabilities, scope, now = Date.now()) {
  const capability = capabilities?.scopes?.[scope];
  return AGGREGATE_SCOPE_NAMES.includes(scope)
    && capability?.status === "available"
    && canonicalInstant(capability.validUntil) > now;
}

export function nextAggregateCapabilityExpiry(capabilities, now = Date.now()) {
  const expiries = AGGREGATE_SCOPE_NAMES
    .filter((scope) => aggregateScopeAvailable(capabilities, scope, now))
    .map((scope) => Date.parse(capabilities.scopes[scope].validUntil));
  return expiries.length ? Math.min(...expiries) : null;
}

export function withAggregateScopeWithheld(capabilities, scope) {
  const source = validateCapabilities(JSON.parse(JSON.stringify(capabilities || PERSONAL_ONLY_CAPABILITIES)));
  if (!AGGREGATE_SCOPE_NAMES.includes(scope) || source.scopes[scope].status === "withheld") return source;
  const next = JSON.parse(JSON.stringify(source));
  next.scopes[scope].status = "withheld";
  delete next.scopes[scope].validUntil;
  const available = AGGREGATE_SCOPE_NAMES.filter((name) => next.scopes[name].status === "available").length;
  next.mode = modeForAvailableCount(available);
  return validateCapabilities(next);
}
