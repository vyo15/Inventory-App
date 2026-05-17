import formatNumber from "../formatters/numberId";
import formatCurrency from "../formatters/currencyId";
import { calculatePayrollAmounts } from "../../constants/productionPayrollOptions";

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

// Formatter final lintas aplikasi: helper ini dipakai untuk pesan validasi payroll
// agar tidak ada formatter lokal di area guarded payroll produksi.
const normalizePayrollMode = (value) => {
  if (value === "per_batch") {
    return "per_batch";
  }

  return "per_qty";
};

const normalizePayrollOutputBasis = (value) => {
  if (["good_qty", "actual_output_qty"].includes(value)) {
    return value;
  }
  return "good_qty";
};

const normalizePayrollClassification = (value, processType = "") => {
  if (["direct_labor", "support_fulfillment"].includes(value)) {
    return value;
  }

  if (processType === "support_process") {
    return "support_fulfillment";
  }

  return "direct_labor";
};

const normalizeIncludePayrollInHpp = (value, payrollClassification = "direct_labor") => {
  if (typeof value === "boolean") {
    return value;
  }

  return payrollClassification === "direct_labor";
};

const buildWorkerLineKey = ({ workerId = "", workerName = "" } = {}, index = 0) => {
  const normalizedId = safeString(workerId);
  if (normalizedId) {
    return `employee:${normalizedId}`;
  }

  const normalizedName = safeString(workerName)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  if (normalizedName) {
    return `legacy_name:${normalizedName}`;
  }

  return `unknown:${index + 1}`;
};

export const buildWorkLogPayrollWorkerCandidates = (workLog = {}) => {
  const workerIds = Array.isArray(workLog.workerIds) ? workLog.workerIds : [];
  const workerCodes = Array.isArray(workLog.workerCodes) ? workLog.workerCodes : [];
  const workerNames = Array.isArray(workLog.workerNames) ? workLog.workerNames : [];
  const declaredWorkerCount = Math.max(0, safeNumber(workLog.workerCount, 0));
  const candidateLength = Math.max(
    workerIds.length,
    workerCodes.length,
    workerNames.length,
  );

  const candidates = [];
  const seenLineKeys = new Set();

  for (let index = 0; index < candidateLength; index += 1) {
    const workerId = safeString(workerIds[index]);
    const workerCode = safeString(workerCodes[index]);
    const workerName = safeString(workerNames[index]);

    if (!workerId && !workerName) {
      continue;
    }

    const workerLineKey = buildWorkerLineKey({ workerId, workerName }, index);

    if (seenLineKeys.has(workerLineKey)) {
      continue;
    }

    seenLineKeys.add(workerLineKey);
    candidates.push({
      workerLineKey,
      workerId,
      workerCode,
      workerName: workerName || `Operator ${index + 1}`,
      workerSourceType: workerId ? "employee_master" : "legacy_name",
      workerIndex: index,
    });
  }

  if (candidates.length === 0 && declaredWorkerCount <= 1) {
    const singleWorkerName = safeString(workLog.workerName);
    if (singleWorkerName && singleWorkerName !== "-") {
      candidates.push({
        workerLineKey: buildWorkerLineKey({ workerName: singleWorkerName }, 0),
        workerId: "",
        workerCode: "",
        workerName: singleWorkerName,
        workerSourceType: "legacy_name",
        workerIndex: 0,
      });
    }
  }

  return candidates;
};

const hasMeaningfulWorkerSummary = (workLog = {}) =>
  buildWorkLogPayrollWorkerCandidates(workLog).length > 0;

