import assert from "node:assert/strict";
import test from "node:test";
import { createSoundController, soundCueNames, soundEnabledFromStorage } from "./sound.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

function fakeAudioContext() {
  const starts = [];
  const parameter = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  return {
    state: "running",
    currentTime: 4,
    destination: {},
    starts,
    createOscillator() {
      return { frequency: parameter, connect() {}, start(at) { starts.push(at); }, stop() {} };
    },
    createGain() {
      return { gain: parameter, connect() {} };
    },
  };
}

test("sound is enabled by default and remembers an explicit mute", () => {
  const storage = memoryStorage();
  assert.equal(soundEnabledFromStorage(storage), true);
  const sound = createSoundController({ storage, windowObject: {} });
  sound.setEnabled(false);
  assert.equal(sound.enabled, false);
  assert.equal(soundEnabledFromStorage(storage), false);
});

test("a mute preference from the previous interface is migrated", () => {
  const storage = memoryStorage({ "polimatch-sound-enabled-v1": "0" });
  assert.equal(soundEnabledFromStorage(storage), false);
  assert.equal(storage.getItem("polimatch:sound"), "off");
});

test("muted sound never creates an audio context", () => {
  let contextCalls = 0;
  const sound = createSoundController({
    storage: memoryStorage({ "polimatch:sound": "off" }),
    windowObject: {},
    contextFactory: () => { contextCalls += 1; return fakeAudioContext(); },
  });
  assert.equal(sound.play("confirm"), false);
  assert.equal(contextCalls, 0);
});

test("every product cue is short, synthesized and playable from one shared context", () => {
  const context = fakeAudioContext();
  let contextCalls = 0;
  const sound = createSoundController({
    storage: memoryStorage(),
    windowObject: {},
    contextFactory: () => { contextCalls += 1; return context; },
  });
  for (const cue of soundCueNames) assert.equal(sound.play(cue), true, cue);
  assert.equal(contextCalls, 1);
  assert.ok(context.starts.length >= soundCueNames.length);
  assert.ok(context.starts.every((start) => start >= 4 && start < 4.2));
});

test("rapid repetitions of the same cue are throttled before scheduling oscillators", () => {
  const context = fakeAudioContext();
  const sound = createSoundController({
    storage: memoryStorage(),
    windowObject: { performance: { now: () => 1000 } },
    contextFactory: () => context,
  });
  assert.equal(sound.play("navigation"), true);
  assert.equal(sound.play("navigation"), false);
  assert.equal(context.starts.length, 1);
});

test("unsupported browsers fail silently without interrupting the interaction", () => {
  const sound = createSoundController({ storage: memoryStorage(), windowObject: {} });
  assert.equal(sound.play("navigation"), false);
  assert.equal(sound.play("unknown"), false);
});
