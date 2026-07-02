const { normalizeText, toRoundedInteger } = require("../../utils/textNormalization");
const { createServiceError } = require("../../utils/httpError");
const crypto = require("crypto");
const { getDb, runInTransaction } = require("../../db/connection");
const {
  sanitizeInventoryMasterUpdate,
  upsertJsonRecord,
  upsertStockReadModel,
} = require("../stock/engine");
const { createAuditLog } = require("../../utils/auditLog");
const { safeJsonParse } = require("../../utils/jsonUtils");
const {
  getBusinessCodePreview,
  resolveBusinessCode,
} = require("../../utils/businessCodeCounter");
const { PRODUCT_VALUATION_FIELDS } = require("../products/products.service");
const { RAW_MATERIAL_VALUATION_FIELDS } = require("../rawMaterials/rawMaterials.service");


const normalizeBool = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  return value === true || value === 1 || value === "1" || value === "true" || value === "active";
};


const normalizeTargetType = (value = "") => {
  const targetType = normalizeText(value || "raw_materials");
  return targetType === "products" ? "products" : "raw_materials";
};

const PRICING_TARGET_CONFIG = Object.freeze({
  products: Object.freeze({
    tableName: "products",
    sourceType: "product",
    priceField: "price",
    preserveVariantOptions: false,
    protectedFields: PRODUCT_VALUATION_FIELDS,
  }),
  raw_materials: Object.freeze({
    tableName: "raw_materials",
    sourceType: "raw_material",
    priceField: "sellingPrice",
    preserveVariantOptions: true,
    protectedFields: RAW_MATERIAL_VALUATION_FIELDS,
  }),
});

const normalizeRulePayload = (body = {}, current = {}) => {
  const targetType = normalizeTargetType(
    body.targetType || body.target_type || current.targetType || current.target_type
  );
  const isActive = normalizeBool(body.isActive ?? body.is_active, current.isActive !== false);
  const status = isActive ? "active" : "inactive";
  const now = new Date().toISOString();

  return {
    id: normalizeText(body.id || current.id || crypto.randomUUID()),
    code: normalizeText(body.code || current.code || ""),
    name: normalizeText(body.name || current.name || ""),
    description: normalizeText(body.description || current.description || ""),
    targetType,
    isActive,
    baseCostSource: normalizeText(
      body.baseCostSource
        || current.baseCostSource
        || (targetType === "products" ? "hppPerUnit" : "averageActualUnitCost")
    ),
    marginType: normalizeText(body.marginType || current.marginType || "percent") === "nominal"
      ? "nominal"
      : "percent",
    marginValue: Math.max(0, toRoundedInteger(body.marginValue ?? current.marginValue)),
    includeMarketplaceBuffer: normalizeBool(
      body.includeMarketplaceBuffer,
      current.includeMarketplaceBuffer === true
    ),
    marketplaceBufferType: normalizeText(
      body.marketplaceBufferType || current.marketplaceBufferType || "percent"
    ) === "nominal"
      ? "nominal"
      : "percent",
    marketplaceBufferValue: Math.max(
      0,
      toRoundedInteger(body.marketplaceBufferValue ?? current.marketplaceBufferValue)
    ),
    roundingType: ["up", "down", "nearest"].includes(
      normalizeText(body.roundingType || current.roundingType)
    )
      ? normalizeText(body.roundingType || current.roundingType)
      : "up",
    roundingUnit: Math.max(1, toRoundedInteger(body.roundingUnit ?? current.roundingUnit ?? 100)),
    status,
    createdAt: current.createdAt || body.createdAt || now,
    updatedAt: now,
  };
};

const toPricingRuleRecord = (row = {}) => {
  const payload = safeJsonParse(row.payload_json, {});
  return {
    ...payload,
    id: row.id,
    code: row.code || payload.code || "",
    name: row.name || payload.name || "",
    targetType: row.target_type || payload.targetType || "raw_materials",
    isActive: row.is_active === 0 ? false : payload.isActive !== false,
    status: row.status || payload.status || "active",
    createdAt: row.created_at || payload.createdAt || null,
    updatedAt: row.updated_at || payload.updatedAt || null,
  };
};

