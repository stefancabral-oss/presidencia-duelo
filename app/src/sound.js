const STORAGE_KEY = "polimatch:sound";
const LEGACY_STORAGE_KEY = "polimatch-sound-enabled-v1";
const CUE_COOLDOWN_MS = 90;

const CUES = Object.freeze({
  enter: [
    { frequency: 392, endFrequency: 523, delay: 0, duration: .09, gain: .032, type: "sine" },
    { frequency: 659, endFrequency: 784, delay: .055, duration: .13, gain: .026, type: "sine" },
  ],
  navigation: [
    { frequency: 466, endFrequency: 587, delay: 0, duration: .075, gain: .023, type: "sine" },
  ],
  profile: [
    { frequency: 349, endFrequency: 440, delay: 0, duration: .12, gain: .025, type: "triangle" },
    { frequency: 523, endFrequency: 659, delay: .065, duration: .16, gain: .021, type: "sine" },
  ],
  dismiss: [
    { frequency: 440, endFrequency: 330, delay: 0, duration: .08, gain: .018, type: "sine" },
  ],
  choose: [
    { frequency: 294, endFrequency: 392, delay: 0, duration: .07, gain: .026, type: "triangle" },
  ],
  confirm: [
    { frequency: 523, endFrequency: 659, delay: 0, duration: .11, gain: .032, type: "sine" },
    { frequency: 659, endFrequency: 784, delay: .07, duration: .14, gain: .03, type: "sine" },
    { frequency: 784, endFrequency: 1047, delay: .14, duration: .2, gain: .024, type: "triangle" },
  ],
  zebra: [
    { frequency: 523, endFrequency: 784, delay: 0, duration: .12, gain: .032, type: "sine" },
    { frequency: 659, endFrequency: 988, delay: .065, duration: .17, gain: .029, type: "triangle" },
    { frequency: 1047, endFrequency: 1568, delay: .15, duration: .24, gain: .022, type: "sine" },
  ],
  shuffle: [
    { frequency: 330, endFrequency: 415, delay: 0, duration: .055, gain: .018, type: "triangle" },
    { frequency: 392, endFrequency: 494, delay: .045, duration: .055, gain: .019, type: "triangle" },
    { frequency: 466, endFrequency: 587, delay: .09, duration: .07, gain: .02, type: "triangle" },
  ],
  error: [
    { frequency: 220, endFrequency: 165, delay: 0, duration: .14, gain: .025, type: "sine" },
    { frequency: 185, endFrequency: 139, delay: .11, duration: .18, gain: .02, type: "sine" },
  ],
  soundOn: [
    { frequency: 523, endFrequency: 784, delay: 0, duration: .13, gain: .027, type: "sine" },
  ],
  soundOff: [
    { frequency: 523, endFrequency: 349, delay: 0, duration: .1, gain: .022, type: "sine" },
  ],
});

export function soundEnabledFromStorage(storage) {
  try {
    const stored = storage?.getItem(STORAGE_KEY);
    if (stored) return stored !== "off";
    const legacy = storage?.getItem(LEGACY_STORAGE_KEY);
    if (legacy === "0" || legacy === "1") {
      const migrated = legacy === "1" ? "on" : "off";
      try { storage?.setItem(STORAGE_KEY, migrated); } catch {}
      return migrated === "on";
    }
    return true;
  } catch {
    return true;
  }
}

export function createSoundController({ windowObject = globalThis.window, storage, contextFactory } = {}) {
  let resolvedStorage = storage;
  if (resolvedStorage === undefined) {
    try { resolvedStorage = windowObject?.localStorage; } catch {}
  }
  let enabled = soundEnabledFromStorage(resolvedStorage);
  let context;
  const lastPlayedAt = new Map();

  function getContext() {
    if (context) return context;
    const AudioContextClass = windowObject?.AudioContext || windowObject?.webkitAudioContext;
    context = contextFactory?.() || (AudioContextClass ? new AudioContextClass() : null);
    return context;
  }

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    try { resolvedStorage?.setItem(STORAGE_KEY, enabled ? "on" : "off"); } catch {}
    return enabled;
  }

  function play(name) {
    if (!enabled || !CUES[name]) return false;
    try {
      const audioContext = getContext();
      if (!audioContext) return false;
      const now = windowObject?.performance?.now?.() ?? Date.now();
      const previous = lastPlayedAt.get(name) ?? -Infinity;
      if (now - previous < CUE_COOLDOWN_MS) return false;
      lastPlayedAt.set(name, now);
      if (audioContext.state === "suspended") audioContext.resume?.().catch?.(() => {});
      const start = audioContext.currentTime + .008;
      for (const note of CUES[name]) {
        const oscillator = audioContext.createOscillator();
        const envelope = audioContext.createGain();
        const noteStart = start + note.delay;
        const noteEnd = noteStart + note.duration;
        oscillator.type = note.type;
        oscillator.frequency.setValueAtTime(note.frequency, noteStart);
        oscillator.frequency.exponentialRampToValueAtTime(note.endFrequency, noteEnd);
        envelope.gain.setValueAtTime(.0001, noteStart);
        envelope.gain.exponentialRampToValueAtTime(note.gain, noteStart + Math.min(.018, note.duration / 3));
        envelope.gain.exponentialRampToValueAtTime(.0001, noteEnd);
        oscillator.connect(envelope);
        envelope.connect(audioContext.destination);
        oscillator.start(noteStart);
        oscillator.stop(noteEnd + .01);
      }
      return true;
    } catch {
      return false;
    }
  }

  return {
    get enabled() { return enabled; },
    play,
    setEnabled,
  };
}

export const soundCueNames = Object.freeze(Object.keys(CUES));
