const crypto = require("crypto");
const { createAuditLog } = require("./auditLog");

const SOURCE_TABLES = Object.freeze({
  product: "products",
  products: "products",
  raw_material: "raw_materials",
  raw_materials: "raw_materials",
  material: "raw_materials",
  raw: "raw_materials",
  semi_finished: "semi_finished_materials",
  semi_finished_material: "semi_finished_materials",
  semi_finished_materials: "semi_finished_materials",
});

const SOURCE_TYPES = Object.freeze({
  products: "product",
  raw_materials: "raw_material",
  semi_finished_materials: "semi_finished",
});

const toInteger = (value = 0) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

const normalizeText = (value) => String(value ?? "").trim();
const nowIso = () => new Date().toISOString();

const safeJsonParse = (value, fallback = {}) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

const getTableForSourceType = (sourceType = "") => {
  const tableName = SOURCE_TABLES[String(sourceType || "").trim().toLowerCase()];
  if (!tableName) {
    throw new Error("Stock engine database lokal hanya mendukung Product, Raw Material, dan Semi Finished.");
  }
  return tableName;
};

const getSourceTypeForTable = (tableName = "") => SOURCE_TYPES[tableName] || "product";

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

const getVariantKey = (variant = {}) => normalizeText(variant.variantKey || variant.key || variant.id || variant.color || variant.name);

const applyStockDeltaToPayload = (payload = {}, { deltaCurrent = 0, variantKey = "" } = {}) => {
  const delta = toInteger(deltaCurrent);
  const hasVariants = payload.hasVariants === true || payload.hasVariantOptions === true || Array.isArray(payload.variants) || Array.isArray(payload.variantOptions);
  const normalizedVariantKey = normalizeText(variantKey);
  let nextPayload = { ...payload };

  if (hasVariants && !normalizedVariantKey) {
    throw new Error("Item memiliki varian. Pilih varian agar mutasi stok masuk ke sumber yang benar.");
  }

  if (hasVariants && normalizedVariantKey) {
    const sourceVariants = Array.isArray(payload.variants)
      ? payload.variants
      : Array.isArray(payload.variantOptions)
        ? payload.variantOptions
        : [];
    let found = false;
    const nextVariants = sourceVariants.map((variant) => {
      if (getVariantKey(variant) !== normalizedVariantKey) return variant;
      found = true;
      const currentStock = toInteger(variant.currentStock ?? variant.stock ?? 0) + delta;
      const reservedStock = toInteger(variant.reservedStock ?? 0);
      if (currentStock < 0) {
        throw new Error(`Stok varian ${variant.variantLabel || variant.color || normalizedVariantKey} tidak boleh minus.`);
      }
      return {
        ...variant,
        currentStock,
        stock: currentStock,
        reservedStock,
        availableStock: Math.max(currentStock - reservedStock, 0),
        updatedAt: nowIso(),
      };
    });

    if (!found) {
      throw new Error("Varian stok tidak ditemukan. Mutasi dibatalkan agar stok tidak masuk ke master/default.");
    }

    const totals = nextVariants.reduce((acc, variant) => {
      const currentStock = toInteger(variant.currentStock ?? variant.stock ?? 0);
      const reservedStock = toInteger(variant.reservedStock ?? 0);
      acc.currentStock += currentStock;
      acc.reservedStock += reservedStock;
      acc.availableStock += Math.max(currentStock - reservedStock, 0);
      return acc;
    }, { currentStock: 0, reservedStock: 0, availableStock: 0 });

    nextPayload = {
      ...nextPayload,
      variants: nextVariants,
      variantOptions: Array.isArray(payload.variantOptions) ? nextVariants : payload.variantOptions,
      currentStock: totals.currentStock,
      stock: totals.currentStock,
      reservedStock: totals.reservedStock,
      availableStock: totals.availableStock,
      updatedAt: nowIso(),
    };
  } else {
    const currentStock = toInteger(payload.currentStock ?? payload.stock ?? 0) + delta;
    const reservedStock = toInteger(payload.reservedStock ?? 0);
    if (currentStock < 0) {
      throw new Error("Stok tidak boleh minus. Mutasi dibatalkan.");
    }
    nextPayload = {
      ...nextPayload,
      currentStock,
      stock: currentStock,
      reservedStock,
      availableStock: Math.max(currentStock - reservedStock, 0),
      updatedAt: nowIso(),
    };
  }

  return nextPayload;
};

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
    availableStock: toInteger(payload.availableStock ?? Math.max(currentStock - reservedStock, 0)),
    minStockAlert: toInteger(payload.minStockAlert ?? payload.minStock ?? 0),
  };
};

