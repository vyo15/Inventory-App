import { LOCAL_DB_MODES } from "../local/localDbSchema";

export const REPOSITORY_MODES = LOCAL_DB_MODES;
export const DEFAULT_REPOSITORY_MODE = REPOSITORY_MODES.FIREBASE_PRIMARY;

export const normalizeRepositoryMode = (mode = DEFAULT_REPOSITORY_MODE) => {
  const supportedModes = Object.values(REPOSITORY_MODES);
  return supportedModes.includes(mode) ? mode : DEFAULT_REPOSITORY_MODE;
};

export const resolveRepositoryMode = ({ mode } = {}) => normalizeRepositoryMode(mode);

export const isOfflineRepositoryMode = (mode) =>
  normalizeRepositoryMode(mode) === REPOSITORY_MODES.OFFLINE_LOCAL;

export const isHybridSyncRepositoryMode = (mode) =>
  normalizeRepositoryMode(mode) === REPOSITORY_MODES.HYBRID_SYNC;
