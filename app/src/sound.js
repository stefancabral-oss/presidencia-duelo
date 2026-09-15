const STORAGE_KEY = "polimatch:sound";
const LEGACY_STORAGE_KEY = "polimatch-sound-enabled-v1";
const CUE_COOLDOWN_MS = 90;

const CUES = Object.freeze({
  enter: [
    { frequency: 82, endFrequency: 48, delay: 0, duration: .085, gain: .046, type: "sine" },
    { frequency: 620, endFrequency: 540, delay: .025, duration: .045, gain: .009, type: "triangle" },
  ],
  navigation: [
    { frequency: 96, endFrequency: 62, delay: 0, duration: .032, gain: .018, type: "triangle" },
  ],
  profile: [
    { frequency: 110, endFrequency: 72, delay: 0, duration: .055, gain: .026, type: "sine" },
    { frequency: 760, endFrequency: 610, delay: .018, duration: .07, gain: .006, type: "triangle" },
  ],
  dismiss: [
    { frequency: 85, endFrequency: 48, delay: 0, duration: .045, gain: .021, type: "triangle" },
  ],
  choose: [
    { frequency: 72, endFrequency: 44, delay: 0, duration: .06, gain: .052, type: "sine" },
  ],
  confirm: [
    { frequency: 92, endFrequency: 50, delay: 0, duration: .095, gain: .05, type: "sine" },
    { frequency: 680, endFrequency: 520, delay: .026, duration: .06, gain: .008, type: "triangle" },
  ],
  zebra: [
    { frequency: 66, endFrequency: 38, delay: 0, duration: .11, gain: .058, type: "sine" },
    { frequency: 510, endFrequency: 740, delay: .035, duration: .12, gain: .014, type: "triangle" },
    { frequency: 1180, endFrequency: 980, delay: .085, duration: .09, gain: .008, type: "sine" },
  ],
  overtake: [
    { frequency: 84, endFrequency: 48, delay: 0, duration: .07, gain: .043, type: "sine" },
    { frequency: 430, endFrequency: 570, delay: .026, duration: .09, gain: .012, type: "triangle" },
  ],
  top10: [
    { frequency: 82, endFrequency: 46, delay: 0, duration: .08, gain: .046, type: "sine" },
    { frequency: 480, endFrequency: 620, delay: .026, duration: .11, gain: .013, type: "triangle" },
    { frequency: 1080, endFrequency: 1250, delay: .07, duration: .08, gain: .006, type: "sine" },
  ],
  podium: [
    { frequency: 74, endFrequency: 40, delay: 0, duration: .105, gain: .055, type: "sine" },
    { frequency: 420, endFrequency: 610, delay: .032, duration: .13, gain: .015, type: "triangle" },
    { frequency: 1060, endFrequency: 1320, delay: .085, duration: .1, gain: .007, type: "sine" },
  ],
  leader: [
    { frequency: 62, endFrequency: 34, delay: 0, duration: .13, gain: .062, type: "sine" },
    { frequency: 390, endFrequency: 620, delay: .035, duration: .16, gain: .016, type: "triangle" },
    { frequency: 940, endFrequency: 1480, delay: .1, duration: .12, gain: .008, type: "sine" },
  ],
  leaderDefense: [
    { frequency: 78, endFrequency: 43, delay: 0, duration: .075, gain: .048, type: "sine" },
    { frequency: 72, endFrequency: 39, delay: .085, duration: .08, gain: .043, type: "sine" },
    { frequency: 720, endFrequency: 610, delay: .035, duration: .11, gain: .009, type: "triangle" },
  ],
  recovery: [
    { frequency: 72, endFrequency: 40, delay: 0, duration: .085, gain: .048, type: "sine" },
    { frequency: 300, endFrequency: 480, delay: .038, duration: .12, gain: .012, type: "triangle" },
  ],
  tierUp: [
    { frequency: 70, endFrequency: 38, delay: 0, duration: .1, gain: .055, type: "sine" },
    { frequency: 360, endFrequency: 520, delay: .032, duration: .13, gain: .015, type: "triangle" },
    { frequency: 920, endFrequency: 1120, delay: .08, duration: .09, gain: .007, type: "sine" },
  ],
  tierDown: [
    { frequency: 88, endFrequency: 45, delay: 0, duration: .11, gain: .052, type: "sine" },
    { frequency: 260, endFrequency: 125, delay: .035, duration: .14, gain: .014, type: "triangle" },
  ],
  lowElo: [
    { frequency: 64, endFrequency: 36, delay: 0, duration: .1, gain: .058, type: "sine" },
    { frequency: 58, endFrequency: 32, delay: .085, duration: .11, gain: .05, type: "sine" },
  ],
  shuffle: [
    { frequency: 110, endFrequency: 70, delay: 0, duration: .035, gain: .016, type: "triangle" },
    { frequency: 104, endFrequency: 66, delay: .045, duration: .035, gain: .016, type: "triangle" },
    { frequency: 98, endFrequency: 62, delay: .09, duration: .04, gain: .017, type: "triangle" },
  ],
  error: [
    { frequency: 105, endFrequency: 48, delay: 0, duration: .14, gain: .047, type: "sine" },
    { frequency: 170, endFrequency: 82, delay: .09, duration: .12, gain: .013, type: "triangle" },
  ],
  soundOn: [
    { frequency: 86, endFrequency: 48, delay: 0, duration: .065, gain: .035, type: "sine" },
    { frequency: 520, endFrequency: 640, delay: .025, duration: .07, gain: .008, type: "triangle" },
  ],
  soundOff: [
    { frequency: 82, endFrequency: 42, delay: 0, duration: .065, gain: .032, type: "sine" },
  ],
});

