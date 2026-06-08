export const REPOSITORY_MODES = Object.freeze({
  SQLITE_SIDECAR: "sqlite_sidecar",
});

export const DEFAULT_REPOSITORY_MODE = REPOSITORY_MODES.SQLITE_SIDECAR;

export const normalizeRepositoryMode = () => DEFAULT_REPOSITORY_MODE;

export const resolveRepositoryMode = () => DEFAULT_REPOSITORY_MODE;

export const isSqliteRepositoryMode = () => true;
