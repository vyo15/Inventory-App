import * as dexieSuppliersAdapter from "../adapters/dexie/dexieSuppliersAdapter";
import * as firebaseSuppliersAdapter from "../adapters/firebase/firebaseSuppliersAdapter";
import {
  REPOSITORY_MODES,
  resolveRepositoryMode,
} from "./repositoryMode";

const getSuppliersAdapter = (options = {}) => {
  const mode = resolveRepositoryMode(options);

  if (mode === REPOSITORY_MODES.OFFLINE_LOCAL) {
    return dexieSuppliersAdapter;
  }

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
