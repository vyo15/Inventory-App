const express = require("express");
const { getDb } = require("../../db/connection");
const { createAuditLog } = require("../../utils/auditLog");
const { failure, success } = require("../../utils/response");

const router = express.Router();

const CUSTOMER_CODE_PREFIX = "CUS";
const CUSTOMER_CODE_PATTERN = /^CUS-\d{8}-\d{3,}$/;

const normalizeText = (value) => (value || "").toString().trim();
const normalizeCode = (value) => normalizeText(value).toUpperCase();

const getDateStamp = (date = new Date()) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}${month}${year}`;
};

const buildCustomerCode = (sequence = 1, date = new Date()) =>
  `${CUSTOMER_CODE_PREFIX}-${getDateStamp(date)}-${String(sequence).padStart(3, "0")}`;

const getCustomerSequence = (code = "", date = new Date()) => {
  const normalizedCode = normalizeCode(code);
  const expectedPrefix = `${CUSTOMER_CODE_PREFIX}-${getDateStamp(date)}-`;
  if (!normalizedCode.startsWith(expectedPrefix)) return 0;

  const sequence = Number(normalizedCode.slice(expectedPrefix.length));
  return Number.isFinite(sequence) ? sequence : 0;
};

const toCustomerRecord = (row = {}) => ({
  id: row.id,
  code: row.customer_code || "",
  customerCode: row.customer_code || "",
  name: row.name || "",
  contact: row.phone || "",
  phone: row.phone || "",
  address: row.address || "",
  note: row.notes || "",
  notes: row.notes || "",
  status: row.status || "active",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildCustomerPayload = (body = {}) => {
  const code = normalizeCode(body.code || body.customerCode || body.customer_code);

  return {
    customerCode: code,
    name: normalizeText(body.name),
    phone: normalizeText(body.contact || body.phone),
    address: normalizeText(body.address),
    notes: normalizeText(body.note || body.notes),
  };
};

const ensureCustomerCodeAvailable = async (db, code, excludeId = null) => {
  if (!code) return;

  const existing = await db.get(
    "SELECT id FROM customers WHERE customer_code = ? AND id != ? AND status != 'deleted'",
    [code, excludeId || 0]
  );

  if (existing) {
    const error = new Error("Kode customer sudah digunakan di SQLite.");
    error.code = "DUPLICATE_CODE";
    throw error;
  }
};

const generateNextCustomerCode = async (db) => {
  const rows = await db.all(
    "SELECT customer_code FROM customers WHERE customer_code LIKE ?",
    [`${CUSTOMER_CODE_PREFIX}-${getDateStamp()}-%`]
  );
  const maxSequence = rows.reduce(
    (max, row) => Math.max(max, getCustomerSequence(row.customer_code)),
    0
  );
  return buildCustomerCode(maxSequence + 1);
};

router.get("/generate-code", async (req, res, next) => {
  try {
    const db = await getDb();
    const code = await generateNextCustomerCode(db);
    return success(res, "Kode customer SQLite berhasil dibuat", { code, customerCode: code });
  } catch (error) {
    return next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const db = await getDb();
    const rows = await db.all(
      "SELECT * FROM customers WHERE status != 'deleted' ORDER BY name ASC, id DESC LIMIT 500"
    );
    return success(res, "Data customer SQLite berhasil dimuat", rows.map(toCustomerRecord));
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const db = await getDb();
    const row = await db.get(
      "SELECT * FROM customers WHERE id = ? AND status != 'deleted'",
      [req.params.id]
    );

    if (!row) {
      return failure(res, "Customer SQLite tidak ditemukan", "NOT_FOUND", 404);
    }

    return success(res, "Detail customer SQLite berhasil dimuat", toCustomerRecord(row));
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const db = await getDb();
    const payload = buildCustomerPayload(req.body);

    if (!payload.name) {
      return failure(res, "Nama customer wajib diisi", "VALIDATION_ERROR", 400);
    }

    if (!payload.phone) {
      return failure(res, "Kontak customer wajib diisi", "VALIDATION_ERROR", 400);
    }

    const finalCode = payload.customerCode || await generateNextCustomerCode(db);

    if (!CUSTOMER_CODE_PATTERN.test(finalCode)) {
      return failure(res, "Kode customer SQLite belum valid", "VALIDATION_ERROR", 400);
    }

    await ensureCustomerCodeAvailable(db, finalCode);

    const result = await db.run(
      `
        INSERT INTO customers (customer_code, name, phone, address, notes, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [finalCode, payload.name, payload.phone, payload.address, payload.notes]
    );

    const customer = await db.get("SELECT * FROM customers WHERE id = ?", [result.lastID]);

    await createAuditLog({
      module: "customers",
      action: "create",
      entityType: "customer",
      entityId: result.lastID,
      description: `Customer ${payload.name} dibuat di SQLite local`,
      metadata: { customerCode: finalCode, name: payload.name, phone: payload.phone, address: payload.address },
    });

    return success(res, "Customer berhasil ditambahkan ke SQLite local", toCustomerRecord(customer), undefined, 201);
  } catch (error) {
    if (error?.code === "DUPLICATE_CODE" || String(error?.message || "").includes("UNIQUE")) {
      return failure(res, "Kode customer sudah ada di SQLite local", "DUPLICATE_CODE", 409);
    }
    return next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const db = await getDb();
    const current = await db.get(
      "SELECT * FROM customers WHERE id = ? AND status != 'deleted'",
      [req.params.id]
    );

    if (!current) {
      return failure(res, "Customer SQLite tidak ditemukan", "NOT_FOUND", 404);
    }

    const payload = buildCustomerPayload(req.body);
    const immutableCode = normalizeCode(payload.customerCode || current.customer_code);

    if (!payload.name) {
      return failure(res, "Nama customer wajib diisi", "VALIDATION_ERROR", 400);
    }

    if (!payload.phone) {
      return failure(res, "Kontak customer wajib diisi", "VALIDATION_ERROR", 400);
    }

    if (!CUSTOMER_CODE_PATTERN.test(immutableCode)) {
      return failure(res, "Kode customer SQLite belum valid", "VALIDATION_ERROR", 400);
    }

    await ensureCustomerCodeAvailable(db, immutableCode, current.id);

    await db.run(
      `
        UPDATE customers
        SET customer_code = ?, name = ?, phone = ?, address = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [immutableCode, payload.name, payload.phone, payload.address, payload.notes, current.id]
    );

    const updated = await db.get("SELECT * FROM customers WHERE id = ?", [current.id]);

    await createAuditLog({
      module: "customers",
      action: "update",
      entityType: "customer",
      entityId: current.id,
      description: `Customer ${payload.name} diubah di SQLite local`,
      metadata: { customerCode: immutableCode, name: payload.name, phone: payload.phone },
    });

    return success(res, "Customer SQLite berhasil diubah", toCustomerRecord(updated));
  } catch (error) {
    if (error?.code === "DUPLICATE_CODE" || String(error?.message || "").includes("UNIQUE")) {
      return failure(res, "Kode customer sudah ada di SQLite local", "DUPLICATE_CODE", 409);
    }
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const db = await getDb();
    const current = await db.get(
      "SELECT * FROM customers WHERE id = ? AND status != 'deleted'",
      [req.params.id]
    );

    if (!current) {
      return failure(res, "Customer SQLite tidak ditemukan", "NOT_FOUND", 404);
    }

    await db.run(
      "UPDATE customers SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [current.id]
    );

    await createAuditLog({
      module: "customers",
      action: "soft_delete",
      entityType: "customer",
      entityId: current.id,
      description: `Customer ${current.name} dinonaktifkan di SQLite local`,
      metadata: { customerCode: current.customer_code, name: current.name },
    });

    return success(res, "Customer SQLite berhasil dinonaktifkan", {
      id: current.id,
      deleted: true,
      softDeleted: true,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
