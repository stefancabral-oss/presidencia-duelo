import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const conf = readFileSync(new URL("../nginx.conf", import.meta.url), "utf8");

test("nginx compresses scripts, styles and JSON", () => {
  assert.match(conf, /^\s*gzip\s+on;/m);
  assert.match(conf, /^\s*gzip_vary\s+on;/m);
  for (const type of ["application/javascript", "text/css", "application/json", "image/svg+xml", "application/manifest+json"]) {
    assert.match(conf, new RegExp(`gzip_types[^;]*${type.replace("/", "\\/").replace("+", "\\+")}`), `gzip_types sem ${type}`);
  }
});

test("hashed assets are immutable and the HTML shell is always revalidated", () => {
  assert.match(conf, /location\s+\/assets\/\s*\{[^}]*Cache-Control\s+"public,\s*max-age=31536000,\s*immutable"/);
  assert.match(conf, /location\s*=\s*\/index\.html\s*\{[^}]*Cache-Control\s+"no-cache"/);
});
