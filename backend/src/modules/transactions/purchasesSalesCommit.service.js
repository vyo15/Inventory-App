const { runInTransaction } = require("../../db/connection");
const { commitStockMutation, insertEventRecord, nowIso, toInteger } = require("../stock/engine");
const { verifyPurchaseCatalogOfferWithDb } = require("../suppliers/suppliers.service");
const { normalizeTransactionItems, resolveTransactionReference } = require("./transactions.common");
const { createFinanceSideEffect, prepareTransactionBody } = require("./transactions.finance");
const {
  buildRawMaterialPurchaseValuationInput,
  reconcileRawMaterialPurchaseValuation,
  validateTransactionItems,
} = require("./transactions.valuation");

const commitStockTransaction = async ({ payload = {}, actor = "system", tableName, transactionType, stockDirection } = {}) => {
  const preparedBody = prepareTransactionBody(transactionType, payload || {});
  const items = normalizeTransactionItems(preparedBody);
  validateTransactionItems(items);

  return runInTransaction(async (db) => {
    const catalogVerification = transactionType === "purchase"
      ? await verifyPurchaseCatalogOfferWithDb(db, preparedBody, actor)
      : null;
    const body = catalogVerification
      ? { ...preparedBody, ...catalogVerification }
      : preparedBody;

    const referenceNumber = await resolveTransactionReference(db, {
      body,
      tableName,
      transactionType,
    });
    const rawMaterialValuationInput = buildRawMaterialPurchaseValuationInput({
      transactionType,
      body,
      items,
    });
    const stockMutationBody = rawMaterialValuationInput
      ? {
          ...body,
          totalActualPurchase: rawMaterialValuationInput.totalActualPurchase,
          actualUnitCost: rawMaterialValuationInput.incomingUnitCost,
        }
      : body;
    const mutationResults = [];
    for (const item of items) {
      const deltaCurrent = stockDirection === "out" ? -Math.abs(item.quantity) : Math.abs(item.quantity);
      const result = await commitStockMutation(db, {
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        deltaCurrent,
        variantKey: item.variantKey,
        referenceNumber: `${referenceNumber}_${item.sourceId}_${item.variantKey || "master"}`,
        reason: transactionType,
        notes: body.notes || body.note || "",
        actor,
        transactionType,
        transactionPayload: { ...stockMutationBody, item },
      });
      mutationResults.push(result);
    }

    const valuationResult = await reconcileRawMaterialPurchaseValuation(db, {
      input: rawMaterialValuationInput,
      mutationResults,
      actor,
      referenceNumber,
    });
    const finalBody = valuationResult
      ? {
          ...body,
          totalActualPurchase: valuationResult.totalActualPurchase,
          actualUnitCost: valuationResult.incomingUnitCost,
          averageActualUnitCostAfter: valuationResult.averageActualUnitCost,
        }
      : body;

    const transactionRecord = await insertEventRecord(db, tableName, {
      ...finalBody,
      id: referenceNumber,
      code: referenceNumber,
      referenceNumber,
      name: finalBody.name || finalBody.description || referenceNumber,
      items,
      mutationResults,
      status: finalBody.status || "active",
      transactionDate: finalBody.transactionDate || finalBody.date || nowIso(),
      totalAmount: toInteger(finalBody.totalAmount ?? finalBody.total ?? finalBody.grandTotal ?? finalBody.amount ?? 0),
      sourceType: transactionType,
    });

    const financeResult = await createFinanceSideEffect(db, {
      tableName,
      transactionType,
      transactionRecord,
      body: finalBody,
      actor,
    });

    return { ...transactionRecord, mutationResults, financeResult, catalogVerification, valuationResult };
  });
};

const commitPurchase = ({ payload = {}, actor = "system" } = {}) => commitStockTransaction({
  payload,
  actor,
  tableName: "purchases",
  transactionType: "purchase",
  stockDirection: "in",
});

const commitSale = ({ payload = {}, actor = "system" } = {}) => commitStockTransaction({
  payload,
  actor,
  tableName: "sales",
  transactionType: "sale",
  stockDirection: "out",
});


module.exports = { commitPurchase, commitSale, commitStockTransaction };
