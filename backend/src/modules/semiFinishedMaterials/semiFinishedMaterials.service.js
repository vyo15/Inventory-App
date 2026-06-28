const { createInventoryMasterRouteGuards } = require("../stock/engine");

const SEMI_FINISHED_VALUATION_FIELDS = [
  "averageCostPerUnit",
  "lastProductionCostPerUnit",
  "costPerUnit",
];

const getSemiFinishedMaterialsRouterConfig = () => ({
  tableName: "semi_finished_materials",
  moduleKey: "semi_finished_materials",
  entityType: "semi_finished_material",
  codePrefix: "SFP",
  requiredName: true,
  orderBy: "name ASC, updated_at DESC",
  protectedWriteNote: [
    "Edit master Semi Finished hanya boleh mengubah metadata dan nilai reference/manual yang diizinkan.",
    "Stok, stok varian, dan valuation hasil produksi dipertahankan dari database terbaru.",
    "Stock read model disinkronkan backend dalam transaction yang sama.",
  ].join(" "),
  ...createInventoryMasterRouteGuards({
    sourceType: "semi_finished",
    sourceCollection: "semi_finished_materials",
    protectedFields: SEMI_FINISHED_VALUATION_FIELDS,
    protectedVariantFields: SEMI_FINISHED_VALUATION_FIELDS,
  }),
});

module.exports = {
  SEMI_FINISHED_VALUATION_FIELDS,
  getSemiFinishedMaterialsRouterConfig,
};
