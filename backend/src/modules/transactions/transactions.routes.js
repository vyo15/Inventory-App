const express = require("express");
const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");
const { getDb } = require("../../db/connection");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");
const { failure, success } = require("../../utils/response");
const { commitStockMutation, insertEventRecord, nowIso, toInteger } = require("../../utils/sqliteStockEngine");
const { createFinanceMovement } = require("../../utils/sqliteFinanceEngine");

const router = express.Router();

const normalizeSourceType = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["product", "products"].includes(normalized)) return "product";
  if (["material", "raw", "raw_material", "raw_materials"].includes(normalized)) return "raw_material";
  return normalized;
};

const normalizeTransactionItems = (body = {}) => {
  const sourceItems = Array.isArray(body.items) && body.items.length > 0
    ? body.items
    : [{
        sourceType: body.sourceType || body.itemType || body.type,
        sourceId: body.sourceId || body.itemId,
        quantity: body.quantity,
        variantKey: body.variantKey || body.productVariantKey || body.materialVariantId,
        itemName: body.itemName,
      }];

  return sourceItems.map((item) => ({
    ...item,
    sourceType: normalizeSourceType(item.sourceType || item.itemType || item.type || body.sourceType || body.itemType || body.type),
    sourceId: item.sourceId || item.itemId || item.id,
    variantKey: item.variantKey || item.productVariantKey || item.materialVariantId || "",
    quantity: toInteger(item.quantity || item.qty || 0),
  }));
};

const shouldCreateSaleIncome = (status = "") => String(status || "").trim().toLowerCase() === "selesai";

const createFinanceSideEffect = async (db, { tableName, transactionType, transactionRecord, body, actor }) => {
  const amount = toInteger(body.totalAmount ?? body.total ?? body.grandTotal ?? body.amount ?? 0);
  if (amount <= 0) return null;

  if (transactionType === "purchase") {
    return createFinanceMovement(db, {
      direction: "out",
      actor,
      sourceModule: "purchases",
      sourceId: transactionRecord.id,
      sourceRef: transactionRecord.referenceNumber || transactionRecord.code || transactionRecord.id,
      description: body.description || `Pembelian ${transactionRecord.referenceNumber || transactionRecord.id}`,
      payload: {
        id: `purchase_expense_${transactionRecord.id}`,
        referenceNumber: `CSH-OUT-${transactionRecord.referenceNumber || transactionRecord.id}`,
        type: "Pembelian Bahan/Barang",
        amount,
        totalAmount: amount,
        transactionDate: transactionRecord.transactionDate || body.transactionDate || body.date || nowIso(),
        sourceModule: "purchases",
        sourceType: "auto_purchase",
        sourceId: transactionRecord.id,
        sourceRef: transactionRecord.referenceNumber || transactionRecord.id,
        relatedPurchaseId: transactionRecord.id,
        status: "Tercatat",
      },
    });
  }

  if (transactionType === "sale" && shouldCreateSaleIncome(body.status)) {
    return createFinanceMovement(db, {
      direction: "in",
      actor,
      sourceModule: "sales",
      sourceId: transactionRecord.id,
      sourceRef: transactionRecord.referenceNumber || transactionRecord.code || transactionRecord.id,
      description: body.description || `Penjualan ${transactionRecord.referenceNumber || transactionRecord.id}`,
      payload: {
        id: `sale_income_${transactionRecord.id}`,
        referenceNumber: `CSH-IN-${transactionRecord.referenceNumber || transactionRecord.id}`,
        type: "Penjualan",
        amount,
        totalAmount: amount,
        transactionDate: transactionRecord.transactionDate || body.transactionDate || body.date || nowIso(),
        sourceModule: "sales",
        sourceType: "auto_sale",
        sourceId: transactionRecord.id,
        sourceRef: transactionRecord.referenceNumber || transactionRecord.id,
        relatedSaleId: transactionRecord.id,
        status: "Selesai",
      },
    });
  }

  if (transactionType === "return") {
    const refundAmount = toInteger(body.refundAmount ?? body.refundTotal ?? 0);
    if (refundAmount <= 0) return null;
    return createFinanceMovement(db, {
      direction: "out",
      actor,
      sourceModule: "returns",
      sourceId: transactionRecord.id,
      sourceRef: transactionRecord.referenceNumber || transactionRecord.id,
      description: body.description || `Refund retur ${transactionRecord.referenceNumber || transactionRecord.id}`,
      payload: {
        id: `return_refund_${transactionRecord.id}`,
        referenceNumber: `CSH-OUT-${transactionRecord.referenceNumber || transactionRecord.id}`,
        type: "Refund Retur",
        amount: refundAmount,
        totalAmount: refundAmount,
        transactionDate: transactionRecord.transactionDate || body.transactionDate || body.date || nowIso(),
        sourceModule: "returns",
        sourceType: "auto_return_refund",
        sourceId: transactionRecord.id,
        sourceRef: transactionRecord.referenceNumber || transactionRecord.id,
        relatedReturnId: transactionRecord.id,
        status: "Tercatat",
      },
    });
  }

  return null;
};

