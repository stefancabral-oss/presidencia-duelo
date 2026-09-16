const API_BASE = String(import.meta.env?.VITE_API_URL || "").replace(/\/$/, "");
const TIMEOUT_MS = 8000;

/**
 * Erro de API que preserva o motivo da falha.
 *
 * `status` 0 significa que nenhuma resposta chegou (rede caiu ou estourou o tempo);
 * qualquer outro valor é o status HTTP real. Quem chama precisa dessa distinção:
 * só um 401 autoriza descartar a chave de recuperação, e só um 409 pede
 * ressincronização de versão. Colapsar tudo numa mensagem única faz o app
 * apagar a conta do jogador por causa de um 503 passageiro.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, code = "", body = null, cause } = {}) {
    super(message, { cause });
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }

  /** Nenhuma resposta chegou: a tentativa pode ter sido aplicada no servidor. */
  get unreachable() {
    return this.status === 0;
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
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ApiError(body?.error || `Servidor respondeu ${response.status}`, {
        status: response.status,
        code: body?.code || "",
        body,
      });
    }
    try {
      return await response.json();
    } catch (error) {
      // Resposta 2xx com corpo ilegível: proxy, portal cativo ou deploy quebrado.
      // A conexão está de pé, então dizer "sem conexão" manda a pessoa
      // consertar a coisa errada.
      throw new ApiError("O servidor respondeu em um formato inesperado", {
        status: response.status,
        code: "BAD_PAYLOAD",
        cause: error,
      });
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const aborted = controller.signal.aborted;
    throw new ApiError(aborted ? "O servidor demorou para responder" : "Sem conexão com o servidor", {
      status: 0,
      code: aborted ? "TIMEOUT" : "NETWORK",
      cause: error,
    });
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

/**
 * O `roundId` vem de quem chama, nunca daqui.
 *
 * Ele é a chave de idempotência que o servidor usa para reconhecer a repetição
 * de uma rodada (trava consultiva + UNIQUE + resposta `alreadyProcessed`). Se
 * nascesse a cada requisição, uma nova tentativa depois de um tempo esgotado
 * viraria uma rodada diferente e derrubaria toda essa proteção.
 */
export function submitRoundVote(roundId, winnerId, candidateIds, topicId = "eleicoes-2026", player = {}) {
  return requestJson("/api/round-vote", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(player.recoveryKey ? { Authorization: `Bearer ${player.recoveryKey}` } : {}),
    },
    body: JSON.stringify({
      roundId,
      winnerId,
      candidateIds,
      topicId,
      playerVersion: player.version,
    }),
  });
}
