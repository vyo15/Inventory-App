import * as sqliteSuppliersAdapter from "../adapters/sqlite/sqliteSuppliersAdapter";

const getSuppliersAdapter = () => sqliteSuppliersAdapter;

export const listSuppliers = (options = {}) => getSuppliersAdapter().listSuppliers(options);
export const getSupplierById = (supplierId, options = {}) => getSuppliersAdapter().getSupplierById(supplierId, options);
export const generateSupplierCode = (options = {}) => getSuppliersAdapter().generateSupplierCode(options);
export const createSupplier = (values = {}, options = {}) => getSuppliersAdapter().createSupplier(values, options);
export const updateSupplier = (supplierId, values = {}, options = {}) => getSuppliersAdapter().updateSupplier(supplierId, values, options);
export const deleteSupplier = (supplierId, options = {}) => getSuppliersAdapter().deleteSupplier(supplierId, options);

export const listSupplierHistory = (supplierId, options = {}) => getSuppliersAdapter().listSupplierHistory(supplierId, options);
export const verifySupplierCatalogOffer = (supplierId, offerId, payload = {}, options = {}) => getSuppliersAdapter().verifySupplierCatalogOffer(supplierId, offerId, payload, options);
