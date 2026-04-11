// =====================================================
// Semi Finished Material Options
// Master enum dan helper untuk Semi Finished Materials
// =====================================================

export const SEMI_FINISHED_CATEGORIES = [
  { value: "kelopak", label: "Kelopak" },
  { value: "daun", label: "Daun" },
  { value: "kawat", label: "Kawat" },
  { value: "subassembly", label: "Sub Assembly" },
  { value: "wrapping", label: "Wrapping" },
  { value: "aksesoris", label: "Aksesoris" },
  { value: "lainnya", label: "Lainnya" },
];

export const SEMI_FINISHED_TYPES = [
  { value: "component", label: "Component" },
  { value: "subassembly", label: "Subassembly" },
  { value: "support_material", label: "Support Material" },
];

export const SEMI_FINISHED_VALUATION_METHODS = [
  { value: "average", label: "Average Cost" },
];

export const toOptionMap = (options = []) =>
  options.reduce((acc, item) => {
    acc[item.value] = item.label;
    return acc;
  }, {});

export const SEMI_FINISHED_CATEGORY_MAP = toOptionMap(SEMI_FINISHED_CATEGORIES);
export const SEMI_FINISHED_TYPE_MAP = toOptionMap(SEMI_FINISHED_TYPES);
export const SEMI_FINISHED_VALUATION_METHOD_MAP = toOptionMap(
  SEMI_FINISHED_VALUATION_METHODS,
);

export const DEFAULT_SEMI_FINISHED_FORM = {
  code: "",
  name: "",
  description: "",
  category: "kelopak",
  type: "component",
  unit: "pcs",

  relatedProductIds: [],
  relatedProductNames: [],
  tags: [],

  currentStock: 0,
  reservedStock: 0,
  availableStock: 0,
  minStockAlert: 0,
  maxStockTarget: null,

  referenceCostPerUnit: 0,
  lastProductionCostPerUnit: 0,
  averageCostPerUnit: 0,
  valuationMethod: "average",

  isActive: true,
  isSellable: false,
  notes: "",
};

export const formatSemiFinishedStockSummary = (item = {}) => {
  const current = Number(item?.currentStock || 0);
  const reserved = Number(item?.reservedStock || 0);
  const available = Number(item?.availableStock || current - reserved);

  const fmt = new Intl.NumberFormat("id-ID");

  return `Stok ${fmt.format(current)} | Reserved ${fmt.format(
    reserved,
  )} | Tersedia ${fmt.format(available)}`;
};
