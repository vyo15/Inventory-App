const {
  nowIso,
  toInteger,
  upsertJsonRecord,
  upsertStockReadModel,
} = require("../stock/engine");
const { createAuditLog } = require("../../utils/auditLog");
const { createRequestError, normalizeSourceType } = require("./transactions.common");

const validateTransactionItems = (items = []) => {
  if (!items.length) {
    throw createRequestError("Item transaksi wajib tersedia", "VALIDATION_ERROR", 400);
  }

  for (const item of items) {
    if (!item.sourceId || !item.sourceType) {
      throw createRequestError("Item transaksi belum memiliki sourceType/sourceId yang valid.", "VALIDATION_ERROR", 400);
    }
    if (!item.quantity || item.quantity <= 0) {
      throw createRequestError("Qty transaksi harus lebih dari 0.", "VALIDATION_ERROR", 400);
    }
  }
};

const buildRawMaterialPurchaseValuationInput = ({ transactionType, body = {}, items = [] } = {}) => {
  if (transactionType !== "purchase") return null;
  const rawMaterialItems = items.filter((item) => normalizeSourceType(item.sourceType) === "raw_material");
  if (rawMaterialItems.length === 0) return null;
  if (items.length !== 1 || rawMaterialItems.length !== 1) {
    throw createRequestError(
      "Pembelian Bahan Baku harus disimpan satu item per transaksi agar modal aktual, Supplier, dan konversi stok dapat diaudit dengan benar.",
      "RAW_MATERIAL_PURCHASE_SINGLE_ITEM_REQUIRED",
      400,
    );
  }

  const item = rawMaterialItems[0];
  const quantity = Math.abs(toInteger(item.quantity || 0));
  const totalActualPurchase = Math.max(0, toInteger(
    body.totalActualPurchase ?? body.totalAmount ?? body.totalCost ?? body.total ?? 0,
  ));
  if (quantity <= 0 || totalActualPurchase <= 0) {
    throw createRequestError(
      "Total biaya aktual dan jumlah stok masuk Bahan Baku harus lebih dari 0.",
      "RAW_MATERIAL_PURCHASE_VALUATION_REQUIRED",
      400,
    );
  }

  const incomingUnitCost = Math.round(totalActualPurchase / quantity);
  if (incomingUnitCost <= 0) {
    throw createRequestError(
      "Modal aktual per satuan Bahan Baku tidak valid.",
      "RAW_MATERIAL_PURCHASE_UNIT_COST_INVALID",
      400,
    );
  }

  return {
    sourceId: item.sourceId,
    quantity,
    totalActualPurchase,
    incomingUnitCost,
  };
};

const reconcileRawMaterialPurchaseValuation = async (db, {
  input,
  mutationResults = [],
  actor = "system",
  referenceNumber = "",
} = {}) => {
  if (!input) return null;
  const mutation = mutationResults.find((result) => String(result?.item?.id || "") === String(input.sourceId));
  if (!mutation?.item) {
    throw createRequestError(
      "Hasil mutasi stok Bahan Baku tidak ditemukan untuk perhitungan modal.",
      "RAW_MATERIAL_PURCHASE_MUTATION_NOT_FOUND",
      500,
    );
  }

  const previousStock = Math.max(0, toInteger(mutation.beforeStock || 0));
  const nextStock = Math.max(0, toInteger(mutation.afterStock || 0));
  const previousAverage = Math.max(0, Number(mutation.item.averageActualUnitCost || 0));
  const previousCostBasis = previousStock > 0 && previousAverage <= 0
    ? input.incomingUnitCost
    : previousAverage;
  const weightedTotal = (previousStock * previousCostBasis) + (input.quantity * input.incomingUnitCost);
  const nextAverage = nextStock > 0 ? Math.round(weightedTotal / nextStock) : input.incomingUnitCost;

  const saved = await upsertJsonRecord(db, "raw_materials", {
    ...mutation.item,
    averageActualUnitCost: nextAverage,
    lastPurchaseUnitCost: input.incomingUnitCost,
    lastPurchaseTotalCost: input.totalActualPurchase,
    lastPurchaseReference: referenceNumber,
    lastPurchaseCostUpdatedAt: nowIso(),
  });
  await upsertStockReadModel(db, saved, {
    sourceType: "raw_material",
    sourceCollection: "raw_materials",
    lastSyncedFrom: "purchase.weighted_average_cost",
  });
  await createAuditLog({
    module: "purchases",
    action: "raw_material_average_cost_updated",
    entityType: "raw_material",
    entityId: input.sourceId,
    actor,
    description: `Modal rata-rata ${saved.name || input.sourceId} diperbarui dari Pembelian ${referenceNumber}.`,
    metadata: {
      referenceNumber,
      previousStock,
      incomingQuantity: input.quantity,
      nextStock,
      previousAverage: Math.round(previousAverage),
      incomingUnitCost: input.incomingUnitCost,
      nextAverage,
      totalActualPurchase: input.totalActualPurchase,
    },
  });

  return {
    sourceId: input.sourceId,
    previousStock,
    incomingQuantity: input.quantity,
    nextStock,
    previousAverage: Math.round(previousAverage),
    incomingUnitCost: input.incomingUnitCost,
    averageActualUnitCost: nextAverage,
    totalActualPurchase: input.totalActualPurchase,
  };
};


module.exports = {
  buildRawMaterialPurchaseValuationInput,
  reconcileRawMaterialPurchaseValuation,
  validateTransactionItems,
};
