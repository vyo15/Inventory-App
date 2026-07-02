const { normalizeTruthyText: normalizeText, normalizeUpperText } = require("../../utils/textNormalization");
const { createServiceError } = require("../../utils/httpError");
const { getDb, runInTransaction } = require("../../db/connection");
const businessCodeContract = require("../../../../shared/businessCodeContract.json");
const { createAuditLog } = require("../../utils/auditLog");
const {
  formatBusinessDateStamp,
  getBusinessCodePreview,
  resolveBusinessCode,
} = require("../../utils/businessCodeCounter");

const CUSTOMER_CODE_PREFIX = businessCodeContract.customer.prefix;
const CUSTOMER_CODE_PATTERN = new RegExp(businessCodeContract.customer.pattern);






const getCustomerCounterOptions = (dateStamp = formatBusinessDateStamp()) => ({
  counterKey: `customers:${CUSTOMER_CODE_PREFIX}:${dateStamp}`,
  prefix: `${CUSTOMER_CODE_PREFIX}-${dateStamp}`,
  tableName: "customers",
  columnName: "customer_code",
  minWidth: 3,
  notes: "Runtime counter customer per tanggal",
});

const generateNextCustomerCode = (db) => getBusinessCodePreview(
  db,
  getCustomerCounterOptions(),
);

const resolveCustomerCreateCode = async (db, requestedCode = "") => {
  const normalizedCode = normalizeUpperText(requestedCode);
  if (!normalizedCode) {
    return resolveBusinessCode(db, "", getCustomerCounterOptions());
  }

  validateCustomerCode(normalizedCode);
  const dateStamp = normalizedCode.split("-")[1];
  return resolveBusinessCode(
    db,
    normalizedCode,
    getCustomerCounterOptions(dateStamp),
  );
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
  const code = normalizeUpperText(body.code || body.customerCode || body.customer_code);

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
    "SELECT id FROM customers WHERE customer_code = ? AND id != ?",
    [code, excludeId || 0]
  );

  if (existing) {
    throw createServiceError(
      "Kode customer sudah digunakan di database lokal.",
      "DUPLICATE_CODE",
      409
    );
  }
};

const generateCustomerCode = async () => {
  const db = await getDb();
  return generateNextCustomerCode(db);
};

const listCustomers = async () => {
  const db = await getDb();
  const rows = await db.all(
    "SELECT * FROM customers WHERE status != 'deleted' ORDER BY name ASC, id DESC LIMIT 500"
  );
  return rows.map(toCustomerRecord);
};

const getCustomerById = async (id) => {
  const db = await getDb();
  const row = await db.get(
    "SELECT * FROM customers WHERE id = ? AND status != 'deleted'",
    [id]
  );
  return row ? toCustomerRecord(row) : null;
};

const validateCustomerPayload = (payload) => {
  if (!payload.name) {
    throw createServiceError("Nama customer wajib diisi", "VALIDATION_ERROR", 400);
  }

  if (!payload.phone) {
    throw createServiceError("Kontak customer wajib diisi", "VALIDATION_ERROR", 400);
  }
};

const validateCustomerCode = (code) => {
  if (!CUSTOMER_CODE_PATTERN.test(code)) {
    throw createServiceError("Kode customer database lokal belum valid", "VALIDATION_ERROR", 400);
  }
};

const createCustomer = async (body = {}, actor = "system") => runInTransaction(async (db) => {
  const payload = buildCustomerPayload(body);

  validateCustomerPayload(payload);

  const finalCode = await resolveCustomerCreateCode(db, payload.customerCode);

  validateCustomerCode(finalCode);
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
    actor,
    description: `Customer ${payload.name} dibuat di database lokal`,
    metadata: {
      customerCode: finalCode,
      name: payload.name,
      phone: payload.phone,
      address: payload.address,
    },
  });

  return toCustomerRecord(customer);
});

const updateCustomer = async (id, body = {}, actor = "system") => runInTransaction(async (db) => {
  const current = await db.get(
    "SELECT * FROM customers WHERE id = ? AND status != 'deleted'",
    [id]
  );

  if (!current) {
    throw createServiceError("Customer database lokal tidak ditemukan", "NOT_FOUND", 404);
  }

  const payload = buildCustomerPayload(body);
  const immutableCode = normalizeUpperText(payload.customerCode || current.customer_code);

  validateCustomerPayload(payload);
  validateCustomerCode(immutableCode);
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
    actor,
    description: `Customer ${payload.name} diubah di database lokal`,
    metadata: { customerCode: immutableCode, name: payload.name, phone: payload.phone },
  });

  return toCustomerRecord(updated);
});

const softDeleteCustomer = async (id, actor = "system") => runInTransaction(async (db) => {
  const current = await db.get(
    "SELECT * FROM customers WHERE id = ? AND status != 'deleted'",
    [id]
  );

  if (!current) {
    throw createServiceError("Customer database lokal tidak ditemukan", "NOT_FOUND", 404);
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
    actor,
    description: `Customer ${current.name} dinonaktifkan di database lokal`,
    metadata: { customerCode: current.customer_code, name: current.name },
  });

  return {
    id: current.id,
    deleted: true,
    softDeleted: true,
  };
});

module.exports = {
  createCustomer,
  generateCustomerCode,
  getCustomerById,
  listCustomers,
  softDeleteCustomer,
  updateCustomer,
};
