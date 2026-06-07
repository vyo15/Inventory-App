const crypto = require("crypto");
const express = require("express");
const { getDb } = require("../../db/connection");
const { createAuditLog } = require("../../utils/auditLog");
const { failure, success } = require("../../utils/response");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");

const router = express.Router();

const normalizeText = (value) => String(value ?? "").trim();
const normalizeBool = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  return value === true || value === 1 || value === "1" || value === "true" || value === "active";
};
const toNumber = (value = 0) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

const safeJsonParse = (value, fallback = {}) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

const normalizeTargetType = (value = "") => {
  const targetType = normalizeText(value || "raw_materials");
  return targetType === "products" ? "products" : "raw_materials";
};

const normalizeRulePayload = (body = {}, current = {}) => {
  const targetType = normalizeTargetType(body.targetType || body.target_type || current.targetType || current.target_type);
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
    baseCostSource: normalizeText(body.baseCostSource || current.baseCostSource || (targetType === "products" ? "hppPerUnit" : "averageActualUnitCost")),
    marginType: normalizeText(body.marginType || current.marginType || "percent") === "nominal" ? "nominal" : "percent",
    marginValue: Math.max(0, toNumber(body.marginValue ?? current.marginValue)),
    includeMarketplaceBuffer: normalizeBool(body.includeMarketplaceBuffer, current.includeMarketplaceBuffer === true),
    marketplaceBufferType: normalizeText(body.marketplaceBufferType || current.marketplaceBufferType || "percent") === "nominal" ? "nominal" : "percent",
    marketplaceBufferValue: Math.max(0, toNumber(body.marketplaceBufferValue ?? current.marketplaceBufferValue)),
    roundingType: ["up", "down", "nearest"].includes(normalizeText(body.roundingType || current.roundingType)) ? normalizeText(body.roundingType || current.roundingType) : "up",
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
  const maxSequence = rows.reduce((max, row) => Math.max(max, getNumericSequenceFromCode(row.code)), 0);
  return `PRC-${String(maxSequence + 1).padStart(3, "0")}`;
};

router.get("/generate-code", requireLocalAuth, async (_req, res, next) => {
  try {
    const db = await getDb();
    const code = await generateNextCode(db);
    return success(res, "Kode pricing rule SQLite berhasil dibuat", { code });
  } catch (error) {
    return next(error);
  }
});

router.get("/", requireLocalAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const targetType = normalizeText(req.query.targetType || "");
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

    return success(res, "Data pricing rule SQLite berhasil dimuat", rows.map(toPricingRuleRecord));
  } catch (error) {
    return next(error);
  }
});


router.get("/:id", requireLocalAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const row = await db.get(
      "SELECT * FROM pricing_rules WHERE id = ? AND status != 'deleted'",
      [req.params.id]
    );

    if (!row) {
      return failure(res, "Pricing rule SQLite tidak ditemukan.", "NOT_FOUND", 404);
    }

    return success(res, "Pricing rule SQLite berhasil dimuat", toPricingRuleRecord(row));
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const code = normalizeText(req.body?.code || "") || await generateNextCode(db);
    const payload = normalizeRulePayload({ ...req.body, code });

    if (!payload.name) {
      return failure(res, "Nama pricing rule wajib diisi.", "VALIDATION_ERROR", 400);
    }

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
      actor: req.localAuth.user.username,
      description: `Pricing rule ${payload.name} dibuat di SQLite local`,
      metadata: { code, targetType: payload.targetType },
    });

    const row = await db.get("SELECT * FROM pricing_rules WHERE id = ?", [payload.id]);
    return success(res, "Pricing rule berhasil ditambahkan ke SQLite local", toPricingRuleRecord(row), undefined, 201);
  } catch (error) {
    if (String(error?.message || "").includes("UNIQUE")) {
      return failure(res, "Kode/ID pricing rule sudah ada di SQLite.", "DUPLICATE_CODE", 409);
    }
    return next(error);
  }
});

router.put("/:id", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const current = await db.get("SELECT * FROM pricing_rules WHERE id = ? AND status != 'deleted'", [req.params.id]);

    if (!current) {
      return failure(res, "Pricing rule SQLite tidak ditemukan.", "NOT_FOUND", 404);
    }

    const currentPayload = toPricingRuleRecord(current);
    const payload = normalizeRulePayload({ ...currentPayload, ...req.body, id: current.id, code: current.code }, currentPayload);

    if (!payload.name) {
      return failure(res, "Nama pricing rule wajib diisi.", "VALIDATION_ERROR", 400);
    }

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
      actor: req.localAuth.user.username,
      description: `Pricing rule ${payload.name} diubah di SQLite local`,
      metadata: { code: current.code, targetType: payload.targetType },
    });

    const row = await db.get("SELECT * FROM pricing_rules WHERE id = ?", [current.id]);
    return success(res, "Pricing rule SQLite berhasil diubah", toPricingRuleRecord(row));
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const current = await db.get("SELECT * FROM pricing_rules WHERE id = ? AND status != 'deleted'", [req.params.id]);

    if (!current) {
      return failure(res, "Pricing rule SQLite tidak ditemukan.", "NOT_FOUND", 404);
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
      actor: req.localAuth.user.username,
      description: `Pricing rule ${current.name} dinonaktifkan di SQLite local`,
      metadata: { code: current.code, targetType: current.target_type },
    });

    return success(res, "Pricing rule SQLite berhasil dihapus", { id: current.id, deleted: true, softDeleted: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
