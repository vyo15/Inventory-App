import React from "react";
import dayjs from "dayjs";
import { SEMI_FINISHED_CATEGORY_MAP, SEMI_FINISHED_GROUP_MAP } from "../../../constants/semiFinishedMaterialOptions";
import formatNumber from "../../../utils/formatters/numberId";

// IMS NOTE [AKTIF/BATCH 19/GUARDED] — helper UI/read-only halaman ProductionOrders.
// Fungsi blok: memusatkan opsi, formatter, dan resolver display requirement/target PO.
// Hubungan flow: hanya presentasi/preview; tidak mengubah submit PO, refresh need, Start Production, stok, Work Log, HPP, payroll, atau read model.
// Alasan logic: halaman ProductionOrders masih besar dan sensitive, sehingga yang dipisah hanya helper pure tanpa side-effect.
export const PRODUCTION_ORDER_TARGET_TYPES = [
  {
    value: "semi_finished_material",
    label: "Bahan / Semi Produk",
  },
  {
    value: "product",
    label: "Produk Jadi",
  },
];

export const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export const ORDER_STATUS_MAP = {
  draft: { text: "Draft", status: "default" },
  shortage: { text: "Shortage", status: "error" },
  ready: { text: "Ready", status: "processing" },
  in_production: { text: "In Production", status: "processing" },
  completed: { text: "Completed", status: "success" },
  released: { text: "Released", status: "warning" },
  cancelled: { text: "Cancelled", status: "default" },
};

const PRIORITY_META_MAP = {
  low: { label: "Low", color: "default" },
  normal: { label: "Normal", color: "blue" },
  high: { label: "High", color: "orange" },
  urgent: { label: "Urgent", color: "red" },
};

export const getPriorityMeta = (value) =>
  PRIORITY_META_MAP[value] || {
    label: value ? String(value) : "-",
    color: "default",
  };

export const formatDateTimeLabel = (value) => {
  if (!value) return "-";
  const parsed = dayjs(value?.toDate?.() || value);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY HH:mm") : "-";
};

export const orderUiClassNames = {
  stack: "ims-cell-stack ims-cell-stack-tight",
  meta: "ims-cell-meta",
  title: "ims-cell-title",
};

export const renderOrderCellBlock = (primary, secondaryLines = []) => (
  <div className={orderUiClassNames.stack}>
    <div className={orderUiClassNames.title}>{primary || "-"}</div>
    {secondaryLines.filter(Boolean).map((line, index) => (
      <div key={index} className={orderUiClassNames.meta}>{line}</div>
    ))}
  </div>
);

export const formatQtyWithUnit = (value, unit = "") => {
  const normalizedUnit = String(unit || "").trim();
  return `${formatNumber(Number(value || 0))}${normalizedUnit ? ` ${normalizedUnit}` : ""}`;
};

export const normalizeRequirementVariantStrategy = (line = {}) => {
  const rawStrategy = String(line.materialVariantStrategy || "none").trim().toLowerCase();
  return ["inherit", "fixed", "none"].includes(rawStrategy) ? rawStrategy : "none";
};

export const lineRequiresVariantStock = (line = {}) => {
  const strategy = normalizeRequirementVariantStrategy(line);
  return line.materialHasVariants === true && strategy !== "none";
};

const FALLBACK_SEMI_FAMILY_KEY = "__general";
const FALLBACK_SEMI_CATEGORY_KEY = "__uncategorized";

const normalizeOptionKey = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "_");

const getExactKnownOptionKey = (value = "", optionMap = {}) => {
  const normalizedValue = normalizeOptionKey(value);

  if (!normalizedValue) return "";

  return (
    Object.entries(optionMap).find(([key, label]) => {
      const normalizedKey = normalizeOptionKey(key);
      const normalizedLabel = normalizeOptionKey(label);
      return normalizedValue === normalizedKey || normalizedValue === normalizedLabel;
    })?.[0] || ""
  );
};

const resolveExplicitSemiOptionMeta = ({
  value = "",
  optionMap = {},
  fallbackKey = "",
  fallbackLabel = "",
} = {}) => {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return { key: fallbackKey, label: fallbackLabel };
  }

  const knownKey = getExactKnownOptionKey(rawValue, optionMap);

  if (knownKey) {
    return { key: knownKey, label: optionMap[knownKey] || rawValue };
  }

  return { key: rawValue, label: rawValue };
};

export const resolveSemiProductionGroupMeta = ({ reference = null } = {}) => {
  const familyMeta = resolveExplicitSemiOptionMeta({
    value: reference?.flowerGroup,
    optionMap: SEMI_FINISHED_GROUP_MAP,
    fallbackKey: FALLBACK_SEMI_FAMILY_KEY,
    fallbackLabel: "Umum / Reusable",
  });
  const categoryMeta = resolveExplicitSemiOptionMeta({
    value: reference?.category,
    optionMap: SEMI_FINISHED_CATEGORY_MAP,
    fallbackKey: FALLBACK_SEMI_CATEGORY_KEY,
    fallbackLabel: "Tanpa Kategori",
  });

  return {
    familyKey: familyMeta.key,
    familyLabel: familyMeta.label,
    categoryKey: categoryMeta.key,
    categoryLabel: categoryMeta.label,
  };
};

export const getProductionTargetDisplayLabel = (group = {}) =>
  group.targetName || "Target belum dikenal";

export const getRecipeDisplayLabel = (option = {}) => {
  const raw = option.raw || {};
  const rawName = String(raw.name || raw.bomName || option.label || "").trim();
  const cleanedName = rawName
    .replace(/^BOM\s*[-:]?\s*/i, "")
    .replace(/^([^\s]+)\s+-\s+BOM\s*/i, "")
    .trim();

  if (cleanedName) {
    return cleanedName.toLowerCase().startsWith("resep")
      ? cleanedName
      : `Resep ${cleanedName}`;
  }

  return "Resep Produksi";
};

export const getRequirementStockSourceMeta = (line = {}) => {
  const variantLabel = line.resolvedVariantLabel || line.fixedVariantLabel || "";

  if (line.stockSourceType === "variant" || line.resolvedVariantKey || variantLabel) {
    return {
      color: "purple",
      label: "Variant",
      variantLabel: variantLabel || "Varian terpilih",
    };
  }

  if (lineRequiresVariantStock(line)) {
    return {
      color: "orange",
      label: "Varian tidak ditemukan",
      variantLabel: "Refresh Need / cek BOM",
    };
  }

  return {
    color: "default",
    label: "Master",
    variantLabel: "Tanpa varian",
  };
};

export const getCompactLineStatus = (line = {}) => {
  const shortageQty = Number(line.shortageQty || 0);
  if (shortageQty > 0) {
    return {
      color: "red",
      label: `Kurang ${formatQtyWithUnit(shortageQty, line.unit)}`,
    };
  }

  return {
    color: "green",
    label: "Cukup",
  };
};
