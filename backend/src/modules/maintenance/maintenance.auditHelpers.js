const { safeJsonParse } = require("../../utils/jsonUtils");

const toFiniteInteger = (value = 0) => {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? Math.round(numericValue) : 0;
};

const normalizeAuditText = (value = "") => String(value ?? "").trim();

const getVariantAuditKey = (variant = {}, index = 0) => normalizeAuditText(
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
    currentStock: toFiniteInteger(variant.currentStock ?? variant.stock ?? 0),
    reservedStock: toFiniteInteger(variant.reservedStock ?? 0),
    availableStock: toFiniteInteger(
      variant.availableStock
      ?? (toFiniteInteger(variant.currentStock ?? variant.stock ?? 0) - toFiniteInteger(variant.reservedStock ?? 0)),
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
  currentStock: toFiniteInteger(row.current_stock),
  stock: toFiniteInteger(row.current_stock),
  reservedStock: toFiniteInteger(row.reserved_stock),
  availableStock: toFiniteInteger(row.available_stock),
  minStockAlert: toFiniteInteger(row.min_stock_alert),
});

const getStockReadModelExpectedSnapshot = (payload = {}, sourceConfig = {}) => ({
  id: `${sourceConfig.sourceType}__${normalizeAuditText(payload.id)}`,
  sourceType: sourceConfig.sourceType,
  sourceCollection: sourceConfig.sourceCollection,
  sourceId: normalizeAuditText(payload.id),
  code: normalizeAuditText(payload.code).toUpperCase(),
  name: normalizeAuditText(payload.name),
  status: normalizeAuditText(payload.status || "active") || "active",
  isActive: payload.isActive !== false,
  currentStock: toFiniteInteger(payload.currentStock ?? payload.stock),
  reservedStock: toFiniteInteger(payload.reservedStock),
  availableStock: toFiniteInteger(payload.availableStock),
  minStockAlert: toFiniteInteger(payload.minStockAlert),
  variants: getCanonicalVariantSnapshot(payload),
});

const getStockReadModelActualSnapshot = (row = {}) => {
  const payload = safeJsonParse(row.payload_json, {}) || {};
  return {
    id: normalizeAuditText(row.id),
    sourceType: normalizeAuditText(payload.sourceType || row.source_type),
    sourceCollection: normalizeAuditText(payload.sourceCollection),
    sourceId: normalizeAuditText(payload.sourceId || row.source_id),
    code: normalizeAuditText(row.code || payload.code).toUpperCase(),
    name: normalizeAuditText(row.name || payload.name),
    status: normalizeAuditText(row.status || payload.status || "active") || "active",
    isActive: row.is_active === 0 ? false : payload.isActive !== false,
    currentStock: toFiniteInteger(row.current_stock ?? payload.currentStock ?? payload.stock),
    reservedStock: toFiniteInteger(row.reserved_stock ?? payload.reservedStock),
    availableStock: toFiniteInteger(row.available_stock ?? payload.availableStock),
    minStockAlert: toFiniteInteger(row.min_stock_alert ?? payload.minStockAlert),
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
  normalizeAuditText,
  toFiniteInteger,
  toInventoryMasterPayload,
};
