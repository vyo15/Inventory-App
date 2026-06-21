const crypto = require("crypto");
const express = require("express");
const { getDb } = require("../db/connection");
const { createAuditLog } = require("../utils/auditLog");
const { failure, success } = require("../utils/response");
const { requireLocalAuth, requireLocalAdministrator } = require("../middlewares/localAuth");
const { safeJsonParse } = require("../utils/jsonUtils");

const normalizeText = (value) => String(value ?? "").trim();
const normalizeCode = (value) => normalizeText(value).toUpperCase();
const toInteger = (value = 0) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

const allowAuthenticatedRead = (_req, _res, next) => next();

const runWriteOperation = async (db, useWriteTransaction, callback) => {
  if (!useWriteTransaction) return callback();

  await db.run("BEGIN IMMEDIATE TRANSACTION");
  try {
    const result = await callback();
    await db.run("COMMIT");
    return result;
  } catch (error) {
    await db.run("ROLLBACK").catch(() => {});
    throw error;
  }
};

const operationSuccess = (message, data = null, meta = undefined, statusCode = 200) => ({
  ok: true,
  message,
  data,
  meta,
  statusCode,
});

const operationFailure = (message, errorCode = "ERROR", statusCode = 400, details = undefined) => ({
  ok: false,
  message,
  errorCode,
  statusCode,
  details,
});

const sendOperationResult = (res, result = {}) => (result.ok
  ? success(res, result.message, result.data, result.meta, result.statusCode)
  : failure(res, result.message, result.errorCode, result.statusCode, result.details));

const getNumericSequenceFromCode = (code = "", prefix = "") => {
  const normalizedCode = normalizeCode(code);
  const normalizedPrefix = normalizeCode(prefix);
  const match = normalizedCode.match(new RegExp(`^${normalizedPrefix}-(\\d+)$`));
  return match ? Number(match[1]) : 0;
};

const buildSequentialCode = (prefix = "REF", sequence = 1) =>
  `${normalizeCode(prefix)}-${String(sequence).padStart(3, "0")}`;

const generateNextCode = async (db, tableName, prefix = "REF") => {
  const rows = await db.all(`SELECT code FROM ${tableName} WHERE code LIKE ?`, [`${normalizeCode(prefix)}-%`]);
  const maxSequence = rows.reduce(
    (max, row) => Math.max(max, getNumericSequenceFromCode(row.code, prefix)),
    0
  );
  return buildSequentialCode(prefix, maxSequence + 1);
};

const defaultExtractColumns = (payload = {}) => {
  const currentStock = toInteger(payload.currentStock ?? payload.stock ?? 0);
  const reservedStock = toInteger(payload.reservedStock ?? 0);
  const availableStock = toInteger(payload.availableStock ?? Math.max(currentStock - reservedStock, 0));
  return {
    code: normalizeCode(payload.code || payload.productCode || payload.materialCode || payload.referenceNumber || payload.sourceRef || ""),
    name: normalizeText(payload.name || payload.title || payload.displayName || payload.referenceNumber || payload.sourceRef || ""),
    categoryId: normalizeText(payload.categoryId || payload.category_id || payload.targetType || payload.sourceType || ""),
    status: normalizeText(payload.status || (payload.isActive === false ? "inactive" : "active")) || "active",
    isActive: payload.isActive === false || payload.status === "inactive" || payload.status === "deleted" ? 0 : 1,
    currentStock,
    reservedStock,
    availableStock,
    minStockAlert: toInteger(payload.minStockAlert ?? payload.minStock ?? payload.minStockThreshold ?? 0),
    totalAmount: toInteger(payload.totalAmount ?? payload.grandTotal ?? payload.total ?? payload.amount ?? 0),
    transactionDate: normalizeText(payload.date || payload.transactionDate || payload.createdAt || ""),
    sourceType: normalizeText(payload.sourceType || payload.type || payload.targetType || ""),
    sourceId: normalizeText(payload.sourceId || payload.relatedId || payload.referenceId || ""),
  };
};

