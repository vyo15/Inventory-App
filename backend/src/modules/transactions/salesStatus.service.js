const { runInTransaction } = require("../../db/connection");
const { nowIso } = require("../stock/engine");
const { safeJsonParse } = require("../../utils/jsonUtils");
const { createRequestError } = require("./transactions.common");
const {
  createFinanceSideEffect,
  normalizeSaleStatusForWrite,
  shouldCreateSaleIncome,
} = require("./transactions.finance");

const updateSaleStatus = async ({ id, status, actor = "system" } = {}) => runInTransaction(async (db) => {
    const row = await db.get("SELECT * FROM sales WHERE id = ? AND status != 'deleted'", [id]);
    if (!row) {
      throw createRequestError("Sales database lokal tidak ditemukan", "NOT_FOUND", 404);
    }

    const payload = safeJsonParse(row.payload_json, {});
    const previousStatus = payload.status || row.status;
    const nextStatus = normalizeSaleStatusForWrite(status || previousStatus || "Diproses");
    const nextPayload = { ...payload, status: nextStatus, updatedAt: nowIso() };
    await db.run(
      "UPDATE sales SET status = ?, payload_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [nextStatus, JSON.stringify(nextPayload), id]
    );

    let financeResult = null;
    if (!shouldCreateSaleIncome(previousStatus) && shouldCreateSaleIncome(nextStatus)) {
      financeResult = await createFinanceSideEffect(db, {
        tableName: "sales",
        transactionType: "sale",
        transactionRecord: {
          ...nextPayload,
          id,
          referenceNumber: nextPayload.referenceNumber || nextPayload.code || id,
        },
        body: {
          ...nextPayload,
          status: nextStatus,
          totalAmount: nextPayload.totalAmount ?? nextPayload.totalSaleValue ?? nextPayload.total,
        },
        actor,
      });
    }

    return { ...nextPayload, financeResult };
});


module.exports = { updateSaleStatus };
