import { getLocalDbTableNames } from "./localDbSchema";

const createDexieRetiredError = () => new Error(
  "Dexie/IndexedDB runtime sudah dinonaktifkan. Gunakan SQLite Local DB Center dan backend Node.js lokal."
);

// LEGACY-COMPAT / CLEANUP CANDIDATE:
// File ini sengaja dipertahankan sebagai guard agar import lama gagal dengan pesan jelas,
// bukan gagal build karena dependency dexie sudah dihapus dari package root.
export const createImsLocalDb = () => {
  throw createDexieRetiredError();
};

export const getImsLocalDb = () => {
  throw createDexieRetiredError();
};

export const closeImsLocalDb = () => undefined;

export const getImsLocalDbTableNames = () => getLocalDbTableNames();
