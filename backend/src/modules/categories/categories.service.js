const { getDb, runInTransaction } = require("../../db/connection");
const { createAuditLog } = require("../../utils/auditLog");

const normalizeText = (value) => (value || "").toString().trim();
const normalizeCode = (value) => normalizeText(value).toUpperCase();

const createServiceError = (message, code = "ERROR", statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.isServiceError = true;
  return error;
};

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
    "SELECT id FROM categories WHERE code = ? AND id != ?",
    [code, excludeId || 0]
  );

  if (existing) {
    throw createServiceError(
      "Kode kategori sudah digunakan di database lokal.",
      "DUPLICATE_CODE",
      409
    );
  }
};

const listCategories = async () => {
  const db = await getDb();
  const rows = await db.all(
    "SELECT * FROM categories WHERE status != 'deleted' ORDER BY name ASC, id DESC LIMIT 500"
  );
  return rows.map(toCategoryRecord);
};

const getCategoryById = async (id) => {
  const db = await getDb();
  const row = await db.get(
    "SELECT * FROM categories WHERE id = ? AND status != 'deleted'",
    [id]
  );
  return row ? toCategoryRecord(row) : null;
};

const createCategory = async (body = {}, actor = "system") => runInTransaction(async (db) => {
  const payload = buildCategoryPayload(body);

  if (!payload.name) {
    throw createServiceError("Nama kategori wajib diisi", "VALIDATION_ERROR", 400);
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
    actor,
    description: `Kategori ${payload.name} dibuat di database lokal`,
    metadata: { code: payload.code, name: payload.name, type: payload.type },
  });

  return toCategoryRecord(category);
});

const updateCategory = async (id, body = {}, actor = "system") => runInTransaction(async (db) => {
  const current = await db.get(
    "SELECT * FROM categories WHERE id = ? AND status != 'deleted'",
    [id]
  );

  if (!current) {
    throw createServiceError("Kategori database lokal tidak ditemukan", "NOT_FOUND", 404);
  }

  const payload = buildCategoryPayload(body);
  const immutableCode = normalizeCode(payload.code || current.code);

  if (!payload.name) {
    throw createServiceError("Nama kategori wajib diisi", "VALIDATION_ERROR", 400);
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
    actor,
    description: `Kategori ${payload.name} diubah di database lokal`,
    metadata: { code: immutableCode, name: payload.name, type: payload.type },
  });

  return toCategoryRecord(updated);
});

const softDeleteCategory = async (id, actor = "system") => runInTransaction(async (db) => {
  const current = await db.get(
    "SELECT * FROM categories WHERE id = ? AND status != 'deleted'",
    [id]
  );

  if (!current) {
    throw createServiceError("Kategori database lokal tidak ditemukan", "NOT_FOUND", 404);
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
    actor,
    description: `Kategori ${current.name} dinonaktifkan di database lokal`,
    metadata: { code: current.code, name: current.name },
  });

  return {
    id: current.id,
    deleted: true,
    softDeleted: true,
  };
});

module.exports = {
  createCategory,
  getCategoryById,
  listCategories,
  softDeleteCategory,
  updateCategory,
};
