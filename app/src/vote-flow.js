export const VOTE_PHASES = Object.freeze({
  READY: "ready",
  SENDING: "sending",
  CONFIRMED: "confirmed",
  SESSION_REQUIRED: "session-required",
  RESTORING_SESSION: "restoring-session",
  RETRY_READY: "retry-ready",
  RATE_LIMITED: "rate-limited",
  SERVER_ERROR: "server-error",
  CONFLICT: "conflict",
  UNCERTAIN: "uncertain",
  REJECTED: "rejected",
});

export const VOTE_ACTIONS = Object.freeze({
  RETRY: "retry-vote",
  RESTORE_SESSION: "restore-session",
});

function positiveSeconds(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(86400, Math.ceil(seconds)) : null;
}

export function formatRetryAfter(value) {
  const seconds = positiveSeconds(value);
  if (!seconds) return "alguns instantes";
  if (seconds >= 3600) {
    const hours = Math.ceil(seconds / 3600);
    return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  }
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  }
  return `${seconds} ${seconds === 1 ? "segundo" : "segundos"}`;
}

export function voteFailureState(error, now = Date.now()) {
  const status = Number(error?.status) || 0;
  const retryAfterSeconds = positiveSeconds(error?.retryAfterSeconds ?? error?.body?.retryAfterSeconds);
  if (status === 401) {
    return {
      phase: VOTE_PHASES.SESSION_REQUIRED,
      action: VOTE_ACTIONS.RESTORE_SESSION,
      message: "Sua sessão precisa ser restabelecida.",
      retryAfterSeconds: null,
      retryAt: 0,
    };
  }
  if (status === 429) {
    return {
      phase: VOTE_PHASES.RATE_LIMITED,
      action: VOTE_ACTIONS.RETRY,
      message: `Muitas tentativas. Tente novamente em ${formatRetryAfter(retryAfterSeconds)}.`,
      retryAfterSeconds,
      retryAt: retryAfterSeconds ? now + retryAfterSeconds * 1000 : 0,
    };
  }
  if (status === 409 && error?.code === "PLAYER_VERSION_CONFLICT") {
    return {
      phase: VOTE_PHASES.CONFLICT,
      action: VOTE_ACTIONS.RETRY,
      message: "Seu ranking mudou. Confirme novamente esta escolha.",
      retryAfterSeconds: null,
      retryAt: 0,
    };
  }
  if (error?.unreachable) {
    return {
      phase: VOTE_PHASES.UNCERTAIN,
      action: VOTE_ACTIONS.RETRY,
      message: "Não tivemos resposta do servidor. Sua escolha pode não ter sido registrada.",
      retryAfterSeconds: null,
      retryAt: 0,
    };
  }
  if (status >= 500 || status === 0) {
    return {
      phase: VOTE_PHASES.SERVER_ERROR,
      action: VOTE_ACTIONS.RETRY,
      message: "Não foi possível confirmar agora.",
      retryAfterSeconds: null,
      retryAt: 0,
    };
  }
  return {
    phase: VOTE_PHASES.REJECTED,
    action: VOTE_ACTIONS.RETRY,
    message: "Não foi possível confirmar esta escolha.",
    retryAfterSeconds: null,
    retryAt: 0,
  };
}

export function voteRecoveryControl(state, now = Date.now()) {
  if (!state.pendingWinnerId || !state.voteAction) return { visible: false, disabled: false, id: "", label: "" };
  const remainingSeconds = state.retryAt > now ? Math.ceil((state.retryAt - now) / 1000) : 0;
  const restoring = state.voteAction === VOTE_ACTIONS.RESTORE_SESSION;
  const baseLabel = restoring ? "Restabelecer sessão" : "Tentar novamente";
  return {
    visible: true,
    disabled: remainingSeconds > 0,
    id: restoring ? "restore-session" : "retry-vote",
    label: remainingSeconds ? `${baseLabel} em ${formatRetryAfter(remainingSeconds)}` : baseLabel,
  };
}
