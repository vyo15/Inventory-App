const { getDb } = require("../../db/connection");
const { createAuditLog } = require("../../utils/auditLog");
const { safeJsonParse } = require("../../utils/jsonUtils");

const SUPPLIER_CODE_PREFIX = "SUP";
const SUPPLIER_CODE_PATTERN = /^SUP-\d{8}-\d{3,}$/;

const normalizeText = (value) => String(value || "").trim();
const normalizeCode = (value) => normalizeText(value).toUpperCase();

const createServiceError = (message, code = "ERROR", statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.isServiceError = true;
  return error;
};

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

const toSupplierRecord = (row = {}) => {
  const payload = safeJsonParse(row.payload_json, {});
  return {
    ...payload,
    id: row.id,
    code: row.supplier_code || payload.code || "",
    supplierCode: row.supplier_code || payload.supplierCode || "",
    name: row.name || payload.name || "",
    storeName: row.name || payload.storeName || "",
    storeLink: row.store_link || payload.storeLink || "",
    link: row.store_link || payload.link || "",
    contact: row.phone || payload.contact || "",
    phone: row.phone || payload.phone || "",
    address: row.address || payload.address || "",
    note: row.notes || payload.note || "",
    notes: row.notes || payload.notes || "",
    materialDetails: Array.isArray(payload.materialDetails) ? payload.materialDetails : [],
    supportedMaterialIds: Array.isArray(payload.supportedMaterialIds)
      ? payload.supportedMaterialIds
      : [],
    supportedMaterialNames: Array.isArray(payload.supportedMaterialNames)
      ? payload.supportedMaterialNames
      : [],
    status: row.status || payload.status || "active",
    createdAt: row.created_at || payload.createdAt,
    updatedAt: row.updated_at || payload.updatedAt,
  };
};

const buildSupplierPayload = (body = {}) => ({
  supplierCode: normalizeCode(body.code || body.supplierCode || body.supplier_code),
  name: normalizeText(body.name || body.storeName || body.supplierName),
  storeLink: normalizeText(body.storeLink || body.link || body.url || body.shopLink),
  phone: normalizeText(body.contact || body.phone),
  address: normalizeText(body.address),
  notes: normalizeText(body.note || body.notes || body.description),
  payload: {
    ...body,
    materialDetails: Array.isArray(body.materialDetails) ? body.materialDetails : [],
    supportedMaterialIds: Array.isArray(body.supportedMaterialIds)
      ? body.supportedMaterialIds
      : [],
    supportedMaterialNames: Array.isArray(body.supportedMaterialNames)
      ? body.supportedMaterialNames
      : [],
  },
});

const ensureSupplierCodeAvailable = async (db, code, excludeId = null) => {
  if (!code) return;

  const existing = await db.get(
    "SELECT id FROM suppliers WHERE supplier_code = ? AND id != ? AND status != 'deleted'",
    [code, excludeId || 0]
  );

  if (existing) {
    throw createServiceError(
      "Kode supplier sudah digunakan di database lokal.",
      "DUPLICATE_CODE",
      409
    );
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

const generateSupplierCode = async () => {
  const db = await getDb();
  return generateNextSupplierCode(db);
};

const listSuppliers = async () => {
  const db = await getDb();
  const rows = await db.all(
    "SELECT * FROM suppliers WHERE status != 'deleted' ORDER BY name ASC, id DESC LIMIT 500"
  );
  return rows.map(toSupplierRecord);
};

const getSupplierById = async (id) => {
  const db = await getDb();
  const row = await db.get(
    "SELECT * FROM suppliers WHERE id = ? AND status != 'deleted'",
    [id]
  );
  return row ? toSupplierRecord(row) : null;
};

const validateSupplierPayload = (payload) => {
  if (!payload.name) {
    throw createServiceError("Nama supplier wajib diisi", "VALIDATION_ERROR", 400);
  }
};

const validateSupplierCode = (code) => {
  if (!SUPPLIER_CODE_PATTERN.test(code)) {
    throw createServiceError(
      "Kode supplier database lokal belum valid",
      "VALIDATION_ERROR",
      400
    );
  }
};

const createSupplier = async (body = {}, actor = "system") => {
  const db = await getDb();
  const payload = buildSupplierPayload(body);

  validateSupplierPayload(payload);

  const finalCode = payload.supplierCode || await generateNextSupplierCode(db);

  validateSupplierCode(finalCode);
  await ensureSupplierCodeAvailable(db, finalCode);

  const result = await db.run(
    `
      INSERT INTO suppliers (supplier_code, name, store_link, phone, address, notes, payload_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [
      finalCode,
      payload.name,
      payload.storeLink,
      payload.phone,
      payload.address,
      payload.notes,
      JSON.stringify(payload.payload),
    ]
  );

  const supplier = await db.get("SELECT * FROM suppliers WHERE id = ?", [result.lastID]);

  await createAuditLog({
    module: "suppliers",
    action: "create",
    entityType: "supplier",
    entityId: result.lastID,
    actor,
    description: `Supplier ${payload.name} dibuat di database lokal`,
    metadata: { supplierCode: finalCode, name: payload.name, storeLink: payload.storeLink },
  });

  return toSupplierRecord(supplier);
};

const updateSupplier = async (id, body = {}, actor = "system") => {
  const db = await getDb();
  const current = await db.get(
    "SELECT * FROM suppliers WHERE id = ? AND status != 'deleted'",
    [id]
  );

  if (!current) {
    throw createServiceError("Supplier database lokal tidak ditemukan", "NOT_FOUND", 404);
  }

  const payload = buildSupplierPayload(body);
  const immutableCode = normalizeCode(payload.supplierCode || current.supplier_code);

  validateSupplierPayload(payload);
  await ensureSupplierCodeAvailable(db, immutableCode, current.id);

  await db.run(
    `
      UPDATE suppliers
      SET supplier_code = ?, name = ?, store_link = ?, phone = ?, address = ?, notes = ?, payload_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [
      immutableCode,
      payload.name,
      payload.storeLink,
      payload.phone,
      payload.address,
      payload.notes,
      JSON.stringify(payload.payload),
      current.id,
    ]
  );

  const updated = await db.get("SELECT * FROM suppliers WHERE id = ?", [current.id]);

  await createAuditLog({
    module: "suppliers",
    action: "update",
    entityType: "supplier",
    entityId: current.id,
    actor,
    description: `Supplier ${payload.name} diubah di database lokal`,
    metadata: { supplierCode: immutableCode, name: payload.name, storeLink: payload.storeLink },
  });

  return toSupplierRecord(updated);
};

const softDeleteSupplier = async (id, actor = "system") => {
  const db = await getDb();
  const current = await db.get(
    "SELECT * FROM suppliers WHERE id = ? AND status != 'deleted'",
    [id]
  );

  if (!current) {
    throw createServiceError("Supplier database lokal tidak ditemukan", "NOT_FOUND", 404);
  }

  await db.run(
    "UPDATE suppliers SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [current.id]
  );

  await createAuditLog({
    module: "suppliers",
    action: "soft_delete",
    entityType: "supplier",
    entityId: current.id,
    actor,
    description: `Supplier ${current.name} dinonaktifkan di database lokal`,
    metadata: { supplierCode: current.supplier_code, name: current.name },
  });

  return {
    id: current.id,
    deleted: true,
    softDeleted: true,
  };
};

module.exports = {
  createSupplier,
  generateSupplierCode,
  getSupplierById,
  listSuppliers,
  softDeleteSupplier,
  updateSupplier,
};
