const { createInventoryMasterRouteGuards } = require("../stock/engine");

const PRODUCT_VALUATION_FIELDS = ["hppPerUnit", "averageCostPerUnit", "costPerUnit"];

const getProductsRouterConfig = () => ({
  tableName: "products",
  moduleKey: "products",
  entityType: "product",
  codePrefix: "PRD",
  requiredName: true,
  orderBy: "name ASC, updated_at DESC",
  protectedWriteNote: [
    "Edit master Product hanya boleh mengubah metadata.",
    "Stok, stok varian, dan HPP hasil produksi dipertahankan dari database terbaru.",
    "Stock read model disinkronkan backend dalam transaction yang sama.",
  ].join(" "),
  ...createInventoryMasterRouteGuards({
    sourceType: "product",
    sourceCollection: "products",
    protectedFields: PRODUCT_VALUATION_FIELDS,
    protectedVariantFields: PRODUCT_VALUATION_FIELDS,
  }),
});

module.exports = {
  PRODUCT_VALUATION_FIELDS,
  getProductsRouterConfig,
};
