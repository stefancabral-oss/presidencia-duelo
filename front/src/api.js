const API_BASE = (import.meta.env?.VITE_API_URL || "").replace(/\/$/, "");
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
    throw new ApiRequestError(`${path} ${response.status}`, { kind: "http" });
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
  return requestJson("/api/vote", {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ winnerId, loserId, mode }),
  });
}
