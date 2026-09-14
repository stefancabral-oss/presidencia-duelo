const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function pointerMotion(rect, clientX, clientY) {
  const x = clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
  const y = clamp((clientY - rect.top) / Math.max(rect.height, 1), 0, 1);
  return {
    x,
    y,
    rotateX: (0.5 - y) * 9,
    rotateY: (x - 0.5) * 11,
  };
}

export function orientationMotion(beta = 45, gamma = 0) {
  const x = clamp((Number(gamma) + 28) / 56, 0, 1);
  const y = clamp((Number(beta) - 18) / 54, 0, 1);
  return {
    x,
    y,
    rotateX: (0.5 - y) * 7,
    rotateY: (x - 0.5) * 8,
  };
}

function paint(card, motion) {
  card.style.setProperty("--holo-x", `${(motion.x * 100).toFixed(1)}%`);
  card.style.setProperty("--holo-y", `${(motion.y * 100).toFixed(1)}%`);
  card.style.setProperty("--tilt-x", `${motion.rotateX.toFixed(2)}deg`);
  card.style.setProperty("--tilt-y", `${motion.rotateY.toFixed(2)}deg`);
}

function reset(card) {
  paint(card, { x: 0.5, y: 0.5, rotateX: 0, rotateY: 0 });
}

let orientationInstalled = false;

function installOrientationListener() {
  if (orientationInstalled || typeof window === "undefined") return;
  orientationInstalled = true;
  window.addEventListener("deviceorientation", (event) => {
    const motion = orientationMotion(event.beta, event.gamma);
    document.querySelectorAll("[data-hologram]").forEach((card) => paint(card, motion));
  }, { passive: true });
}

export async function enableDeviceTilt() {
  if (typeof window === "undefined" || typeof window.DeviceOrientationEvent === "undefined") return false;
  const OrientationEvent = window.DeviceOrientationEvent;
  if (typeof OrientationEvent.requestPermission === "function") {
    const permission = await OrientationEvent.requestPermission();
    if (permission !== "granted") return false;
  }
  installOrientationListener();
  return true;
}

export function installChromaMotion(root = document) {
  const cards = [...root.querySelectorAll("[data-hologram]")];
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    cards.forEach(reset);
    return cards.length;
  }
  cards.forEach((card) => {
    reset(card);
    const move = (event) => paint(card, pointerMotion(card.getBoundingClientRect(), event.clientX, event.clientY));
    card.addEventListener("pointerenter", move);
    card.addEventListener("pointermove", move);
    card.addEventListener("pointerdown", move);
    card.addEventListener("pointerleave", () => reset(card));
    card.addEventListener("pointercancel", () => reset(card));
  });
  if (typeof window !== "undefined" && typeof window.DeviceOrientationEvent !== "undefined" && typeof window.DeviceOrientationEvent.requestPermission !== "function") {
    installOrientationListener();
  }
  return cards.length;
}
