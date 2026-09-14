import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("PWA image includes the shared catalog required by the portrait validator", () => {
  const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  assert.match(dockerfile, /^COPY shared shared$/m);
  assert.ok(dockerfile.indexOf("COPY shared shared") < dockerfile.indexOf("RUN npm run build --prefix app"));
});
