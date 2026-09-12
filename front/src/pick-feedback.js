/**
 * Impact feedback after a locked pick: Elo floats, win/lose classes, haptic tap.
 * Sound is omitted — no mute control exists in the current shell.
 */

export const VIBRATE_MS = 30;
export const ZEBRA_BADGE_TEXT = "ZEBRA!";

export function formatEloDelta(delta) {
  const n = Math.round(Number(delta));
  if (!Number.isFinite(n)) return "0";
  if (n > 0) return `+${n}`;
  return String(n);
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

export function showEloFloat(el, delta, kind) {
  el.querySelector?.(".elo-float")?.remove();
  const doc = el.ownerDocument;
  if (!doc?.createElement) return null;
  const node = doc.createElement("span");
  node.className = `elo-float ${kind}`;
  node.setAttribute("aria-hidden", "true");
  node.textContent = formatEloDelta(delta);
  el.appendChild(node);
  return node;
}

export function showZebraBadge(el) {
  el.querySelector?.(".zebra-badge")?.remove();
  const doc = el.ownerDocument;
  if (!doc?.createElement) return null;
  const node = doc.createElement("span");
  node.className = "zebra-badge";
  node.setAttribute("aria-hidden", "true");
  node.textContent = ZEBRA_BADGE_TEXT;
  el.appendChild(node);
  return node;
}

export function clearPickFeedback(el) {
  el.classList.remove("picked-win", "picked-lose");
  el.querySelector?.(".elo-float")?.remove();
  el.querySelector?.(".zebra-badge")?.remove();
}

export function applyPickFeedback(winnerEl, loserEl, winnerDelta, loserDelta, options = {}) {
  winnerEl.classList.add("picked-win");
  loserEl.classList.add("picked-lose");
  showEloFloat(winnerEl, winnerDelta, "win");
  showEloFloat(loserEl, loserDelta, "lose");
  if (options.zebra) showZebraBadge(winnerEl);
  tryVibrate(VIBRATE_MS, options.navigator);
}
