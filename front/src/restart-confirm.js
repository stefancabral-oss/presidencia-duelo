const DEFAULT_WINDOW_MS = 4500;

function tournamentHasProgress(documentRef) {
  const winner = documentRef.getElementById("tournament-winner");
  if (winner && winner.hidden === false) return true;
  const round = documentRef.getElementById("tournament-round");
  const text = String(round?.textContent || "");
  return Boolean(text) && !/duelo\s+1\s+de\s+11/i.test(text);
}

export function installTournamentRestartGuard({
  documentRef = globalThis.document,
  windowRef = globalThis.window,
  confirmWindowMs = DEFAULT_WINDOW_MS,
} = {}) {
  if (!documentRef?.addEventListener) return () => {};
  let timer = null;

  function restore(button) {
    if (timer != null) windowRef?.clearTimeout?.(timer);
    timer = null;
    if (!button) return;
    button.dataset.restartConfirm = "";
    button.textContent = "Novo torneio";
  }

  function handler(event) {
    const button = event.target?.closest?.("#restart-tournament");
    if (!button) return;
    if (!tournamentHasProgress(documentRef)) {
      restore(button);
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (button.dataset.restartConfirm !== "armed") {
      button.dataset.restartConfirm = "armed";
      button.textContent = "Confirmar novo torneio";
      const status = documentRef.getElementById("tournament-recovery-status");
      if (status) {
        status.hidden = false;
        status.textContent = "Clique novamente para apagar esta chave e começar outro torneio.";
      }
      timer = windowRef?.setTimeout?.(() => restore(button), confirmWindowMs) ?? null;
      return;
    }

    restore(button);
    documentRef.getElementById("tournament-again")?.click();
  }

  documentRef.addEventListener("click", handler, true);
  return () => {
    documentRef.removeEventListener("click", handler, true);
    if (timer != null) windowRef?.clearTimeout?.(timer);
  };
}
