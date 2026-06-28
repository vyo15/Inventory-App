const { safeJsonParse } = require("../../../utils/jsonUtils");
const { normalizeCode, normalizeText, toInteger } = require("./operationResult");

const defaultExtractColumns = (payload = {}) => {
  const currentStock = toInteger(payload.currentStock ?? payload.stock ?? 0);
  const reservedStock = toInteger(payload.reservedStock ?? 0);
  const availableStock = toInteger(payload.availableStock ?? Math.max(currentStock - reservedStock, 0));
  return {
    code: normalizeCode(payload.code || payload.productCode || payload.materialCode || payload.referenceNumber || payload.sourceRef || ""),
    name: normalizeText(payload.name || payload.title || payload.displayName || payload.referenceNumber || payload.sourceRef || ""),
    categoryId: normalizeText(payload.categoryId || payload.category_id || payload.targetType || payload.sourceType || ""),
    status: normalizeText(payload.status || (payload.isActive === false ? "inactive" : "active")) || "active",
    isActive: payload.isActive === false || payload.status === "inactive" || payload.status === "deleted" ? 0 : 1,
    currentStock,
    reservedStock,
    availableStock,
    minStockAlert: toInteger(payload.minStockAlert ?? payload.minStock ?? payload.minStockThreshold ?? 0),
    totalAmount: toInteger(payload.totalAmount ?? payload.grandTotal ?? payload.total ?? payload.amount ?? 0),
    transactionDate: normalizeText(payload.date || payload.transactionDate || payload.createdAt || ""),
    sourceType: normalizeText(payload.sourceType || payload.type || payload.targetType || ""),
    sourceId: normalizeText(payload.sourceId || payload.relatedId || payload.referenceId || ""),
  };
};

const toRecord = (row = {}) => {
  const payload = safeJsonParse(row.payload_json, {});
  const versionToken = payload.updatedAt || row.updated_at || null;
  return {
    ...payload,
    id: row.id,
    code: row.code || payload.code || payload.productCode || payload.materialCode || "",
    name: row.name || payload.name || "",
    categoryId: row.category_id || payload.categoryId || null,
    status: row.status || payload.status || "active",
    isActive: row.is_active === 0 ? false : payload.isActive !== false,
    currentStock: row.current_stock ?? payload.currentStock ?? payload.stock ?? 0,
    stock: row.current_stock ?? payload.stock ?? payload.currentStock ?? 0,
    reservedStock: row.reserved_stock ?? payload.reservedStock ?? 0,
    availableStock: row.available_stock ?? payload.availableStock ?? 0,
    minStockAlert: row.min_stock_alert ?? payload.minStockAlert ?? payload.minStock ?? 0,
    totalAmount: row.total_amount ?? payload.totalAmount ?? payload.total ?? 0,
    transactionDate: row.transaction_date || payload.transactionDate || payload.date || null,
    sourceType: row.source_type || payload.sourceType || payload.type || null,
    sourceId: row.source_id || payload.sourceId || null,
    createdAt: row.created_at || payload.createdAt || null,
    updatedAt: row.updated_at || payload.updatedAt || null,
    versionToken,
  };
};

module.exports = { defaultExtractColumns, toRecord };
