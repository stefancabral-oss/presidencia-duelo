import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./main.js", import.meta.url), "utf8");
const nginx = readFileSync(new URL("../nginx.conf", import.meta.url), "utf8");

test("public PWA requires API and turns bootstrap crashes into a retry gate", () => {
  assert.match(source, /initGame\(\{ requireApi: true \}\)/);
  assert.match(source, /\.catch\(\(error\) => \{/);
  assert.match(source, /renderConnectionRequired\(document\.getElementById\("app"\)\)/);
});

test("PWA manifest is served with its standard MIME type", () => {
  assert.match(nginx, /location = \/manifest\.webmanifest \{[\s\S]*default_type application\/manifest\+json;/);
});
