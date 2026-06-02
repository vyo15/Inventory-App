import * as firebaseSuppliersAdapter from "../adapters/firebase/firebaseSuppliersAdapter";
import * as sqliteSuppliersAdapter from "../adapters/sqlite/sqliteSuppliersAdapter";
import {
  REPOSITORY_MODES,
  resolveRepositoryMode,
} from "./repositoryMode";

// IMS NOTE [AKTIF/GUARDED] - Supplier repository boundary.
// Fungsi: memisahkan UI Supplier dari Firebase direct write saat mode SQLite aktif.
// Hubungan flow: C1 hanya master supplier; purchase/raw/stock/finance tetap guarded dan belum dimutasi SQLite.
// Alasan logic: Supplier backend SQLite sudah tersedia, tetapi katalog material/history masih legacy read-only.
// Behavior: options.mode dari SQLite Local DB Center menjadi penentu utama; env hanya fallback untuk compatibility.
const resolveSupplierRepositoryMode = (options = {}) => {
  if (options.mode) return resolveRepositoryMode(options);

  const envMode = import.meta.env.VITE_SUPPLIERS_REPOSITORY_MODE;
  if (envMode === "firebase") return REPOSITORY_MODES.FIREBASE_PRIMARY;
  if (envMode === "sqlite" || envMode === "sqlite_sidecar") return REPOSITORY_MODES.SQLITE_SIDECAR;

  return resolveRepositoryMode(options);
};

const getSuppliersAdapter = (options = {}) => {
  const mode = resolveSupplierRepositoryMode(options);

  if (mode === REPOSITORY_MODES.FIREBASE_PRIMARY) {
    return firebaseSuppliersAdapter;
  }

  return sqliteSuppliersAdapter;
};

export const listSuppliers = (options = {}) =>
  getSuppliersAdapter(options).listSuppliers(options);

export const getSupplierById = (supplierId, options = {}) =>
  getSuppliersAdapter(options).getSupplierById(supplierId, options);

export const generateSupplierCode = (options = {}) =>
  getSuppliersAdapter(options).generateSupplierCode(options);

export const createSupplier = (values = {}, options = {}) =>
  getSuppliersAdapter(options).createSupplier(values, options);

export const updateSupplier = (supplierId, values = {}, options = {}) =>
  getSuppliersAdapter(options).updateSupplier(supplierId, values, options);

export const deleteSupplier = (supplierId, options = {}) =>
  getSuppliersAdapter(options).deleteSupplier(supplierId, options);
