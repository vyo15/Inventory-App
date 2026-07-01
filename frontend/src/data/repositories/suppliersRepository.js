import * as sqliteSuppliersAdapter from "../adapters/sqlite/sqliteSuppliersAdapter";


export const listSuppliers = (options = {}) => sqliteSuppliersAdapter.listSuppliers(options);
export const getSupplierById = (supplierId, options = {}) => sqliteSuppliersAdapter.getSupplierById(supplierId, options);
export const generateSupplierCode = (options = {}) => sqliteSuppliersAdapter.generateSupplierCode(options);
export const createSupplier = (values = {}, options = {}) => sqliteSuppliersAdapter.createSupplier(values, options);
export const updateSupplier = (supplierId, values = {}, options = {}) => sqliteSuppliersAdapter.updateSupplier(supplierId, values, options);
export const deleteSupplier = (supplierId, options = {}) => sqliteSuppliersAdapter.deleteSupplier(supplierId, options);

export const listSupplierHistory = (supplierId, options = {}) => sqliteSuppliersAdapter.listSupplierHistory(supplierId, options);
export const verifySupplierCatalogOffer = (supplierId, offerId, payload = {}, options = {}) => sqliteSuppliersAdapter.verifySupplierCatalogOffer(supplierId, offerId, payload, options);
