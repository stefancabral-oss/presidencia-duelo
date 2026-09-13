/**
 * The shared vote must succeed before local statistics change. This keeps the
 * personal Elo and aggregate server ranking in the same transaction boundary.
 * A generation guard prevents an old response from mutating a newer session.
 */
export async function commitOnlineVote(postRemote, applyLocal, isCurrent = () => true) {
  const response = await postRemote();
  if (!isCurrent()) return { response, applied: false };
  applyLocal(response);
  return { response, applied: true };
}
