const { toInteger } = require("../stock/engine");
const { safeJsonParse } = require("../../utils/jsonUtils");
const {
  createRequestError,
  normalizeSourceType,
  normalizeText,
  normalizeTransactionItems,
} = require("./transactions.common");

const getSaleItemSourceType = (item = {}) => normalizeSourceType(
  item.sourceType
    || item.itemType
    || item.type
    || (item.collectionName === "raw_materials" ? "raw_material" : "product"),
);

const getSaleItemSourceId = (item = {}) => normalizeText(item.sourceId || item.itemId || item.id);
const getSaleItemVariantKey = (item = {}) => normalizeText(item.variantKey || item.productVariantKey || item.materialVariantId || "");
const getSaleItemMatchKey = (item = {}) => [
  getSaleItemSourceType(item),
  getSaleItemSourceId(item),
  getSaleItemVariantKey(item) || "master",
].join("::");

const getReturnLineItems = (record = {}) => {
  const payloadItems = Array.isArray(record.items) && record.items.length > 0
    ? record.items
    : [{
        sourceType: record.sourceType || record.type,
        sourceId: record.sourceId || record.itemId,
        variantKey: record.variantKey,
        quantity: record.quantity,
      }];

  return payloadItems.map((item) => ({
    ...item,
    sourceType: normalizeSourceType(item.sourceType || item.type || record.sourceType || record.type),
    sourceId: item.sourceId || item.itemId || item.id || record.sourceId || record.itemId,
    variantKey: item.variantKey || record.variantKey || "",
    quantity: toInteger(item.quantity || item.qty || 0),
  }));
};

const sumReturnedQuantityForSaleLine = async (db, relatedSaleId, saleLine) => {
  const rows = await db.all("SELECT payload_json FROM returns WHERE status != 'deleted'");
  const targetKey = getSaleItemMatchKey(saleLine);

  return rows.reduce((total, row) => {
    const payload = safeJsonParse(row.payload_json, {});
    const payloadSaleId = normalizeText(payload.relatedSaleId || payload.saleId);
    if (payloadSaleId !== relatedSaleId) return total;

    return total + getReturnLineItems(payload).reduce((lineTotal, line) => {
      if (getSaleItemMatchKey(line) !== targetKey) return lineTotal;
      return lineTotal + Math.abs(toInteger(line.quantity || 0));
    }, 0);
  }, 0);
};

const RETURN_STATUS = "Selesai";

