import {
  DEFAULT_REPOSITORY_MODE,
  REPOSITORY_MODES,
} from "./repositoryMode";

const SQLITE_MODULE_MODES = new Set(["sqlite", "sqlite_sidecar", "local_sqlite"]);

export const isSqliteRepositoryModuleEnabled = (envKey, fallbackMode = "sqlite") => {
  const value = String(import.meta.env?.[envKey] || fallbackMode || "").trim().toLowerCase();
  return SQLITE_MODULE_MODES.has(value);
};

export const getRepositoryModeStatus = async () => ({
  mode: DEFAULT_REPOSITORY_MODE,
  isSqliteSidecar: true,
  repositoryLabel: "SQLite lokal",
  storageEngine: REPOSITORY_MODES.SQLITE_SIDECAR,
});