const toRecord = (row = {}) => {
  const payload = safeJsonParse(row.payload_json, {});
  const versionToken = payload.updatedAt || row.updated_at || null;
  return {
    ...payload,
    id: row.id,
    code: row.code || payload.code || payload.productCode || payload.materialCode || "",
    name: row.name || payload.name || "",
    categoryId: row.category_id || payload.categoryId || null,
    status: row.status || payload.status || "active",
    isActive: row.is_active === 0 ? false : payload.isActive !== false,
    currentStock: row.current_stock ?? payload.currentStock ?? payload.stock ?? 0,
    stock: row.current_stock ?? payload.stock ?? payload.currentStock ?? 0,
    reservedStock: row.reserved_stock ?? payload.reservedStock ?? 0,
    availableStock: row.available_stock ?? payload.availableStock ?? 0,
    minStockAlert: row.min_stock_alert ?? payload.minStockAlert ?? payload.minStock ?? 0,
    totalAmount: row.total_amount ?? payload.totalAmount ?? payload.total ?? 0,
    transactionDate: row.transaction_date || payload.transactionDate || payload.date || null,
    sourceType: row.source_type || payload.sourceType || payload.type || null,
    sourceId: row.source_id || payload.sourceId || null,
    createdAt: row.created_at || payload.createdAt || null,
    updatedAt: row.updated_at || payload.updatedAt || null,
    versionToken,
  };
};

