import assert from "node:assert/strict";
import test from "node:test";
import { VOTE_ACTIONS, VOTE_PHASES, formatRetryAfter, voteFailureState, voteRecoveryControl } from "./vote-flow.js";

test("401, 429 and 5xx expose distinct recovery states without internal text", () => {
  const session = voteFailureState({ status: 401, message: "token interno" });
  assert.deepEqual(
    { phase: session.phase, action: session.action, message: session.message },
    { phase: VOTE_PHASES.SESSION_REQUIRED, action: VOTE_ACTIONS.RESTORE_SESSION, message: "Sua sessão precisa ser restabelecida." },
  );

  const limited = voteFailureState({ status: 429, retryAfterSeconds: 61 }, 1_000);
  assert.equal(limited.phase, VOTE_PHASES.RATE_LIMITED);
  assert.equal(limited.retryAt, 62_000);
  assert.match(limited.message, /2 minutos/);

  const server = voteFailureState({ status: 503, message: "postgres senha=segredo" });
  assert.equal(server.phase, VOTE_PHASES.SERVER_ERROR);
  assert.equal(server.message, "Não foi possível confirmar agora.");
  assert.doesNotMatch(server.message, /postgres|segredo/);
});

test("network uncertainty is explicit and version conflict remains retryable", () => {
  assert.equal(voteFailureState({ status: 0, unreachable: true }).phase, VOTE_PHASES.UNCERTAIN);
  assert.equal(voteFailureState({ status: 409, code: "PLAYER_VERSION_CONFLICT" }).phase, VOTE_PHASES.CONFLICT);
});

test("recovery control keeps rate-limited retries disabled until the deadline", () => {
  const state = { pendingWinnerId: "lula", voteAction: VOTE_ACTIONS.RETRY, retryAt: 61_000 };
  assert.deepEqual(voteRecoveryControl(state, 1_000), {
    visible: true,
    disabled: true,
    id: "retry-vote",
    label: "Tentar novamente em 1 minuto",
  });
  assert.equal(voteRecoveryControl(state, 61_000).disabled, false);
  assert.equal(formatRetryAfter(3601), "2 horas");
});
