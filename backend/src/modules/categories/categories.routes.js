const express = require("express");
const { getDb } = require("../../db/connection");
const { createAuditLog } = require("../../utils/auditLog");
const { failure, success } = require("../../utils/response");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");

const router = express.Router();

const normalizeText = (value) => (value || "").toString().trim();
const normalizeCode = (value) => normalizeText(value).toUpperCase();

const toCategoryRecord = (row = {}) => ({
  id: row.id,
  code: row.code || "",
  name: row.name || "",
  description: row.notes || "",
  notes: row.notes || "",
  type: row.type || "general",
  status: row.status || "active",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildCategoryPayload = (body = {}) => ({
  code: normalizeCode(body.code),
  name: normalizeText(body.name),
  type: normalizeText(body.type) || "general",
  notes: normalizeText(body.description || body.notes),
});

const ensureCategoryCodeAvailable = async (db, code, excludeId = null) => {
  if (!code) return;

  const existing = await db.get(
    "SELECT id FROM categories WHERE code = ? AND id != ? AND status != 'deleted'",
    [code, excludeId || 0]
  );

  if (existing) {
    const error = new Error("Kode kategori sudah digunakan di database lokal.");
    error.code = "DUPLICATE_CODE";
    throw error;
  }
};

router.get("/", requireLocalAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const rows = await db.all(
      "SELECT * FROM categories WHERE status != 'deleted' ORDER BY name ASC, id DESC LIMIT 500"
    );
    return success(res, "Data kategori database lokal berhasil dimuat", rows.map(toCategoryRecord));
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", requireLocalAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    const row = await db.get(
      "SELECT * FROM categories WHERE id = ? AND status != 'deleted'",
      [req.params.id]
    );

    if (!row) {
      return failure(res, "Kategori database lokal tidak ditemukan", "NOT_FOUND", 404);
    }

    return success(res, "Detail kategori database lokal berhasil dimuat", toCategoryRecord(row));
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const payload = buildCategoryPayload(req.body);

    if (!payload.name) {
      return failure(res, "Nama kategori wajib diisi", "VALIDATION_ERROR", 400);
    }

    await ensureCategoryCodeAvailable(db, payload.code);

    const result = await db.run(
      `
        INSERT INTO categories (code, name, type, notes, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [payload.code || null, payload.name, payload.type, payload.notes]
    );

    const category = await db.get("SELECT * FROM categories WHERE id = ?", [result.lastID]);

    await createAuditLog({
      module: "categories",
      action: "create",
      entityType: "category",
      entityId: result.lastID,
      actor: req.localAuth.user.username,
      description: `Kategori ${payload.name} dibuat di database lokal`,
      metadata: { code: payload.code, name: payload.name, type: payload.type },
    });

    return success(res, "Kategori berhasil ditambahkan ke database lokal", toCategoryRecord(category), undefined, 201);
  } catch (error) {
    if (error?.code === "DUPLICATE_CODE" || String(error?.message || "").includes("UNIQUE")) {
      return failure(res, "Kode kategori sudah ada di database lokal", "DUPLICATE_CODE", 409);
    }
    return next(error);
  }
});

router.put("/:id", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const current = await db.get(
      "SELECT * FROM categories WHERE id = ? AND status != 'deleted'",
      [req.params.id]
    );

    if (!current) {
      return failure(res, "Kategori database lokal tidak ditemukan", "NOT_FOUND", 404);
    }

    const payload = buildCategoryPayload(req.body);
    const immutableCode = normalizeCode(payload.code || current.code);

    if (!payload.name) {
      return failure(res, "Nama kategori wajib diisi", "VALIDATION_ERROR", 400);
    }

    await ensureCategoryCodeAvailable(db, immutableCode, current.id);

    await db.run(
      `
        UPDATE categories
        SET code = ?, name = ?, type = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [immutableCode || null, payload.name, payload.type, payload.notes, current.id]
    );

    const updated = await db.get("SELECT * FROM categories WHERE id = ?", [current.id]);

    await createAuditLog({
      module: "categories",
      action: "update",
      entityType: "category",
      entityId: current.id,
      actor: req.localAuth.user.username,
      description: `Kategori ${payload.name} diubah di database lokal`,
      metadata: { code: immutableCode, name: payload.name, type: payload.type },
    });

    return success(res, "Kategori database lokal berhasil diubah", toCategoryRecord(updated));
  } catch (error) {
    if (error?.code === "DUPLICATE_CODE" || String(error?.message || "").includes("UNIQUE")) {
      return failure(res, "Kode kategori sudah ada di database lokal", "DUPLICATE_CODE", 409);
    }
    return next(error);
  }
});

router.delete("/:id", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const current = await db.get(
      "SELECT * FROM categories WHERE id = ? AND status != 'deleted'",
      [req.params.id]
    );

    if (!current) {
      return failure(res, "Kategori database lokal tidak ditemukan", "NOT_FOUND", 404);
    }

    await db.run(
      "UPDATE categories SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [current.id]
    );

    await createAuditLog({
      module: "categories",
      action: "soft_delete",
      entityType: "category",
      entityId: current.id,
      actor: req.localAuth.user.username,
      description: `Kategori ${current.name} dinonaktifkan di database lokal`,
      metadata: { code: current.code, name: current.name },
    });

    return success(res, "Kategori database lokal berhasil dinonaktifkan", {
      id: current.id,
      deleted: true,
      softDeleted: true,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
