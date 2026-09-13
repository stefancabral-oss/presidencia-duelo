export async function commitPersonalReset({ clearedState, resetRemote, applyLocal }) {
  const remote = resetRemote ? await resetRemote(clearedState) : null;
  applyLocal(clearedState, remote);
  return remote;
}
