export const SWIPE_THRESHOLD = 60;
export const QUICK_CONTROLS_HINT_KEY = "presidencia-duelo-quick-controls-hint-v1";
export const QUICK_CONTROLS_STATES = {
  INTRO: "intro",
  CONTROLS: "controls",
  COMPLETE: "complete",
};

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
  return quickControlsHintState(storage) === QUICK_CONTROLS_STATES.COMPLETE;
}

export function quickControlsHintState(storage = globalThis.localStorage) {
  try {
    const value = storage.getItem(QUICK_CONTROLS_HINT_KEY);
    if (value === "1" || value === QUICK_CONTROLS_STATES.COMPLETE) {
      return QUICK_CONTROLS_STATES.COMPLETE;
    }
    if (value === QUICK_CONTROLS_STATES.CONTROLS) return QUICK_CONTROLS_STATES.CONTROLS;
  } catch {
    // Start from the intro when storage is unavailable.
  }
  return QUICK_CONTROLS_STATES.INTRO;
}

export function markQuickControlsHintControls(storage = globalThis.localStorage) {
  try {
    storage.setItem(QUICK_CONTROLS_HINT_KEY, QUICK_CONTROLS_STATES.CONTROLS);
    return true;
  } catch {
    return false;
  }
}

export function markQuickControlsHintSeen(storage = globalThis.localStorage) {
  try {
    storage.setItem(QUICK_CONTROLS_HINT_KEY, QUICK_CONTROLS_STATES.COMPLETE);
    return true;
  } catch {
    return false;
  }
}

export function quickControlsHintText(coarsePointer) {
  return coarsePointer
    ? "Dica: deslize os cards para escolher mais rápido no celular."
    : "Dica: use as setas ← e → para escolher mais rápido no computador.";
}
