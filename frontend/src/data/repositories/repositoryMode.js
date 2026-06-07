export const REPOSITORY_MODES = Object.freeze({
  SQLITE_SIDECAR: "sqlite_sidecar",
  OFFLINE_LOCAL: "offline_local",
  HYBRID_SYNC: "hybrid_sync",
});

export const DEFAULT_REPOSITORY_MODE = REPOSITORY_MODES.SQLITE_SIDECAR;

export const normalizeRepositoryMode = (mode = DEFAULT_REPOSITORY_MODE) => {
  const supportedModes = [REPOSITORY_MODES.SQLITE_SIDECAR];
  return supportedModes.includes(mode) ? mode : DEFAULT_REPOSITORY_MODE;
};

export const resolveRepositoryMode = ({ mode } = {}) => normalizeRepositoryMode(mode);

export const isSqliteRepositoryMode = (mode) =>
  normalizeRepositoryMode(mode) === REPOSITORY_MODES.SQLITE_SIDECAR;

export const isOfflineRepositoryMode = isSqliteRepositoryMode;

export const isHybridSyncRepositoryMode = () => false;
