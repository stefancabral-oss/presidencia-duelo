export const RECOVERY_KEY_STORAGE = "polimatch-recovery-key-v1";
const RANKING_FIELDS = ["ratings", "wins", "losses", "zebras"];

export function loadRecoveryKey(storage = globalThis.localStorage) {
  try {
    return storage.getItem(RECOVERY_KEY_STORAGE) || "";
  } catch {
    return "";
  }
}

export function saveRecoveryKey(recoveryKey, storage = globalThis.localStorage) {
  try {
    storage.setItem(RECOVERY_KEY_STORAGE, recoveryKey);
    return true;
  } catch {
    return false;
  }
}

export function rankingStateForServer(state) {
  return {
    ratings: { ...state.ratings },
    wins: { ...state.wins },
    losses: { ...state.losses },
    zebras: { ...(state.zebras || {}) },
    duels: Number(state.duels) || 0,
  };
}

export function applyServerPlayerState(localState, serverState) {
  for (const field of RANKING_FIELDS) localState[field] = { ...(serverState[field] || {}) };
  localState.duels = Number(serverState.duels) || 0;
  localState.lastDuel = null;
  return localState;
}

export async function initializePlayerSync({
  states,
  recoveryKey,
  createRemotePlayer,
  fetchRemoteState,
  replaceRemoteState,
  onRecoveryKey,
  recoverInvalidStoredKey = false,
}) {
  let key = recoveryKey;
  let created = false;

  async function createPlayerKey() {
    ({ recoveryKey: key } = await createRemotePlayer());
    created = true;
    onRecoveryKey?.(key);
  }

  async function synchronize() {
    const versions = {};
    for (const mode of Object.keys(states)) {
      let remote = await fetchRemoteState(key, mode);
      if (remote.version === 0 && remote.state.duels === 0 && states[mode].duels > 0) {
        remote = await replaceRemoteState(
          key,
          mode,
          remote.version,
          rankingStateForServer(states[mode]),
        );
      }
      applyServerPlayerState(states[mode], remote.state);
      versions[mode] = remote.version;
    }
    return versions;
  }

  if (!key) await createPlayerKey();

  let versions;
  try {
    versions = await synchronize();
  } catch (error) {
    const staleStoredKey = recoverInvalidStoredKey && Boolean(recoveryKey) && error?.status === 401;
    if (!staleStoredKey) throw error;
    await createPlayerKey();
    versions = await synchronize();
  }

  return { recoveryKey: key, versions, created };
}
