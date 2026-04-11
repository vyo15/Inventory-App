// =====================================================
// Production BOM Options
// Master enum dan helper untuk BOM Produksi
// =====================================================

export const PRODUCTION_BOM_TARGET_TYPES = [
  { value: "semi_finished_material", label: "Semi Finished Material" },
  { value: "product", label: "Product" },
];

export const PRODUCTION_BOM_MATERIAL_ITEM_TYPES = [
  { value: "raw_material", label: "Raw Material" },
  { value: "semi_finished_material", label: "Semi Finished Material" },
];

export const toOptionMap = (options = []) =>
  options.reduce((acc, item) => {
    acc[item.value] = item.label;
    return acc;
  }, {});

export const BOM_TARGET_TYPE_MAP = toOptionMap(PRODUCTION_BOM_TARGET_TYPES);
export const BOM_MATERIAL_ITEM_TYPE_MAP = toOptionMap(
  PRODUCTION_BOM_MATERIAL_ITEM_TYPES,
);

export const DEFAULT_BOM_MATERIAL_LINE = {
  id: "",
  itemType: "raw_material",
  itemId: "",
  itemCode: "",
  itemName: "",
  unit: "pcs",
  qtyPerBatch: 1,
  wastageQty: 0,
  totalRequiredQty: 1,
  costPerUnitSnapshot: 0,
  totalCostSnapshot: 0,
  isOptional: false,
  notes: "",
};

export const DEFAULT_BOM_STEP_LINE = {
  id: "",
  stepId: "",
  stepCode: "",
  stepName: "",
  sequenceNo: 1,
  notes: "",
};

export const DEFAULT_PRODUCTION_BOM_FORM = {
  code: "",
  name: "",
  description: "",

  targetType: "product",
  targetId: "",
  targetCode: "",
  targetName: "",
  targetUnit: "pcs",

  version: 1,
  isDefault: true,
  isActive: true,
  effectiveDate: null,
  expiredDate: null,

  batchOutputQty: 1,
  yieldPercentage: 100,
  scrapPercentage: 0,

  materialCostEstimate: 0,
  laborCostEstimate: 0,
  overheadCostEstimate: 0,
  totalCostEstimate: 0,

  routingMode: "multi_step",
  materialLines: [],
  stepLines: [],

  notes: "",
};

export const calculateBomMaterialLine = (line = {}) => {
  const qtyPerBatch = Number(line.qtyPerBatch || 0);
  const wastageQty = Number(line.wastageQty || 0);
  const costPerUnitSnapshot = Number(line.costPerUnitSnapshot || 0);

  const totalRequiredQty = qtyPerBatch + wastageQty;
  const totalCostSnapshot = totalRequiredQty * costPerUnitSnapshot;

  return {
    ...line,
    totalRequiredQty,
    totalCostSnapshot,
  };
};

export const calculateBomTotals = (
  materialLines = [],
  stepLines = [],
  header = {},
) => {
  const materialCostEstimate = materialLines.reduce(
    (sum, item) => sum + Number(item.totalCostSnapshot || 0),
    0,
  );

  const laborCostEstimate = stepLines.reduce((sum, item) => {
    const useDefault = item.useStepDefaultPayroll !== false;
    if (useDefault) return sum + Number(item.payrollRate || 0);
    return sum + Number(item.payrollRate || 0);
  }, 0);

  const overheadCostEstimate = Number(header.overheadCostEstimate || 0);
  const totalCostEstimate =
    materialCostEstimate + laborCostEstimate + overheadCostEstimate;

  return {
    materialCostEstimate,
    laborCostEstimate,
    overheadCostEstimate,
    totalCostEstimate,
  };
};
