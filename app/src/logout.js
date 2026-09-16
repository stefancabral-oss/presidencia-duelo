export async function revokeSessionBeforeClearing(accessToken, { endSession, clearLocalSession }) {
  await endSession(accessToken);
  clearLocalSession();
}
