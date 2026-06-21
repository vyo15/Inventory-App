const { getDb } = require("../../db/connection");
const { commitStockMutation, insertEventRecord, nowIso, toInteger } = require("../../utils/sqliteStockEngine");
const { createFinanceMovement } = require("../../utils/sqliteFinanceEngine");
const { safeJsonParse } = require("../../utils/jsonUtils");

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

const normalizeText = (value) => String(value ?? "").trim();

const createRequestError = (message, code = "VALIDATION_ERROR", statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

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

const buildSaleReturnValidation = async (db, body = {}) => {
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

  return {
    ...body,
    relatedSaleId,
    saleId: relatedSaleId,
    saleReference,
    saleStatus: salePayload.status || saleRow.status || "",
    customerName: salePayload.customerName || body.customerName || "",
    salesChannel: salePayload.salesChannel || body.salesChannel || "",
    items: validatedItems,
    sourceType: "sale",
    sourceId: relatedSaleId,
    status: body.status || "Selesai",
    name: body.name || `Retur ${saleReference}`,
    note: body.note || body.notes || "",
  };
};

const shouldCreateSaleIncome = (status = "") => String(status || "").trim().toLowerCase() === "selesai";

const ACTIVE_SALE_STATUS_LABELS = Object.freeze({
  diproses: "Diproses",
  processing: "Diproses",
  processed: "Diproses",
  active: "Diproses",
  dikirim: "Dikirim",
  shipped: "Dikirim",
  sent: "Dikirim",
  selesai: "Selesai",
  completed: "Selesai",
  complete: "Selesai",
  done: "Selesai",
});

const normalizeSaleStatusForWrite = (status = "Diproses") => {
  const normalized = String(status || "Diproses").trim().toLowerCase();
  const resolvedStatus = ACTIVE_SALE_STATUS_LABELS[normalized];
  if (!resolvedStatus) {
    throw createRequestError(
      "Status sales hanya boleh Diproses, Dikirim, atau Selesai. Cancel/delete sales tetap dilarang; gunakan Return untuk barang kembali.",
      "INVALID_SALE_STATUS",
      400,
    );
  }
  return resolvedStatus;
};

const prepareTransactionBody = (transactionType, body = {}) => {
  if (transactionType !== "sale") return body;
  return {
    ...body,
    status: normalizeSaleStatusForWrite(body.status || "Diproses"),
  };
};

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

const commitStockTransaction = async ({ payload = {}, actor = "system", tableName, transactionType, stockDirection } = {}) => {
  const body = prepareTransactionBody(transactionType, payload || {});
  const referenceNumber = body.referenceNumber
    || body.code
    || body.purchaseNumber
    || body.saleNumber
    || body.returnNumber
    || `${transactionType.toUpperCase()}-${Date.now()}`;
  const items = normalizeTransactionItems(body);
  validateTransactionItems(items);

  const db = await getDb();
  try {
    await db.run("BEGIN IMMEDIATE TRANSACTION");

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
      actor,
    });

    await db.run("COMMIT");
    return { ...transactionRecord, mutationResults, financeResult };
  } catch (error) {
    await db.run("ROLLBACK").catch(() => {});
    throw error;
  }
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

const updateSaleStatus = async ({ id, status, actor = "system" } = {}) => {
  const db = await getDb();
  try {
    await db.run("BEGIN IMMEDIATE TRANSACTION");
    const row = await db.get("SELECT * FROM sales WHERE id = ? AND status != 'deleted'", [id]);
    if (!row) {
      await db.run("ROLLBACK").catch(() => {});
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

    await db.run("COMMIT");
    return { ...nextPayload, financeResult };
  } catch (error) {
    await db.run("ROLLBACK").catch(() => {});
    throw error;
  }
};

const commitReturn = async ({ payload = {}, actor = "system" } = {}) => {
  const db = await getDb();
  try {
    await db.run("BEGIN IMMEDIATE TRANSACTION");

    const body = await buildSaleReturnValidation(db, payload || {});
    const referenceNumber = body.referenceNumber || body.code || body.returnNumber || `RET-${Date.now()}`;
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
      status: body.status || "Selesai",
      transactionDate: body.transactionDate || body.date || nowIso(),
      totalAmount: toInteger(body.totalAmount ?? body.total ?? body.grandTotal ?? body.amount ?? 0),
      sourceType: "return",
      sourceId: body.relatedSaleId,
    });

    const financeResult = await createFinanceSideEffect(db, {
      tableName: "returns",
      transactionType: "return",
      transactionRecord,
      body,
      actor,
    });

    await db.run("COMMIT");
    return { ...transactionRecord, mutationResults, financeResult };
  } catch (error) {
    await db.run("ROLLBACK").catch(() => {});
    throw error;
  }
};


const getTransactionRecordRouterDefinitions = () => [
  {
    path: "/purchases",
    config: {
      tableName: "purchases",
      moduleKey: "purchases",
      entityType: "purchase",
      codePrefix: "PUR",
      requiredName: false,
      orderBy: "transaction_date DESC, updated_at DESC",
      protectedWriteNote: [
        "Purchase database lokal atomic aktif untuk Product/Raw stock-in.",
        "Direct write generic diblokir agar stok/finance tidak dobel.",
      ].join(" "),
      allowDirectCreate: false,
      allowDirectUpdate: false,
      allowDirectDelete: false,
      blockedWriteMessage: [
        "Purchase wajib lewat POST /api/transactions/purchases/commit",
        "agar stok masuk, expense, audit log, dan transaction record atomic.",
      ].join(" "),
    },
  },
  {
    path: "/sales",
    config: {
      tableName: "sales",
      moduleKey: "sales",
      entityType: "sale",
      codePrefix: "ORD",
      requiredName: false,
      orderBy: "transaction_date DESC, updated_at DESC",
      protectedWriteNote: [
        "Sales database lokal atomic aktif untuk Product/Raw stock-out.",
        "Direct write/delete diblokir; status aktif hanya Diproses, Dikirim, Selesai.",
      ].join(" "),
      allowDirectCreate: false,
      allowDirectUpdate: false,
      allowDirectDelete: false,
      blockedWriteMessage: [
        "Sales wajib lewat endpoint commit/status resmi.",
        "Cancel/delete sales dilarang; gunakan Return untuk barang kembali.",
      ].join(" "),
    },
  },
  {
    path: "/returns",
    config: {
      tableName: "returns",
      moduleKey: "returns",
      entityType: "return",
      codePrefix: "RET",
      requiredName: false,
      orderBy: "transaction_date DESC, updated_at DESC",
      protectedWriteNote: [
        "Returns aktif wajib terkait transaksi Sales.",
        "Direct write generic diblokir agar stok kembali tidak bisa dibuat tanpa relasi sales.",
      ].join(" "),
      allowDirectCreate: false,
      allowDirectUpdate: false,
      allowDirectDelete: false,
      blockedWriteMessage: [
        "Return wajib lewat POST /api/transactions/returns/commit dan harus terkait Sales",
        "agar qty retur, stok kembali, audit log, dan transaction record tetap terkunci.",
      ].join(" "),
    },
  },
];

module.exports = {
  commitPurchase,
  commitReturn,
  commitSale,
  getTransactionRecordRouterDefinitions,
  updateSaleStatus,
};
