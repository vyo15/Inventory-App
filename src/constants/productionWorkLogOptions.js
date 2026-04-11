// =====================================================
// Production Work Log Options
// Master enum dan helper untuk Work Log Produksi
// =====================================================

export const PRODUCTION_WORK_LOG_SOURCE_TYPES = [
  { value: "planned", label: "Planned" },
  { value: "manual", label: "Manual" },
  { value: "production_order", label: "Production Order" },
];

export const PRODUCTION_WORK_LOG_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const PRODUCTION_WORK_LOG_TARGET_TYPES = [
  { value: "semi_finished_material", label: "Semi Finished Material" },
  { value: "product", label: "Product" },
];

export const PRODUCTION_WORK_LOG_STOCK_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "applied", label: "Applied" },
  { value: "reverted", label: "Reverted" },
];

export const PRODUCTION_WORK_LOG_PAYROLL_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "calculated", label: "Calculated" },
  { value: "posted", label: "Posted" },
  { value: "reverted", label: "Reverted" },
];

export const toOptionMap = (options = []) =>
  options.reduce((acc, item) => {
    acc[item.value] = item.label;
    return acc;
  }, {});

export const WORK_LOG_SOURCE_TYPE_MAP = toOptionMap(
  PRODUCTION_WORK_LOG_SOURCE_TYPES,
);
export const WORK_LOG_STATUS_MAP = toOptionMap(PRODUCTION_WORK_LOG_STATUSES);
export const WORK_LOG_TARGET_TYPE_MAP = toOptionMap(
  PRODUCTION_WORK_LOG_TARGET_TYPES,
);
export const WORK_LOG_STOCK_STATUS_MAP = toOptionMap(
  PRODUCTION_WORK_LOG_STOCK_STATUSES,
);
export const WORK_LOG_PAYROLL_STATUS_MAP = toOptionMap(
  PRODUCTION_WORK_LOG_PAYROLL_STATUSES,
);

export const DEFAULT_WORK_LOG_MATERIAL_USAGE = {
  id: "",
  itemType: "raw_material",
  itemId: "",
  itemCode: "",
  itemName: "",
  unit: "pcs",

  plannedQty: 0,
  actualQty: 0,
  varianceQty: 0,

  costPerUnitSnapshot: 0,
  totalCostSnapshot: 0,

  stockDeducted: false,
  stockDeductedAt: null,

  notes: "",
};

export const DEFAULT_WORK_LOG_OUTPUT = {
  id: "",
  outputType: "semi_finished_material",
  outputIdRef: "",
  outputCode: "",
  outputName: "",
  unit: "pcs",

  goodQty: 0,
  rejectQty: 0,
  reworkQty: 0,

  costPerUnit: 0,
  totalCost: 0,

  stockAdded: false,
  stockAddedAt: null,

  notes: "",
};

export const DEFAULT_PRODUCTION_WORK_LOG_FORM = {
  workNumber: "",
  workDate: null,

  bomId: "",
  bomCode: "",
  bomName: "",
  bomVersion: null,

  targetType: "product",
  targetId: "",
  targetCode: "",
  targetName: "",
  targetUnit: "pcs",

  stepId: "",
  stepCode: "",
  stepName: "",
  sequenceNo: 1,

  sourceType: "manual",
  status: "draft",

  plannedQty: 1,
  actualOutputQty: 0,
  goodQty: 0,
  rejectQty: 0,
  reworkQty: 0,
  scrapQty: 0,

  startedAt: null,
  completedAt: null,
  durationMinutesActual: 0,

  workerIds: [],
  workerCodes: [],
  workerNames: [],
  workerCount: 0,

  materialCostActual: 0,
  laborCostActual: 0,
  overheadCostActual: 0,
  totalCostActual: 0,
  costPerGoodUnit: 0,

  stockConsumptionStatus: "pending",
  stockOutputStatus: "pending",

  payrollCalculated: false,
  payrollCalculationStatus: "pending",

  materialUsages: [],
  outputs: [],

  notes: "",
  cancellationReason: "",
};

export const calculateMaterialUsageLine = (line = {}) => {
  const plannedQty = Number(line.plannedQty || 0);
  const actualQty = Number(line.actualQty || 0);
  const varianceQty = actualQty - plannedQty;
  const costPerUnitSnapshot = Number(line.costPerUnitSnapshot || 0);
  const totalCostSnapshot = actualQty * costPerUnitSnapshot;

  return {
    ...line,
    plannedQty,
    actualQty,
    varianceQty,
    costPerUnitSnapshot,
    totalCostSnapshot,
  };
};

export const calculateOutputLine = (line = {}) => {
  const goodQty = Number(line.goodQty || 0);
  const rejectQty = Number(line.rejectQty || 0);
  const reworkQty = Number(line.reworkQty || 0);
  const costPerUnit = Number(line.costPerUnit || 0);
  const totalCost = goodQty * costPerUnit;

  return {
    ...line,
    goodQty,
    rejectQty,
    reworkQty,
    costPerUnit,
    totalCost,
  };
};
