const { createHttpError } = require("../../../utils/httpError");
const crypto = require("crypto");
const { safeJsonParse } = require("../../../utils/jsonUtils");
const {
  getSourceTypeForTable,
  getTableForSourceType,
  normalizeText,
  nowIso,
  resolveInventoryVariantCollection,
  toInteger,
} = require("./stockSourceRegistry");
const {
  assertStockSnapshotValid,
  getVariantDisplayName,
} = require("./stockVariantDomain");

const toRowPayload = (row = {}) => ({
  ...safeJsonParse(row.payload_json, {}),
  id: row.id,
  code: row.code || "",
  name: row.name || "",
  status: row.status || "active",
  isActive: row.is_active === 0 ? false : true,
  currentStock: row.current_stock ?? 0,
  stock: row.current_stock ?? 0,
  reservedStock: row.reserved_stock ?? 0,
  availableStock: row.available_stock ?? 0,
  minStockAlert: row.min_stock_alert ?? 0,
});

const extractColumns = (payload = {}) => {
  const currentStock = toInteger(payload.currentStock ?? payload.stock ?? 0);
  const reservedStock = toInteger(payload.reservedStock ?? 0);
  return {
    code: normalizeText(payload.code || payload.productCode || payload.materialCode || "").toUpperCase(),
    name: normalizeText(payload.name || payload.itemName || ""),
    status: normalizeText(payload.status || (payload.isActive === false ? "inactive" : "active")) || "active",
    isActive: payload.isActive === false || payload.status === "inactive" || payload.status === "deleted" ? 0 : 1,
    currentStock,
    reservedStock,
    availableStock: Math.max(currentStock - reservedStock, 0),
    minStockAlert: toInteger(payload.minStockAlert ?? payload.minStock ?? 0),
  };
};

const upsertJsonRecord = async (db, tableName, payload = {}) => {
  const id = normalizeText(payload.id || payload.code || crypto.randomUUID());
  const columns = extractColumns({ ...payload, id });
  const existing = await db.get(`SELECT id FROM ${tableName} WHERE id = ?`, [id]);
  const finalPayload = {
    ...payload,
    id,
    currentStock: columns.currentStock,
    stock: columns.currentStock,
    reservedStock: columns.reservedStock,
    availableStock: columns.availableStock,
    updatedAt: payload.updatedAt || nowIso(),
  };

  if (existing) {
    await db.run(
      `UPDATE ${tableName}
       SET code = ?, name = ?, status = ?, is_active = ?, current_stock = ?, reserved_stock = ?, available_stock = ?, min_stock_alert = ?, payload_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [columns.code, columns.name, columns.status, columns.isActive, columns.currentStock, columns.reservedStock, columns.availableStock, columns.minStockAlert, JSON.stringify(finalPayload), id]
    );
  } else {
    await db.run(
      `INSERT INTO ${tableName} (id, code, name, status, is_active, current_stock, reserved_stock, available_stock, min_stock_alert, payload_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, columns.code, columns.name, columns.status, columns.isActive, columns.currentStock, columns.reservedStock, columns.availableStock, columns.minStockAlert, JSON.stringify({ ...finalPayload, createdAt: finalPayload.createdAt || nowIso() })]
    );
  }

  const row = await db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
  return toRowPayload(row);
};

