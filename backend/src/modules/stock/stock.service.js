const { getDb } = require("../../db/connection");
const { commitStockMutation, insertEventRecord } = require("../../utils/sqliteStockEngine");

const commitStockAdjustment = async ({ payload = {}, actor = "system" } = {}) => {
  const db = await getDb();
  try {
    await db.run("BEGIN IMMEDIATE TRANSACTION");

    const result = await commitStockMutation(db, {
      sourceType: payload.sourceType || payload.itemType || payload.type,
      sourceId: payload.sourceId || payload.itemId,
      deltaCurrent: payload.deltaCurrent ?? payload.quantityChange ?? payload.quantity,
      variantKey: payload.variantKey || "",
      referenceNumber: payload.referenceNumber || payload.code,
      reason: payload.reason || "manual_adjustment",
      notes: payload.notes || payload.note || "",
      actor,
      transactionType: "stock_adjustment",
      transactionPayload: payload,
    });

    await insertEventRecord(db, "stock_adjustments", {
      ...payload,
      id: result.referenceNumber,
      referenceNumber: result.referenceNumber,
      code: result.referenceNumber,
      name: `Penyesuaian ${result?.item?.name || payload.sourceId || payload.itemId}`,
      totalAmount: 0,
      sourceType: payload.sourceType || payload.itemType || payload.type,
      sourceId: payload.sourceId || payload.itemId,
    });

    await db.run("COMMIT");
    return result;
  } catch (error) {
    await db.run("ROLLBACK").catch(() => {});
    throw error;
  }
};

module.exports = {
  commitStockAdjustment,
};
