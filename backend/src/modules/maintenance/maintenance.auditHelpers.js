const { safeJsonParse } = require("../../utils/jsonUtils");
const { normalizeText, toRoundedInteger } = require("../../utils/textNormalization");

const getVariantAuditKey = (variant = {}, index = 0) => normalizeText(
  variant.variantKey
  || variant.key
  || variant.id
  || variant.variantId
  || variant.code
  || variant.sku
  || variant.label
  || variant.name
  || `variant-${index}`,
).toLowerCase();

const getCanonicalVariantSnapshot = (payload = {}) => {
  const variants = Array.isArray(payload.variants) && payload.variants.length
    ? payload.variants
    : Array.isArray(payload.variantOptions)
      ? payload.variantOptions
      : [];

  return variants.map((variant, index) => ({
    key: getVariantAuditKey(variant, index),
    currentStock: toRoundedInteger(variant.currentStock ?? variant.stock ?? 0),
    reservedStock: toRoundedInteger(variant.reservedStock ?? 0),
    availableStock: toRoundedInteger(
      variant.availableStock
      ?? (toRoundedInteger(variant.currentStock ?? variant.stock ?? 0) - toRoundedInteger(variant.reservedStock ?? 0)),
    ),
    isActive: variant.isActive !== false,
    isArchived: variant.isArchived === true,
  })).sort((left, right) => left.key.localeCompare(right.key));
};

const toInventoryMasterPayload = (row = {}) => ({
  ...safeJsonParse(row.payload_json, {}),
  id: row.id,
  code: row.code || "",
  name: row.name || "",
  status: row.status || "active",
  isActive: row.is_active === 0 ? false : true,
  currentStock: toRoundedInteger(row.current_stock),
  stock: toRoundedInteger(row.current_stock),
  reservedStock: toRoundedInteger(row.reserved_stock),
  availableStock: toRoundedInteger(row.available_stock),
  minStockAlert: toRoundedInteger(row.min_stock_alert),
});

const getStockReadModelExpectedSnapshot = (payload = {}, sourceConfig = {}) => ({
  id: `${sourceConfig.sourceType}__${normalizeText(payload.id)}`,
  sourceType: sourceConfig.sourceType,
  sourceCollection: sourceConfig.sourceCollection,
  sourceId: normalizeText(payload.id),
  code: normalizeText(payload.code).toUpperCase(),
  name: normalizeText(payload.name),
  status: normalizeText(payload.status || "active") || "active",
  isActive: payload.isActive !== false,
  currentStock: toRoundedInteger(payload.currentStock ?? payload.stock),
  reservedStock: toRoundedInteger(payload.reservedStock),
  availableStock: toRoundedInteger(payload.availableStock),
  minStockAlert: toRoundedInteger(payload.minStockAlert),
  variants: getCanonicalVariantSnapshot(payload),
});

const getStockReadModelActualSnapshot = (row = {}) => {
  const payload = safeJsonParse(row.payload_json, {}) || {};
  return {
    id: normalizeText(row.id),
    sourceType: normalizeText(payload.sourceType || row.source_type),
    sourceCollection: normalizeText(payload.sourceCollection),
    sourceId: normalizeText(payload.sourceId || row.source_id),
    code: normalizeText(row.code || payload.code).toUpperCase(),
    name: normalizeText(row.name || payload.name),
    status: normalizeText(row.status || payload.status || "active") || "active",
    isActive: row.is_active === 0 ? false : payload.isActive !== false,
    currentStock: toRoundedInteger(row.current_stock ?? payload.currentStock ?? payload.stock),
    reservedStock: toRoundedInteger(row.reserved_stock ?? payload.reservedStock),
    availableStock: toRoundedInteger(row.available_stock ?? payload.availableStock),
    minStockAlert: toRoundedInteger(row.min_stock_alert ?? payload.minStockAlert),
    variants: getCanonicalVariantSnapshot(payload),
  };
};

const getSnapshotIssues = (expected = {}, actual = {}) => {
  const issues = [];
  const scalarFields = [
    ["sourceType", "tipe sumber"],
    ["sourceCollection", "collection sumber"],
    ["sourceId", "ID sumber"],
    ["code", "kode"],
    ["name", "nama"],
    ["status", "status"],
    ["isActive", "status aktif"],
    ["currentStock", "current stock"],
    ["reservedStock", "reserved stock"],
    ["availableStock", "available stock"],
    ["minStockAlert", "minimum stock"],
  ];

  for (const [field, label] of scalarFields) {
    if (expected[field] !== actual[field]) issues.push(label);
  }

  if (JSON.stringify(expected.variants) !== JSON.stringify(actual.variants)) {
    issues.push("snapshot varian");
  }

  return issues;
};

const buildStockReadModelSourceAuditRow = (sourceRow = {}, overrides = {}) => ({
  key: sourceRow.expected.id,
  readModelId: sourceRow.expected.id,
  sourceCollection: sourceRow.sourceConfig.sourceCollection,
  sourceType: sourceRow.sourceConfig.sourceType,
  sourceId: sourceRow.expected.sourceId,
  sourceLabel: sourceRow.sourceConfig.sourceLabel,
  itemName: sourceRow.expected.name || sourceRow.expected.code || sourceRow.expected.sourceId,
  ...overrides,
});

module.exports = {
  buildStockReadModelSourceAuditRow,
  getCanonicalVariantSnapshot,
  getSnapshotIssues,
  getStockReadModelActualSnapshot,
  getStockReadModelExpectedSnapshot,
  normalizeAuditText: normalizeText,
  toFiniteInteger: toRoundedInteger,
  toInventoryMasterPayload,
};