const PRICING_CODE_OPTIONS = Object.freeze({
  counterKey: "pricing_rules:PRC",
  prefix: "PRC",
  tableName: "pricing_rules",
  columnName: "code",
  minWidth: 3,
  notes: "Runtime counter pricing rules",
});

const generateNextCode = (db) => getBusinessCodePreview(db, PRICING_CODE_OPTIONS);

const resolvePricingCreateCode = async (db, requestedCode = "") => {
  const code = await resolveBusinessCode(db, requestedCode, PRICING_CODE_OPTIONS);
  if (!code) {
    throw createServiceError("Kode pricing rule sudah pernah digunakan.", "DUPLICATE_CODE", 409);
  }
  return code;
};

const generatePricingRuleCode = async () => {
  const db = await getDb();
  return generateNextCode(db);
};

const listPricingRules = async (query = {}) => {
  const db = await getDb();
  const targetType = normalizeText(query.targetType || "");
  const where = ["status != 'deleted'"];
  const params = [];

  if (targetType) {
    where.push("target_type = ?");
    params.push(normalizeTargetType(targetType));
  }

  const rows = await db.all(
    `SELECT * FROM pricing_rules WHERE ${where.join(" AND ")} ORDER BY name ASC, updated_at DESC LIMIT 500`,
    params
  );

  return rows.map(toPricingRuleRecord);
};

const getPricingRuleById = async (id) => {
  const db = await getDb();
  const row = await db.get(
    "SELECT * FROM pricing_rules WHERE id = ? AND status != 'deleted'",
    [id]
  );
  return row ? toPricingRuleRecord(row) : null;
};

const validatePricingRulePayload = (payload) => {
  if (!payload.name) {
    throw createServiceError("Nama pricing rule wajib diisi.", "VALIDATION_ERROR", 400);
  }
};

const createPricingRule = async (body = {}, actor = "system") => runInTransaction(async (db) => {
  const code = await resolvePricingCreateCode(db, body?.code);
  const requestedCode = normalizeText(body?.code || "").toUpperCase();
  const requestedId = normalizeText(body?.id || "");
  const normalizedBody = {
    ...body,
    id: !requestedId || requestedId.toUpperCase() === requestedCode ? code : requestedId,
    code,
  };
  const payload = normalizeRulePayload(normalizedBody);

  validatePricingRulePayload(payload);

  await db.run(
    `
      INSERT INTO pricing_rules (id, code, name, target_type, status, is_active, payload_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [
      payload.id,
      code,
      payload.name,
      payload.targetType,
      payload.status,
      payload.isActive ? 1 : 0,
      JSON.stringify({ ...payload, code }),
    ]
  );

  await createAuditLog({
    module: "pricing_rules",
    action: "create",
    entityType: "pricing_rule",
    entityId: payload.id,
    actor,
    description: `Pricing rule ${payload.name} dibuat di database lokal`,
    metadata: { code, targetType: payload.targetType },
  });

  const row = await db.get("SELECT * FROM pricing_rules WHERE id = ?", [payload.id]);
  return toPricingRuleRecord(row);
});

const updatePricingRule = async (id, body = {}, actor = "system") => runInTransaction(async (db) => {
  const current = await db.get(
    "SELECT * FROM pricing_rules WHERE id = ? AND status != 'deleted'",
    [id]
  );

  if (!current) {
    throw createServiceError("Pricing rule database lokal tidak ditemukan.", "NOT_FOUND", 404);
  }

  const currentPayload = toPricingRuleRecord(current);
  const payload = normalizeRulePayload(
    { ...currentPayload, ...body, id: current.id, code: current.code },
    currentPayload
  );

  validatePricingRulePayload(payload);

  await db.run(
    `
      UPDATE pricing_rules
      SET name = ?, target_type = ?, status = ?, is_active = ?, payload_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [
      payload.name,
      payload.targetType,
      payload.status,
      payload.isActive ? 1 : 0,
      JSON.stringify({ ...payload, code: current.code }),
      current.id,
    ]
  );

  await createAuditLog({
    module: "pricing_rules",
    action: "update",
    entityType: "pricing_rule",
    entityId: current.id,
    actor,
    description: `Pricing rule ${payload.name} diubah di database lokal`,
    metadata: { code: current.code, targetType: payload.targetType },
  });

  const row = await db.get("SELECT * FROM pricing_rules WHERE id = ?", [current.id]);
  return toPricingRuleRecord(row);
});

