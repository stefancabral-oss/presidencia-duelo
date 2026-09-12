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
