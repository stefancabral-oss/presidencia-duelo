import assert from "node:assert/strict";
import test from "node:test";
import { createGoogleIdentityVerifier } from "./google-auth.js";

test("Google login remains optional when the client id is absent", async () => {
  const verifier = createGoogleIdentityVerifier({ clientId: "" });
  assert.equal(verifier.configured, false);
  await assert.rejects(verifier.verify("credential"), (error) => error.code === "GOOGLE_LOGIN_NOT_CONFIGURED" && error.status === 503);
});

test("Google identity is derived from a verified token and stable subject", async () => {
  const calls = [];
  const verifier = createGoogleIdentityVerifier({
    clientId: "web-client.apps.googleusercontent.com",
    client: {
      async verifyIdToken(options) {
        calls.push(options);
        return { getPayload: () => ({ sub: "google-sub-123", email: "jogador@example.com", email_verified: true, given_name: "Bia", picture: "https://example.com/avatar.jpg" }) };
      },
    },
  });
  const identity = await verifier.verify("signed-id-token");
  assert.deepEqual(calls, [{ idToken: "signed-id-token", audience: "web-client.apps.googleusercontent.com" }]);
  assert.deepEqual(identity, { subject: "google-sub-123", displayName: "Bia", avatarUrl: "https://example.com/avatar.jpg" });
});

test("email is never promoted to an account key or collected", async () => {
  const verifier = createGoogleIdentityVerifier({
    clientId: "client-id",
    client: { async verifyIdToken() { return { getPayload: () => ({ sub: "stable-sub", email: "unverified@example.com", email_verified: false }) }; } },
  });
  assert.equal(Object.hasOwn(await verifier.verify("token"), "email"), false);
  await assert.rejects(verifier.verify(""), (error) => error.code === "INVALID_GOOGLE_CREDENTIAL");
});
