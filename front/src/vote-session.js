export function captureVoteSession({ generation, pair, mode, topicId, state, winnerEl }) {
  const frozenPair = Object.freeze([...pair]);
  const winnerId = winnerEl.dataset.id;
  const loserId = frozenPair[0] === winnerId ? frozenPair[1] : frozenPair[0];
  return Object.freeze({
    generation,
    pair: frozenPair,
    mode,
    topicId,
    state,
    winnerEl,
    winnerId,
    loserId,
  });
}

export function isCurrentVoteSession(session, current) {
  return session.generation === current.generation
    && session.mode === current.mode
    && session.topicId === current.topicId
    && session.state === current.state
    && session.pair.length === current.pair?.length
    && session.pair.every((id, index) => id === current.pair[index]);
}
