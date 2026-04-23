// =====================================================
// Production Payroll Rule Helpers
// Boundary helper final/guarded untuk payroll produksi.
//
// Status area:
// - ACTIVE / GUARDED:
//   semua draft payroll baru wajib membaca rule dari snapshot step di Work Log
//   atau, bila snapshot lama belum ada, fallback sekali ke master step.
// - LEGACY / DEPRECATED:
//   custom payroll di master karyawan tidak lagi menjadi sumber hitung aktif.
//
// Catatan maintainability:
// - Helper ini sengaja dipisah agar contract payroll tidak tersebar di page,
//   service, dan preview UI dengan rumus yang berbeda-beda.
// - Patch berikutnya tidak boleh mengubah contract helper ini tanpa evaluasi
//   khusus area guarded payroll produksi.
// =====================================================

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const safeString = (value) => String(value || "").trim();

const normalizePayrollMode = (value) => {
  if (["per_qty", "per_batch", "fixed"].includes(value)) {
    return value;
  }
  return "per_qty";
};

const normalizePayrollOutputBasis = (value) => {
  if (["good_qty", "actual_output_qty"].includes(value)) {
    return value;
  }
  return "good_qty";
};

export const getNormalizedProductionPayrollRule = (rule = {}) => {
  const payrollMode = normalizePayrollMode(rule.payrollMode || rule.mode);
  const payrollRate = Math.max(0, safeNumber(rule.payrollRate || rule.rate, 0));
  const payrollQtyBase =
    payrollMode === "per_qty"
      ? Math.max(1, safeNumber(rule.payrollQtyBase || rule.qtyBase, 1))
      : 1;
  const payrollOutputBasis = normalizePayrollOutputBasis(
    rule.payrollOutputBasis || rule.outputBasis,
  );

  return {
    payrollMode,
    payrollRate,
    payrollQtyBase,
    payrollOutputBasis,
  };
};

export const buildProductionStepPayrollSnapshot = (step = {}) => {
  const normalizedRule = getNormalizedProductionPayrollRule(step);

  return {
    stepId: safeString(step.id || step.stepId),
    stepCode: safeString(step.code || step.stepCode),
    stepName: safeString(step.name || step.stepName),
    ...normalizedRule,
  };
};

export const getWorkLogPayrollRuleSnapshot = (workLog = {}) => {
  const hasSnapshot =
    safeString(workLog.stepPayrollMode) ||
    safeString(workLog.stepPayrollOutputBasis) ||
    safeNumber(workLog.stepPayrollRate, 0) > 0 ||
    safeString(workLog.stepPayrollRuleSource);

  return {
    hasSnapshot: Boolean(hasSnapshot),
    stepId: safeString(workLog.stepId),
    stepCode: safeString(workLog.stepCode),
    stepName: safeString(workLog.stepName),
    ...getNormalizedProductionPayrollRule({
      payrollMode: workLog.stepPayrollMode,
      payrollRate: workLog.stepPayrollRate,
      payrollQtyBase: workLog.stepPayrollQtyBase,
      payrollOutputBasis: workLog.stepPayrollOutputBasis,
    }),
  };
};

export const resolveCompletedWorkLogPayrollRule = ({
  workLog = {},
  productionStep = null,
} = {}) => {
  const workLogSnapshot = getWorkLogPayrollRuleSnapshot(workLog);

  if (workLogSnapshot.hasSnapshot) {
    return {
      rule: workLogSnapshot,
      source: "work_log_step_snapshot",
      legacyFallbackUsed: false,
    };
  }

  if (productionStep) {
    return {
      rule: buildProductionStepPayrollSnapshot(productionStep),
      source: "production_step_master_legacy_fallback",
      legacyFallbackUsed: true,
    };
  }

  return {
    rule: buildProductionStepPayrollSnapshot({
      stepId: workLog.stepId,
      stepCode: workLog.stepCode,
      stepName: workLog.stepName,
    }),
    source: "missing_payroll_rule",
    legacyFallbackUsed: true,
  };
};

export const getWorkLogPayrollMetrics = (workLog = {}, payrollRule = {}) => {
  const normalizedRule = getNormalizedProductionPayrollRule(payrollRule);
  const plannedBatchQty = Math.max(0, safeNumber(workLog.plannedQty, 0));
  const actualOutputQty = Math.max(0, safeNumber(workLog.actualOutputQty, 0));
  const goodQty = Math.max(0, safeNumber(workLog.goodQty, 0));
  const outputQtyUsed =
    normalizedRule.payrollOutputBasis === "actual_output_qty"
      ? actualOutputQty
      : goodQty;

  const workedQty =
    normalizedRule.payrollMode === "per_batch" ? plannedBatchQty : outputQtyUsed;

  return {
    plannedBatchQty,
    actualOutputQty,
    goodQty,
    outputQtyUsed,
    workedQty,
  };
};

export const formatPayrollRuleSourceLabel = (source = "") => {
  if (source === "work_log_step_snapshot") {
    return "Snapshot rule step pada Work Log";
  }

  if (source === "production_step_master_legacy_fallback") {
    return "Legacy fallback ke master step";
  }

  return "Rule payroll tidak lengkap";
};

export const buildPayrollCalculationNotes = ({
  workLog = {},
  payrollRule = {},
  payrollSource = "",
  legacyFallbackUsed = false,
} = {}) => {
  const metrics = getWorkLogPayrollMetrics(workLog, payrollRule);
  const sourceLabel = formatPayrollRuleSourceLabel(payrollSource);

  const baseText = [
    `Rule source: ${sourceLabel}.`,
    `Mode: ${payrollRule.payrollMode || "per_qty"}.`,
    `Rate: Rp${new Intl.NumberFormat("id-ID").format(
      safeNumber(payrollRule.payrollRate, 0),
    )}.`,
  ];

  if ((payrollRule.payrollMode || "per_qty") === "per_batch") {
    baseText.push(
      `Worked Qty memakai Qty Batch Work Log = ${new Intl.NumberFormat("id-ID").format(
        metrics.workedQty,
      )}.`,
    );
  } else if ((payrollRule.payrollMode || "per_qty") === "per_qty") {
    baseText.push(
      `Output Qty Used memakai ${
        payrollRule.payrollOutputBasis === "actual_output_qty"
          ? "Actual Output Qty"
          : "Good Qty"
      } = ${new Intl.NumberFormat("id-ID").format(metrics.outputQtyUsed)}.`,
    );
  } else {
    baseText.push("Mode fixed dihitung 1x per work log completed.");
  }

  if (legacyFallbackUsed) {
    baseText.push(
      "Legacy/deprecated fallback terpakai karena snapshot payroll rule lama belum tersimpan di Work Log. Setelah work log baru diposting, fallback ini seharusnya tidak dipakai lagi.",
    );
  }

  return baseText.join(" ");
};
