import * as firebaseSuppliersAdapter from "../adapters/firebase/firebaseSuppliersAdapter";

// LEGACY-COMPAT:
// Supplier belum dipindahkan ke SQLite karena supplier terkait purchase/raw material/history.
// Semua write/read supplier tetap Firebase-primary sampai audit migrasi supplier selesai.
const getSuppliersAdapter = () => firebaseSuppliersAdapter;

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
