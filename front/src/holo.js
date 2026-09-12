function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function bindHoloTilt(cards, windowObject = window) {
  const reduceMotion = windowObject.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return () => {};

  const setTilt = (card, x, y) => {
    card.style.setProperty("--mx", `${x.toFixed(1)}%`);
    card.style.setProperty("--my", `${y.toFixed(1)}%`);
    card.style.setProperty("--holo-hl", "0.34");
  };
  const reset = (card) => {
    card.style.removeProperty("--mx");
    card.style.removeProperty("--my");
    card.style.removeProperty("--holo-hl");
  };

  for (const card of cards) {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setTilt(card,
        clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
        clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100));
    });
    card.addEventListener("pointerleave", () => reset(card));
  }

  const orientation = windowObject.DeviceOrientationEvent;
  const onOrientation = (event) => {
    if (event.gamma == null || event.beta == null) return;
    const x = clamp(50 + event.gamma * 1.6, 0, 100);
    const y = clamp(50 + (event.beta - 45) * 1.2, 0, 100);
    cards.forEach((card) => setTilt(card, x, y));
  };
  if (orientation && typeof orientation.requestPermission !== "function") {
    windowObject.addEventListener("deviceorientation", onOrientation);
  }
  return () => windowObject.removeEventListener?.("deviceorientation", onOrientation);
}
