import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const cssUrl = new URL("./design-system.css", import.meta.url);
const statesUrl = new URL("./design-system-states.css", import.meta.url);
const playgroundUrl = new URL("./design-system-playground.js", import.meta.url);

const read = (url) => readFile(url, "utf8");

test("design system exposes the approved light, malachite, gold and chroma tokens", async () => {
  const source = await read(cssUrl);
  for (const token of [
    "--pm-bg: #faf8f3",
    "--pm-porcelain: #f7f3e8",
    "--pm-malachite-900: #073326",
    "--pm-gold-500: #d4af37",
    "--pm-chroma-cyan: #00c9d8",
    "--pm-chroma-violet: #8b5cf6",
    "--pm-chroma-magenta: #e657a6",
  ]) assert.equal(source.includes(token), true, `${token} ausente`);
});

test("button families and accessible focus states are part of the contract", async () => {
  const source = await read(cssUrl);
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
  ]) assert.equal(source.includes(selector), true, `${selector} ausente`);
  assert.equal(source.includes(":focus-visible"), true);
  assert.equal(source.includes("prefers-reduced-motion"), true);
});

test("card anatomy keeps TCG ratio and distinct Chroma tiers", async () => {
  const source = await read(cssUrl);
  const states = await read(statesUrl);
  assert.match(source, /aspect-ratio:\s*5\s*\/\s*7/);
  assert.equal(source.includes(".pm-card__media"), true);
  assert.equal(source.includes(".pm-card__description"), true);
  assert.equal(states.includes('data-rarity="chroma-suprema"'), true);
  assert.equal(states.includes('data-rarity="chroma-comemorativa"'), true);
  assert.equal(states.includes("prefers-reduced-motion"), true);
});

test("playground shows regular, Chroma, Suprema and Comemorativa before duel integration", async () => {
  const source = await read(playgroundUrl);
  for (const rarity of ["basica", "chroma-ilustrada", "chroma-suprema", "chroma-comemorativa"]) {
    assert.equal(source.includes(`rarity: "${rarity}"`), true, `${rarity} ausente`);
  }
  assert.equal(source.includes("pg-duel-preview"), true);
});
