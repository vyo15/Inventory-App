// =====================================================
// Production Payroll Options
// =====================================================

import { toOptionMap } from "../utils/options/optionMap";
export { toOptionMap };

export const PRODUCTION_PAYROLL_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "confirmed", label: "Confirmed" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

export const PRODUCTION_PAYROLL_PAYMENT_STATUSES = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
];

export const PRODUCTION_PAYROLL_MODES = [
  { value: "per_qty", label: "Per Qty" },
  { value: "per_batch", label: "Per Batch" },
];

export const PRODUCTION_PAYROLL_OUTPUT_BASIS = [
  { value: "good_qty", label: "Good Qty" },
  { value: "actual_output_qty", label: "Actual Output Qty" },
];

export const PRODUCTION_PAYROLL_CLASSIFICATIONS = [
  { value: "direct_labor", label: "Produksi Inti" },
  { value: "support_fulfillment", label: "Support / Fulfillment" },
];

export const PAYROLL_STATUS_MAP = toOptionMap(PRODUCTION_PAYROLL_STATUSES);
export const PAYROLL_PAYMENT_STATUS_MAP = toOptionMap(
  PRODUCTION_PAYROLL_PAYMENT_STATUSES,
);
export const PAYROLL_MODE_MAP = toOptionMap(PRODUCTION_PAYROLL_MODES);
export const PAYROLL_OUTPUT_BASIS_MAP = toOptionMap(
  PRODUCTION_PAYROLL_OUTPUT_BASIS,
);
export const PAYROLL_CLASSIFICATION_MAP = toOptionMap(
  PRODUCTION_PAYROLL_CLASSIFICATIONS,
);

const PAYROLL_STATUS_TAG_COLORS = {
  draft: "default",
  confirmed: "blue",
  paid: "green",
  cancelled: "red",
};

const PAYROLL_PAYMENT_STATUS_TAG_COLORS = {
  unpaid: "orange",
  partial: "gold",
  paid: "green",
};

const normalizePayrollStatusValue = (value) => String(value || "").trim();

// =====================================================
// ACTIVE / UI-ONLY
// Fungsi:
// - Menyiapkan daftar status payroll yang compact untuk tabel/detail/report.
// - Jika lifecycle status dan payment status sama-sama `paid`, UI cukup menampilkan satu tag.
// Catatan:
// - Helper ini presentational; tidak mengubah status, paymentStatus, Cash Out, HPP, atau schema.
// =====================================================
export const getCompactPayrollStatusTags = ({ status, paymentStatus } = {}) => {
  const statusValue = normalizePayrollStatusValue(status);
  const paymentValue = normalizePayrollStatusValue(paymentStatus);

  const statusTag = statusValue
    ? {
        key: `status-${statusValue}`,
        source: "status",
        value: statusValue,
        label: PAYROLL_STATUS_MAP[statusValue] || statusValue,
        color: PAYROLL_STATUS_TAG_COLORS[statusValue] || "default",
      }
    : null;

  const paymentTag = paymentValue
    ? {
        key: `payment-${paymentValue}`,
        source: "paymentStatus",
        value: paymentValue,
        label: PAYROLL_PAYMENT_STATUS_MAP[paymentValue] || paymentValue,
        color: PAYROLL_PAYMENT_STATUS_TAG_COLORS[paymentValue] || "default",
      }
    : null;

  if (statusValue && paymentValue && statusValue === paymentValue) {
    return [statusTag || paymentTag];
  }

  const tags = [statusTag, paymentTag].filter(Boolean);
  return tags.length ? tags : [{ key: "status-empty", label: "-", color: "default" }];
};

export const DEFAULT_PRODUCTION_PAYROLL_FORM = {
  payrollNumber: "",
  payrollDate: null,

  workLogId: "",
  workNumber: "",

  bomId: "",
  bomCode: "",

  targetType: "",
  targetId: "",
  targetCode: "",
  targetName: "",

  stepId: "",
  stepCode: "",
  stepName: "",
  sequenceNo: 1,

  workerLineKey: "",
  workerSourceType: "",
  workerId: "",
  workerCode: "",
  workerName: "",

  payrollMode: "per_qty",
  payrollRate: 0,
  payrollQtyBase: 1,
  payrollOutputBasis: "good_qty",
  payrollClassification: "direct_labor",
  includePayrollInHpp: true,

  totalWorkLogOutputQty: 0,
  workedQty: 0,
  outputQtyUsed: 0,
  payableQtyFactor: 0,

  amountCalculated: 0,
  bonusAmount: 0,
  deductionAmount: 0,
  finalAmount: 0,

  sharedWorkLog: false,
  teamWorkerCount: 1,

  status: "draft",
  paymentStatus: "unpaid",
  confirmedAt: null,
  paidAt: null,

  notes: "",
  calculationNotes: "",
  payrollRuleSource: "work_log_step_snapshot",
  historicalPayrollFallbackUsed: false,
  payrollEligibilityStatus: "eligible",
  payrollEligibilityBlockingReasons: [],
  payrollEligibilityWarningReasons: [],
  payrollEligibilityNotes: "",
};

// =====================================================
// ACTIVE / GUARDED
// Rumus payroll final wajib lewat helper ini agar per_batch
// dan per_qty selalu konsisten di seluruh modul.
// =====================================================
const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  const parsedFallback = Number(fallback ?? 0);
  if (Number.isFinite(parsed)) return parsed;
  return Number.isFinite(parsedFallback) ? parsedFallback : 0;
};

export const calculatePayrollAmounts = (values = {}) => {
  const payrollMode = values.payrollMode || "per_qty";
  const payrollRate = Math.max(0, safeNumber(values.payrollRate));
  const payrollQtyBase = safeNumber(values.payrollQtyBase, 1);
  const outputQtyUsed = Math.max(0, safeNumber(values.outputQtyUsed));
  const workedQty = Math.max(0, safeNumber(values.workedQty));
  const bonusAmount = safeNumber(values.bonusAmount);
  const deductionAmount = safeNumber(values.deductionAmount);

  let amountCalculated = 0;
  let payableQtyFactor = 0;

  if (payrollMode === "per_batch") {
    // =====================================================
    // ACTIVE / GUARDED
    // Mode per_batch wajib membaca Qty Batch real dari Work Log.
    // Logic lama yang hanya membayar 1x rate tanpa pengali batch
    // sudah dinonaktifkan lewat rumus ini.
    // =====================================================
    payableQtyFactor = workedQty > 0 ? workedQty : outputQtyUsed;
    amountCalculated = payableQtyFactor * payrollRate;
  } else {
    payableQtyFactor = payrollQtyBase > 0 ? outputQtyUsed / payrollQtyBase : 0;
    amountCalculated = payableQtyFactor * payrollRate;
  }

  const finalAmount = amountCalculated + bonusAmount - deductionAmount;

  return {
    payableQtyFactor: safeNumber(payableQtyFactor),
    amountCalculated: safeNumber(amountCalculated),
    finalAmount: safeNumber(finalAmount),
  };
};