export const getNormalizedProductionPayrollRule = (rule = {}) => {
  const payrollMode = normalizePayrollMode(rule.payrollMode || rule.mode);
  const payrollRate = Math.max(0, safeNumber(rule.payrollRate ?? rule.rate, 0));
  const payrollQtyBase = 1;
  const payrollOutputBasis = normalizePayrollOutputBasis(
    rule.payrollOutputBasis || rule.outputBasis,
  );
  const payrollClassification = normalizePayrollClassification(
    rule.payrollClassification || rule.classification,
    rule.processType,
  );
  const includePayrollInHpp = normalizeIncludePayrollInHpp(
    rule.includePayrollInHpp,
    payrollClassification,
  );

  return {
    payrollMode,
    payrollRate,
    payrollQtyBase,
    payrollOutputBasis,
    payrollClassification,
    includePayrollInHpp,
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

// =====================================================
// ACTIVE / GUARDED
// Helper ini dipakai untuk mendeteksi snapshot payroll Work Log yang stale
// dibandingkan master Tahapan Produksi.
//
// Catatan:
// - Patch ini tidak mengubah business rule payroll.
// - Helper hanya menyiapkan patch rekonsiliasi yang jelas sumbernya dari
//   master step aktif. Caller tetap menentukan kapan patch aman diterapkan.
// =====================================================
export const getWorkLogPayrollSnapshotReconcilePatch = ({
  workLog = {},
  productionStep = null,
} = {}) => {
  if (!productionStep?.id) {
    return null;
  }

  const workLogSnapshot = getWorkLogPayrollRuleSnapshot(workLog);
  const masterSnapshot = buildProductionStepPayrollSnapshot(productionStep);
  const hasMismatch =
    safeString(workLog.stepCode) !== safeString(productionStep.code) ||
    safeString(workLog.stepName) !== safeString(productionStep.name) ||
    safeString(workLog.stepProcessType) !== safeString(productionStep.processType) ||
    workLogSnapshot.payrollMode !== masterSnapshot.payrollMode ||
    safeNumber(workLogSnapshot.payrollRate, 0) !== safeNumber(masterSnapshot.payrollRate, 0) ||
    safeNumber(workLogSnapshot.payrollQtyBase, 1) !== safeNumber(masterSnapshot.payrollQtyBase, 1) ||
    safeString(workLogSnapshot.payrollOutputBasis) !== safeString(masterSnapshot.payrollOutputBasis) ||
    safeString(workLogSnapshot.payrollClassification) !== safeString(masterSnapshot.payrollClassification) ||
    Boolean(workLogSnapshot.includePayrollInHpp) !== Boolean(masterSnapshot.includePayrollInHpp);

  if (!hasMismatch) {
    return null;
  }

  return {
    stepCode: safeString(productionStep.code || workLog.stepCode),
    stepName: safeString(productionStep.name || workLog.stepName),
    stepProcessType: safeString(productionStep.processType || workLog.stepProcessType),
    stepPayrollMode: masterSnapshot.payrollMode,
    stepPayrollRate: masterSnapshot.payrollRate,
    stepPayrollQtyBase: masterSnapshot.payrollQtyBase,
    stepPayrollOutputBasis: masterSnapshot.payrollOutputBasis,
    stepPayrollClassification: masterSnapshot.payrollClassification,
    stepPayrollIncludeInHpp: masterSnapshot.includePayrollInHpp,
    stepPayrollRuleSource: "production_step",
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
      payrollClassification: workLog.stepPayrollClassification,
      includePayrollInHpp: workLog.stepPayrollIncludeInHpp,
      processType: workLog.stepProcessType,
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
      processType: workLog.stepProcessType,
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

export const formatPayrollEligibilityStatusLabel = (status = "blocked") => {
  if (status === "eligible") {
    return "Eligible";
  }
  return "Blocked";
};

export const resolveWorkLogPayrollDraft = ({
  workLog = {},
  productionStep = null,
} = {}) => {
  const resolvedRule = resolveCompletedWorkLogPayrollRule({
    workLog,
    productionStep,
  });

  const payrollRule = resolvedRule.rule || buildProductionStepPayrollSnapshot({});
  const metrics = getWorkLogPayrollMetrics(workLog, payrollRule);
  const workerCandidates = buildWorkLogPayrollWorkerCandidates(workLog);
  const declaredWorkerCount = Math.max(0, safeNumber(workLog.workerCount, 0));
  const blockingReasons = [];
  const warningReasons = [];

  // =====================================================
  // ACTIVE / GUARDED
  // Validasi ini dipakai untuk menyaring Work Log completed mana yang benar-benar
  // aman dijadikan draft payroll operasional.
  // =====================================================
  if (!workLog?.id) {
    blockingReasons.push("Work Log tidak valid atau belum tersimpan.");
  }

  if (safeString(workLog.status) !== "completed") {
    blockingReasons.push("Work Log belum berstatus completed.");
  }

  if (!safeString(workLog.stepId) && !safeString(workLog.stepName)) {
    blockingReasons.push("Step produksi pada Work Log belum terbaca.");
  }

  if (!hasMeaningfulWorkerSummary(workLog)) {
    blockingReasons.push(
      "Operator Work Log belum terbaca satu per satu. Payroll v1 wajib punya 1 line per orang + per step + per batch/work log.",
    );
  }

  if (declaredWorkerCount > 0 && workerCandidates.length < declaredWorkerCount) {
    blockingReasons.push(
      `Work Log mencatat ${formatNumber(
        declaredWorkerCount,
      )} orang, tetapi operator yang terbaca baru ${formatNumber(
        workerCandidates.length,
      )}. Lengkapi operator satu per satu sebelum payroll dibuat.`,
    );
  }

  if (resolvedRule.source === "missing_payroll_rule") {
    blockingReasons.push(
      "Rule payroll step tidak ditemukan pada snapshot Work Log maupun master step.",
    );
  }

  if (payrollRule.payrollRate <= 0) {
    blockingReasons.push("Tarif payroll step harus lebih besar dari 0.");
  }

  if (payrollRule.payrollMode === "per_qty" && metrics.outputQtyUsed <= 0) {
    blockingReasons.push(
      `Output qty untuk payroll per qty belum valid. Basis saat ini menghasilkan ${formatNumber(
        metrics.outputQtyUsed,
      )}.`,
    );
  }

  if (payrollRule.payrollMode === "per_batch" && metrics.workedQty <= 0) {
    blockingReasons.push(
      `Qty batch Work Log harus lebih besar dari 0 untuk mode per batch. Nilai saat ini ${formatNumber(
        metrics.workedQty,
      )}.`,
    );
  }

  if (resolvedRule.legacyFallbackUsed) {
    warningReasons.push(
      "Draft payroll memakai legacy/deprecated fallback ke master step karena snapshot rule payroll lama belum ada di Work Log.",
    );
  }

  if (
    Boolean(workLog.payrollCalculated) &&
    !["pending", "reverted", ""].includes(
      safeString(workLog.payrollCalculationStatus),
    )
  ) {
    warningReasons.push(
      "Work Log ini sudah pernah ditandai memiliki payroll. Pastikan tidak ada payroll aktif ganda pada line operator yang sama.",
    );
  }

  return {
    resolvedRule,
    payrollRule,
    metrics,
    workerCandidates,
    isEligible: blockingReasons.length === 0,
    status: blockingReasons.length === 0 ? "eligible" : "blocked",
    blockingReasons,
    warningReasons,
  };
};

export const buildPayrollCalculationNotes = ({
  workLog = {},
  payrollRule = {},
  payrollSource = "",
  legacyFallbackUsed = false,
  workerName = "",
} = {}) => {
  const metrics = getWorkLogPayrollMetrics(workLog, payrollRule);
  const sourceLabel = formatPayrollRuleSourceLabel(payrollSource);

  const baseText = [
    `Rule source: ${sourceLabel}.`,
    `Mode: ${payrollRule.payrollMode || "per_qty"}.`,
    `Rate: ${formatCurrency(safeNumber(payrollRule.payrollRate, 0))}.`,
    `Klasifikasi: ${payrollRule.payrollClassification || "direct_labor"}.`,
    `Masuk HPP: ${payrollRule.includePayrollInHpp ? "ya" : "tidak"}.`,
  ];

  if (workerName) {
    baseText.push(`Line payroll untuk operator: ${workerName}.`);
  }

  if ((payrollRule.payrollMode || "per_qty") === "per_batch") {
    baseText.push(
      `Worked Qty memakai Qty Batch Work Log = ${formatNumber(metrics.workedQty)}.`,
    );
  } else if ((payrollRule.payrollMode || "per_qty") === "per_qty") {
    baseText.push(
      `Output Qty Used memakai ${
        payrollRule.payrollOutputBasis === "actual_output_qty"
          ? "Actual Output Qty"
          : "Good Qty"
      } = ${formatNumber(metrics.outputQtyUsed)}.`,
    );
  }

  if (legacyFallbackUsed) {
    baseText.push(
      "Legacy/deprecated fallback terpakai karena snapshot payroll rule lama belum tersimpan di Work Log. Setelah work log baru diposting, fallback ini seharusnya tidak dipakai lagi.",
    );
  }

  return baseText.join(" ");
};

export const buildPayrollEligibilityNotes = ({
  workLog = {},
  eligibility = null,
} = {}) => {
  const resolvedEligibility =
    eligibility ||
    resolveWorkLogPayrollDraft({
      workLog,
      productionStep: null,
    });

  const notes = [];

  notes.push(
    `Eligibility: ${formatPayrollEligibilityStatusLabel(resolvedEligibility.status)}.`,
  );
  notes.push(
    `Operator terbaca: ${formatNumber(
      resolvedEligibility.workerCandidates.length,
    )}.`,
  );

  if (resolvedEligibility.blockingReasons.length > 0) {
    notes.push(`Blocking: ${resolvedEligibility.blockingReasons.join(" | ")}.`);
  }

  if (resolvedEligibility.warningReasons.length > 0) {
    notes.push(`Warning: ${resolvedEligibility.warningReasons.join(" | ")}.`);
  }

  return notes.join(" ");
};

// =====================================================
// ACTIVE / GUARDED - shared Work Log labor display resolver.
// Fungsi:
// - Menyatukan resolver biaya labor display untuk Detail Work Log dan HPP Analysis;
// - payroll final tetap prioritas dan satu-satunya biaya labor final HPP;
// - payroll draft / estimasi Step hanya read-only agar UI tidak menampilkan labor 0 yang menyesatkan;
// - tidak menulis estimasi ke Firestore.
// Risiko:
// - Jangan pakai displayAmount sebagai final HPP tanpa mengecek isFinal.
// =====================================================
export const isProductionPayrollLineHppIncluded = (line = {}) =>
  safeString(line.status).toLowerCase() !== "cancelled" && line.includePayrollInHpp !== false;

export const isProductionPayrollLineFinal = (line = {}) => {
  if (!isProductionPayrollLineHppIncluded(line)) return false;

  const status = safeString(line.status).toLowerCase();
  const paymentStatus = safeString(line.paymentStatus).toLowerCase();

  if (["confirmed", "paid"].includes(status) || paymentStatus === "paid") {
    return true;
  }

  // LEGACY-COMPAT:
  // Sebagian payroll lama belum punya status/paymentStatus tetapi sudah punya nominal final.
  // Untuk display read-only Work Log/HPP, line seperti ini diperlakukan sebagai final agar
  // labor tidak jatuh ke 0/draft palsu. Payroll baru tetap wajib memakai status eksplisit.
  return !status && !paymentStatus && safeNumber(line.finalAmount) > 0;
};

const getDisplayPayrollWorkerCount = (workLog = {}) => {
  const workerIds = Array.isArray(workLog.workerIds) ? workLog.workerIds.filter(Boolean) : [];
  const workerNames = Array.isArray(workLog.workerNames) ? workLog.workerNames.filter(Boolean) : [];
  return Math.max(workerIds.length, workerNames.length, safeNumber(workLog.workerCount), 1);
};

const getEstimatedWorkLogPayrollQty = (workLog = {}, payrollRule = {}) => {
  const metrics = getWorkLogPayrollMetrics(workLog, payrollRule);
  const plannedOutputQty = Math.max(
    0,
    safeNumber(workLog.theoreticalOutputQty),
    safeNumber(workLog.actualOutputQty),
    safeNumber(workLog.goodQty),
    safeNumber(workLog.plannedQty),
  );

  if (payrollRule.payrollMode === "per_batch") {
    return {
      ...metrics,
      workedQty: metrics.workedQty > 0 ? metrics.workedQty : safeNumber(workLog.plannedQty),
      outputQtyUsed: metrics.outputQtyUsed > 0 ? metrics.outputQtyUsed : plannedOutputQty,
    };
  }

  return {
    ...metrics,
    outputQtyUsed: metrics.outputQtyUsed > 0 ? metrics.outputQtyUsed : plannedOutputQty,
    workedQty: metrics.workedQty > 0 ? metrics.workedQty : safeNumber(workLog.plannedQty),
  };
};

const resolveWorkLogStepEstimate = ({ workLog = {}, productionStep = null } = {}) => {
  const resolved = resolveCompletedWorkLogPayrollRule({ workLog, productionStep });
  const payrollRule = resolved.rule || {};

  if (payrollRule.includePayrollInHpp === false) {
    return {
      displayAmount: 0,
      amount: 0,
      finalAmount: 0,
      estimatedAmount: 0,
      draftAmount: 0,
      source: "step_excluded_from_hpp",
      statusLabel: "Tidak masuk HPP",
      totalStatusLabel: "Estimasi",
      label: "Tidak masuk HPP",
      tagColor: "default",
      helper: "Step support/fulfillment tidak masuk labor HPP.",
      isFinal: false,
      isEstimated: false,
      isDraft: false,
      needsReview: false,
      reviewReasons: [],
    };
  }

  const reviewReasons = [];
  if (safeNumber(payrollRule.payrollRate) <= 0) {
    reviewReasons.push("Rate step produksi 0/kosong.");
  }

  const metrics = getEstimatedWorkLogPayrollQty(workLog, payrollRule);
  if (payrollRule.payrollMode === "per_qty" && metrics.outputQtyUsed <= 0) {
    reviewReasons.push("Good qty/output qty 0 untuk mode per_qty.");
  }
  if (payrollRule.payrollMode === "per_batch" && metrics.workedQty <= 0) {
    reviewReasons.push("Qty batch Work Log 0 untuk mode per_batch.");
  }

  if (reviewReasons.length > 0) {
    return {
      displayAmount: 0,
      amount: 0,
      finalAmount: 0,
      estimatedAmount: 0,
      draftAmount: 0,
      source: "needs_review",
      statusLabel: "Perlu cek",
      totalStatusLabel: "Perlu cek",
      label: "Perlu cek",
      tagColor: "red",
      helper: reviewReasons[0],
      isFinal: false,
      isEstimated: false,
      isDraft: false,
      needsReview: true,
      reviewReasons,
    };
  }

  const calculated = calculatePayrollAmounts({
    payrollMode: payrollRule.payrollMode,
    payrollRate: payrollRule.payrollRate,
    payrollQtyBase: payrollRule.payrollQtyBase,
    outputQtyUsed: metrics.outputQtyUsed,
    workedQty: metrics.workedQty,
    bonusAmount: 0,
    deductionAmount: 0,
  });
  const workerCount = getDisplayPayrollWorkerCount(workLog);
  const estimatedAmount = Math.max(0, safeNumber(calculated.finalAmount) * workerCount);

  if (estimatedAmount <= 0) {
    return {
      displayAmount: 0,
      amount: 0,
      finalAmount: 0,
      estimatedAmount: 0,
      draftAmount: 0,
      source: "needs_review",
      statusLabel: "Perlu cek",
      totalStatusLabel: "Perlu cek",
      label: "Perlu cek",
      tagColor: "red",
      helper: "Output/batch untuk estimasi belum terbaca.",
      isFinal: false,
      isEstimated: false,
      isDraft: false,
      needsReview: true,
      reviewReasons: ["Output/batch untuk estimasi belum terbaca."],
    };
  }

  return {
    displayAmount: estimatedAmount,
    amount: estimatedAmount,
    finalAmount: 0,
    estimatedAmount,
    draftAmount: 0,
    source: "step_estimate",
    statusLabel: "Estimasi dari Step",
    totalStatusLabel: "Estimasi",
    label: "Estimasi Step",
    tagColor: "blue",
    helper: `${formatNumber(workerCount)} operator · read-only, belum masuk HPP final.`,
    isFinal: false,
    isEstimated: true,
    isDraft: false,
    needsReview: false,
    reviewReasons: [],
  };
};

export const resolveWorkLogLaborCostDisplay = ({
  workLog = {},
  relatedPayrolls = [],
  productionStep = null,
} = {}) => {
  const includedPayrolls = (Array.isArray(relatedPayrolls) ? relatedPayrolls : []).filter(
    isProductionPayrollLineHppIncluded,
  );
  const finalPayrolls = includedPayrolls.filter(isProductionPayrollLineFinal);
  const draftPayrolls = includedPayrolls.filter((line) => !isProductionPayrollLineFinal(line));
  const cancelledPayrollCount = (Array.isArray(relatedPayrolls) ? relatedPayrolls : []).filter(
    (line) => safeString(line.status).toLowerCase() === "cancelled",
  ).length;
  const finalAmount = finalPayrolls.reduce((sum, line) => sum + safeNumber(line.finalAmount), 0);
  const draftAmount = draftPayrolls.reduce((sum, line) => sum + safeNumber(line.finalAmount), 0);
  const reviewReasons = [];

  if (finalPayrolls.length > 0) {
    if (finalAmount <= 0) reviewReasons.push("Final amount payroll 0.");

    return {
      displayAmount: finalAmount,
      amount: finalAmount,
      finalAmount,
      estimatedAmount: 0,
      draftAmount: 0,
      source: "payroll_final",
      statusLabel: "Final",
      totalStatusLabel: "Final",
      label: "Payroll Final",
      tagColor: "green",
      helper: "Confirmed/paid; masuk HPP final.",
      isFinal: true,
      isEstimated: false,
      isDraft: false,
      needsReview: reviewReasons.length > 0,
      reviewReasons,
    };
  }

  if (draftPayrolls.length > 0 && draftAmount > 0) {
    return {
      displayAmount: draftAmount,
      amount: draftAmount,
      finalAmount: 0,
      estimatedAmount: 0,
      draftAmount,
      source: "payroll_draft",
      statusLabel: "Draft Payroll",
      totalStatusLabel: "Draft Payroll",
      label: "Draft Payroll",
      tagColor: "gold",
      helper: "Read-only; belum masuk HPP final.",
      isFinal: false,
      isEstimated: false,
      isDraft: true,
      needsReview: false,
      reviewReasons,
    };
  }

  if (draftPayrolls.length > 0 && draftAmount <= 0) {
    reviewReasons.push("Draft payroll 0; tampilkan estimasi step sementara.");
  }

  if (cancelledPayrollCount > 0) {
    reviewReasons.push("Payroll Work Log cancelled.");
  }

  const legacyLaborCost = safeNumber(workLog.laborCostActual);
  if (legacyLaborCost > 0) {
    return {
      displayAmount: legacyLaborCost,
      amount: legacyLaborCost,
      finalAmount: 0,
      estimatedAmount: legacyLaborCost,
      draftAmount: 0,
      source: "work_log_labor_cost_actual",
      statusLabel: "Estimasi",
      totalStatusLabel: "Estimasi",
      label: "Ringkasan lama",
      tagColor: "default",
      helper: "Legacy/summary Work Log.",
      isFinal: false,
      isEstimated: true,
      isDraft: false,
      needsReview: reviewReasons.length > 0,
      reviewReasons,
    };
  }

  const estimate = resolveWorkLogStepEstimate({ workLog, productionStep });
  return {
    ...estimate,
    reviewReasons: [...new Set([...reviewReasons, ...(estimate.reviewReasons || [])])],
    needsReview: reviewReasons.length > 0 || Boolean(estimate.needsReview),
    helper: reviewReasons.length > 0 ? reviewReasons[0] : estimate.helper,
  };
};