const upsertJsonRecord = async (db, tableName, payload = {}) => {
  const id = normalizeText(payload.id || payload.code || crypto.randomUUID());
  const columns = extractColumns({ ...payload, id });
  const existing = await db.get(`SELECT id FROM ${tableName} WHERE id = ?`, [id]);
  const finalPayload = { ...payload, id, updatedAt: payload.updatedAt || nowIso() };

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
    availableStock: toInteger(itemPayload.availableStock ?? Math.max(currentStock - reservedStock, 0)),
    minStockAlert: toInteger(itemPayload.minStockAlert ?? itemPayload.minStock ?? 0),
    variants: Array.isArray(itemPayload.variants) ? itemPayload.variants : [],
    status: itemPayload.status || "active",
    isActive: itemPayload.isActive !== false,
    lastSyncedFrom,
    syncedAt: nowIso(),
  };
  return upsertJsonRecord(db, "stock_read_models", payload);
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
  if (!row) throw new Error("Item stok database lokal tidak ditemukan.");
  return { tableName, row, payload: toRowPayload(row) };
};

const commitStockMutation = async (db, {
  sourceType,
  sourceId,
  deltaCurrent,
  variantKey = "",
  referenceNumber = "",
  reason = "manual_adjustment",
  notes = "",
  actor = "system",
  transactionType = "stock_adjustment",
  transactionPayload = {},
} = {}) => {
  if (!sourceId) throw new Error("Source ID stok wajib tersedia.");
  const delta = toInteger(deltaCurrent);
  if (delta === 0) throw new Error("Qty mutasi stok tidak boleh 0.");

  const { tableName, payload } = await loadSourceItem(db, sourceType, sourceId);
  const beforeStock = toInteger(payload.currentStock ?? payload.stock ?? 0);
  const nextPayload = applyStockDeltaToPayload(payload, { deltaCurrent: delta, variantKey });
  const afterStock = toInteger(nextPayload.currentStock ?? nextPayload.stock ?? 0);
  await upsertJsonRecord(db, tableName, nextPayload);
  const stockReadModel = await upsertStockReadModel(db, nextPayload, {
    sourceType: getSourceTypeForTable(tableName),
    sourceCollection: tableName,
    lastSyncedFrom: `sqlite_stock_engine.${transactionType}`,
  });

  const ref = referenceNumber || `${transactionType.toUpperCase()}-${Date.now()}`;
  const eventBase = {
    referenceNumber: ref,
    code: ref,
    sourceType: getSourceTypeForTable(tableName),
    sourceCollection: tableName,
    sourceId,
    itemId: sourceId,
    itemName: nextPayload.name || payload.name || "",
    variantKey: variantKey || "",
    deltaCurrent: delta,
    quantity: Math.abs(delta),
    beforeStock,
    afterStock,
    reason,
    notes,
    transactionType,
    ...transactionPayload,
  };

  await insertEventRecord(db, "inventory_logs", {
    ...eventBase,
    id: `log_${ref}_${crypto.randomUUID()}`,
    name: `Log ${ref}`,
    type: delta >= 0 ? "stock_in" : "stock_out",
  });

  await createAuditLog({
    module: "stock",
    action: transactionType,
    entityType: getSourceTypeForTable(tableName),
    entityId: sourceId,
    actor,
    description: `Stock ${nextPayload.name || sourceId} berubah ${delta}`,
    metadata: { referenceNumber: ref, beforeStock, afterStock, deltaCurrent: delta, variantKey, reason },
  });

  return {
    referenceNumber: ref,
    item: nextPayload,
    stockReadModel,
    beforeStock,
    afterStock,
    deltaCurrent: delta,
  };
};

module.exports = {
  commitStockMutation,
  insertEventRecord,
  loadSourceItem,
  upsertJsonRecord,
  upsertStockReadModel,
  toInteger,
  nowIso,
  getTableForSourceType,
};
