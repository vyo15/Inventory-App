const { runInTransaction } = require("../../db/connection");
const { safeJsonParse } = require("../../utils/jsonUtils");
const { resolveBusinessCode } = require("../../utils/businessCodeCounter");
const {
  matchesVariantReference,
  resolveInventoryVariantCollection,
} = require("../../utils/sqliteStockEngine");
const {
  normalizeSourceType,
  toPositiveNumber,
} = require("./production.calculations");

const normalizeText = (value = "") => String(value ?? "").trim();
const normalizeLower = (value = "") => normalizeText(value).toLowerCase();
const normalizeUpper = (value = "") => normalizeText(value).toUpperCase();
const nowIso = () => new Date().toISOString();

class ProductionError extends Error {
  constructor(publicMessage, errorCode = "PRODUCTION_VALIDATION_ERROR", statusCode = 400) {
    super(publicMessage);
    this.publicMessage = publicMessage;
    this.errorCode = errorCode;
    this.statusCode = statusCode;
  }
}

const fail = (message, code = "PRODUCTION_VALIDATION_ERROR", status = 400) => {
  throw new ProductionError(message, code, status);
};

const runProductionTransaction = (callback) => runInTransaction(callback);

const toRecord = (row = {}) => ({
  ...safeJsonParse(row.payload_json, {}),
  id: row.id,
  code: row.code || "",
  name: row.name || "",
  status: row.status || "active",
  isActive: row.is_active === 0 ? false : true,
  currentStock: row.current_stock ?? 0,
  stock: row.current_stock ?? 0,
  reservedStock: row.reserved_stock ?? 0,
  availableStock: row.available_stock ?? 0,
  totalAmount: row.total_amount ?? 0,
  transactionDate: row.transaction_date || null,
  sourceType: row.source_type || null,
  sourceId: row.source_id || null,
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const getRecord = async (db, tableName, id, label) => {
  const row = await db.get(
    `SELECT * FROM ${tableName} WHERE id = ? AND status != 'deleted'`,
    [id],
  );
  if (!row) fail(`${label} database lokal tidak ditemukan.`, "NOT_FOUND", 404);
  return toRecord(row);
};

const listRecords = async (db, tableName) => {
  const rows = await db.all(`SELECT * FROM ${tableName} WHERE status != 'deleted'`);
  return rows.map(toRecord);
};

const getProductionCodeCounterOptions = (tableName, prefix) => ({
  counterKey: `${tableName}:${normalizeUpper(prefix)}`,
  prefix: normalizeUpper(prefix),
  tableName,
  columnName: "code",
  minWidth: 3,
  notes: `Runtime counter untuk ${tableName}`,
});

const resolveProductionCode = async (db, tableName, prefix, requestedCode = "") => {
  const code = await resolveBusinessCode(
    db,
    requestedCode,
    getProductionCodeCounterOptions(tableName, prefix),
  );
  if (!code) {
    fail("Kode produksi sudah pernah digunakan.", "PRODUCTION_DUPLICATE_CODE", 409);
  }
  return code;
};

const findVariant = (item = {}, variantKey = "") => {
  const normalizedKey = normalizeLower(variantKey);
  if (!normalizedKey) return null;
  const variants = resolveInventoryVariantCollection(item).variants;
  return variants.find((variant) => matchesVariantReference(variant, normalizedKey)) || null;
};

const getMaterialUnitCost = ({ sourceType, item, variantKey = "" } = {}) => {
  const normalizedType = normalizeSourceType(sourceType);
  const variant = findVariant(item, variantKey);
  const candidatesByType = {
    raw_material: ["averageActualUnitCost", "restockReferencePrice"],
    semi_finished: ["averageCostPerUnit", "lastProductionCostPerUnit"],
    product: ["hppPerUnit", "averageCostPerUnit", "costPerUnit"],
  };
  const candidates = candidatesByType[normalizedType] || [];

  for (const source of [variant, item]) {
    if (!source) continue;
    for (const key of candidates) {
      const amount = toPositiveNumber(source[key]);
      if (amount > 0) {
        return {
          unitCost: amount,
          costSource: source === variant ? `variant.${key}` : `master.${key}`,
        };
      }
    }
  }

  return { unitCost: 0, costSource: "missing_cost_snapshot" };
};

module.exports = {
  ProductionError,
  fail,
  findVariant,
  getMaterialUnitCost,
  getRecord,
  listRecords,
  normalizeLower,
  normalizeText,
  normalizeUpper,
  nowIso,
  resolveProductionCode,
  runProductionTransaction,
  toRecord,
};
