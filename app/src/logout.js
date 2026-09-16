export async function revokeSessionBeforeClearing(accessToken, { endSession, clearLocalSession }) {
  await endSession(accessToken);
  clearLocalSession();
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
  state.roundId = createRoundId();
  state.pendingWinnerId = "";
  state.selectedId = "";
  state.roundOutcome = null;
  state.busy = false;
  state.result = "";
  state.resultTone = "";
  state.personalFeedbackMessage = "";
  state.globalFeedbackMessage = "";
}
