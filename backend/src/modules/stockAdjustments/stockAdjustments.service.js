const getStockAdjustmentsRouterConfig = () => ({
  tableName: "stock_adjustments",
  moduleKey: "stock_adjustments",
  entityType: "stock_adjustment",
  codePrefix: "STK-ADJ",
  requiredName: false,
  orderBy: "transaction_date DESC, updated_at DESC",
  protectedWriteNote: [
    "Daftar Penyesuaian Stok.",
    "Commit mutasi wajib lewat POST /api/stock/adjustments/commit.",
  ].join(" "),
  allowDirectCreate: false,
  allowDirectUpdate: false,
  allowDirectDelete: false,
  blockedWriteMessage: [
    "Penyesuaian Stok wajib lewat POST /api/stock/adjustments/commit agar mutasi stok,",
    "data stok, inventory log, dan audit log tetap atomic.",
  ].join(" "),
});

module.exports = {
  getStockAdjustmentsRouterConfig,
};
