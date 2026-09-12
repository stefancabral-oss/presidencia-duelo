export const SWIPE_THRESHOLD = 60;
export const QUICK_CONTROLS_HINT_KEY = "presidencia-duelo-quick-controls-hint-v1";

export function isTypingTarget(target) {
  if (!target) return false;
  const tagName = String(target.tagName || "").toUpperCase();
  return tagName === "INPUT"
    || tagName === "TEXTAREA"
    || tagName === "SELECT"
    || Boolean(target.isContentEditable);
}

export function keyboardPickSide(event) {
  if (!event || isTypingTarget(event.target)) return null;
  if (event.key === "ArrowLeft") return "left";
  if (event.key === "ArrowRight") return "right";
  return null;
}

export function swipePickSide(startX, endX, threshold = SWIPE_THRESHOLD) {
  const delta = Number(endX) - Number(startX);
  if (!Number.isFinite(delta) || Math.abs(delta) < threshold) return null;
  return delta < 0 ? "left" : "right";
}

export function hasSeenQuickControlsHint(storage = globalThis.localStorage) {
  try {
    return storage.getItem(QUICK_CONTROLS_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

export function markQuickControlsHintSeen(storage = globalThis.localStorage) {
  try {
    storage.setItem(QUICK_CONTROLS_HINT_KEY, "1");
    return true;
  } catch {
    return false;
  }
}
