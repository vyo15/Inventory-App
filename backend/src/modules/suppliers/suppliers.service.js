const {
  createSupplier,
  generateSupplierCode,
  getSupplierById,
  listSuppliers,
  softDeleteSupplier,
  updateSupplier,
} = require("./suppliers.identity.service");
const {
  listSupplierCatalogHistory,
  verifyPurchaseCatalogOfferWithDb,
  verifySupplierCatalogOffer,
} = require("./suppliers.catalog.service");

module.exports = {
  createSupplier,
  generateSupplierCode,
  getSupplierById,
  listSupplierCatalogHistory,
  listSuppliers,
  softDeleteSupplier,
  updateSupplier,
  verifyPurchaseCatalogOfferWithDb,
  verifySupplierCatalogOffer,
};
