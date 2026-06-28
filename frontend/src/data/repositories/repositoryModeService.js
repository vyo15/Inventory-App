import {
  DEFAULT_REPOSITORY_MODE,
  REPOSITORY_MODES,
} from "./repositoryMode";

// Runtime final IMS hanya memakai SQLite lokal. Parameter dipertahankan untuk
// kompatibilitas pemanggil lama, tetapi environment lama tidak boleh lagi
// menonaktifkan modul atau membuat sumber data ganda.
export const isSqliteRepositoryModuleEnabled = () => true;

export const getRepositoryModeStatus = async () => ({
  mode: DEFAULT_REPOSITORY_MODE,
  isSqliteSidecar: true,
  repositoryLabel: "SQLite lokal",
  storageEngine: REPOSITORY_MODES.SQLITE_SIDECAR,
});
