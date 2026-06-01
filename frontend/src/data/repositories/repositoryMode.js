export const REPOSITORY_MODES = Object.freeze({
  SQLITE_SIDECAR: "sqlite_sidecar",
  FIREBASE_PRIMARY: "firebase_primary",
  // LEGACY-COMPAT:
  // Nilai lama dari Dexie/IndexedDB dipetakan ke SQLite agar UI lama tidak crash,
  // tetapi tidak lagi mengaktifkan Dexie runtime.
  OFFLINE_LOCAL: "offline_local",
  HYBRID_SYNC: "hybrid_sync",
});

export const DEFAULT_REPOSITORY_MODE = REPOSITORY_MODES.SQLITE_SIDECAR;

const LEGACY_MODE_ALIASES = Object.freeze({
  offline_local: REPOSITORY_MODES.SQLITE_SIDECAR,
  hybrid_sync: REPOSITORY_MODES.SQLITE_SIDECAR,
});

export const normalizeRepositoryMode = (mode = DEFAULT_REPOSITORY_MODE) => {
  const normalizedMode = LEGACY_MODE_ALIASES[mode] || mode;
  const supportedModes = [
    REPOSITORY_MODES.SQLITE_SIDECAR,
    REPOSITORY_MODES.FIREBASE_PRIMARY,
  ];
  return supportedModes.includes(normalizedMode) ? normalizedMode : DEFAULT_REPOSITORY_MODE;
};

export const resolveRepositoryMode = ({ mode } = {}) => normalizeRepositoryMode(mode);

export const isSqliteRepositoryMode = (mode) =>
  normalizeRepositoryMode(mode) === REPOSITORY_MODES.SQLITE_SIDECAR;

export const isFirebaseRepositoryMode = (mode) =>
  normalizeRepositoryMode(mode) === REPOSITORY_MODES.FIREBASE_PRIMARY;

export const isOfflineRepositoryMode = isSqliteRepositoryMode;

export const isHybridSyncRepositoryMode = () => false;
