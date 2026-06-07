export const REPOSITORY_MODES = Object.freeze({
  SQLITE_SIDECAR: "sqlite_sidecar",
  FIREBASE_PRIMARY: "firebase_primary",
  // LEGACY-COMPAT:
  // Nilai lama Firebase/Dexie/IndexedDB tetap dikenali hanya sebagai alias ke SQLite.
  // Alias ini tidak boleh menghidupkan runtime lama.
  OFFLINE_LOCAL: "offline_local",
  HYBRID_SYNC: "hybrid_sync",
});

export const DEFAULT_REPOSITORY_MODE = REPOSITORY_MODES.SQLITE_SIDECAR;

const LEGACY_MODE_ALIASES = Object.freeze({
  firebase_primary: REPOSITORY_MODES.SQLITE_SIDECAR,
  offline_local: REPOSITORY_MODES.SQLITE_SIDECAR,
  hybrid_sync: REPOSITORY_MODES.SQLITE_SIDECAR,
});

export const normalizeRepositoryMode = (mode = DEFAULT_REPOSITORY_MODE) => {
  const normalizedMode = LEGACY_MODE_ALIASES[mode] || mode;
  const supportedModes = [REPOSITORY_MODES.SQLITE_SIDECAR];
  return supportedModes.includes(normalizedMode) ? normalizedMode : DEFAULT_REPOSITORY_MODE;
};

export const resolveRepositoryMode = ({ mode } = {}) => normalizeRepositoryMode(mode);

export const isSqliteRepositoryMode = (mode) =>
  normalizeRepositoryMode(mode) === REPOSITORY_MODES.SQLITE_SIDECAR;

export const isFirebaseRepositoryMode = () => false;

export const isOfflineRepositoryMode = isSqliteRepositoryMode;

export const isHybridSyncRepositoryMode = () => false;
