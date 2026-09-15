import assert from "node:assert/strict";
import test from "node:test";
import { googleClientId, mountGoogleButton } from "./google-login.js";

test("Google login is optional when the public client id is absent", async () => {
  assert.equal(googleClientId({}), "");
  assert.equal(await mountGoogleButton({}, { clientId: "" }), false);
});

test("the official GIS renderer receives a light, compact Portuguese button", async () => {
  const calls = [];
  const element = { replaceChildren() {}, getBoundingClientRect: () => ({ width: 300 }) };
  const windowRef = { google: { accounts: { id: {
    initialize: (options) => calls.push(["initialize", options]),
    renderButton: (_element, options) => calls.push(["render", options]),
  } } } };
  const callback = () => {};
  assert.equal(await mountGoogleButton(element, { clientId: "client-id", callback, windowRef, documentRef: {} }), true);
  assert.equal(calls[0][1].client_id, "client-id");
  assert.equal(calls[0][1].callback, callback);
  assert.deepEqual(calls[1][1], { type: "standard", theme: "outline", size: "large", shape: "pill", text: "continue_with", locale: "pt_BR", width: 300 });
});
