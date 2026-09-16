export async function revokeSessionBeforeClearing(accessToken, { endSession, clearLocalSession }) {
  await endSession(accessToken);
  clearLocalSession();
}

export function isCurrentVoteIdentity(state, attempt) {
  return Number(state.identityEpoch || 0) === attempt.epoch
    && state.recoveryKey === attempt.recoveryKey;
}

/**
 * Abandona qualquer tentativa ligada ao jogador anterior.
 *
 * Um `roundId` pertence ao jogador que iniciou a rodada. Reaproveitá-lo depois
 * de login ou logout faz o backend enxergar a escolha de outra identidade e
 * rejeitá-la para sempre. A troca de sessão mantém as quatro cartas visíveis,
 * mas começa uma confirmação nova e sem ambiguidade.
 */
export function resetPendingVoteForIdentityChange(state, createRoundId = () => crypto.randomUUID()) {
  state.identityEpoch = Number(state.identityEpoch || 0) + 1;
  state.dailyLoadEpoch = Number(state.dailyLoadEpoch || 0) + 1;
  state.roundId = createRoundId();
  state.dailySession = null;
  state.dailyCandidates = [];
  state.dailyLoading = false;
  state.dailyLoadError = "";
  state.pendingDailySession = null;
  state.pendingDailyRefresh = false;
  state.pendingWinnerId = "";
  state.votePhase = "ready";
  state.voteAction = "";
  state.retryAfterSeconds = null;
  state.retryAt = 0;
  state.sessionRecoveryMode = "";
  state.selectedId = "";
  state.roundOutcome = null;
  state.busy = false;
  state.result = "";
  state.resultTone = "";
  state.personalFeedbackMessage = "";
  state.globalFeedbackMessage = "";
}
