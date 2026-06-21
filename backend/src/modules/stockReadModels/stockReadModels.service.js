const getStockReadModelsRouterConfig = () => ({
  tableName: "stock_read_models",
  moduleKey: "stock_read_models",
  entityType: "stock_read_model",
  codePrefix: "STK",
  requiredName: false,
  orderBy: "source_type ASC, name ASC, updated_at DESC",
  protectedWriteNote: [
    "Stock read model adalah data turunan backend, bukan source of truth mutasi stok.",
    "Writer hanya Stock Engine dan inventory master transaction resmi.",
  ].join(" "),
  allowDirectCreate: false,
  allowDirectUpdate: false,
  allowDirectDelete: false,
  blockedWriteMessage: [
    "Stock read model tidak boleh ditulis langsung dari client.",
    "Gunakan Stock Adjustment, transaksi resmi, atau edit metadata master yang guarded.",
  ].join(" "),
});

module.exports = {
  getStockReadModelsRouterConfig,
};
