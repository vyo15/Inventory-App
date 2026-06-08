const crypto = require("crypto");
const { getDb } = require("../../db/connection");
const { createAuditLog } = require("../../utils/auditLog");
const { safeJsonParse } = require("../../utils/jsonUtils");

const normalizeText = (value) => String(value ?? "").trim();
const normalizeBool = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  return value === true || value === 1 || value === "1" || value === "true" || value === "active";
};
const toNumber = (value = 0) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

const createServiceError = (message, code = "ERROR", statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.isServiceError = true;
  return error;
};

const normalizeTargetType = (value = "") => {
  const targetType = normalizeText(value || "raw_materials");
  return targetType === "products" ? "products" : "raw_materials";
};

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
    marginValue: Math.max(0, toNumber(body.marginValue ?? current.marginValue)),
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
      toNumber(body.marketplaceBufferValue ?? current.marketplaceBufferValue)
    ),
    roundingType: ["up", "down", "nearest"].includes(
      normalizeText(body.roundingType || current.roundingType)
    )
      ? normalizeText(body.roundingType || current.roundingType)
      : "up",
    roundingUnit: Math.max(1, toNumber(body.roundingUnit ?? current.roundingUnit ?? 100)),
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

const getNumericSequenceFromCode = (code = "") => {
  const match = String(code || "").match(/^PRC-(\d+)$/i);
  return match ? Number(match[1]) : 0;
};

const generateNextCode = async (db) => {
  const rows = await db.all("SELECT code FROM pricing_rules WHERE code LIKE 'PRC-%'");
  const maxSequence = rows.reduce(
    (max, row) => Math.max(max, getNumericSequenceFromCode(row.code)),
    0
  );
  return `PRC-${String(maxSequence + 1).padStart(3, "0")}`;
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

const createPricingRule = async (body = {}, actor = "system") => {
  const db = await getDb();
  const code = normalizeText(body?.code || "") || await generateNextCode(db);
  const payload = normalizeRulePayload({ ...body, code });

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
};

const updatePricingRule = async (id, body = {}, actor = "system") => {
  const db = await getDb();
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
};

const softDeletePricingRule = async (id, actor = "system") => {
  const db = await getDb();
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
};

module.exports = {
  createPricingRule,
  generatePricingRuleCode,
  getPricingRuleById,
  listPricingRules,
  softDeletePricingRule,
  updatePricingRule,
};
