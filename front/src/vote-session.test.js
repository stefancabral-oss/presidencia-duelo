import assert from "node:assert/strict";
import { test } from "node:test";
import { commitOnlineVote } from "./online-vote.js";
import { captureVoteSession, isCurrentVoteSession } from "./vote-session.js";

function context(overrides = {}) {
  const state = overrides.state || {};
  return {
    generation: 4,
    pair: ["a", "b"],
    mode: "presidentes",
    topicId: "politica-em-jogo",
    state,
    ...overrides,
  };
}

test("vote session snapshots pair, winner, mode, topic, state, and generation", () => {
  const pair = ["a", "b"];
  const state = {};
  const session = captureVoteSession({ ...context({ pair, state }), winnerEl: { dataset: { id: "b" } } });
  pair[0] = "c";

  assert.deepEqual(session.pair, ["a", "b"]);
  assert.equal(session.winnerId, "b");
  assert.equal(session.loserId, "a");
  assert.equal(session.state, state);
  assert.ok(Object.isFrozen(session));
  assert.ok(Object.isFrozen(session.pair));
});

test("reset generation invalidates an older vote session", () => {
  const current = context();
  const session = captureVoteSession({ ...current, winnerEl: { dataset: { id: "a" } } });
  assert.equal(isCurrentVoteSession(session, current), true);
  assert.equal(isCurrentVoteSession(session, { ...current, generation: 5 }), false);
});

test("topic, mode, state, or pair changes invalidate an older vote session", () => {
  const current = context();
  const session = captureVoteSession({ ...current, winnerEl: { dataset: { id: "a" } } });

  assert.equal(isCurrentVoteSession(session, { ...current, topicId: "direita-esquerda" }), false);
  assert.equal(isCurrentVoteSession(session, { ...current, mode: "vices" }), false);
  assert.equal(isCurrentVoteSession(session, { ...current, state: {} }), false);
  assert.equal(isCurrentVoteSession(session, { ...current, pair: ["b", "a"] }), false);
});

test("controlled late responses stay out after reset, topic change, or a new pair", async () => {
  const replacements = [
    (current) => ({ ...current, generation: current.generation + 1, state: {} }),
    (current) => ({ ...current, generation: current.generation + 1, topicId: "direita-esquerda" }),
    (current) => ({ ...current, generation: current.generation + 1, pair: ["c", "d"] }),
  ];

  for (const replaceCurrent of replacements) {
    let resolveRemote;
    let current = context();
    let applied = 0;
    const session = captureVoteSession({ ...current, winnerEl: { dataset: { id: "a" } } });
    const pending = commitOnlineVote(
      () => new Promise((resolve) => { resolveRemote = resolve; }),
      () => { applied += 1; },
      () => isCurrentVoteSession(session, current),
    );

    current = replaceCurrent(current);
    resolveRemote({ vote: { id: "still-queryable" } });
    const result = await pending;
    assert.equal(applied, 0);
    assert.equal(result.applied, false);
    assert.equal(result.response.vote.id, "still-queryable");
  }
});
