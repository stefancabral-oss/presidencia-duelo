import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("PWA image includes the shared catalog required by the portrait validator", () => {
  const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  assert.match(dockerfile, /^COPY shared shared$/m);
  assert.ok(dockerfile.indexOf("COPY shared shared") < dockerfile.indexOf("RUN npm run build --prefix app"));
});

test("PWA image receives the public Google web client id only at build time", () => {
  const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  assert.match(dockerfile, /^ARG VITE_GOOGLE_CLIENT_ID$/m);
  assert.match(dockerfile, /^ENV VITE_GOOGLE_CLIENT_ID=\$\{VITE_GOOGLE_CLIENT_ID\}$/m);
});
