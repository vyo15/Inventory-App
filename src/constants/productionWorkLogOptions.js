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

  materialHasVariants: false,
  materialVariantStrategy: "none",
  resolvedVariantKey: "",
  resolvedVariantLabel: "",
  stockSourceType: "master",

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

  outputHasVariants: false,
  outputVariantKey: "",
  outputVariantLabel: "",
  stockSourceType: "master",

  notes: "",
};

export const DEFAULT_PRODUCTION_WORK_LOG_FORM = {
  workNumber: "",
  workDate: null,

  bomId: "",
  bomCode: "",
  bomName: "",
  bomVersion: null,

  // ACTIVE / FINAL: field link PO didaftarkan di default form agar drawer
  // Work Log tidak kehilangan snapshot PO saat Apply Draft Production Order.
  productionOrderId: "",
  productionOrderCode: "",
  productionOrderStatusSnapshot: "",

  productionProfileId: "",
  productionProfileName: "",

  baseInputQty: 0,
  baseInputUnit: "",
  theoreticalOutputQty: 0,
  theoreticalFlowerEquivalent: 0,
  leftoverLeafQty: 0,
  leftoverStemQty: 0,
  leftoverPetalFlowerEquivalent: 0,
  missPetalFlowerEquivalent: 0,
  missPetalQty: 0,
  missLeafQty: 0,
  missStemQty: 0,
  missPercent: 0,
  missStatus: "normal",

  targetType: "product",
  targetId: "",
  targetCode: "",
  targetName: "",
  targetUnit: "pcs",

  // ACTIVE / FINAL: snapshot varian target dari PO.
  // Untuk flow PO, field ini menjadi contract ke output dan stock log.
  targetHasVariants: false,
  targetVariantKey: "",
  targetVariantLabel: "",

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


const safeNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export const calculateProductionMonitoring = (profile = {}, values = {}) => {
  const baseInputQty = safeNumber(values.baseInputQty || 0);
  const goodQty = safeNumber(values.goodQty || 0);
  const leftoverLeafQty = Math.max(0, safeNumber(values.leftoverLeafQty || 0));
  const leftoverStemQty = Math.max(0, safeNumber(values.leftoverStemQty || 0));
  const leftoverPetalFlowerEquivalent = Math.max(0, safeNumber(values.leftoverPetalFlowerEquivalent || 0));

  const basisType = values.workBasisType || profile.workBasisType || '';
  let theoreticalOutputQty = 0;
  let theoreticalFlowerEquivalent = 0;

  if (basisType === 'per_meter') {
    theoreticalOutputQty = baseInputQty * safeNumber(profile.referenceYieldPerBaseQty || values.referenceYieldPerBaseQty || 0);
    theoreticalFlowerEquivalent = baseInputQty * safeNumber(profile.flowerEquivalentPerBaseQty || values.flowerEquivalentPerBaseQty || 0);
  } else if (basisType === 'per_rod_40cm') {
    theoreticalOutputQty = baseInputQty * safeNumber(profile.referenceYieldPerBaseQty || values.referenceYieldPerBaseQty || 0);
    theoreticalFlowerEquivalent = baseInputQty * safeNumber(profile.flowerEquivalentPerBaseQty || values.flowerEquivalentPerBaseQty || 0);
  } else if (basisType === 'per_finished_unit') {
    theoreticalOutputQty = goodQty;
    theoreticalFlowerEquivalent = goodQty;
  } else if (basisType === 'per_batch') {
    theoreticalOutputQty = safeNumber(profile.assemblyTargetOutput || values.assemblyTargetOutput || 0);
    theoreticalFlowerEquivalent = theoreticalOutputQty;
  }

  const theoreticalLeafLeftover = Math.max(0, safeNumber(profile.batchLeafQty || 0) - goodQty * safeNumber(profile.leavesPerUnit || 1));
  const theoreticalStemLeftover = Math.max(0, safeNumber(profile.batchStemQty || 0) - goodQty * safeNumber(profile.stemsPerUnit || 1));
  const missPetalFlowerEquivalent = Math.max(0, theoreticalFlowerEquivalent - (goodQty + leftoverPetalFlowerEquivalent));
  const missPetalQty = missPetalFlowerEquivalent * Math.max(1, safeNumber(profile.petalsPerUnit || 1));
  const missLeafQty = Math.max(0, theoreticalLeafLeftover - leftoverLeafQty);
  const missStemQty = Math.max(0, theoreticalStemLeftover - leftoverStemQty);
  const missPercent = theoreticalFlowerEquivalent > 0 ? (missPetalFlowerEquivalent / theoreticalFlowerEquivalent) * 100 : 0;

  const yellow = safeNumber(profile.missYellowPercent || 2);
  const red = safeNumber(profile.missRedPercent || 5);
  let missStatus = 'normal';
  if (missPercent > red) missStatus = 'critical';
  else if (missPercent > yellow) missStatus = 'warning';

  return {
    baseInputQty,
    theoreticalOutputQty,
    theoreticalFlowerEquivalent,
    leftoverLeafQty,
    leftoverStemQty,
    leftoverPetalFlowerEquivalent,
    missPetalFlowerEquivalent,
    missPetalQty,
    missLeafQty,
    missStemQty,
    missPercent,
    missStatus,
  };
};
