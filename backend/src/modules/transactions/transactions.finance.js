const { nowIso, toInteger } = require("../stock/engine");
const { createFinanceMovement } = require("../finance/finance.engine");
const { createRequestError } = require("./transactions.common");

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

const normalizePurchaseStatusForWrite = (status = "Selesai") => {
  const normalized = String(status || "Selesai").trim().toLowerCase();
  if (["selesai", "completed", "complete", "done", "active", "tercatat"].includes(normalized)) {
    return "Selesai";
  }
  throw createRequestError(
    "Status Purchase ditentukan sistem dan hanya boleh Selesai. Draft, cancel, atau delete tidak diterima dari endpoint commit.",
    "INVALID_PURCHASE_STATUS",
    400,
  );
};

const prepareTransactionBody = (transactionType, body = {}) => {
  if (transactionType === "sale") {
    return {
      ...body,
      status: normalizeSaleStatusForWrite(body.status || "Diproses"),
    };
  }
  if (transactionType === "purchase") {
    return {
      ...body,
      status: normalizePurchaseStatusForWrite(body.status || "Selesai"),
    };
  }
  return body;
};

const createFinanceSideEffect = async (db, { transactionType, transactionRecord, body, actor }) => {
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
    throw createRequestError(
      "Return tidak boleh membuat expense atau ledger otomatis. Gunakan proses finance terpisah yang disetujui bila ada refund kas.",
      "RETURN_FINANCE_SIDE_EFFECT_FORBIDDEN",
      400,
    );
  }

  return null;
};


module.exports = {
  createFinanceSideEffect,
  normalizePurchaseStatusForWrite,
  normalizeSaleStatusForWrite,
  prepareTransactionBody,
  shouldCreateSaleIncome,
};
