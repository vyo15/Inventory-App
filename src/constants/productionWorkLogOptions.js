// =====================================================
// Production Work Log Options
// Master enum dan helper untuk Work Log Produksi
// =====================================================

import { toOptionMap } from "../utils/options/optionMap";
export { toOptionMap };

export const PRODUCTION_WORK_LOG_SOURCE_TYPES = [
  { value: "planned", label: "Planned" },
  { value: "manual", label: "Manual" },
  { value: "production_order", label: "Production Order" },
];

/* =====================================================
SECTION: Active Work Log Status Options — AKTIF/GUARDED
Fungsi:
- Menjaga opsi status Work Log aktif hanya pada status eksekusi produksi, tanpa opsi Draft di filter/form UI aktif.

Dipakai oleh:
- ProductionWorkLogs.jsx filter status dan form Work Log.

Alasan perubahan:
- Work Log produksi sekarang merepresentasikan eksekusi kerja; Draft BOM/PO hanya legacy helper pembentuk template data, bukan status operasional baru.

Catatan cleanup:
- PRODUCTION_WORK_LOG_LEGACY_STATUSES hanya untuk membaca data lama yang masih tersimpan sebagai draft/cancelled.

Risiko:
- Jika Draft/Cancelled dikembalikan ke opsi aktif, user bisa membuat Work Log non-eksekusi yang tidak mengikuti flow PO/start production.
===================================================== */
export const PRODUCTION_WORK_LOG_STATUSES = [
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

export const PRODUCTION_WORK_LOG_LEGACY_STATUSES = [
  { value: "draft", label: "Draft (Legacy)" },
  { value: "cancelled", label: "Cancelled (Legacy)" },
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

export const WORK_LOG_SOURCE_TYPE_MAP = toOptionMap(
  PRODUCTION_WORK_LOG_SOURCE_TYPES,
);
export const WORK_LOG_STATUS_MAP = toOptionMap([
  ...PRODUCTION_WORK_LOG_LEGACY_STATUSES,
  ...PRODUCTION_WORK_LOG_STATUSES,
]);
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
  // Work Log tidak kehilangan snapshot PO saat Ambil Data Production Order.
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
  status: "in_progress",

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

const safeNumber = (value, fallback = 0) => {
  const num = Number(value ?? fallback);
  const fallbackNum = Number(fallback ?? 0);
  if (Number.isFinite(num)) return num;
  return Number.isFinite(fallbackNum) ? fallbackNum : 0;
};

export const calculateMaterialUsageLine = (line = {}) => {
  const plannedQty = safeNumber(line.plannedQty);
  const actualQty = safeNumber(line.actualQty);
  const varianceQty = actualQty - plannedQty;
  const costPerUnitSnapshot = safeNumber(line.costPerUnitSnapshot);
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
  const goodQty = safeNumber(line.goodQty);
  const rejectQty = safeNumber(line.rejectQty);
  const reworkQty = safeNumber(line.reworkQty);
  const costPerUnit = safeNumber(line.costPerUnit);
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


export const calculateProductionMonitoring = (profile = {}, values = {}) => {
  const baseInputQty = safeNumber(values.baseInputQty);
  const goodQty = safeNumber(values.goodQty);
  const leftoverLeafQty = Math.max(0, safeNumber(values.leftoverLeafQty));
  const leftoverStemQty = Math.max(0, safeNumber(values.leftoverStemQty));
  const leftoverPetalFlowerEquivalent = Math.max(0, safeNumber(values.leftoverPetalFlowerEquivalent));

  const basisType = values.basisType || profile.basisType || '';
  let theoreticalOutputQty = 0;
  let theoreticalFlowerEquivalent = 0;

  if (basisType === 'per_meter') {
    theoreticalOutputQty = baseInputQty * safeNumber(profile.referenceYieldPerBaseQty ?? values.referenceYieldPerBaseQty ?? 0);
    theoreticalFlowerEquivalent = baseInputQty * safeNumber(profile.flowerEquivalentPerBaseQty ?? values.flowerEquivalentPerBaseQty ?? 0);
  } else if (basisType === 'per_rod_40cm') {
    theoreticalOutputQty = baseInputQty * safeNumber(profile.referenceYieldPerBaseQty ?? values.referenceYieldPerBaseQty ?? 0);
    theoreticalFlowerEquivalent = baseInputQty * safeNumber(profile.flowerEquivalentPerBaseQty ?? values.flowerEquivalentPerBaseQty ?? 0);
  } else if (basisType === 'per_qty') {
    theoreticalOutputQty = goodQty;
    theoreticalFlowerEquivalent = goodQty;
  } else if (basisType === 'per_batch') {
    theoreticalOutputQty = safeNumber(profile.assemblyTargetOutput ?? values.assemblyTargetOutput ?? 0);
    theoreticalFlowerEquivalent = theoreticalOutputQty;
  }

  const theoreticalLeafLeftover = Math.max(0, safeNumber(profile.batchLeafQty) - goodQty * safeNumber(profile.leavesPerUnit, 1));
  const theoreticalStemLeftover = Math.max(0, safeNumber(profile.batchStemQty) - goodQty * safeNumber(profile.stemsPerUnit, 1));
  const missPetalFlowerEquivalent = Math.max(0, theoreticalFlowerEquivalent - (goodQty + leftoverPetalFlowerEquivalent));
  const missPetalQty = missPetalFlowerEquivalent * Math.max(1, safeNumber(profile.petalsPerUnit, 1));
  const missLeafQty = Math.max(0, theoreticalLeafLeftover - leftoverLeafQty);
  const missStemQty = Math.max(0, theoreticalStemLeftover - leftoverStemQty);
  const missPercent = theoreticalFlowerEquivalent > 0 ? (missPetalFlowerEquivalent / theoreticalFlowerEquivalent) * 100 : 0;

  const yellow = safeNumber(profile.missYellowPercent, 2);
  const red = safeNumber(profile.missRedPercent, 5);
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