const createSqliteJsonRecordRouter = ({
  tableName,
  moduleKey,
  entityType,
  codePrefix = "REF",
  requiredName = false,
  orderBy = "name ASC, updated_at DESC",
  extractColumns = defaultExtractColumns,
  protectedWriteNote = "",
  allowDirectCreate = true,
  allowDirectUpdate = true,
  allowDirectDelete = true,
  blockedWriteMessage = "",
  readGuard = allowAuthenticatedRead,
  writeGuard = requireLocalAdministrator,
  deleteGuard = requireLocalAdministrator,
  useWriteTransaction = false,
  sanitizeDirectCreate = null,
  sanitizeDirectUpdate = null,
  validateDirectCreate = null,
  validateDirectUpdate = null,
  validateDirectDelete = null,
  afterDirectCreate = null,
  afterDirectUpdate = null,
  afterDirectDelete = null,
} = {}) => {
  if (!tableName || !moduleKey || !entityType) {
    throw new Error("Konfigurasi database lokal JSON record route tidak lengkap.");
  }

  const router = express.Router();
  const rejectDirectWrite = (actionLabel) => (_req, res) => failure(
    res,
    blockedWriteMessage || `${entityType} database lokal tidak boleh ${actionLabel} langsung. Gunakan endpoint commit/service resmi agar audit, stok, dan ledger tetap konsisten.`,
    "DIRECT_WRITE_BLOCKED",
    405,
  );

  router.get("/generate-code", requireLocalAuth, readGuard, async (_req, res, next) => {
    try {
      const db = await getDb();
      const code = await generateNextCode(db, tableName, codePrefix);
      return success(res, `Kode ${entityType} database lokal berhasil dibuat`, { code, referenceNumber: code });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/", requireLocalAuth, readGuard, async (req, res, next) => {
    try {
      const db = await getDb();
      const limit = Math.min(Math.max(Number(req.query.limit || 500), 1), 2000);
      const status = normalizeText(req.query.status || "");
      const sourceType = normalizeText(req.query.sourceType || "");
      const where = ["status != 'deleted'"];
      const params = [];

      if (status) {
        where.push("status = ?");
        params.push(status);
      }
      if (sourceType) {
        where.push("source_type = ?");
        params.push(sourceType);
      }

      const rows = await db.all(
        `SELECT * FROM ${tableName} WHERE ${where.join(" AND ")} ORDER BY ${orderBy} LIMIT ?`,
        [...params, limit]
      );
      return success(res, `Data ${entityType} database lokal berhasil dimuat`, rows.map(toRecord), {
        table: tableName,
        guarded: Boolean(protectedWriteNote),
        protectedWriteNote,
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/:id", requireLocalAuth, readGuard, async (req, res, next) => {
    try {
      const db = await getDb();
      const row = await db.get(`SELECT * FROM ${tableName} WHERE id = ? AND status != 'deleted'`, [req.params.id]);
      if (!row) return failure(res, `${entityType} database lokal tidak ditemukan`, "NOT_FOUND", 404);
      return success(res, `Detail ${entityType} database lokal berhasil dimuat`, toRecord(row));
    } catch (error) {
      return next(error);
    }
  });

  if (allowDirectCreate) {
    router.post("/", requireLocalAuth, writeGuard, async (req, res, next) => {
      try {
        const db = await getDb();
        const result = await runWriteOperation(db, useWriteTransaction, async () => {
          const now = new Date().toISOString();
          const incomingPayload = { ...(req.body || {}) };
          const columns = extractColumns(incomingPayload);
          const finalCode = normalizeCode(columns.code || incomingPayload.code || incomingPayload.referenceNumber || "") || await generateNextCode(db, tableName, codePrefix);
          const finalId = normalizeText(incomingPayload.id || finalCode || crypto.randomUUID());
          const finalName = normalizeText(columns.name || incomingPayload.name || incomingPayload.title || finalCode);

          if (requiredName && !finalName) {
            return operationFailure(`Nama ${entityType} wajib diisi`, "VALIDATION_ERROR", 400);
          }

          const duplicate = await db.get(`SELECT id FROM ${tableName} WHERE code = ? AND status != 'deleted'`, [finalCode]);
          if (duplicate) {
            return operationFailure(`Kode ${entityType} sudah ada di database lokal`, "DUPLICATE_CODE", 409);
          }

          let payload = {
            ...incomingPayload,
            id: finalId,
            code: finalCode,
            name: finalName,
            status: columns.status || incomingPayload.status || "active",
            isActive: columns.isActive === 0 ? false : incomingPayload.isActive !== false,
            createdAt: incomingPayload.createdAt || now,
            updatedAt: now,
          };

          if (typeof sanitizeDirectCreate === "function") {
            payload = await sanitizeDirectCreate({
              db,
              entityType,
              incomingPayload,
              payload,
              req,
            }) || payload;
          }

          if (typeof validateDirectCreate === "function") {
            await validateDirectCreate({
              db,
              entityType,
              incomingPayload,
              payload,
              req,
            });
          }

          const normalizedColumns = extractColumns(payload);

          await db.run(
            `
              INSERT INTO ${tableName} (
                id, code, name, category_id, status, is_active,
                current_stock, reserved_stock, available_stock, min_stock_alert,
                total_amount, transaction_date, source_type, source_id,
                payload_json, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `,
            [
              finalId,
              normalizedColumns.code || finalCode,
              normalizedColumns.name || finalName,
              normalizedColumns.categoryId || null,
              normalizedColumns.status || "active",
              normalizedColumns.isActive,
              normalizedColumns.currentStock,
              normalizedColumns.reservedStock,
              normalizedColumns.availableStock,
              normalizedColumns.minStockAlert,
              normalizedColumns.totalAmount,
              normalizedColumns.transactionDate || null,
              normalizedColumns.sourceType || null,
              normalizedColumns.sourceId || null,
              JSON.stringify(payload),
            ]
          );

          const row = await db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [finalId]);
          const record = toRecord(row);

          if (typeof afterDirectCreate === "function") {
            await afterDirectCreate({ db, entityType, incomingPayload, payload, record, req });
          }

          await createAuditLog({
            module: moduleKey,
            action: "create",
            entityType,
            entityId: finalId,
            actor: req.localAuth.user.username,
            description: `${entityType} ${finalName || finalCode} dibuat di database lokal`,
            metadata: { code: finalCode, guarded: Boolean(protectedWriteNote), protectedWriteNote },
          });

          return operationSuccess(
            `${entityType} berhasil ditambahkan ke database lokal`,
            record,
            undefined,
            201,
          );
        });

        return sendOperationResult(res, result);
      } catch (error) {
        if (String(error?.message || "").includes("UNIQUE")) {
          return failure(res, `Kode/ID ${entityType} sudah ada di database lokal`, "DUPLICATE_CODE", 409);
        }
        return next(error);
      }
    });
  } else {
    router.post("/", requireLocalAuth, writeGuard, rejectDirectWrite("dibuat"));
  }

  if (allowDirectUpdate) {
    router.put("/:id", requireLocalAuth, writeGuard, async (req, res, next) => {
      try {
        const db = await getDb();
        const result = await runWriteOperation(db, useWriteTransaction, async () => {
          const current = await db.get(`SELECT * FROM ${tableName} WHERE id = ? AND status != 'deleted'`, [req.params.id]);
          if (!current) {
            return operationFailure(`${entityType} database lokal tidak ditemukan`, "NOT_FOUND", 404);
          }

          const currentPayload = safeJsonParse(current.payload_json, {});
          const incomingPayload = { ...(req.body || {}) };
          let mergedPayload = {
            ...currentPayload,
            ...incomingPayload,
            id: current.id,
            code: normalizeCode(current.code || incomingPayload.code || currentPayload.code || ""),
            updatedAt: new Date().toISOString(),
          };

          if (typeof sanitizeDirectUpdate === "function") {
            mergedPayload = await sanitizeDirectUpdate({
              db,
              entityType,
              current: toRecord(current),
              currentPayload,
              incomingPayload,
              mergedPayload,
              req,
            }) || mergedPayload;
          }

          if (typeof validateDirectUpdate === "function") {
            await validateDirectUpdate({
              db,
              entityType,
              current: toRecord(current),
              currentPayload,
              incomingPayload,
              mergedPayload,
              req,
            });
          }

          const columns = extractColumns(mergedPayload);
          const finalName = normalizeText(columns.name || mergedPayload.name || current.name || current.code);

          if (requiredName && !finalName) {
            return operationFailure(`Nama ${entityType} wajib diisi`, "VALIDATION_ERROR", 400);
          }

          const finalPayload = {
            ...mergedPayload,
            name: finalName,
            status: columns.status || mergedPayload.status || "active",
          };

          await db.run(
            `
              UPDATE ${tableName}
              SET code = ?, name = ?, category_id = ?, status = ?, is_active = ?,
                  current_stock = ?, reserved_stock = ?, available_stock = ?, min_stock_alert = ?,
                  total_amount = ?, transaction_date = ?, source_type = ?, source_id = ?,
                  payload_json = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
            [
              columns.code || current.code,
              finalName,
              columns.categoryId || null,
              columns.status || current.status || "active",
              columns.isActive,
              columns.currentStock,
              columns.reservedStock,
              columns.availableStock,
              columns.minStockAlert,
              columns.totalAmount,
              columns.transactionDate || null,
              columns.sourceType || null,
              columns.sourceId || null,
              JSON.stringify(finalPayload),
              current.id,
            ]
          );

          const row = await db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [current.id]);
          const record = toRecord(row);

          if (typeof afterDirectUpdate === "function") {
            await afterDirectUpdate({
              db,
              entityType,
              current: toRecord(current),
              currentPayload,
              incomingPayload,
              payload: finalPayload,
              record,
              req,
            });
          }

          await createAuditLog({
            module: moduleKey,
            action: "update",
            entityType,
            entityId: current.id,
            actor: req.localAuth.user.username,
            description: `${entityType} ${finalName} diubah di database lokal`,
            metadata: { code: columns.code || current.code, guarded: Boolean(protectedWriteNote), protectedWriteNote },
          });

          return operationSuccess(`${entityType} database lokal berhasil diubah`, record);
        });

        return sendOperationResult(res, result);
      } catch (error) {
        return next(error);
      }
    });
  } else {
    router.put("/:id", requireLocalAuth, writeGuard, rejectDirectWrite("diubah"));
  }

  if (allowDirectDelete) {
    router.delete("/:id", requireLocalAuth, deleteGuard, async (req, res, next) => {
      try {
        const db = await getDb();
        const result = await runWriteOperation(db, useWriteTransaction, async () => {
          const current = await db.get(`SELECT * FROM ${tableName} WHERE id = ? AND status != 'deleted'`, [req.params.id]);
          if (!current) {
            return operationFailure(`${entityType} database lokal tidak ditemukan`, "NOT_FOUND", 404);
          }

          const payload = safeJsonParse(current.payload_json, {});
          const currentRecord = toRecord(current);

          if (typeof validateDirectDelete === "function") {
            await validateDirectDelete({ db, entityType, current: currentRecord, currentPayload: payload, req });
          }

          const deletedPayload = {
            ...payload,
            status: "deleted",
            isActive: false,
            updatedAt: new Date().toISOString(),
          };
          await db.run(
            `UPDATE ${tableName} SET status = 'deleted', is_active = 0, payload_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [JSON.stringify(deletedPayload), current.id]
          );

          if (typeof afterDirectDelete === "function") {
            await afterDirectDelete({ db, entityType, current: currentRecord, currentPayload: payload, payload: deletedPayload, req });
          }

          await createAuditLog({
            module: moduleKey,
            action: "soft_delete",
            entityType,
            entityId: current.id,
            actor: req.localAuth.user.username,
            description: `${entityType} ${current.name || current.code} dinonaktifkan di database lokal`,
            metadata: { code: current.code, guarded: Boolean(protectedWriteNote), protectedWriteNote },
          });

          return operationSuccess(
            `${entityType} database lokal berhasil dinonaktifkan`,
            { id: current.id, deleted: true, softDeleted: true },
          );
        });

        return sendOperationResult(res, result);
      } catch (error) {
        return next(error);
      }
    });
  } else {
    router.delete("/:id", requireLocalAuth, deleteGuard, rejectDirectWrite("dihapus/dinonaktifkan"));
  }

  return router;
};

module.exports = {
  createSqliteJsonRecordRouter,
  defaultExtractColumns,
  toInteger,
  normalizeText,
  normalizeCode,
};
