/**
 * The shared vote must succeed before local statistics change. This keeps the
 * personal Elo and aggregate server ranking in the same transaction boundary.
 */
export async function commitOnlineVote(postRemote, applyLocal) {
  const response = await postRemote();
  applyLocal();
  return response;
}
