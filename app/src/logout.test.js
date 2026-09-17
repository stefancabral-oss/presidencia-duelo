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
      predictionId: `${transition}-old-prediction`,
      predictionBusy: true,
      predictionError: "old prediction error",
      pendingPredictionAction: { candidateId: "lula" },
      predictionResults: { sessions: [{ edition: { id: `${transition}-old-edition` } }] },
      predictionResultsLoading: true,
      predictionResultsError: "old results error",
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
      pendingDiscard: { roundId: "old-round" },
      discardBusy: true,
      discardError: "old discard error",
      collection: [{ id: "old-finish" }],
      collectionLoading: true,
      collectionError: "old collection error",
      pairLoading: true,
      pairError: "old pair error",
      pairRemaining: 2,
      warmupSkipped: true,
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
      predictionId: "",
      predictionBusy: false,
      predictionError: "",
      pendingPredictionAction: null,
      predictionResults: null,
      predictionResultsLoading: false,
      predictionResultsError: "",
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
      pendingDiscard: null,
      discardBusy: false,
      discardError: "",
      collection: [],
      collectionLoading: false,
      collectionError: "",
      pairLoading: false,
      pairError: "",
      pairRemaining: 0,
      warmupSkipped: false,
    });
  }
});

test("login or logout during a result load releases the new identity to open its own scoreboard", () => {
  for (const transition of ["login", "logout"]) {
    const state = {
      identityEpoch: 2,
      dailyLoadEpoch: 3,
      recoveryKey: "pm2_previous",
      predictionId: "650e8400-e29b-41d4-a716-446655440000",
      predictionBusy: true,
      predictionError: "pending",
      pendingPredictionAction: { candidateId: "candidate-1" },
      predictionResults: { sessions: [] },
      predictionResultsLoading: true,
      predictionResultsError: "pending",
    };
    const staleLoad = { epoch: state.identityEpoch, recoveryKey: state.recoveryKey };
    resetPendingVoteForIdentityChange(state, () => `${transition}-round`);
    state.recoveryKey = `pm2_${transition}`;

    assert.equal(isCurrentVoteIdentity(state, staleLoad), false);
    assert.equal(state.predictionResultsLoading, false);
    assert.equal(state.predictionResults, null);
    assert.equal(state.pendingPredictionAction, null);
    assert.equal(state.predictionBusy, false);

    // É o mesmo gate usado por openDailyPredictionResults: a identidade nova
    // não fica presa pelo carregamento que pertencia à credencial anterior.
    if (!state.predictionResultsLoading) state.predictionResultsLoading = true;
    assert.equal(state.predictionResultsLoading, true);
  }
});

test("an async vote belongs to both the identity epoch and credential that sent it", () => {
  const attempt = { epoch: 4, recoveryKey: "pm2_old" };
  assert.equal(isCurrentVoteIdentity({ identityEpoch: 4, recoveryKey: "pm2_old" }, attempt), true);
  assert.equal(isCurrentVoteIdentity({ identityEpoch: 5, recoveryKey: "pm2_old" }, attempt), false);
  assert.equal(isCurrentVoteIdentity({ identityEpoch: 4, recoveryKey: "pm2_new" }, attempt), false);
});
