const { runInTransaction } = require("../../db/connection");
const { commitStockMutation, insertEventRecord, nowIso, toInteger } = require("../stock/engine");
const { normalizeTransactionItems, resolveTransactionReference } = require("./transactions.common");
const { buildSaleReturnValidation } = require("./transactions.returnValidation");

const commitReturn = async ({ payload = {}, actor = "system" } = {}) => runInTransaction(async (db) => {
    const body = await buildSaleReturnValidation(db, payload || {});
    const referenceNumber = await resolveTransactionReference(db, {
      body,
      tableName: "returns",
      transactionType: "return",
    });
    const items = normalizeTransactionItems(body);

    const mutationResults = [];
    for (const item of items) {
      const result = await commitStockMutation(db, {
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        deltaCurrent: Math.abs(item.quantity),
        variantKey: item.variantKey,
        referenceNumber: `${referenceNumber}_${item.sourceId}_${item.variantKey || "master"}`,
        reason: "return",
        notes: body.notes || body.note || "",
        actor,
        transactionType: "return",
        transactionPayload: { ...body, item },
        allowInactiveSource: true,
        allowInactiveVariant: true,
        allowArchivedVariantRestore: true,
        inactiveOverrideReason: "Retur historis yang terhubung ke penjualan sah.",
      });
      mutationResults.push(result);
    }

    const transactionRecord = await insertEventRecord(db, "returns", {
      ...body,
      id: referenceNumber,
      code: referenceNumber,
      referenceNumber,
      returnNumber: referenceNumber,
      name: body.name || `Retur ${body.saleReference || body.relatedSaleId}`,
      items,
      mutationResults,
      status: "Selesai",
      transactionDate: body.transactionDate || body.date || nowIso(),
      totalAmount: toInteger(body.totalAmount ?? body.total ?? body.grandTotal ?? body.amount ?? 0),
      sourceType: "return",
      sourceId: body.relatedSaleId,
    });

    return { ...transactionRecord, mutationResults, financeResult: null };
});



module.exports = { commitReturn };
