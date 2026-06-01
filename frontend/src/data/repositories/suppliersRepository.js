import * as firebaseSuppliersAdapter from "../adapters/firebase/firebaseSuppliersAdapter";
import * as sqliteSuppliersAdapter from "../adapters/sqlite/sqliteSuppliersAdapter";

// GUARDED:
// Supplier masih terkait purchase/raw material/history. Default tetap Firebase agar flow produksi/transaksi tidak berubah.
// SQLite supplier hanya opt-in eksplisit untuk pilot master data setelah audit manual.
const getSuppliersAdapter = (options = {}) => {
  const requestedMode = options.mode || import.meta.env.VITE_SUPPLIERS_REPOSITORY_MODE;
  if (requestedMode === "sqlite") return sqliteSuppliersAdapter;
  return firebaseSuppliersAdapter;
};

export const listSuppliers = (options = {}) =>
  getSuppliersAdapter(options).listSuppliers(options);

export const getSupplierById = (supplierId, options = {}) =>
  getSuppliersAdapter(options).getSupplierById(supplierId, options);

export const createSupplier = (values = {}, options = {}) =>
  getSuppliersAdapter(options).createSupplier(values, options);

export const updateSupplier = (supplierId, values = {}, options = {}) =>
  getSuppliersAdapter(options).updateSupplier(supplierId, values, options);

export const deleteSupplier = (supplierId, options = {}) =>
  getSuppliersAdapter(options).deleteSupplier(supplierId, options);
