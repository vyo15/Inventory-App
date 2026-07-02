const { normalizeText } = require("../../utils/textNormalization");
const { createServiceError } = require("../../utils/httpError");
const { toInteger } = require("../stock/engine");
const { formatBusinessDateStamp, resolveBusinessCode } = require("../../utils/businessCodeCounter");

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


const TRANSACTION_CODE_PREFIX = Object.freeze({
  purchase: "PUR",
  sale: "ORD",
  return: "RET",
});

const getTransactionCounterOptions = ({ tableName, transactionType, dateValue, requestedCode = "" }) => {
  const basePrefix = TRANSACTION_CODE_PREFIX[transactionType];
  const normalizedRequestedCode = normalizeText(requestedCode).toUpperCase();
  const requestedMatch = normalizedRequestedCode.match(new RegExp(`^${basePrefix}-(\\d{8})-\\d+$`));
  const dateStamp = requestedMatch?.[1] || formatBusinessDateStamp(dateValue);
  const prefix = `${basePrefix}-${dateStamp}`;
  return {
    counterKey: `${tableName}:${prefix}`,
    prefix,
    tableName,
    columnName: "code",
    minWidth: 3,
    notes: `Runtime counter ${transactionType} per tanggal`,
  };
};

const resolveTransactionReference = async (db, {
  body,
  tableName,
  transactionType,
}) => {
  const requestedCode = body.referenceNumber
    || body.code
    || body.purchaseNumber
    || body.saleNumber
    || body.returnNumber
    || "";
  const code = await resolveBusinessCode(
    db,
    requestedCode,
    getTransactionCounterOptions({
      tableName,
      transactionType,
      dateValue: body.transactionDate || body.date || body.createdAt,
      requestedCode,
    }),
  );
  if (!code) {
    throw createRequestError(
      "Nomor referensi transaksi sudah pernah digunakan.",
      "DUPLICATE_REFERENCE",
      409,
    );
  }
  return code;
};

const createRequestError = createServiceError;


module.exports = {
  createRequestError,
  normalizeSourceType,
  normalizeText,
  normalizeTransactionItems,
  resolveTransactionReference,
};
