import {
  DEFAULT_REPOSITORY_MODE,
  normalizeRepositoryMode,
  REPOSITORY_MODES,
} from "./repositoryMode";

const REPOSITORY_MODE_STORAGE_KEY = "ims.repositoryMode";

const SQLITE_MODULE_MODES = new Set(["sqlite", "sqlite_sidecar", "local_sqlite"]);

export const isSqliteRepositoryModuleEnabled = (envKey, fallbackMode = "firebase_primary") => {
  const value = String(import.meta.env?.[envKey] || fallbackMode || "").trim().toLowerCase();
  return SQLITE_MODULE_MODES.has(value);
};

export const getRepositoryModuleMode = (envKey, fallbackMode = "firebase_primary") =>
  String(import.meta.env?.[envKey] || fallbackMode || "").trim().toLowerCase();

export const SQLITE_REPOSITORY_CONFIRMATION = "ENABLE SQLITE LOCAL MODE";
export const FIREBASE_REPOSITORY_CONFIRMATION = "ENABLE FIREBASE MODE";

const safeGetLocalStorage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const readPersistedMode = () => {
  try {
    return safeGetLocalStorage()?.getItem(REPOSITORY_MODE_STORAGE_KEY) || DEFAULT_REPOSITORY_MODE;
  } catch (error) {
    console.warn("Gagal membaca repository mode SQLite:", error);
    return DEFAULT_REPOSITORY_MODE;
  }
};

const persistMode = (mode) => {
  try {
    safeGetLocalStorage()?.setItem(REPOSITORY_MODE_STORAGE_KEY, mode);
  } catch (error) {
    console.warn("Gagal menyimpan repository mode SQLite:", error);
  }
};

export const getRepositoryModeStatus = async () => {
  const mode = normalizeRepositoryMode(readPersistedMode());

  return {
    mode,
    isFirebasePrimary: mode === REPOSITORY_MODES.FIREBASE_PRIMARY,
    isOfflineLocal: mode === REPOSITORY_MODES.SQLITE_SIDECAR,
    isSqliteSidecar: mode === REPOSITORY_MODES.SQLITE_SIDECAR,
    isHybridSync: false,
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
  const expectedConfirmation = nextMode === REPOSITORY_MODES.FIREBASE_PRIMARY
    ? FIREBASE_REPOSITORY_CONFIRMATION
    : SQLITE_REPOSITORY_CONFIRMATION;

  if (confirmation !== expectedConfirmation) {
    throw new Error(`Untuk mengganti repository mode, isi confirmation: ${expectedConfirmation}`);
  }

  persistMode(nextMode);

  return {
    mode: nextMode,
    reason,
    updatedAt: new Date().toISOString(),
  };
};

export const resetRepositoryModeToFirebasePrimary = async ({ confirmation = "" } = {}) =>
  setRepositoryModeForDevelopment(REPOSITORY_MODES.FIREBASE_PRIMARY, {
    confirmation,
    reason: "Fallback manual ke Firebase mode dari SQLite Local DB Center.",
  });

export const resetRepositoryModeToSqliteLocal = async () => {
  persistMode(REPOSITORY_MODES.SQLITE_SIDECAR);

  return {
    mode: REPOSITORY_MODES.SQLITE_SIDECAR,
    updatedAt: new Date().toISOString(),
  };
};
