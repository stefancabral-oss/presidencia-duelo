import assert from "node:assert/strict";
import test from "node:test";
import { isCurrentVoteIdentity, resetPendingVoteForIdentityChange, revokeSessionBeforeClearing } from "./logout.js";

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
      identityEpoch: 7,
      dailyLoadEpoch: 11,
      roundId: `${transition}-old-round`,
      dailySession: { edition: { id: `${transition}-old-edition` } },
      dailyCandidates: [{ id: "old-candidate" }],
      dailyLoading: true,
      dailyLoadError: "old error",
      pendingDailySession: { edition: { id: `${transition}-old-edition` } },
      pendingDailyRefresh: true,
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
      identityEpoch: 8,
      dailyLoadEpoch: 12,
      roundId: `${transition}-new-round`,
      dailySession: null,
      dailyCandidates: [],
      dailyLoading: false,
      dailyLoadError: "",
      pendingDailySession: null,
      pendingDailyRefresh: false,
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

test("an async vote belongs to both the identity epoch and credential that sent it", () => {
  const attempt = { epoch: 4, recoveryKey: "pm2_old" };
  assert.equal(isCurrentVoteIdentity({ identityEpoch: 4, recoveryKey: "pm2_old" }, attempt), true);
  assert.equal(isCurrentVoteIdentity({ identityEpoch: 5, recoveryKey: "pm2_old" }, attempt), false);
  assert.equal(isCurrentVoteIdentity({ identityEpoch: 4, recoveryKey: "pm2_new" }, attempt), false);
});
