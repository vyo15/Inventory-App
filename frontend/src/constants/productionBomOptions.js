// =====================================================
// Production BOM Options
// Master enum dan helper untuk BOM Produksi
// =====================================================

import { toOptionMap } from "../utils/options/optionMap";
import { calculateBomCostSummary } from "../utils/produksi/productionBomCostHelpers";

export { toOptionMap };

export const PRODUCTION_BOM_TARGET_TYPES = [
  { value: "semi_finished_material", label: "Semi Finished Material" },
  { value: "product", label: "Product" },
];

export const PRODUCTION_BOM_MATERIAL_ITEM_TYPES = [
  { value: "raw_material", label: "Raw Material" },
  { value: "semi_finished_material", label: "Semi Finished Material" },
];

export const BOM_MATERIAL_VARIANT_STRATEGIES = [
  { value: "inherit", label: "Ikuti Varian Target" },
  { value: "fixed", label: "Varian Tetap" },
  { value: "none", label: "Tanpa Varian" },
];

export const BOM_TARGET_TYPE_MAP = toOptionMap(PRODUCTION_BOM_TARGET_TYPES);
export const BOM_MATERIAL_ITEM_TYPE_MAP = toOptionMap(
  PRODUCTION_BOM_MATERIAL_ITEM_TYPES,
);
export const BOM_MATERIAL_VARIANT_STRATEGY_MAP = toOptionMap(
  BOM_MATERIAL_VARIANT_STRATEGIES,
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
  materialHasVariants: false,
  materialVariantStrategy: "none",
  fixedVariantKey: "",
  fixedVariantLabel: "",
  isOptional: false,
  notes: "",
};

export const DEFAULT_BOM_STEP_LINE = {
  id: "",
  stepId: "",
  stepCode: "",
  stepName: "",
  sequenceNo: 1,
  payrollMode: "per_batch",
  payrollRate: 0,
  payrollQtyBase: 1,
  payrollOutputBasis: "good_qty",
  payrollClassification: "direct_labor",
  includePayrollInHpp: true,
  useStepDefaultPayroll: true,
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

  routingMode: "single_step",
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
) => calculateBomCostSummary({ materialLines, stepLines, header });