const commitStockTransaction = async ({ req, res, next, tableName, transactionType, stockDirection, successMessage }) => {
  const db = await getDb();
  try {
    await db.run("BEGIN IMMEDIATE TRANSACTION");
    const body = req.body || {};
    const referenceNumber = body.referenceNumber || body.code || body.purchaseNumber || body.saleNumber || body.returnNumber || `${transactionType.toUpperCase()}-${Date.now()}`;
    const items = normalizeTransactionItems(body);
    if (!items.length) return failure(res, "Item transaksi wajib tersedia", "VALIDATION_ERROR", 400);

    const mutationResults = [];
    for (const item of items) {
      if (!item.sourceId || !item.sourceType) {
        throw new Error("Item transaksi belum memiliki sourceType/sourceId yang valid.");
      }
      if (!item.quantity || item.quantity <= 0) {
        throw new Error("Qty transaksi harus lebih dari 0.");
      }
      const deltaCurrent = stockDirection === "out" ? -Math.abs(item.quantity) : Math.abs(item.quantity);
      const result = await commitStockMutation(db, {
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        deltaCurrent,
        variantKey: item.variantKey,
        referenceNumber: `${referenceNumber}_${item.sourceId}_${item.variantKey || "master"}`,
        reason: transactionType,
        notes: body.notes || body.note || "",
        actor: req.localAuth.user.username,
        transactionType,
        transactionPayload: { ...body, item },
      });
      mutationResults.push(result);
    }

    const transactionRecord = await insertEventRecord(db, tableName, {
      ...body,
      id: referenceNumber,
      code: referenceNumber,
      referenceNumber,
      name: body.name || body.description || referenceNumber,
      items,
      mutationResults,
      status: body.status || "active",
      transactionDate: body.transactionDate || body.date || nowIso(),
      totalAmount: toInteger(body.totalAmount ?? body.total ?? body.grandTotal ?? body.amount ?? 0),
      sourceType: transactionType,
    });

    const financeResult = await createFinanceSideEffect(db, {
      tableName,
      transactionType,
      transactionRecord,
      body,
      actor: req.localAuth.user.username,
    });

    await db.run("COMMIT");
    return success(res, successMessage, { ...transactionRecord, mutationResults, financeResult }, undefined, 201);
  } catch (error) {
    await db.run("ROLLBACK").catch(() => {});
    return next(error);
  }
};

router.post("/purchases/commit", requireLocalAuth, requireLocalAdministrator, (req, res, next) => commitStockTransaction({
  req,
  res,
  next,
  tableName: "purchases",
  transactionType: "purchase",
  stockDirection: "in",
  successMessage: "Purchase SQLite berhasil disimpan dan stok masuk.",
}));

router.post("/sales/commit", requireLocalAuth, requireLocalAdministrator, (req, res, next) => commitStockTransaction({
  req,
  res,
  next,
  tableName: "sales",
  transactionType: "sale",
  stockDirection: "out",
  successMessage: "Sales SQLite berhasil disimpan dan stok keluar.",
}));

router.put("/sales/:id/status", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  const db = await getDb();
  try {
    await db.run("BEGIN IMMEDIATE TRANSACTION");
    const row = await db.get("SELECT * FROM sales WHERE id = ? AND status != 'deleted'", [req.params.id]);
    if (!row) {
      await db.run("ROLLBACK").catch(() => {});
      return failure(res, "Sales SQLite tidak ditemukan", "NOT_FOUND", 404);
    }
    const payload = JSON.parse(row.payload_json || "{}");
    const previousStatus = payload.status || row.status;
    const nextStatus = req.body?.status || previousStatus;
    const nextPayload = { ...payload, status: nextStatus, updatedAt: nowIso() };
    await db.run("UPDATE sales SET status = ?, payload_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [nextStatus, JSON.stringify(nextPayload), req.params.id]);

    let financeResult = null;
    if (!shouldCreateSaleIncome(previousStatus) && shouldCreateSaleIncome(nextStatus)) {
      financeResult = await createFinanceSideEffect(db, {
        tableName: "sales",
        transactionType: "sale",
        transactionRecord: { ...nextPayload, id: req.params.id, referenceNumber: nextPayload.referenceNumber || nextPayload.code || req.params.id },
        body: { ...nextPayload, status: nextStatus, totalAmount: nextPayload.totalAmount ?? nextPayload.totalSaleValue ?? nextPayload.total },
        actor: req.localAuth.user.username,
      });
    }

    await db.run("COMMIT");
    return success(res, "Status sales SQLite berhasil diubah", { ...nextPayload, financeResult });
  } catch (error) {
    await db.run("ROLLBACK").catch(() => {});
    return next(error);
  }
});

router.post("/returns/commit", requireLocalAuth, requireLocalAdministrator, (req, res, next) => commitStockTransaction({
  req,
  res,
  next,
  tableName: "returns",
  transactionType: "return",
  stockDirection: "in",
  successMessage: "Return SQLite berhasil disimpan dan stok dipulihkan.",
}));

router.use("/purchases", createSqliteJsonRecordRouter({
  tableName: "purchases",
  moduleKey: "purchases",
  entityType: "purchase",
  codePrefix: "PUR",
  requiredName: false,
  orderBy: "transaction_date DESC, updated_at DESC",
  protectedWriteNote: "Purchase SQLite atomic aktif untuk Product/Raw stock-in. Finance ledger final masih guarded.",
}));

router.use("/sales", createSqliteJsonRecordRouter({
  tableName: "sales",
  moduleKey: "sales",
  entityType: "sale",
  codePrefix: "ORD",
  requiredName: false,
  orderBy: "transaction_date DESC, updated_at DESC",
  protectedWriteNote: "Sales SQLite atomic aktif untuk Product/Raw stock-out. Income/ledger final masih guarded.",
}));

router.use("/returns", createSqliteJsonRecordRouter({
  tableName: "returns",
  moduleKey: "returns",
  entityType: "return",
  codePrefix: "RET",
  requiredName: false,
  orderBy: "transaction_date DESC, updated_at DESC",
  protectedWriteNote: "Returns SQLite atomic aktif untuk Product/Raw stock restore. Refund/finance final masih guarded.",
}));

module.exports = router;
