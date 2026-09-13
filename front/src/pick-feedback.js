/** A single, accessible result moment shown on the selected card. */

export const VIBRATE_MS = 30;
export const PICK_PENDING_TEXT = "Escolhido · salvando…";

export function formatEloDelta(delta) {
  const n = Math.round(Number(delta));
  if (!Number.isFinite(n)) return "0";
  if (n > 0) return `+${n}`;
  return String(n);
}

export function formatPickResult({ winnerDelta, zebra = false, combo = 0, saved = false }) {
  const parts = [];
  if (zebra) parts.push("ZEBRA!");
  parts.push(`${formatEloDelta(winnerDelta)} Elo`);
  if (combo >= 2) parts.push(`Combo x${Math.trunc(combo)}`);
  parts.push(saved ? "Voto salvo" : "Escolha registrada");
  return parts.join(" · ");
}

export function tryVibrate(ms = VIBRATE_MS, nav = typeof navigator !== "undefined" ? navigator : undefined) {
  if (!nav || typeof nav.vibrate !== "function") return false;
  try {
    nav.vibrate(ms);
    return true;
  } catch {
    return false;
  }
}

export function showPickResult(el, text, kind = "saved") {
  el.querySelector?.(".pick-result")?.remove();
  const doc = el.ownerDocument;
  if (!doc?.createElement) return null;
  const node = doc.createElement("span");
  node.className = `pick-result ${kind}`;
  node.setAttribute("role", "status");
  node.setAttribute("aria-live", "polite");
  node.textContent = text;
  el.appendChild(node);
  return node;
}

export function clearPickFeedback(el) {
  el.classList.remove("picked-pending", "picked-win", "picked-lose");
  el.querySelector?.(".pick-result")?.remove();
}

export function applyPendingPickFeedback(winnerEl, loserEl) {
  clearPickFeedback(winnerEl);
  clearPickFeedback(loserEl);
  winnerEl.classList.add("picked-pending");
  return showPickResult(winnerEl, PICK_PENDING_TEXT, "pending");
}

export function applyPickFeedback(winnerEl, loserEl, winnerDelta, _loserDelta, options = {}) {
  clearPickFeedback(winnerEl);
  clearPickFeedback(loserEl);
  winnerEl.classList.add("picked-win");
  loserEl.classList.add("picked-lose");
  const text = formatPickResult({ winnerDelta, ...options });
  showPickResult(winnerEl, text, options.zebra ? "zebra" : "saved");
  tryVibrate(VIBRATE_MS, options.navigator);
}
