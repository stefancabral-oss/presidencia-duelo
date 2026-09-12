import assert from "node:assert/strict";
import { test } from "node:test";
import { canRegisterServiceWorker, registerServiceWorker } from "./register-sw.js";

test("service worker is supported only over http(s)", () => {
  const navigator = { serviceWorker: {} };
  assert.equal(canRegisterServiceWorker({ location: { protocol: "https:" }, navigator }), true);
  assert.equal(canRegisterServiceWorker({ location: { protocol: "http:" }, navigator }), true);
  assert.equal(canRegisterServiceWorker({ location: { protocol: "file:" }, navigator }), false);
  assert.equal(canRegisterServiceWorker({ location: { protocol: "https:" }, navigator: {} }), false);
});

test("registration waits for load and uses the supplied scoped URL", async () => {
  let onLoad;
  let registeredUrl;
  const win = {
    location: { protocol: "https:" },
    addEventListener(name, callback) {
      assert.equal(name, "load");
      onLoad = callback;
    },
  };
  const navigator = {
    serviceWorker: {
      async register(url) {
        registeredUrl = url;
      },
    },
  };
  assert.equal(registerServiceWorker({
    window: win,
    navigator,
    scriptUrl: new URL("https://example.test/presidencia-duelo/sw.js"),
  }), true);
  await onLoad();
  assert.equal(registeredUrl, "https://example.test/presidencia-duelo/sw.js");
});

test("file protocol does not attach a load listener", () => {
  let attached = false;
  const win = {
    location: { protocol: "file:" },
    addEventListener() { attached = true; },
  };
  const navigator = { serviceWorker: { register() {} } };
  assert.equal(registerServiceWorker({ window: win, navigator }), false);
  assert.equal(attached, false);
});
