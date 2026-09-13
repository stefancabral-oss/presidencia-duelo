import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const sourceUrl = new URL("./frontend-enhancements.js", import.meta.url);

async function source() {
  return readFile(sourceUrl, "utf8");
}

test("legacy navigation and actions are mapped into PoliMatch component families", async () => {
  const src = await source();
  for (const className of [
    "pm-nav-button",
    "pm-topic-chip",
    "pm-segment-button",
    "pm-tile-button",
    "pm-button--primary",
    "pm-button--secondary",
    "pm-button--ghost",
    "pm-button--compact",
    "pm-button--icon",
    "pm-button--danger",
  ]) {
    assert.match(src, new RegExp(className));
  }
});

test("ranking reset is explicitly treated as a destructive action", async () => {
  const src = await source();
  assert.match(src, /reset-ranking/);
  assert.match(src, /pm-button--danger/);
});

test("light theme color is the app-level metadata color", async () => {
  const src = await source();
  assert.match(src, /ensureMeta\("theme-color", "#faf8f3"\)/);
});
