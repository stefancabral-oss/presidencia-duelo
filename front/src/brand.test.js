import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicFiles = [
  "index.html",
  "src/game.js",
  "src/podium.js",
  "src/tournament.js",
  "../app/index.html",
  "../app/public/manifest.webmanifest",
];

test("public surfaces consistently use the PoliMatch brand", () => {
  for (const relative of publicFiles) {
    const source = readFileSync(join(root, relative), "utf8");
    assert.match(source, /PoliMatch/, relative);
    assert.doesNotMatch(source, /Presidência Duelo/, relative);
  }
});

test("PWA manifest and temporary icon expose the new brand", () => {
  const manifest = JSON.parse(readFileSync(join(root, "../app/public/manifest.webmanifest"), "utf8"));
  assert.equal(manifest.name, "PoliMatch");
  assert.equal(manifest.short_name, "PoliMatch");
  assert.match(readFileSync(join(root, "public/icons/icon.svg"), "utf8"), />PM<\/text>/);
});

test("share texts preserve the entertainment disclaimer", () => {
  const podium = readFileSync(join(root, "src/podium.js"), "utf8");
  const tournament = readFileSync(join(root, "src/tournament.js"), "utf8");
  assert.match(podium, /Não é pesquisa oficial/);
  assert.match(tournament, /Não é pesquisa oficial/);
});
