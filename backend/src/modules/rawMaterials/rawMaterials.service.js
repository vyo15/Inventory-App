const { createInventoryMasterRouteGuards } = require("../../utils/sqliteStockEngine");

const RAW_MATERIAL_VALUATION_FIELDS = ["averageActualUnitCost"];

const getRawMaterialsRouterConfig = () => ({
  tableName: "raw_materials",
  moduleKey: "raw_materials",
  entityType: "raw_material",
  codePrefix: "RAW",
  requiredName: true,
  orderBy: "name ASC, updated_at DESC",
  protectedWriteNote: [
    "Edit master Raw Material hanya boleh mengubah metadata dan nilai reference/manual yang diizinkan.",
    "Stok, stok varian, dan average actual cost hasil transaksi dipertahankan dari database terbaru.",
    "Stock read model disinkronkan backend dalam transaction yang sama.",
  ].join(" "),
  ...createInventoryMasterRouteGuards({
    sourceType: "raw_material",
    sourceCollection: "raw_materials",
    preserveVariantOptions: true,
    protectedFields: RAW_MATERIAL_VALUATION_FIELDS,
    protectedVariantFields: RAW_MATERIAL_VALUATION_FIELDS,
  }),
});

module.exports = {
  getRawMaterialsRouterConfig,
};
