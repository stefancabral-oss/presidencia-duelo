import assert from "node:assert/strict";
import test from "node:test";
import { resetPendingVoteForIdentityChange, revokeSessionBeforeClearing } from "./logout.js";

test("logout clears the local session only after server revocation succeeds", async () => {
  const calls = [];
  await revokeSessionBeforeClearing("pms_session", {
    endSession: async (token) => calls.push(["revoke", token]),
    clearLocalSession: () => calls.push(["clear"]),
  });
  assert.deepEqual(calls, [["revoke", "pms_session"], ["clear"]]);
});

test("logout keeps the local session when server revocation fails", async () => {
  let cleared = false;
  await assert.rejects(
    revokeSessionBeforeClearing("pms_session", {
      endSession: async () => { throw new Error("offline"); },
      clearLocalSession: () => { cleared = true; },
    }),
    /offline/,
  );
  assert.equal(cleared, false);
});

test("login and logout rotate the round and abandon a pending vote from the previous identity", () => {
  for (const transition of ["login", "logout"]) {
    const state = {
      roundId: `${transition}-old-round`,
      pendingWinnerId: "lula",
      votePhase: "rate-limited",
      voteAction: "retry-vote",
      retryAfterSeconds: 60,
      retryAt: 60000,
      sessionRecoveryMode: "load",
      selectedId: "lula",
      roundOutcome: { winnerId: "lula" },
      busy: true,
      result: "Não foi possível confirmar",
      resultTone: "erro",
      personalFeedbackMessage: "Lula subiu no seu ranking",
      globalFeedbackMessage: "Lula entrou no Top 10 público",
    };

    resetPendingVoteForIdentityChange(state, () => `${transition}-new-round`);

    assert.deepEqual(state, {
      roundId: `${transition}-new-round`,
      pendingWinnerId: "",
      votePhase: "ready",
      voteAction: "",
      retryAfterSeconds: null,
      retryAt: 0,
      sessionRecoveryMode: "",
      selectedId: "",
      roundOutcome: null,
      busy: false,
      result: "",
      resultTone: "",
      personalFeedbackMessage: "",
      globalFeedbackMessage: "",
    });
  }
});
