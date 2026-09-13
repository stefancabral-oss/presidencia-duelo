import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const cssUrl = new URL("./design-system.css", import.meta.url);
const playgroundUrl = new URL("./design-system-playground.js", import.meta.url);

async function css() {
  return readFile(cssUrl, "utf8");
}

async function playground() {
  return readFile(playgroundUrl, "utf8");
}

test("design system exposes the approved light, malachite, gold and chroma tokens", async () => {
  const source = await css();
  for (const token of [
    "--pm-bg: #faf8f3",
    "--pm-porcelain: #f7f3e8",
    "--pm-malachite-900: #073326",
    "--pm-gold-500: #d4af37",
    "--pm-chroma-cyan: #00c9d8",
    "--pm-chroma-violet: #8b5cf6",
    "--pm-chroma-magenta: #e657a6",
  ]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
});

test("button families and accessible focus states are part of the contract", async () => {
  const source = await css();
  for (const selector of [
    ".pm-button--primary",
    ".pm-button--secondary",
    ".pm-button--ghost",
    ".pm-button--icon",
    ".pm-button--danger",
    ".pm-topic-chip",
    ".pm-segment-button",
    ".pm-nav-button",
    ".pm-tile-button",
  ]) assert.match(source, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /:focus-visible/);
  assert.match(source, /prefers-reduced-motion/);
});

test("card anatomy keeps TCG ratio and distinct Chroma tiers", async () => {
  const source = await css();
  assert.match(source, /aspect-ratio:\s*5\s*\/\s*7/);
  assert.match(source, /\.pm-card__media/);
  assert.match(source, /\.pm-card__description/);
  assert.match(source, /data-rarity="chroma-suprema"/);
  assert.match(source, /data-rarity="chroma-comemorativa"/);
});

test("playground shows regular, Chroma, Suprema and Comemorativa before duel integration", async () => {
  const source = await playground();
  for (const rarity of ["basica", "chroma-ilustrada", "chroma-suprema", "chroma-comemorativa"]) {
    assert.match(source, new RegExp(`rarity: "${rarity}"`));
  }
  assert.match(source, /pg-duel-preview/);
});
