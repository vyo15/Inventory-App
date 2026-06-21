const getStockReadModelsRouterConfig = () => ({
  tableName: "stock_read_models",
  moduleKey: "stock_read_models",
  entityType: "stock_read_model",
  codePrefix: "STK",
  requiredName: false,
  orderBy: "source_type ASC, name ASC, updated_at DESC",
  protectedWriteNote: [
    "Stock Read Model adalah snapshot turunan dan tidak boleh ditulis langsung oleh client.",
    "Perubahan hanya boleh berasal dari Stock Engine atau transaction/service inventory resmi yang audited.",
  ].join(" "),
  allowDirectCreate: false,
  allowDirectUpdate: false,
  allowDirectDelete: false,
  blockedWriteMessage: "Stock Read Model tidak boleh ditulis langsung. Gunakan Stock Engine atau transaction/service inventory resmi.",
});

module.exports = {
  getStockReadModelsRouterConfig,
};
