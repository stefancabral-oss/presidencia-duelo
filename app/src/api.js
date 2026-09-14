const API_BASE = String(import.meta.env?.VITE_API_URL || "").replace(/\/$/, "");
const TIMEOUT_MS = 8000;

export class ApiError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = "ApiError";
  }
}

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

export async function requestJson(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(apiUrl(path), { ...options, signal: controller.signal });
    if (!response.ok) throw new ApiError(`Servidor respondeu ${response.status}`);
    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(controller.signal.aborted ? "O servidor demorou para responder" : "Sem conexão com o servidor", error);
  } finally {
    clearTimeout(timer);
  }
}

export async function loadCandidates(topicId = "eleicoes-2026") {
  const result = await requestJson(`/api/candidates?topic=${encodeURIComponent(topicId)}`);
  if (!Array.isArray(result.candidates)) throw new ApiError("Catálogo inválido");
  return result.candidates;
}

export function loadRanking(topicId = "eleicoes-2026") {
  return requestJson(`/api/ranking?topic=${encodeURIComponent(topicId)}`);
}

export function createPlayer() {
  return requestJson("/api/player", { method: "POST" });
}

export function loadPlayerRanking(recoveryKey, topicId = "eleicoes-2026") {
  return requestJson(`/api/player/state?topic=${encodeURIComponent(topicId)}`, {
    headers: { Authorization: `Bearer ${recoveryKey}` },
  });
}

export function submitVote(winnerId, loserId, topicId = "eleicoes-2026", player = {}) {
  return requestJson("/api/vote", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(player.recoveryKey ? { Authorization: `Bearer ${player.recoveryKey}` } : {}),
    },
    body: JSON.stringify({
      voteId: crypto.randomUUID(),
      winnerId,
      loserId,
      topicId,
      playerVersion: player.version,
    }),
  });
}
