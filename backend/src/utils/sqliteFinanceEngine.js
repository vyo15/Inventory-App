const crypto = require("crypto");
const { createAuditLog } = require("./auditLog");

const toInteger = (value = 0) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

const normalizeText = (value = "") => String(value ?? "").trim();
const nowIso = () => new Date().toISOString();

const safeJsonParse = (value, fallback = {}) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

const normalizeDate = (value) => {
  if (!value) return nowIso();
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? nowIso() : parsed.toISOString();
};

const buildFinanceCode = (prefix, payload = {}) =>
  normalizeText(payload.referenceNumber || payload.code || payload.cashInNumber || payload.cashOutNumber || `${prefix}-${Date.now()}`)
    .toUpperCase();

const toRecordPayload = (row = {}) => ({
  ...safeJsonParse(row.payload_json, {}),
  id: row.id,
  code: row.code || "",
  name: row.name || "",
  status: row.status || "active",
  amount: row.total_amount ?? 0,
  totalAmount: row.total_amount ?? 0,
  transactionDate: row.transaction_date || null,
  date: row.transaction_date || null,
  sourceType: row.source_type || null,
  sourceId: row.source_id || null,
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const upsertFinanceJsonRecord = async (db, tableName, payload = {}) => {
  const id = normalizeText(payload.id || payload.referenceNumber || payload.code || crypto.randomUUID());
  const code = normalizeText(payload.code || payload.referenceNumber || id).toUpperCase();
  const name = normalizeText(payload.name || payload.description || payload.type || code);
  const status = normalizeText(payload.status || "active") || "active";
  const transactionDate = normalizeDate(payload.transactionDate || payload.date || payload.createdAt);
  const amount = toInteger(payload.amount ?? payload.totalAmount ?? payload.total ?? 0);
  const sourceType = normalizeText(payload.sourceType || payload.sourceModule || "");
  const sourceId = normalizeText(payload.sourceId || payload.relatedId || payload.relatedPurchaseId || payload.relatedSaleId || payload.relatedReturnId || "");
  const finalPayload = {
    ...payload,
    id,
    code,
    referenceNumber: payload.referenceNumber || code,
    amount,
    totalAmount: amount,
    transactionDate,
    date: transactionDate,
    status,
    updatedAt: nowIso(),
  };

  const existing = await db.get(`SELECT id FROM ${tableName} WHERE id = ?`, [id]);
  if (existing) {
    await db.run(
      `UPDATE ${tableName}
       SET code = ?, name = ?, status = ?, is_active = ?, total_amount = ?, transaction_date = ?, source_type = ?, source_id = ?, payload_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [code, name, status, status === "deleted" ? 0 : 1, amount, transactionDate, sourceType || null, sourceId || null, JSON.stringify(finalPayload), id]
    );
  } else {
    await db.run(
      `INSERT INTO ${tableName} (id, code, name, status, is_active, total_amount, transaction_date, source_type, source_id, payload_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, code, name, status, status === "deleted" ? 0 : 1, amount, transactionDate, sourceType || null, sourceId || null, JSON.stringify({ ...finalPayload, createdAt: finalPayload.createdAt || nowIso() })]
    );
  }

  const row = await db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
  return toRecordPayload(row);
};

const createFinanceMovement = async (db, {
  direction = "in",
  payload = {},
  actor = "system",
  sourceModule = "manual",
  sourceId = "",
  sourceRef = "",
  description = "",
} = {}) => {
  const normalizedDirection = direction === "out" ? "out" : "in";
  const tableName = normalizedDirection === "out" ? "expenses" : "incomes";
  const prefix = normalizedDirection === "out" ? "CSH-OUT" : "CSH-IN";
  const referenceNumber = buildFinanceCode(prefix, payload);
  const movementId = normalizeText(payload.id || referenceNumber);
  const amount = Math.abs(toInteger(payload.amount ?? payload.totalAmount ?? payload.total ?? 0));

  if (amount <= 0) {
    throw new Error("Nominal kas wajib lebih dari 0.");
  }

  const movementPayload = {
    ...payload,
    id: movementId,
    code: referenceNumber,
    referenceNumber,
    sourceRef: sourceRef || payload.sourceRef || referenceNumber,
    sourceModule: sourceModule || payload.sourceModule || (normalizedDirection === "out" ? "cash_out_manual" : "cash_in_manual"),
    sourceType: payload.sourceType || sourceModule || "manual",
    sourceId: sourceId || payload.sourceId || movementId,
    amount,
    totalAmount: amount,
    description: description || payload.description || payload.notes || payload.type || referenceNumber,
    transactionDate: normalizeDate(payload.transactionDate || payload.date || payload.createdAt),
    date: normalizeDate(payload.transactionDate || payload.date || payload.createdAt),
    status: payload.status || "Tercatat",
    type: payload.type || (normalizedDirection === "out" ? "Pengeluaran" : "Pemasukan"),
  };

  const movementRecord = await upsertFinanceJsonRecord(db, tableName, movementPayload);
  const ledgerId = normalizeText(payload.ledgerId || `ledger_${movementId}`);
  const ledgerPayload = {
    ...movementPayload,
    id: ledgerId,
    code: `LGR-${referenceNumber}`,
    referenceNumber,
    sourceCollection: tableName,
    sourceType: movementPayload.sourceModule,
    sourceId: movementId,
    direction: normalizedDirection,
    debit: normalizedDirection === "in" ? amount : 0,
    credit: normalizedDirection === "out" ? amount : 0,
    amount,
    name: movementPayload.description || referenceNumber,
  };
  const ledgerRecord = await upsertFinanceJsonRecord(db, "money_movement_ledger", ledgerPayload);

  await createAuditLog({
    module: "finance",
    action: normalizedDirection === "out" ? "cash_out" : "cash_in",
    entityType: tableName,
    entityId: movementId,
    actor,
    description: `${normalizedDirection === "out" ? "Kas keluar" : "Kas masuk"} ${referenceNumber} tersimpan di SQLite`,
    metadata: { referenceNumber, amount, sourceModule: movementPayload.sourceModule, sourceId: movementPayload.sourceId },
  });

  return { movement: movementRecord, ledger: ledgerRecord };
};

const markFinanceMovementDeleted = async (db, { tableName, id, actor = "system" } = {}) => {
  if (!id) throw new Error("ID kas yang akan dihapus tidak valid.");
  const row = await db.get(`SELECT * FROM ${tableName} WHERE id = ? AND status != 'deleted'`, [id]);
  if (!row) throw new Error("Data kas SQLite tidak ditemukan.");
  const payload = { ...safeJsonParse(row.payload_json, {}), status: "deleted", isActive: false, deletedAt: nowIso(), updatedAt: nowIso() };

  await db.run(
    `UPDATE ${tableName} SET status = 'deleted', is_active = 0, payload_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [JSON.stringify(payload), id]
  );
  await db.run(
    `UPDATE money_movement_ledger SET status = 'deleted', is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE source_id = ?`,
    [id]
  );

  await createAuditLog({
    module: "finance",
    action: "delete",
    entityType: tableName,
    entityId: id,
    actor,
    description: `Data kas ${id} dihapus dari SQLite`,
    metadata: { tableName, id },
  });

  return { id, deleted: true };
};

module.exports = {
  createFinanceMovement,
  markFinanceMovementDeleted,
  upsertFinanceJsonRecord,
  toInteger,
  normalizeDate,
  nowIso,
};
