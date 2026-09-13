import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const src = await readFile(new URL("./interaction-sound.js", import.meta.url), "utf8");

test("sound engine exposes all required interaction states", () => {
  for (const state of [
    "tap",
    "select",
    "skip",
    "success",
    "error",
    "combo",
    "chroma",
    "leader-defense",
    "comeback",
    "overtake",
  ]) {
    assert.match(src, new RegExp(`case \\\"${state}\\\"`));
  }
});

test("sound can be disabled and persists preference", () => {
  assert.match(src, /polimatch-sound-enabled-v1/);
  assert.match(src, /aria-pressed/);
  assert.match(src, /setSoundEnabled/);
});

test("sound is progressive enhancement and includes haptic fallback", () => {
  assert.match(src, /AudioContext/);
  assert.match(src, /webkitAudioContext/);
  assert.match(src, /navigator\?\.vibrate/);
});
