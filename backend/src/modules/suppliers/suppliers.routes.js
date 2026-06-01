const express = require("express");
const { getDb } = require("../../db/connection");
const { createAuditLog } = require("../../utils/auditLog");
const { failure, success } = require("../../utils/response");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");

const router = express.Router();

const SUPPLIER_CODE_PREFIX = "SUP";
const SUPPLIER_CODE_PATTERN = /^SUP-\d{8}-\d{3,}$/;

const normalizeText = (value) => String(value || "").trim();
const normalizeCode = (value) => normalizeText(value).toUpperCase();

const getDateStamp = (date = new Date()) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}${month}${year}`;
};

const buildSupplierCode = (sequence = 1, date = new Date()) =>
  `${SUPPLIER_CODE_PREFIX}-${getDateStamp(date)}-${String(sequence).padStart(3, "0")}`;

const getSupplierSequence = (code = "", date = new Date()) => {
  const normalizedCode = normalizeCode(code);
  const expectedPrefix = `${SUPPLIER_CODE_PREFIX}-${getDateStamp(date)}-`;
  if (!normalizedCode.startsWith(expectedPrefix)) return 0;

  const sequence = Number(normalizedCode.slice(expectedPrefix.length));
  return Number.isFinite(sequence) ? sequence : 0;
};

const toSupplierRecord = (row = {}) => ({
  id: row.id,
  code: row.supplier_code || "",
  supplierCode: row.supplier_code || "",
  name: row.name || "",
  storeName: row.name || "",
  storeLink: row.store_link || "",
  link: row.store_link || "",
  contact: row.phone || "",
  phone: row.phone || "",
  address: row.address || "",
  note: row.notes || "",
  notes: row.notes || "",
  status: row.status || "active",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildSupplierPayload = (body = {}) => ({
  supplierCode: normalizeCode(body.code || body.supplierCode || body.supplier_code),
  name: normalizeText(body.name || body.storeName || body.supplierName),
  storeLink: normalizeText(body.storeLink || body.link || body.url || body.shopLink),
  phone: normalizeText(body.contact || body.phone),
  address: normalizeText(body.address),
  notes: normalizeText(body.note || body.notes || body.description),
});

const ensureSupplierCodeAvailable = async (db, code, excludeId = null) => {
  if (!code) return;

  const existing = await db.get(
    "SELECT id FROM suppliers WHERE supplier_code = ? AND id != ? AND status != 'deleted'",
    [code, excludeId || 0]
  );

  if (existing) {
    const error = new Error("Kode supplier sudah digunakan di SQLite.");
    error.code = "DUPLICATE_CODE";
    throw error;
  }
};

const generateNextSupplierCode = async (db) => {
  const rows = await db.all(
    "SELECT supplier_code FROM suppliers WHERE supplier_code LIKE ?",
    [`${SUPPLIER_CODE_PREFIX}-${getDateStamp()}-%`]
  );
  const maxSequence = rows.reduce(
    (max, row) => Math.max(max, getSupplierSequence(row.supplier_code)),
    0
  );
  return buildSupplierCode(maxSequence + 1);
};

router.get("/generate-code", async (req, res, next) => {
  try {
    const db = await getDb();
    const code = await generateNextSupplierCode(db);
    return success(res, "Kode supplier SQLite berhasil dibuat", { code, supplierCode: code });
  } catch (error) {
    return next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const db = await getDb();
    const rows = await db.all(
      "SELECT * FROM suppliers WHERE status != 'deleted' ORDER BY name ASC, id DESC LIMIT 500"
    );
    return success(res, "Data supplier SQLite berhasil dimuat", rows.map(toSupplierRecord));
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const db = await getDb();
    const row = await db.get(
      "SELECT * FROM suppliers WHERE id = ? AND status != 'deleted'",
      [req.params.id]
    );

    if (!row) return failure(res, "Supplier SQLite tidak ditemukan", "NOT_FOUND", 404);
    return success(res, "Detail supplier SQLite berhasil dimuat", toSupplierRecord(row));
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const payload = buildSupplierPayload(req.body);

    if (!payload.name) {
      return failure(res, "Nama supplier wajib diisi", "VALIDATION_ERROR", 400);
    }

    const finalCode = payload.supplierCode || await generateNextSupplierCode(db);
    if (!SUPPLIER_CODE_PATTERN.test(finalCode)) {
      return failure(res, "Kode supplier SQLite belum valid", "VALIDATION_ERROR", 400);
    }

    await ensureSupplierCodeAvailable(db, finalCode);

    const result = await db.run(
      `
        INSERT INTO suppliers (supplier_code, name, store_link, phone, address, notes, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [finalCode, payload.name, payload.storeLink, payload.phone, payload.address, payload.notes]
    );

    const supplier = await db.get("SELECT * FROM suppliers WHERE id = ?", [result.lastID]);

    await createAuditLog({
      module: "suppliers",
      action: "create",
      entityType: "supplier",
      entityId: result.lastID,
      actor: req.localAuth.user.username,
      description: `Supplier ${payload.name} dibuat di SQLite local`,
      metadata: { supplierCode: finalCode, name: payload.name, storeLink: payload.storeLink },
    });

    return success(res, "Supplier berhasil ditambahkan ke SQLite local", toSupplierRecord(supplier), undefined, 201);
  } catch (error) {
    if (error?.code === "DUPLICATE_CODE" || String(error?.message || "").includes("UNIQUE")) {
      return failure(res, "Kode supplier sudah ada di SQLite local", "DUPLICATE_CODE", 409);
    }
    return next(error);
  }
});