const softDeletePricingRule = async (id, actor = "system") => runInTransaction(async (db) => {
  const current = await db.get(
    "SELECT * FROM pricing_rules WHERE id = ? AND status != 'deleted'",
    [id]
  );

  if (!current) {
    throw createServiceError("Pricing rule database lokal tidak ditemukan.", "NOT_FOUND", 404);
  }

  const payload = {
    ...toPricingRuleRecord(current),
    isActive: false,
    status: "deleted",
    updatedAt: new Date().toISOString(),
  };

  await db.run(
    "UPDATE pricing_rules SET status = 'deleted', is_active = 0, payload_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [JSON.stringify(payload), current.id]
  );

  await createAuditLog({
    module: "pricing_rules",
    action: "soft_delete",
    entityType: "pricing_rule",
    entityId: current.id,
    actor,
    description: `Pricing rule ${current.name} dinonaktifkan di database lokal`,
    metadata: { code: current.code, targetType: current.target_type },
  });

  return { id: current.id, deleted: true, softDeleted: true };
});

const toInventoryRecord = (row = {}) => {
  const payload = safeJsonParse(row.payload_json, {});
  const versionToken = payload.updatedAt || row.updated_at || null;
  return {
    ...payload,
    id: row.id,
    code: row.code || payload.code || "",
    name: row.name || payload.name || "",
    status: row.status || payload.status || "active",
    isActive: row.is_active === 0 ? false : payload.isActive !== false,
    currentStock: row.current_stock ?? payload.currentStock ?? payload.stock ?? 0,
    stock: row.current_stock ?? payload.stock ?? payload.currentStock ?? 0,
    reservedStock: row.reserved_stock ?? payload.reservedStock ?? 0,
    availableStock: row.available_stock ?? payload.availableStock ?? 0,
    updatedAt: row.updated_at || payload.updatedAt || null,
    versionToken,
  };
};

const normalizePricingBatchUpdates = (updates = []) => {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw createServiceError(
      "Tidak ada perubahan harga yang perlu diterapkan.",
      "PRICING_BATCH_EMPTY",
      400,
    );
  }
  if (updates.length > 2000) {
    throw createServiceError(
      "Apply pricing maksimal 2000 item per proses.",
      "PRICING_BATCH_TOO_LARGE",
      400,
    );
  }

  const seenIds = new Set();
  return updates.map((update = {}, index) => {
    const itemId = normalizeText(update.itemId || update.id);
    const expectedVersion = normalizeText(update.expectedVersion);
    const parsedPrice = Number(update.newPrice);
    if (!itemId) {
      throw createServiceError(`Item pricing ke-${index + 1} tidak memiliki ID.`, "PRICING_ITEM_INVALID", 400);
    }
    if (seenIds.has(itemId)) {
      throw createServiceError(`Item pricing ${itemId} dikirim lebih dari sekali.`, "PRICING_ITEM_DUPLICATE", 400);
    }
    if (!expectedVersion) {
      throw createServiceError(
        `Versi data item ${itemId} tidak tersedia. Muat ulang preview pricing.`,
        "INVENTORY_VERSION_REQUIRED",
        428,
      );
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      throw createServiceError(`Harga baru item ${itemId} tidak valid.`, "PRICING_PRICE_INVALID", 400);
    }
    seenIds.add(itemId);
    return {
      itemId,
      expectedVersion,
      newPrice: Math.round(parsedPrice),
    };
  });
};

