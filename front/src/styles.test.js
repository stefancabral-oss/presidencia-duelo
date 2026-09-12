import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "styles.css"), "utf8");

function cssWithoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

function mediaBlocks(source, query) {
  const blocks = [];
  const needle = `@media ${query}`;
  let from = 0;
  while (from < source.length) {
    const start = source.indexOf(needle, from);
    if (start < 0) break;
    const open = source.indexOf("{", start);
    if (open < 0) break;
    let depth = 0;
    let i = open;
    for (; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          blocks.push(source.slice(open + 1, i));
          from = i + 1;
          break;
        }
      }
    }
    if (depth !== 0) break;
  }
  return blocks;
}

const clean = cssWithoutComments(css);
const hoverMedia = mediaBlocks(clean, "(hover: hover)");
const hoverMediaCss = hoverMedia.join("\n");
const outsideHoverMedia = hoverMedia.reduce(
  (acc, block) => acc.replace(block, ""),
  clean,
);

test("poke-card hover lift is gated by @media (hover: hover)", () => {
  assert.ok(hoverMedia.length >= 1, "expected @media (hover: hover) { ... }");
  assert.match(hoverMediaCss, /\.poke-card:hover\s*\{/);
  assert.match(hoverMediaCss, /translateY\(-4px\)/);
  assert.doesNotMatch(outsideHoverMedia, /\.poke-card:hover\s*\{/);
});

test("poke-card :focus-visible lift stays outside the hover media query", () => {
  assert.match(outsideHoverMedia, /\.poke-card:focus-visible\s*\{/);
  assert.match(outsideHoverMedia, /\.poke-card:focus-visible\s*\{[^}]*translateY\(-4px\)/);
  assert.doesNotMatch(hoverMediaCss, /\.poke-card:focus-visible/);
});

test("poke-card no longer shares one hover+focus-visible rule", () => {
  assert.doesNotMatch(clean, /\.poke-card:hover\s*,\s*\.poke-card:focus-visible/);
  assert.doesNotMatch(clean, /\.poke-card:focus-visible\s*,\s*\.poke-card:hover/);
});

test("picked-win flashes and picked-lose shakes", () => {
  assert.match(clean, /\.poke-card\.picked-win\s*\{[^}]*animation:\s*pick-flash/);
  assert.match(clean, /\.poke-card\.picked-lose\s*\{[^}]*animation:\s*pick-shake/);
  assert.match(clean, /@keyframes pick-flash/);
  assert.match(clean, /@keyframes pick-shake/);
});

test("elo-float uses win green and lose red", () => {
  assert.match(clean, /\.elo-float\.win\s*\{\s*color:\s*var\(--win\)/);
  assert.match(clean, /\.elo-float\.lose\s*\{\s*color:\s*var\(--danger\)/);
  assert.match(clean, /@keyframes elo-float-pop/);
});

test("loser dimming does not gray out the floating Elo delta", () => {
  assert.match(clean, /\.poke-card\.picked-lose\s*>\s*:not\(\.elo-float\)\s*\{/);
  assert.doesNotMatch(clean, /\.poke-card\.picked-lose\s*\{[^}]*\bopacity:/);
  assert.doesNotMatch(clean, /\.poke-card\.picked-lose\s*\{[^}]*\bfilter:/);
});

test("prefers-reduced-motion disables pick shake, flash, and float", () => {
  const reduced = mediaBlocks(clean, "(prefers-reduced-motion: reduce)").join("\n");
  assert.ok(reduced.length > 0, "expected @media (prefers-reduced-motion: reduce)");
  assert.match(reduced, /\.poke-card\.picked-win/);
  assert.match(reduced, /\.poke-card\.picked-lose/);
  assert.match(reduced, /\.elo-float/);
  assert.match(reduced, /animation:\s*none/);
});

test("Desfazer button uses the shared btn style and a disabled mute", () => {
  assert.match(clean, /\.duel-actions\s*\{/);
  assert.match(clean, /\.btn:disabled/);
  assert.match(clean, /\.btn:disabled:hover/);
  assert.match(clean, /cursor:\s*not-allowed/);
});

test("podium overlay uses the dark gold card theme and can hide", () => {
  assert.match(clean, /\.podium-overlay\[hidden\]\s*\{[^}]*display:\s*none/);
  assert.match(clean, /\.podium-dialog\s*\{/);
  assert.match(clean, /\.podium-stand\s*\{/);
  assert.match(clean, /\.podium-place-1\s*\{/);
  assert.match(clean, /\.ranking-actions\s*\{/);
});

test("duel progress bar and goal modal match the existing card theme", () => {
  assert.match(clean, /\.duel-progress-bar\s*\{/);
  assert.match(clean, /\.duel-progress-fill\s*\{/);
  assert.match(clean, /\.goal-modal\s*\{/);
  assert.match(clean, /\.goal-modal\[hidden\]\s*\{[^}]*display:\s*none/);
  assert.match(clean, /\.btn\.primary\s*\{/);
  const reduced = mediaBlocks(clean, "(prefers-reduced-motion: reduce)").join("\n");
  assert.match(reduced, /\.duel-progress-fill/);
  assert.match(reduced, /transition:\s*none/);
});

test("combo banner and achievement toast match the gold card theme", () => {
  assert.match(clean, /\.combo-banner\[hidden\]\s*\{[^}]*display:\s*none/);
  assert.match(clean, /\.combo-label\.combo-pop\s*\{[^}]*animation:\s*combo-pop/);
  assert.match(clean, /@keyframes combo-pop/);
  assert.match(clean, /\.achievement-toast\s*\{[^}]*animation:\s*achievement-toast-in/);
  assert.match(clean, /@keyframes achievement-toast-in/);
  assert.match(clean, /\.achievement-chip\.unlocked\s*\{/);
  const reduced = mediaBlocks(clean, "(prefers-reduced-motion: reduce)").join("\n");
  assert.match(reduced, /\.combo-label\.combo-pop/);
  assert.match(reduced, /\.achievement-toast/);
  assert.match(reduced, /animation:\s*none/);
});

test("zebra badge stamps on the winner card and respects reduced motion", () => {
  assert.match(clean, /\.zebra-badge\s*\{[^}]*animation:\s*zebra-stamp/);
  assert.match(clean, /@keyframes zebra-stamp/);
  const reduced = mediaBlocks(clean, "(prefers-reduced-motion: reduce)").join("\n");
  assert.match(reduced, /\.zebra-badge/);
  assert.match(reduced, /animation:\s*none/);
});
