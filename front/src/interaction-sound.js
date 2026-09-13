const SOUND_KEY = "polimatch-sound-enabled-v1";

let ctx = null;
let enabled = true;
let installed = false;

function storedEnabled() {
  try {
    const value = localStorage.getItem(SOUND_KEY);
    return value === null ? true : value === "1";
  } catch {
    return true;
  }
}

function saveEnabled(value) {
  try { localStorage.setItem(SOUND_KEY, value ? "1" : "0"); } catch {}
}

function audioContext() {
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctx) return null;
  if (!ctx) ctx = new Ctx();
  return ctx;
}

function tone({ frequency = 440, duration = .05, gain = .025, type = "sine", endFrequency = null, delay = 0 }) {
  if (!enabled) return;
  const ac = audioContext();
  if (!ac) return;
  const start = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  amp.gain.setValueAtTime(.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + .008);
  amp.gain.exponentialRampToValueAtTime(.0001, start + duration);
  osc.connect(amp);
  amp.connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + .02);
}

function haptic(pattern) {
  try { globalThis.navigator?.vibrate?.(pattern); } catch {}
}

export function emitPoliMatchFeedback(kind) {
  if (!enabled) return;
  switch (kind) {
    case "tap":
      tone({ frequency: 330, endFrequency: 360, duration: .035, gain: .018 });
      haptic(8);
      break;
    case "select":
      tone({ frequency: 390, endFrequency: 520, duration: .075, gain: .028 });
      tone({ frequency: 610, duration: .045, gain: .014, delay: .045 });
      haptic(12);
      break;
    case "skip":
      tone({ frequency: 300, endFrequency: 250, duration: .055, gain: .018 });
      break;
    case "success":
      tone({ frequency: 460, endFrequency: 690, duration: .09, gain: .026 });
      tone({ frequency: 760, duration: .08, gain: .018, delay: .07 });
      haptic([10, 24, 14]);
      break;
    case "error":
      tone({ frequency: 220, endFrequency: 155, duration: .11, gain: .022, type: "triangle" });
      haptic([18, 24, 18]);
      break;
    case "combo":
      tone({ frequency: 520, endFrequency: 780, duration: .07, gain: .024 });
      tone({ frequency: 880, duration: .08, gain: .02, delay: .055 });
      break;
    case "chroma":
      tone({ frequency: 620, endFrequency: 980, duration: .15, gain: .024 });
      tone({ frequency: 1040, duration: .14, gain: .016, delay: .08 });
      tone({ frequency: 1320, duration: .12, gain: .012, delay: .15 });
      haptic([8, 18, 10, 18, 16]);
      break;
    case "leader-defense":
      tone({ frequency: 430, endFrequency: 500, duration: .08, gain: .022, type: "triangle" });
      tone({ frequency: 430, duration: .055, gain: .014, delay: .075 });
      break;
    case "comeback":
      tone({ frequency: 260, endFrequency: 420, duration: .12, gain: .024, type: "triangle" });
      tone({ frequency: 560, duration: .08, gain: .018, delay: .1 });
      haptic([12, 20, 14]);
      break;
    case "overtake":
      tone({ frequency: 380, endFrequency: 720, duration: .1, gain: .025 });
      break;
  }
}

function createToggle() {
  if (document.getElementById("pm-sound-toggle")) return;
  const btn = document.createElement("button");
  btn.id = "pm-sound-toggle";
  btn.type = "button";
  btn.className = "pm-sound-toggle";
  btn.setAttribute("aria-label", "Ativar ou desativar sons do PoliMatch");
  btn.setAttribute("aria-pressed", enabled ? "true" : "false");
  btn.textContent = enabled ? "Som on" : "Som off";
  const duel = document.querySelector(".pm-duel-v2__controls") || document.querySelector("#panel-duel");
  duel?.appendChild(btn);
  btn.addEventListener("click", () => {
    enabled = !enabled;
    saveEnabled(enabled);
    btn.setAttribute("aria-pressed", enabled ? "true" : "false");
    btn.textContent = enabled ? "Som on" : "Som off";
    if (enabled) emitPoliMatchFeedback("tap");
  });
}

function observeFeedbackStates() {
  const root = document.querySelector("#panel-duel");
  if (!root || !globalThis.MutationObserver) return;
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const el = mutation.target;
      if (!(el instanceof Element)) continue;
      if (mutation.attributeName === "class") {
        if (el.classList.contains("picked-win")) emitPoliMatchFeedback("success");
        if (el.classList.contains("picked-pending")) emitPoliMatchFeedback("select");
      }
      if (mutation.attributeName === "hidden" && el.id === "combo-banner" && !el.hidden) {
        emitPoliMatchFeedback("combo");
      }
      if (mutation.attributeName === "hidden" && el.id === "goal-modal" && !el.hidden) {
        emitPoliMatchFeedback("success");
      }
    }
  });
  observer.observe(root, { attributes: true, subtree: true, attributeFilter: ["class", "hidden"] });
}

function bindControls() {
  document.querySelectorAll(".tab, .topic-btn, .mode-btn, .card-info").forEach((el) => {
    el.addEventListener("click", () => emitPoliMatchFeedback("tap"));
  });
  document.querySelector("#skip-duel")?.addEventListener("click", () => emitPoliMatchFeedback("skip"));
  document.querySelectorAll("#card-a,#card-b").forEach((el) => {
    el.addEventListener("click", () => {
      const rarity = el.dataset.rarity || "";
      emitPoliMatchFeedback(rarity.startsWith("chroma") ? "chroma" : "select");
    });
  });
}

export function installInteractionSound() {
  if (installed || !globalThis.document) return;
  installed = true;
  enabled = storedEnabled();
  createToggle();
  bindControls();
  observeFeedbackStates();
}

export function isSoundEnabled() { return enabled; }
export function setSoundEnabled(value) {
  enabled = Boolean(value);
  saveEnabled(enabled);
}
