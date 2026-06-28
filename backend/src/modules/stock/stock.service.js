const { createHttpError } = require("../../utils/httpError");
const { runInTransaction } = require("../../db/connection");
const {
  formatBusinessDateStamp,
  resolveBusinessCode,
} = require("../../utils/businessCodeCounter");
const { commitStockMutation, insertEventRecord } = require("./engine");

const getStockAdjustmentCounterOptions = (payload = {}) => {
  const dateStamp = formatBusinessDateStamp(
    payload.transactionDate || payload.date || payload.createdAt,
  );
  const prefix = `STK-ADJ-${dateStamp}`;
  return {
    counterKey: `stock_adjustments:${prefix}`,
    prefix,
    tableName: "stock_adjustments",
    columnName: "code",
    minWidth: 3,
    notes: "Runtime counter stock adjustment per tanggal",
  };
};

const commitStockAdjustment = async ({ payload = {}, actor = "system" } = {}) => runInTransaction(async (db) => {
  const referenceNumber = await resolveBusinessCode(
    db,
    payload.referenceNumber || payload.code || "",
    getStockAdjustmentCounterOptions(payload),
  );
  if (!referenceNumber) {
    throw createHttpError(
      "Nomor referensi penyesuaian stok sudah pernah digunakan.",
      "DUPLICATE_REFERENCE",
      409,
    );
  }

  const transactionPayload = {
    ...payload,
    id: referenceNumber,
    code: referenceNumber,
    referenceNumber,
  };
  const result = await commitStockMutation(db, {
    sourceType: payload.sourceType || payload.itemType || payload.type,
    sourceId: payload.sourceId || payload.itemId,
    deltaCurrent: payload.deltaCurrent ?? payload.quantityChange ?? payload.quantity,
    variantKey: payload.variantKey || "",
    referenceNumber,
    reason: payload.reason || "manual_adjustment",
    notes: payload.notes || payload.note || "",
    actor,
    transactionType: "stock_adjustment",
    transactionPayload,
  });

  await insertEventRecord(db, "stock_adjustments", {
    ...transactionPayload,
    name: `Penyesuaian ${result?.item?.name || payload.sourceId || payload.itemId}`,
    totalAmount: 0,
    sourceType: payload.sourceType || payload.itemType || payload.type,
    sourceId: payload.sourceId || payload.itemId,
  });

  return result;
});

module.exports = {
  commitStockAdjustment,
};