router.put("/:id", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const current = await db.get(
      "SELECT * FROM suppliers WHERE id = ? AND status != 'deleted'",
      [req.params.id]
    );

    if (!current) return failure(res, "Supplier SQLite tidak ditemukan", "NOT_FOUND", 404);

    const payload = buildSupplierPayload(req.body);
    const immutableCode = normalizeCode(payload.supplierCode || current.supplier_code);

    if (!payload.name) {
      return failure(res, "Nama supplier wajib diisi", "VALIDATION_ERROR", 400);
    }

    await ensureSupplierCodeAvailable(db, immutableCode, current.id);

    await db.run(
      `
        UPDATE suppliers
        SET supplier_code = ?, name = ?, store_link = ?, phone = ?, address = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [immutableCode, payload.name, payload.storeLink, payload.phone, payload.address, payload.notes, current.id]
    );

    const updated = await db.get("SELECT * FROM suppliers WHERE id = ?", [current.id]);

    await createAuditLog({
      module: "suppliers",
      action: "update",
      entityType: "supplier",
      entityId: current.id,
      actor: req.localAuth.user.username,
      description: `Supplier ${payload.name} diubah di SQLite local`,
      metadata: { supplierCode: immutableCode, name: payload.name, storeLink: payload.storeLink },
    });

    return success(res, "Supplier SQLite berhasil diubah", toSupplierRecord(updated));
  } catch (error) {
    if (error?.code === "DUPLICATE_CODE" || String(error?.message || "").includes("UNIQUE")) {
      return failure(res, "Kode supplier sudah ada di SQLite local", "DUPLICATE_CODE", 409);
    }
    return next(error);
  }
});

router.delete("/:id", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const current = await db.get(
      "SELECT * FROM suppliers WHERE id = ? AND status != 'deleted'",
      [req.params.id]
    );

    if (!current) return failure(res, "Supplier SQLite tidak ditemukan", "NOT_FOUND", 404);

    await db.run(
      "UPDATE suppliers SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [current.id]
    );

    await createAuditLog({
      module: "suppliers",
      action: "soft_delete",
      entityType: "supplier",
      entityId: current.id,
      actor: req.localAuth.user.username,
      description: `Supplier ${current.name} dinonaktifkan di SQLite local`,
      metadata: { supplierCode: current.supplier_code, name: current.name },
    });

    return success(res, "Supplier SQLite berhasil dinonaktifkan", {
      id: current.id,
      deleted: true,
      softDeleted: true,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
