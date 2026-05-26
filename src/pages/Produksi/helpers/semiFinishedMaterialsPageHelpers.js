import {
  calculateSemiFinishedTotalsFromVariants,
  DEFAULT_SEMI_FINISHED_FORM,
  DEFAULT_SEMI_FINISHED_VARIANT,
  normalizeSemiFinishedVariants,
  SEMI_FINISHED_COLOR_MAP,
  SEMI_FINISHED_GROUP_OPTIONS,
  SEMI_FINISHED_GROUP_MAP,
} from "../../../constants/semiFinishedMaterialOptions";
import { formatStockWithUnitId } from "../../../utils/formatters/stockUnit";
import { getVariantAwareStockStatusMeta } from "../../../utils/stock/stockHelpers";

// IMS NOTE [AKTIF/BATCH 19/GUARDED] — helper UI/read-only halaman SemiFinishedMaterials.
// Fungsi blok: memusatkan normalizer form, label grup/varian, dan status stok semi finished.
// Hubungan flow: helper ini tidak menulis master stok, Work Log, HPP, payroll, atau read model.
// Alasan logic: halaman semi finished masih besar; extraction dibatasi ke helper pure tanpa mengubah service payload.
export const normalizeFormVariants = (variants = [], hasVariants = true) => {
  if (!hasVariants) {
    return [];
  }

  const normalized = normalizeSemiFinishedVariants(variants);

  if (normalized.length > 0) {
    return normalized;
  }

  return [{ ...DEFAULT_SEMI_FINISHED_VARIANT }];
};

export const buildFormValues = (record = {}) => {
  const hasVariants = record?.hasVariants === true || (record?.variants || []).length > 0;
  const totals = calculateSemiFinishedTotalsFromVariants(record.variants || []);

  return {
    ...DEFAULT_SEMI_FINISHED_FORM,
    ...record,
    hasVariants,
    variantLabel: record.variantLabel || "Varian",
    variants: normalizeFormVariants(record.variants || [], hasVariants),
    currentStock: hasVariants ? totals.currentStock : Number(record.currentStock || 0),
    reservedStock: hasVariants ? totals.reservedStock : Number(record.reservedStock || 0),
    availableStock:
      hasVariants
        ? totals.availableStock
        : Math.max(
            Number(record.currentStock || 0) - Number(record.reservedStock || 0),
            0,
          ),
    minStockAlert: Number(record.minStockAlert || 0),
    averageCostPerUnit:
      hasVariants
        ? Number(totals.averageCostPerUnit || 0)
        : Number(record.averageCostPerUnit || 0),
  };
};

export const formatStockWithUnit = formatStockWithUnitId;

export const getVariantDisplayLabel = (variant = {}, index = 0) =>
  variant.variantLabel
  || variant.label
  || variant.name
  || SEMI_FINISHED_COLOR_MAP[variant.color]
  || variant.color
  || `Varian ${index + 1}`;

const FLOWER_COMPONENT_RECIPE_QTY_MAP = {
  kelopak: 10,
  daun: 1,
  kawat: 1,
};

const FLOWER_COMPONENT_LABEL_MAP = {
  kelopak: "kelopak",
  daun: "daun",
  kawat: "tangkai",
};

export const resolveFlowerComponentRecipeMeta = (record = {}) => {
  const category = String(record?.category || "").toLowerCase();
  const qty = FLOWER_COMPONENT_RECIPE_QTY_MAP[category];

  if (!qty) return null;

  return {
    qty,
    label: FLOWER_COMPONENT_LABEL_MAP[category] || "komponen",
  };
};

export const resolveSemiFinishedActiveHppCost = (record = {}) => {
  const variants = Array.isArray(record?.variants) ? record.variants : [];
  const hasVariants = record?.hasVariants === true || variants.length > 0;

  if (hasVariants) {
    const totals = calculateSemiFinishedTotalsFromVariants(variants);
    return Number(
      totals?.averageCostPerUnit
      || record.averageCostPerUnit
      || record.lastProductionCostPerUnit
      || 0,
    );
  }

  return Number(record?.averageCostPerUnit || record?.lastProductionCostPerUnit || 0);
};