const applyPricingRuleBatch = async (id, body = {}, actor = "system") => {
  const updates = normalizePricingBatchUpdates(body.updates);
  return runInTransaction(async (db) => {
    const ruleRow = await db.get(
      "SELECT * FROM pricing_rules WHERE id = ? AND status != 'deleted'",
      [id],
    );
    if (!ruleRow) {
      throw createServiceError("Pricing rule database lokal tidak ditemukan.", "NOT_FOUND", 404);
    }

    const rule = toPricingRuleRecord(ruleRow);
    if (rule.isActive === false || rule.status === "inactive") {
      throw createServiceError("Pricing rule nonaktif tidak dapat diterapkan.", "PRICING_RULE_INACTIVE", 409);
    }
    const requestedTargetType = normalizeText(body.targetType || "");
    if (requestedTargetType && !Object.prototype.hasOwnProperty.call(PRICING_TARGET_CONFIG, requestedTargetType)) {
      throw createServiceError("Target apply pricing tidak valid.", "PRICING_TARGET_INVALID", 400);
    }
    const targetType = normalizeTargetType(requestedTargetType || rule.targetType);
    if (targetType !== rule.targetType) {
      throw createServiceError(
        "Target apply pricing tidak sesuai dengan target pricing rule.",
        "PRICING_TARGET_MISMATCH",
        409,
      );
    }
    const config = PRICING_TARGET_CONFIG[targetType];
    const changeSource = normalizeText(body.changeSource || "pricing_rule_apply");
    const notes = normalizeText(body.notes || "");
    const updatedItems = [];

    for (const update of updates) {
      const row = await db.get(
        `SELECT * FROM ${config.tableName} WHERE id = ? AND status != 'deleted'`,
        [update.itemId],
      );
      if (!row) {
        throw createServiceError(
          `Item pricing ${update.itemId} tidak ditemukan. Tidak ada harga yang diubah.`,
          "PRICING_ITEM_NOT_FOUND",
          404,
        );
      }

      const currentPayload = safeJsonParse(row.payload_json, {});
      const current = toInventoryRecord(row);
      const now = new Date().toISOString();
      const incomingPayload = {
        expectedVersion: update.expectedVersion,
        [config.priceField]: update.newPrice,
        pricingMode: "rule",
        pricingRuleId: rule.id,
        lastPricingUpdatedAt: now,
      };
      const sanitizedPayload = sanitizeInventoryMasterUpdate({
        current,
        currentPayload,
        incomingPayload,
        mergedPayload: {
          ...currentPayload,
          ...incomingPayload,
          id: row.id,
          code: row.code || currentPayload.code || "",
          name: row.name || currentPayload.name || "",
          updatedAt: now,
        },
        req: { localAuth: { user: { username: actor } } },
        preserveVariantOptions: config.preserveVariantOptions,
        protectedFields: config.protectedFields,
        protectedVariantFields: config.protectedFields,
      });

      const oldPrice = toRoundedInteger(currentPayload[config.priceField]);
      const saved = await upsertJsonRecord(db, config.tableName, sanitizedPayload);
      await upsertStockReadModel(db, saved, {
        sourceType: config.sourceType,
        sourceCollection: config.tableName,
        lastSyncedFrom: "pricing_rules.batch_apply",
      });
      await createAuditLog({
        module: "pricing_rules",
        action: "apply_price",
        entityType: config.sourceType,
        entityId: row.id,
        actor,
        description: `Pricing rule ${rule.name} diterapkan ke ${row.name || row.code || row.id}`,
        metadata: {
          pricingRuleId: rule.id,
          pricingRuleCode: rule.code,
          targetType,
          oldPrice,
          newPrice: update.newPrice,
          changeSource,
          notes,
        },
      });
      updatedItems.push({
        id: row.id,
        name: saved.name || row.name || "",
        oldPrice,
        newPrice: update.newPrice,
        versionToken: saved.updatedAt || null,
      });
    }

    await createAuditLog({
      module: "pricing_rules",
      action: "apply_batch",
      entityType: "pricing_rule",
      entityId: rule.id,
      actor,
      description: `Pricing rule ${rule.name} diterapkan secara atomic ke ${updatedItems.length} item`,
      metadata: {
        targetType,
        updatedCount: updatedItems.length,
        itemIds: updatedItems.map((item) => item.id),
      },
    });

    return {
      ruleId: rule.id,
      targetType,
      updatedCount: updatedItems.length,
      updatedItems,
    };
  });
};

module.exports = {
  applyPricingRuleBatch,
  createPricingRule,
  generatePricingRuleCode,
  getPricingRuleById,
  listPricingRules,
  softDeletePricingRule,
  updatePricingRule,
};
