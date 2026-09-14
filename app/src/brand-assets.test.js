import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const publicFile = (path) => new URL(`../public/${path}`, import.meta.url);

test("production logo is outlined, self-contained and free of embedded generation metadata", () => {
  const logo = readFileSync(publicFile("brand/logo-horizontal-outline.svg"), "utf8");
  assert.match(logo, /<svg/);
  assert.doesNotMatch(logo, /<text|@font-face|fonts\.googleapis|<metadata/);
  assert.match(logo, /#D6B566/i);
});

test("PWA manifest exposes the official vector and raster app icons", () => {
  const manifest = JSON.parse(readFileSync(publicFile("manifest.webmanifest"), "utf8"));
  assert.deepEqual(manifest.icons.map(({ src, sizes }) => [src, sizes]), [
    ["./icon.svg", "any"],
    ["./icons/icon-192.png", "192x192"],
    ["./icons/icon-512.png", "512x512"],
  ]);
});