export const FALLBACK_SEMI_FINISHED_GROUP_KEY = "__general_reusable";
export const FALLBACK_SEMI_FINISHED_GROUP_LABEL = "Umum / Reusable";

export const normalizeSemiFinishedGroupKey = (value = "") => String(value || "").trim();

const normalizeSemiFinishedGroupLookupKey = (value = "") =>
  normalizeSemiFinishedGroupKey(value)
    .toLowerCase()
    .replace(/[\s_-]+/g, "_");

const getKnownSemiFinishedGroupKey = (value = "") => {
  const lookupKey = normalizeSemiFinishedGroupLookupKey(value);

  if (!lookupKey) return "";

  return (
    SEMI_FINISHED_GROUP_OPTIONS.find((option) =>
      [option.value, option.label].some(
        (candidate) => normalizeSemiFinishedGroupLookupKey(candidate) === lookupKey,
      ),
    )?.value || ""
  );
};

export const getSemiFinishedGroupLabel = (value = "", fallbackLabel = "-") => {
  const key = normalizeSemiFinishedGroupKey(value);
  if (!key) return fallbackLabel;

  const knownKey = getKnownSemiFinishedGroupKey(key);
  return SEMI_FINISHED_GROUP_MAP[knownKey] || key;
};

export const buildSemiFinishedGroupOptions = (materials = [], { includeGeneral = false } = {}) => {
  const staticOptions = SEMI_FINISHED_GROUP_OPTIONS.map((option) => ({ ...option }));
  const knownKeys = new Set(
    staticOptions.flatMap((option) => [option.value, option.label].map(normalizeSemiFinishedGroupLookupKey)),
  );
  const dynamicOptions = [];
  const dynamicKeys = new Set();
  let hasGeneralGroup = false;

  materials.forEach((item) => {
    const key = normalizeSemiFinishedGroupKey(item?.flowerGroup);
    const lookupKey = normalizeSemiFinishedGroupLookupKey(key);

    if (!key) {
      hasGeneralGroup = true;
      return;
    }

    if (knownKeys.has(lookupKey) || dynamicKeys.has(lookupKey)) return;

    dynamicKeys.add(lookupKey);
    dynamicOptions.push({
      value: key,
      label: getSemiFinishedGroupLabel(key, key),
    });
  });

  dynamicOptions.sort((a, b) => a.label.localeCompare(b.label));

  return [
    ...(includeGeneral && hasGeneralGroup
      ? [{ value: FALLBACK_SEMI_FINISHED_GROUP_KEY, label: FALLBACK_SEMI_FINISHED_GROUP_LABEL }]
      : []),
    ...staticOptions,
    ...dynamicOptions,
  ];
};

export const getSemiFinishedMinimumStockValue = (record = {}) => {
  const stockValue = Number(record.availableStock ?? record.currentStock ?? record.stock ?? 0);
  return Number.isFinite(stockValue) ? stockValue : 0;
};

export const getStockStatusMeta = (record = {}) => {
  const comparableStock = getSemiFinishedMinimumStockValue(record);
  const minStockAlertValue = Number(record.minStockAlert || 0);
  const minStockAlert = Number.isFinite(minStockAlertValue) ? minStockAlertValue : 0;

  if (record.isActive === false) {
    return { color: "default", label: "Nonaktif", alertType: "info" };
  }

  const variantStatusMeta = getVariantAwareStockStatusMeta(record, {
    sourceType: "semi_finished",
    threshold: minStockAlert,
  });

  if (variantStatusMeta) return variantStatusMeta;

  if (comparableStock <= 0) {
    return { color: "red", label: "Kosong", alertType: "error" };
  }

  if (minStockAlert > 0 && comparableStock <= minStockAlert) {
    return { color: "orange", label: "Stok Rendah", alertType: "warning" };
  }

  return { color: "green", label: "Aman", alertType: "success" };
};

export const compactCellStyles = {
  stack: { display: "flex", flexDirection: "column", gap: 2 },
  meta: { fontSize: 12, lineHeight: 1.35 },
};
