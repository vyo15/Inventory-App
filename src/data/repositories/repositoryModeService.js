import {
  getLocalDbMeta,
  setLocalDbMeta,
} from "../local/localDbMeta";
import {
  LOCAL_DB_META_KEYS,
  LOCAL_DB_MODES,
} from "../local/localDbSchema";
import {
  DEFAULT_REPOSITORY_MODE,
  normalizeRepositoryMode,
  REPOSITORY_MODES,
} from "./repositoryMode";

export const OFFLINE_REPOSITORY_PILOT_CONFIRMATION =
  "ENABLE OFFLINE REPOSITORY PILOT";

export const getRepositoryModeStatus = async () => {
  const persistedMode = await getLocalDbMeta(
    LOCAL_DB_META_KEYS.MODE,
    DEFAULT_REPOSITORY_MODE
  );
  const mode = normalizeRepositoryMode(persistedMode);

  return {
    mode,
    isFirebasePrimary: mode === REPOSITORY_MODES.FIREBASE_PRIMARY,
    isOfflineLocal: mode === REPOSITORY_MODES.OFFLINE_LOCAL,
    isHybridSync: mode === REPOSITORY_MODES.HYBRID_SYNC,
    hybridSyncEnabled: false,
  };
};

export const setRepositoryModeForDevelopment = async (
  mode,
  {
    confirmation = "",
    reason = "",
  } = {}
) => {
  const nextMode = normalizeRepositoryMode(mode);

  if (nextMode === LOCAL_DB_MODES.HYBRID_SYNC) {
    throw new Error(
      "Mode hybrid_sync belum diaktifkan. Selesaikan sync queue, manual sync, dan conflict guard terlebih dahulu."
    );
  }

  if (
    nextMode !== LOCAL_DB_MODES.FIREBASE_PRIMARY &&
    confirmation !== OFFLINE_REPOSITORY_PILOT_CONFIRMATION
  ) {
    throw new Error(
      `Untuk mengaktifkan mode repository non-Firebase, isi confirmation: ${OFFLINE_REPOSITORY_PILOT_CONFIRMATION}`
    );
  }

  await setLocalDbMeta(LOCAL_DB_META_KEYS.MODE, nextMode);

  return {
    mode: nextMode,
    reason,
    updatedAt: new Date().toISOString(),
  };
};

export const resetRepositoryModeToFirebasePrimary = async () => {
  await setLocalDbMeta(LOCAL_DB_META_KEYS.MODE, LOCAL_DB_MODES.FIREBASE_PRIMARY);

  return {
    mode: LOCAL_DB_MODES.FIREBASE_PRIMARY,
    updatedAt: new Date().toISOString(),
  };
};