const TEXTURES = Object.freeze({
  enter: { duration: .045, gain: .014, frequency: 1500, type: "bandpass", q: .8 },
  navigation: { duration: .018, gain: .01, frequency: 2100, type: "highpass", q: .7 },
  profile: { duration: .055, gain: .012, frequency: 1250, type: "bandpass", q: .9 },
  dismiss: { duration: .025, gain: .009, frequency: 1450, type: "highpass", q: .7 },
  choose: { duration: .035, gain: .018, frequency: 980, type: "bandpass", q: 1.1 },
  confirm: { duration: .055, gain: .018, frequency: 1320, type: "bandpass", q: 1.2 },
  zebra: { duration: .12, gain: .022, frequency: 1850, type: "bandpass", q: 1.5 },
  overtake: { duration: .07, gain: .017, frequency: 1540, type: "bandpass", q: 1.2 },
  top10: { duration: .095, gain: .018, frequency: 1780, type: "bandpass", q: 1.4 },
  podium: { duration: .12, gain: .021, frequency: 1980, type: "bandpass", q: 1.6 },
  leader: { duration: .15, gain: .023, frequency: 2200, type: "bandpass", q: 1.8 },
  leaderDefense: { duration: .09, gain: .019, frequency: 1160, type: "bandpass", q: 1.2 },
  recovery: { duration: .085, gain: .017, frequency: 1420, type: "bandpass", q: 1.2 },
  tierUp: { duration: .12, gain: .021, frequency: 1900, type: "bandpass", q: 1.6 },
  tierDown: { duration: .085, gain: .018, frequency: 720, type: "lowpass", q: .8 },
  lowElo: { duration: .12, gain: .019, frequency: 520, type: "lowpass", q: .7 },
  shuffle: { duration: .13, gain: .013, frequency: 2600, type: "highpass", q: .8 },
  error: { duration: .09, gain: .015, frequency: 620, type: "lowpass", q: .8 },
  soundOn: { duration: .04, gain: .012, frequency: 1700, type: "bandpass", q: 1 },
  soundOff: { duration: .03, gain: .009, frequency: 900, type: "lowpass", q: .8 },
});

function scheduleTexture(audioContext, destination, start, texture) {
  if (!texture || !audioContext.createBuffer || !audioContext.createBufferSource || !audioContext.createBiquadFilter) return;
  try {
    const sampleRate = audioContext.sampleRate || 44100;
    const frameCount = Math.max(1, Math.floor(sampleRate * texture.duration));
    const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      const decay = (1 - index / frameCount) ** 2.4;
      data[index] = (Math.random() * 2 - 1) * decay;
    }
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const envelope = audioContext.createGain();
    source.buffer = buffer;
    filter.type = texture.type;
    filter.frequency.setValueAtTime(texture.frequency, start);
    filter.Q.setValueAtTime(texture.q, start);
    envelope.gain.setValueAtTime(texture.gain, start);
    envelope.gain.exponentialRampToValueAtTime(.0001, start + texture.duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(destination);
    source.start(start);
    source.stop(start + texture.duration + .01);
  } catch {
    // A textura é um reforço; os tons principais ainda devem tocar em WebViews limitadas.
  }
}

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
      scheduleTexture(audioContext, audioContext.destination, start, TEXTURES[name]);
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
export const soundTextureCueNames = Object.freeze(Object.keys(TEXTURES));