const buildSaleReturnValidation = async (db, body = {}) => {
  const requestedStatus = normalizeText(body.status || RETURN_STATUS).toLowerCase();
  if (requestedStatus !== RETURN_STATUS.toLowerCase()) {
    throw createRequestError(
      "Status Return ditentukan sistem dan hanya boleh Selesai. Return tidak memiliki draft, cancel, atau delete dari endpoint operasional.",
      "INVALID_RETURN_STATUS",
      400,
    );
  }

  const requestedRefundAmount = toInteger(body.refundAmount ?? body.refundTotal ?? 0);
  if (requestedRefundAmount !== 0) {
    throw createRequestError(
      "Return hanya mengoreksi stok. Refund kas wajib dicatat melalui proses finance terpisah yang disetujui.",
      "RETURN_REFUND_NOT_SUPPORTED",
      400,
    );
  }
  const relatedSaleId = normalizeText(body.relatedSaleId || body.saleId || body.selectedSaleId);
  if (!relatedSaleId) {
    throw createRequestError("Return wajib dipilih dari transaksi Sales yang valid.", "RELATED_SALE_REQUIRED", 400);
  }

  const saleRow = await db.get("SELECT * FROM sales WHERE id = ? AND status != 'deleted'", [relatedSaleId]);
  if (!saleRow) {
    throw createRequestError("Transaksi Sales untuk retur tidak ditemukan.", "RELATED_SALE_NOT_FOUND", 404);
  }

  const salePayload = safeJsonParse(saleRow.payload_json, {});
  const saleItems = Array.isArray(salePayload.items) ? salePayload.items : [];
  if (!saleItems.length) {
    throw createRequestError("Transaksi Sales belum memiliki item yang bisa diretur.", "RELATED_SALE_ITEMS_EMPTY", 400);
  }

  const requestedItems = normalizeTransactionItems(body);
  if (!requestedItems.length) {
    throw createRequestError("Item retur wajib dipilih dari transaksi Sales.", "RETURN_ITEM_REQUIRED", 400);
  }

  const groupedSaleItems = new Map();
  for (const saleItem of saleItems) {
    const sourceType = getSaleItemSourceType(saleItem);
    const sourceId = getSaleItemSourceId(saleItem);
    if (!sourceType || !sourceId) continue;

    const key = getSaleItemMatchKey(saleItem);
    const existing = groupedSaleItems.get(key) || {
      ...saleItem,
      sourceType,
      sourceId,
      itemId: sourceId,
      variantKey: getSaleItemVariantKey(saleItem),
      quantity: 0,
    };
    existing.quantity += Math.abs(toInteger(saleItem.quantity || saleItem.qty || 0));
    groupedSaleItems.set(key, existing);
  }

  const requestedQuantityByKey = new Map();
  for (const item of requestedItems) {
    const sourceType = normalizeSourceType(item.sourceType || item.type);
    const sourceId = normalizeText(item.sourceId || item.itemId);
    const variantKey = normalizeText(item.variantKey || "");
    if (!sourceType || !sourceId) continue;
    const key = getSaleItemMatchKey({ sourceType, sourceId, variantKey });
    requestedQuantityByKey.set(key, (requestedQuantityByKey.get(key) || 0) + Math.abs(toInteger(item.quantity || item.qty || 0)));
  }

  const validatedItems = [];
  for (const item of requestedItems) {
    const sourceType = normalizeSourceType(item.sourceType || item.type);
    const sourceId = normalizeText(item.sourceId || item.itemId);
    const variantKey = normalizeText(item.variantKey || "");
    const quantity = Math.abs(toInteger(item.quantity || item.qty || 0));

    if (!sourceType || !sourceId) {
      throw createRequestError("Item retur wajib berasal dari item Sales yang dipilih.", "RETURN_ITEM_SOURCE_REQUIRED", 400);
    }
    if (quantity <= 0) {
      throw createRequestError("Qty retur harus lebih dari 0.", "INVALID_RETURN_QUANTITY", 400);
    }

    const itemMatchKey = getSaleItemMatchKey({ sourceType, sourceId, variantKey });
    const saleLine = groupedSaleItems.get(itemMatchKey);
    if (!saleLine) {
      throw createRequestError("Item retur tidak ada pada transaksi Sales yang dipilih.", "RETURN_ITEM_NOT_IN_SALE", 400);
    }

    const soldQuantity = Math.abs(toInteger(saleLine.quantity || 0));
    const returnedQuantity = await sumReturnedQuantityForSaleLine(db, relatedSaleId, saleLine);
    const remainingQuantity = Math.max(soldQuantity - returnedQuantity, 0);
    const requestedQuantityForLine = requestedQuantityByKey.get(itemMatchKey) || quantity;

    if (requestedQuantityForLine > remainingQuantity) {
      throw createRequestError(
        `Qty retur ${saleLine.itemName || saleLine.name || sourceId} melebihi sisa yang boleh diretur. Maksimal: ${remainingQuantity}.`,
        "RETURN_QUANTITY_EXCEEDS_SALE",
        400,
      );
    }

    validatedItems.push({
      ...item,
      sourceType,
      sourceId,
      itemId: sourceId,
      itemName: saleLine.itemName || saleLine.name || item.itemName || "Item Sales",
      quantity,
      variantKey,
      variantLabel: saleLine.variantLabel || item.variantLabel || "",
      unit: saleLine.unit || saleLine.stockUnit || item.unit || "",
      pricePerUnit: toInteger(saleLine.pricePerUnit || item.pricePerUnit || 0),
      relatedSaleId,
      soldQuantity,
      returnedQuantityBefore: returnedQuantity,
      remainingQuantityBefore: remainingQuantity,
    });
  }

  const saleReference = normalizeText(
    salePayload.referenceNumber
      || salePayload.saleNumber
      || salePayload.code
      || saleRow.code
      || saleRow.id,
  );

  const safeBody = { ...body };
  delete safeBody.status;
  delete safeBody.refundAmount;
  delete safeBody.refundTotal;

  return {
    ...safeBody,
    relatedSaleId,
    saleId: relatedSaleId,
    saleReference,
    saleStatus: salePayload.status || saleRow.status || "",
    customerName: salePayload.customerName || body.customerName || "",
    salesChannel: salePayload.salesChannel || body.salesChannel || "",
    items: validatedItems,
    sourceType: "sale",
    sourceId: relatedSaleId,
    status: RETURN_STATUS,
    name: body.name || `Retur ${saleReference}`,
    note: body.note || body.notes || "",
  };
};


module.exports = { buildSaleReturnValidation };