const upsertStockReadModel = async (db, itemPayload = {}, { sourceType, sourceCollection, lastSyncedFrom = "sqlite_stock_engine" } = {}) => {
  const sourceId = normalizeText(itemPayload.id);
  const resolvedSourceType = sourceType || getSourceTypeForTable(sourceCollection);
  const id = `${resolvedSourceType}__${sourceId}`;
  const currentStock = toInteger(itemPayload.currentStock ?? itemPayload.stock ?? 0);
  const reservedStock = toInteger(itemPayload.reservedStock ?? 0);
  const resolvedVariants = resolveInventoryVariantCollection(itemPayload);
  const normalizedVariants = resolvedVariants.variants.map((variant) => ({
    ...variant,
    ...assertStockSnapshotValid(variant, `Stok varian ${getVariantDisplayName(variant)}`),
  }));
  const hasVariantMinimumStock = resolvedSourceType === "raw_material"
    && resolvedVariants.hasVariants
    && normalizedVariants.some((variant) => (
      Object.prototype.hasOwnProperty.call(variant, "minStockAlert")
      || Object.prototype.hasOwnProperty.call(variant, "minStock")
    ));
  const variantMinimumStockTotal = hasVariantMinimumStock
    ? normalizedVariants
      .filter((variant) => variant.isActive !== false && variant.isArchived !== true)
      .reduce((sum, variant) => sum + Math.max(0, toInteger(variant.minStockAlert ?? variant.minStock ?? 0)), 0)
    : 0;
  const payload = {
    id,
    code: itemPayload.code || itemPayload.productCode || itemPayload.materialCode || id,
    name: itemPayload.name || "",
    sourceType: resolvedSourceType,
    sourceCollection,
    sourceId,
    currentStock,
    stock: currentStock,
    reservedStock,
    availableStock: Math.max(currentStock - reservedStock, 0),
    minStockAlert: hasVariantMinimumStock
      ? variantMinimumStockTotal
      : toInteger(itemPayload.minStockAlert ?? itemPayload.minStock ?? 0),
    minimumStockMode: hasVariantMinimumStock ? "variant" : "master",
    variants: normalizedVariants,
    hasVariants: resolvedVariants.hasVariants,
    status: itemPayload.status || "active",
    isActive: itemPayload.isActive !== false,
    lastSyncedFrom,
    syncedAt: nowIso(),
  };
  return upsertJsonRecord(db, "stock_read_models", payload);
};

const softDeleteStockReadModel = async (db, sourceType, sourceId) => {
  const id = `${sourceType}__${sourceId}`;
  const row = await db.get("SELECT * FROM stock_read_models WHERE id = ?", [id]);
  if (!row) return null;
  const payload = safeJsonParse(row.payload_json, {});
  return upsertJsonRecord(db, "stock_read_models", {
    ...payload,
    id,
    status: "deleted",
    isActive: false,
    updatedAt: nowIso(),
  });
};
const insertEventRecord = async (db, tableName, payload = {}) => {
  const id = normalizeText(payload.id || payload.referenceNumber || payload.code || crypto.randomUUID());
  const columns = extractColumns({ ...payload, id });
  await db.run(
    `INSERT INTO ${tableName} (id, code, name, status, is_active, current_stock, reserved_stock, available_stock, min_stock_alert, total_amount, transaction_date, source_type, source_id, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      id,
      columns.code || normalizeText(payload.referenceNumber || payload.code || id).toUpperCase(),
      columns.name || normalizeText(payload.name || payload.description || payload.itemName || id),
      columns.status || "active",
      columns.isActive,
      columns.currentStock,
      columns.reservedStock,
      columns.availableStock,
      columns.minStockAlert,
      toInteger(payload.totalAmount ?? payload.total ?? payload.amount ?? 0),
      payload.transactionDate || payload.date || nowIso(),
      payload.sourceType || payload.type || null,
      payload.sourceId || payload.itemId || null,
      JSON.stringify({ ...payload, id, createdAt: payload.createdAt || nowIso(), updatedAt: nowIso() }),
    ]
  );
  return { id, ...payload };
};

const loadSourceItem = async (db, sourceType, sourceId) => {
  const tableName = getTableForSourceType(sourceType);
  const row = await db.get(`SELECT * FROM ${tableName} WHERE id = ? AND status != 'deleted'`, [sourceId]);
  if (!row) {
    throw createHttpError("Item stok database lokal tidak ditemukan.", "STOCK_ITEM_NOT_FOUND", 404);
  }
  return { tableName, row, payload: toRowPayload(row) };
};


module.exports = {
  extractColumns,
  insertEventRecord,
  loadSourceItem,
  softDeleteStockReadModel,
  toRowPayload,
  upsertJsonRecord,
  upsertStockReadModel,
};
