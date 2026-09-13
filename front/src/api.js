const LEGACY_API_BASE = "https://api-polimatch.e7h3.com";
const PRIMARY_API_BASE = "https://api.polimatch.com.br";

export function normalizeApiBase(configuredBase = "") {
  const base = configuredBase.replace(/\/$/, "");
  return base === LEGACY_API_BASE ? PRIMARY_API_BASE : base;
}

const API_BASE = normalizeApiBase(import.meta.env?.VITE_API_URL || "");
export const API_TIMEOUT_MS = 8000;

export class ApiRequestError extends Error {
  constructor(message, { kind, confirmationUnknown = false, cause } = {}) {
    super(message, { cause });
    this.name = "ApiRequestError";
    this.kind = kind || "unknown";
    this.confirmationUnknown = confirmationUnknown;
  }
}

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

export function isUnknownVoteConfirmation(error) {
  return error instanceof ApiRequestError && error.confirmationUnknown;
}

export async function requestJson(
  path,
  {
    method = "GET",
    headers,
    body,
    timeoutMs = API_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
  } = {},
) {
  const controller = new AbortController();
  const writeMayHaveReachedServer = method !== "GET" && method !== "HEAD";
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(apiUrl(path), {
      method,
      headers,
      body,
      signal: controller.signal,
    });
  } catch (error) {
    const timedOut = controller.signal.aborted || error?.name === "AbortError";
    throw new ApiRequestError(timedOut ? `timeout ${path}` : `network ${path}`, {
      kind: timedOut ? "timeout" : "network",
      confirmationUnknown: writeMayHaveReachedServer,
      cause: error,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let errorBody = null;
    try {
      errorBody = await response.json();
    } catch {
      // An HTTP status is enough to classify the failure.
    }
    const error = new ApiRequestError(`${path} ${response.status}`, { kind: "http" });
    error.status = response.status;
    error.body = errorBody;
    throw error;
  }

  try {
    return await response.json();
  } catch (error) {
    throw new ApiRequestError(`invalid response ${path}`, {
      kind: "invalid-response",
      confirmationUnknown: writeMayHaveReachedServer,
      cause: error,
    });
  }
}

export async function fetchCandidates(options) {
  const data = await requestJson("/api/candidates", options);
  const list = Array.isArray(data.candidates) ? data.candidates : data;
  if (!Array.isArray(list) || list.length === 0) {
    throw new ApiRequestError("lista vazia", { kind: "invalid-response" });
  }
  return list;
}

export async function fetchHealth(options) {
  return requestJson("/api/health", options);
}

export async function fetchServerRanking(mode = "presidentes", options) {
  return requestJson(`/api/ranking?mode=${encodeURIComponent(mode)}`, options);
}

export async function postVote(winnerId, loserId, mode = "presidentes", options = {}) {
  const { voteId, recoveryKey, playerVersion, ...requestOptions } = options;
  return requestJson("/api/vote", {
    ...requestOptions,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(recoveryKey ? { Authorization: `Bearer ${recoveryKey}` } : {}),
    },
    body: JSON.stringify({ voteId, winnerId, loserId, mode, playerVersion }),
  });
}

export async function createPlayer(options) {
  return requestJson("/api/player", { ...options, method: "POST" });
}

export async function fetchPlayerState(recoveryKey, mode = "presidentes", options = {}) {
  return requestJson(`/api/player/state?mode=${encodeURIComponent(mode)}`, {
    ...options,
    headers: { Authorization: `Bearer ${recoveryKey}` },
  });
}

export async function replacePlayerState(recoveryKey, mode, version, state, options = {}) {
  return requestJson("/api/player/state", {
    ...options,
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${recoveryKey}`,
    },
    body: JSON.stringify({ mode, version, state }),
  });
}
