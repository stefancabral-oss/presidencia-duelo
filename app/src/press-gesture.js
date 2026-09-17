export const HOLD_DELAY_MS = 460;
export const MOVE_TOLERANCE_PX = 12;

export function createPressGesture({
  onTap,
  onHold,
  delay = HOLD_DELAY_MS,
  tolerance = MOVE_TOLERANCE_PX,
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
} = {}) {
  let timer = null;
  let start = null;
  let held = false;

  function cancelTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  return {
    pointerDown(event) {
      if (event.button !== undefined && event.button !== 0) return;
      cancelTimer();
      held = false;
      start = { x: event.clientX || 0, y: event.clientY || 0 };
      timer = setTimer(() => {
        timer = null;
        held = true;
        onHold?.(event);
      }, delay);
    },
    pointerMove(event) {
      if (!start || timer === null) return;
      const distance = Math.hypot((event.clientX || 0) - start.x, (event.clientY || 0) - start.y);
      if (distance > tolerance) cancelTimer();
    },
    pointerEnd() {
      cancelTimer();
      start = null;
    },
    click(event) {
      // Pointer-generated clicks have a positive detail. A keyboard or AT
      // activation has detail === 0 and may be the first click we receive
      // after showModal() swallowed the pointer gesture's own click.
      if (held && event.detail !== 0) {
        held = false;
        event.preventDefault?.();
        event.stopPropagation?.();
        return "hold";
      }
      held = false;
      onTap?.(event);
      return "tap";
    },
    contextMenu(event) {
      event.preventDefault?.();
    },
  };
}

export function installPressGesture(element, callbacks) {
  const gesture = createPressGesture(callbacks);
  element.addEventListener("pointerdown", gesture.pointerDown);
  element.addEventListener("pointermove", gesture.pointerMove);
  element.addEventListener("pointerup", gesture.pointerEnd);
  element.addEventListener("pointercancel", gesture.pointerEnd);
  element.addEventListener("click", gesture.click);
  element.addEventListener("contextmenu", gesture.contextMenu);
  return gesture;
}
