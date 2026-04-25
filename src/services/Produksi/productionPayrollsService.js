// =====================================================
// Production Payrolls Service
//
// ACTIVE / GUARDED
// Flow final payroll produksi sekarang adalah:
// Work Log completed -> resolve rule payroll step -> pilih 1 operator line ->
// buat payroll draft -> confirm -> paid / cancelled -> sinkronkan flag payroll
// di Work Log.
//
// LEGACY / DEPRECATED
// - Custom payroll pada master karyawan tidak lagi menjadi jalur hitung aktif.
// - Fallback ke master step hanya dipakai untuk work log lama yang belum
//   menyimpan snapshot payroll rule step.
// =====================================================

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  DEFAULT_PRODUCTION_PAYROLL_FORM,
  calculatePayrollAmounts,
} from "../../constants/productionPayrollOptions";
import {
  getCompletedProductionWorkLogs,
  getProductionWorkLogById,
} from "./productionWorkLogsService";
import {
  buildPayrollCalculationNotes,
  buildPayrollEligibilityNotes,
  buildWorkLogPayrollWorkerCandidates,
  formatPayrollRuleSourceLabel,
  resolveWorkLogPayrollDraft,
} from "../../utils/produksi/productionPayrollRuleHelpers";

const COLLECTION_NAME = "production_payrolls";
const WORK_LOG_COLLECTION_NAME = "production_work_logs";

const safeTrim = (value) => String(value || "").trim();
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toDateValue = (value) => {
  const rawValue = value?.toDate ? value.toDate() : value;
  if (!rawValue) return null;

  return rawValue instanceof Date ? rawValue : new Date(rawValue);
};

const getPayrollDateCode = (value = new Date()) => {
  const dateValue = toDateValue(value) || new Date();
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const resolvePayrollDraftDate = (workLog = {}) =>
  toDateValue(workLog.completedAt) || toDateValue(workLog.workDate) || new Date();

const resolveSelectedWorkerCandidate = (workLog = {}, selectedWorker = "") => {
  const candidates = buildWorkLogPayrollWorkerCandidates(workLog);
  if (candidates.length === 0) return null;

  const normalizedKey = safeTrim(
    typeof selectedWorker === "string"
      ? selectedWorker
      : selectedWorker?.workerLineKey,
  );

  if (normalizedKey) {
    return (
      candidates.find((item) => item.workerLineKey === normalizedKey) || candidates[0]
    );
  }

  const selectedWorkerId = safeTrim(selectedWorker?.workerId);
  if (selectedWorkerId) {
    return candidates.find((item) => item.workerId === selectedWorkerId) || candidates[0];
  }

  return candidates[0];
};

const getAllProductionStepsForPayroll = async () => {
  try {
    const snapshot = await getDocs(collection(db, "production_steps"));
    return snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));
  } catch (error) {
    console.error("Gagal memuat referensi step payroll produksi", error);
    return [];
  }
};

const getAllProductionPayrollDocs = async () => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("payrollDate", "desc"),
      orderBy("payrollNumber", "desc"),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    console.error("Query payroll utama gagal, pakai fallback", error);
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  }
};

const getPayrollDocsByWorkLogId = async (workLogId) => {
  if (!workLogId) return [];

  const snapshot = await getDocs(
    query(collection(db, COLLECTION_NAME), where("workLogId", "==", workLogId)),
  );

  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
};

const buildPayrollWorkerLineKeySet = (payrolls = [], { includeCancelled = true } = {}) => {
  const lineKeys = new Set();

  payrolls.forEach((item) => {
    if (!includeCancelled && item?.status === "cancelled") {
      return;
    }

    const workerLineKey = safeTrim(item?.workerLineKey);
    if (workerLineKey) {
      lineKeys.add(workerLineKey);
    }
  });

  return lineKeys;
};

const generateProductionPayrollNumberFromPool = (payrolls = [], payrollDate = new Date()) => {
  const dateCode = getPayrollDateCode(payrollDate);
  const sameDayPayrolls = payrolls.filter((item) =>
    safeTrim(item?.payrollNumber).startsWith(`PAY-${dateCode}-`),
  );
  const nextSequence = String(sameDayPayrolls.length + 1).padStart(4, "0");

  return `PAY-${dateCode}-${nextSequence}`;
};

const hasActivePayrollLineForWorkLog = async ({
  workLogId,
  workerLineKey,
  excludeId = null,
} = {}) => {
  if (!workLogId || !workerLineKey) return false;

  const payrolls = await getPayrollDocsByWorkLogId(workLogId);

  return payrolls.some((item) => {
    if (item.id === excludeId) return false;
    if (item.status === "cancelled") return false;
    return safeTrim(item.workerLineKey) === safeTrim(workerLineKey);
  });
};

const deriveWorkLogPayrollSyncState = (activePayrolls = []) => {
  if (activePayrolls.length === 0) {
    return {
      payrollCalculated: false,
      payrollCalculationStatus: "pending",
    };
  }

  const allPaid = activePayrolls.every(
    (item) => item.status === "paid" && item.paymentStatus === "paid",
  );

  return {
    payrollCalculated: true,
    payrollCalculationStatus: allPaid ? "posted" : "calculated",
  };
};

// =====================================================
// ACTIVE / GUARDED
// Sinkronisasi flag payroll pada Work Log completed.
//
// Fungsi:
// - menjaga audit trail Work Log -> Payroll tetap jelas
// - 1 work log sekarang boleh punya banyak payroll line selama berbeda operator
//   sehingga sinkronisasi harus membaca summary aktif, bukan satu dokumen payroll
// =====================================================
const syncWorkLogPayrollState = async (workLogId, actor = "system") => {
  if (!workLogId) return;

  const payrolls = await getPayrollDocsByWorkLogId(workLogId);
  const activePayrolls = payrolls.filter((item) => item.status !== "cancelled");
  const totalFinalAmount = activePayrolls.reduce(
    (sum, item) => sum + toNumber(item.finalAmount, 0),
    0,
  );
  const paidPayrollLineCount = activePayrolls.filter(
    (item) => item.status === "paid" && item.paymentStatus === "paid",
  ).length;
  const syncState = deriveWorkLogPayrollSyncState(activePayrolls);
  const singleActivePayroll = activePayrolls.length === 1 ? activePayrolls[0] : null;

  await updateDoc(doc(db, WORK_LOG_COLLECTION_NAME, workLogId), {
    payrollCalculated: syncState.payrollCalculated,
    payrollCalculationStatus: syncState.payrollCalculationStatus,
    payrollId: singleActivePayroll?.id || "",
    payrollNumber: singleActivePayroll?.payrollNumber || "",
    payrollIds: activePayrolls.map((item) => item.id),
    payrollNumbers: activePayrolls.map((item) => safeTrim(item.payrollNumber)).filter(Boolean),
    payrollLineCount: activePayrolls.length,
    paidPayrollLineCount,
    payrollFinalAmount: totalFinalAmount,
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
};

const normalizePayload = (values = {}, currentUser = null, isEdit = false) => {
  const totals = calculatePayrollAmounts(values);

  const payload = {
    payrollNumber: safeTrim(values.payrollNumber).toUpperCase(),
    payrollDate: values.payrollDate || null,

    workLogId: values.workLogId || "",
    workNumber: safeTrim(values.workNumber),

    bomId: values.bomId || "",
    bomCode: safeTrim(values.bomCode),

    targetType: values.targetType || "",
    targetId: values.targetId || "",
    targetCode: safeTrim(values.targetCode),
    targetName: safeTrim(values.targetName),

    stepId: values.stepId || "",
    stepCode: safeTrim(values.stepCode),
    stepName: safeTrim(values.stepName),
    sequenceNo: Number(values.sequenceNo || 1),

    // =====================================================
    // ACTIVE / GUARDED
    // Payroll v1 wajib menyimpan line operator secara tegas.
    // 1 payroll line = 1 orang + 1 step + 1 batch/work log.
    // =====================================================
    workerLineKey: safeTrim(values.workerLineKey),
    workerSourceType: safeTrim(values.workerSourceType),
    workerId: values.workerId || "",
    workerCode: safeTrim(values.workerCode),
    workerName: safeTrim(values.workerName),

    payrollMode: values.payrollMode || "per_qty",
    payrollRate: Number(values.payrollRate || 0),
    payrollQtyBase: Number(values.payrollQtyBase || 1),
    payrollOutputBasis: values.payrollOutputBasis || "good_qty",
    payrollClassification: values.payrollClassification || "direct_labor",
    includePayrollInHpp:
      typeof values.includePayrollInHpp === "boolean"
        ? values.includePayrollInHpp
        : true,
    payrollRuleSource: values.payrollRuleSource || "work_log_step_snapshot",
    legacyPayrollFallbackUsed: Boolean(values.legacyPayrollFallbackUsed),

    totalWorkLogOutputQty: Number(values.totalWorkLogOutputQty || 0),
    workedQty: Number(values.workedQty || 0),
    outputQtyUsed: Number(values.outputQtyUsed || 0),
    payableQtyFactor: totals.payableQtyFactor,

    amountCalculated: totals.amountCalculated,
    bonusAmount: Number(values.bonusAmount || 0),
    deductionAmount: Number(values.deductionAmount || 0),
    finalAmount: totals.finalAmount,

    sharedWorkLog: Boolean(values.sharedWorkLog),
    teamWorkerCount: Number(values.teamWorkerCount || 1),

    status: values.status || "draft",
    paymentStatus: values.paymentStatus || "unpaid",
    confirmedAt: values.confirmedAt || null,
    paidAt: values.paidAt || null,

    notes: safeTrim(values.notes),
    calculationNotes: safeTrim(values.calculationNotes),
    payrollEligibilityStatus: values.payrollEligibilityStatus || "eligible",
    payrollEligibilityBlockingReasons: Array.isArray(values.payrollEligibilityBlockingReasons)
      ? values.payrollEligibilityBlockingReasons.filter(Boolean).map((item) => safeTrim(item))
      : [],
    payrollEligibilityWarningReasons: Array.isArray(values.payrollEligibilityWarningReasons)
      ? values.payrollEligibilityWarningReasons.filter(Boolean).map((item) => safeTrim(item))
      : [],
    payrollEligibilityNotes: safeTrim(values.payrollEligibilityNotes),

    updatedAt: serverTimestamp(),
    updatedBy:
      currentUser?.email ||
      currentUser?.displayName ||
      currentUser?.uid ||
      "system",
  };

  if (!isEdit) {
    payload.createdAt = serverTimestamp();
    payload.createdBy =
      currentUser?.email ||
      currentUser?.displayName ||
      currentUser?.uid ||
      "system";
  }

  return payload;
};

export const validateProductionPayroll = (values = {}) => {
  const errors = {};

  if (!safeTrim(values.payrollNumber)) {
    errors.payrollNumber = "Nomor payroll wajib diisi";
  }

  if (!values.payrollDate) {
    errors.payrollDate = "Tanggal payroll wajib diisi";
  }

  if (!values.workLogId) {
    errors.workLogId = "Work log wajib dipilih";
  }

  if (!safeTrim(values.workerLineKey)) {
    errors.workerLineKey =
      "Line operator payroll wajib dipilih. Payroll v1 tidak lagi memakai ringkasan tim sebagai satu line.";
  }

  if (!safeTrim(values.workerName)) {
    errors.workerName = "Nama operator payroll wajib terbaca dari Work Log";
  }

  if (!values.stepId) {
    errors.stepId = "Step produksi wajib terbaca dari work log";
  }

  if (Number(values.payrollRate || 0) <= 0) {
    errors.payrollRate = "Tarif payroll wajib lebih besar dari 0";
  }

  if (Number(values.outputQtyUsed || 0) < 0) {
    errors.outputQtyUsed = "Output qty tidak boleh negatif";
  }

  if (Number(values.workedQty || 0) < 0) {
    errors.workedQty = "Worked qty tidak boleh negatif";
  }

  if ((values.payrollMode || "per_qty") === "per_qty") {
    if (Number(values.payrollQtyBase || 0) <= 0) {
      errors.payrollQtyBase = "Qty dasar payroll per qty wajib lebih besar dari 0";
    }

    if (Number(values.outputQtyUsed || 0) <= 0) {
      errors.outputQtyUsed =
        "Output qty untuk payroll per qty wajib lebih besar dari 0";
    }
  }

  if ((values.payrollMode || "per_qty") === "per_batch" && Number(values.workedQty || 0) <= 0) {
    errors.workedQty =
      "Qty batch untuk payroll per batch wajib lebih besar dari 0";
  }

  if (String(values.payrollEligibilityStatus || "eligible") === "blocked") {
    errors.workLogId =
      "Draft payroll ini masih blocked. Selesaikan dulu issue eligibility pada Work Log.";
  }

  return errors;
};

// =====================================================
// ACTIVE / FINAL
// Helper ini menjadi titik handoff resmi Work Log completed -> payroll draft.
// Source of truth rule tetap dibaca dari snapshot payroll pada Work Log.
// Fallback master step hanya dipertahankan untuk data lama yang belum punya
// snapshot payroll dan harus tetap ditandai legacy/deprecated.
//
// Catatan penting:
// - includeCancelled=true dipakai untuk reconciliation agar line yang sudah
//   pernah dicancel tidak otomatis dibuat ulang diam-diam.
// - createProductionPayroll tetap dipakai sebagai boundary write final agar
//   validasi line operator dan sinkronisasi Work Log tidak tersebar.
// =====================================================
const createMissingPayrollDraftsForCompletedWorkLog = async ({
  workLog,
  productionStep = null,
  existingPayrolls = [],
  currentUser = null,
} = {}) => {
  const normalizedWorkLog = workLog?.id ? workLog : null;
  if (!normalizedWorkLog?.id) {
    return {
      status: "blocked",
      createdCount: 0,
      blockingReasons: ["Work Log completed tidak valid untuk auto-create payroll draft."],
      warningReasons: [],
      createdPayrollIds: [],
      createdPayrollNumbers: [],
      createdWorkerNames: [],
    };
  }

  const eligibility = resolveWorkLogPayrollDraft({
    workLog: normalizedWorkLog,
    productionStep,
  });

  if (!eligibility.isEligible) {
    return {
      status: "blocked",
      createdCount: 0,
      blockingReasons: eligibility.blockingReasons,
      warningReasons: eligibility.warningReasons,
      createdPayrollIds: [],
      createdPayrollNumbers: [],
      createdWorkerNames: [],
    };
  }

  const processedWorkerLineKeys = buildPayrollWorkerLineKeySet(existingPayrolls, {
    includeCancelled: true,
  });
  const missingWorkerCandidates = (eligibility.workerCandidates || []).filter(
    (candidate) => !processedWorkerLineKeys.has(safeTrim(candidate.workerLineKey)),
  );

  if (missingWorkerCandidates.length === 0) {
    return {
      status: existingPayrolls.length > 0 ? "already_exists" : "no_candidates",
      createdCount: 0,
      blockingReasons: [],
      warningReasons: eligibility.warningReasons,
      createdPayrollIds: [],
      createdPayrollNumbers: [],
      createdWorkerNames: [],
    };
  }

  const payrollPool = await getAllProductionPayrollDocs();
  const payrollDate = resolvePayrollDraftDate(normalizedWorkLog);
  const createdPayrollIds = [];
  const createdPayrollNumbers = [];
  const createdWorkerNames = [];

  for (const candidate of missingWorkerCandidates) {
    const draft = buildPayrollDraftFromWorkLog(
      normalizedWorkLog,
      productionStep,
      candidate.workerLineKey,
    );

    if (draft.payrollEligibilityStatus === "blocked") {
      return {
        status: "blocked",
        createdCount: createdPayrollIds.length,
        blockingReasons: draft.payrollEligibilityBlockingReasons || [
          "Draft payroll otomatis masih blocked.",
        ],
        warningReasons: draft.payrollEligibilityWarningReasons || [],
        createdPayrollIds,
        createdPayrollNumbers,
        createdWorkerNames,
      };
    }

    const payrollNumber = generateProductionPayrollNumberFromPool(payrollPool, payrollDate);
    const payrollId = await createProductionPayroll(
      {
        ...draft,
        payrollNumber,
        payrollDate,
      },
      currentUser,
    );

    payrollPool.push({
      id: payrollId,
      payrollNumber,
      payrollDate,
      workLogId: normalizedWorkLog.id,
      workerLineKey: draft.workerLineKey,
      status: "draft",
      paymentStatus: "unpaid",
    });
    createdPayrollIds.push(payrollId);
    createdPayrollNumbers.push(payrollNumber);
    createdWorkerNames.push(draft.workerName || candidate.workerName || "-");
  }

  return {
    status: "draft_created",
    createdCount: createdPayrollIds.length,
    blockingReasons: [],
    warningReasons: eligibility.warningReasons,
    createdPayrollIds,
    createdPayrollNumbers,
    createdWorkerNames,
  };
};

export const ensurePayrollDraftsForCompletedWorkLog = async (
  workLogOrId,
  currentUser = null,
) => {
  const workLog =
    typeof workLogOrId === "string"
      ? await getProductionWorkLogById(workLogOrId)
      : workLogOrId;

  if (!workLog?.id) {
    return {
      status: "blocked",
      createdCount: 0,
      blockingReasons: ["Work Log untuk auto-create payroll draft tidak ditemukan."],
      warningReasons: [],
      createdPayrollIds: [],
      createdPayrollNumbers: [],
      createdWorkerNames: [],
    };
  }

  if (safeTrim(workLog.status) !== "completed") {
    return {
      status: "skipped_not_completed",
      createdCount: 0,
      blockingReasons: ["Work Log belum completed sehingga draft payroll belum boleh dibuat."],
      warningReasons: [],
      createdPayrollIds: [],
      createdPayrollNumbers: [],
      createdWorkerNames: [],
    };
  }

  const [productionSteps, existingPayrolls] = await Promise.all([
    getAllProductionStepsForPayroll(),
    getPayrollDocsByWorkLogId(workLog.id),
  ]);
  const productionStep = productionSteps.find((item) => item.id === workLog.stepId) || null;

  return createMissingPayrollDraftsForCompletedWorkLog({
    workLog,
    productionStep,
    existingPayrolls,
    currentUser,
  });
};

// =====================================================
// ACTIVE / GUARDED
// Referensi payroll sekarang berfungsi sebagai halaman review draft final.
// Completed Work Log yang eligible akan direkonsiliasi sekali di sini agar
// draft payroll otomatis tetap lengkap untuk data completed lama.
// Halaman Payroll tidak lagi menjadi tempat generate candidate manual.
// =====================================================
export const getPayrollReferenceData = async () => {
  const [completedWorkLogs, productionSteps, payrollsBeforeSync] = await Promise.all([
    getCompletedProductionWorkLogs(),
    getAllProductionStepsForPayroll(),
    getAllProductionPayrollDocs(),
  ]);

  const stepMap = productionSteps.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
  const processedLineKeysByWorkLog = payrollsBeforeSync.reduce((acc, item) => {
    if (!item?.workLogId) {
      return acc;
    }

    if (!acc[item.workLogId]) {
      acc[item.workLogId] = new Set();
    }

    const workerLineKey = safeTrim(item.workerLineKey);
    if (workerLineKey) {
      acc[item.workLogId].add(workerLineKey);
    }

    return acc;
  }, {});

  const blockedCompletedWorkLogs = [];
  const autoCreateQueue = [];

  completedWorkLogs.forEach((item) => {
    const eligibility = resolveWorkLogPayrollDraft({
      workLog: item,
      productionStep: stepMap[item.stepId] || null,
    });
    const processedLineKeys = processedLineKeysByWorkLog[item.id] || new Set();
    const missingWorkerCandidates = (eligibility.workerCandidates || []).filter(
      (candidate) => !processedLineKeys.has(candidate.workerLineKey),
    );

    if (!eligibility.isEligible) {
      blockedCompletedWorkLogs.push({
        ...item,
        workerPayrollCandidates: eligibility.workerCandidates,
        payrollEligibilityStatus: eligibility.status,
        payrollEligibilityBlockingReasons: eligibility.blockingReasons,
        payrollEligibilityWarningReasons: eligibility.warningReasons,
        payrollEligibilityNotes: buildPayrollEligibilityNotes({
          workLog: item,
          eligibility,
        }),
      });
      return;
    }

    if (missingWorkerCandidates.length > 0) {
      autoCreateQueue.push({
        workLog: item,
        productionStep: stepMap[item.stepId] || null,
      });
    }
  });

  const autoDraftSummary = {
    affectedWorkLogCount: 0,
    createdLineCount: 0,
    blockedWorkLogCount: blockedCompletedWorkLogs.length,
  };

  for (const queueItem of autoCreateQueue) {
    const existingPayrolls = payrollsBeforeSync.filter(
      (item) => item.workLogId === queueItem.workLog.id,
    );
    const result = await createMissingPayrollDraftsForCompletedWorkLog({
      ...queueItem,
      existingPayrolls,
      currentUser: null,
    });

    if (result.status === "draft_created") {
      autoDraftSummary.affectedWorkLogCount += 1;
      autoDraftSummary.createdLineCount += Number(result.createdCount || 0);
    }
  }

  return {
    completedWorkLogs: [],
    blockedCompletedWorkLogs,
    payrollReadinessSummary: {
      eligibleCount: Math.max(0, completedWorkLogs.length - blockedCompletedWorkLogs.length),
      blockedCount: blockedCompletedWorkLogs.length,
    },
    productionSteps,
    autoDraftSummary,
  };
};

// =====================================================
// ACTIVE / GUARDED
// Draft payroll final wajib membaca rule payroll step dari snapshot
// Work Log dan memilih 1 operator line. Employee custom payroll tidak lagi
// dipakai di jalur aktif.
//
// LEGACY / DEPRECATED
// Jika work log lama belum punya snapshot payroll step, service ini masih
// boleh fallback sekali ke master step dan menandainya eksplisit.
// =====================================================
export const buildPayrollDraftFromWorkLog = (
  workLog,
  productionStep = null,
  selectedWorker = "",
) => {
  const eligibility = resolveWorkLogPayrollDraft({
    workLog,
    productionStep,
  });
  const resolvedRule = eligibility.resolvedRule;
  const payrollRule = eligibility.payrollRule || DEFAULT_PRODUCTION_PAYROLL_FORM;
  const metrics = eligibility.metrics;
  const selectedWorkerCandidate = resolveSelectedWorkerCandidate(
    workLog,
    selectedWorker,
  );
  const calculated = calculatePayrollAmounts({
    payrollMode: payrollRule.payrollMode,
    payrollRate: payrollRule.payrollRate,
    payrollQtyBase: payrollRule.payrollQtyBase,
    outputQtyUsed: metrics.outputQtyUsed,
    workedQty: metrics.workedQty,
    bonusAmount: 0,
    deductionAmount: 0,
  });

  return {
    workLogId: workLog?.id || "",
    workNumber: workLog?.workNumber || "",

    bomId: workLog?.bomId || "",
    bomCode: workLog?.bomCode || "",

    targetType: workLog?.targetType || "",
    targetId: workLog?.targetId || "",
    targetCode: workLog?.targetCode || "",
    targetName: workLog?.targetName || "",

    stepId: workLog?.stepId || payrollRule.stepId || "",
    stepCode: workLog?.stepCode || payrollRule.stepCode || "",
    stepName: workLog?.stepName || payrollRule.stepName || "",
    sequenceNo: Number(workLog?.sequenceNo || 1),

    workerLineKey: selectedWorkerCandidate?.workerLineKey || "",
    workerSourceType: selectedWorkerCandidate?.workerSourceType || "",
    workerId: selectedWorkerCandidate?.workerId || "",
    workerCode: selectedWorkerCandidate?.workerCode || "",
    workerName: selectedWorkerCandidate?.workerName || "",

    payrollMode: payrollRule.payrollMode,
    payrollRate: payrollRule.payrollRate,
    payrollQtyBase: payrollRule.payrollQtyBase,
    payrollOutputBasis: payrollRule.payrollOutputBasis,
    payrollClassification: payrollRule.payrollClassification,
    includePayrollInHpp: payrollRule.includePayrollInHpp,
    payrollRuleSource: resolvedRule.source,
    legacyPayrollFallbackUsed: resolvedRule.legacyFallbackUsed,

    totalWorkLogOutputQty: metrics.outputQtyUsed,
    workedQty: metrics.workedQty,
    outputQtyUsed: metrics.outputQtyUsed,
    payableQtyFactor: calculated.payableQtyFactor,

    amountCalculated: calculated.amountCalculated,
    bonusAmount: 0,
    deductionAmount: 0,
    finalAmount: calculated.finalAmount,

    sharedWorkLog: (eligibility.workerCandidates || []).length > 1,
    teamWorkerCount: Number(workLog?.workerCount || (eligibility.workerCandidates || []).length || 1),

    status: "draft",
    paymentStatus: "unpaid",
    confirmedAt: null,
    paidAt: null,

    notes: "",
    calculationNotes: buildPayrollCalculationNotes({
      workLog,
      payrollRule,
      payrollSource: resolvedRule.source,
      legacyFallbackUsed: resolvedRule.legacyFallbackUsed,
      workerName: selectedWorkerCandidate?.workerName || "",
    }),
    payrollEligibilityStatus: eligibility.status,
    payrollEligibilityBlockingReasons: eligibility.blockingReasons,
    payrollEligibilityWarningReasons: eligibility.warningReasons,
    payrollEligibilityNotes: buildPayrollEligibilityNotes({
      workLog,
      eligibility,
    }),
  };
};

export const getAllProductionPayrolls = async () => getAllProductionPayrollDocs();

export const getProductionPayrollById = async (id) => {
  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new Error("Data payroll produksi tidak ditemukan");
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
};

export const isPayrollNumberExists = async (payrollNumber, excludeId = null) => {
  const normalized = safeTrim(payrollNumber).toUpperCase();
  if (!normalized) return false;

  const snapshot = await getDocs(
    query(collection(db, COLLECTION_NAME), where("payrollNumber", "==", normalized)),
  );

  if (snapshot.empty) return false;

  const found = snapshot.docs.find((item) => item.id !== excludeId);
  return Boolean(found);
};

export const createProductionPayroll = async (values, currentUser = null) => {
  const errors = validateProductionPayroll(values);

  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  const exists = await isPayrollNumberExists(values.payrollNumber);
  if (exists) {
    throw {
      type: "validation",
      errors: {
        payrollNumber: "Nomor payroll sudah digunakan",
      },
    };
  }

  const activePayrollExists = await hasActivePayrollLineForWorkLog({
    workLogId: values.workLogId,
    workerLineKey: values.workerLineKey,
  });
  if (activePayrollExists) {
    throw {
      type: "validation",
      errors: {
        workerLineKey:
          "Line operator untuk Work Log ini sudah memiliki payroll aktif. Cancel payroll lama terlebih dahulu jika ingin membuat ulang.",
      },
    };
  }

  const payload = normalizePayload(values, currentUser, false);
  const result = await addDoc(collection(db, COLLECTION_NAME), payload);

  await syncWorkLogPayrollState(payload.workLogId, payload.updatedBy);

  return result.id;
};

export const updateProductionPayroll = async (id, values, currentUser = null) => {
  const errors = validateProductionPayroll(values);

  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  const exists = await isPayrollNumberExists(values.payrollNumber, id);
  if (exists) {
    throw {
      type: "validation",
      errors: {
        payrollNumber: "Nomor payroll sudah digunakan",
      },
    };
  }

  const activePayrollExists = await hasActivePayrollLineForWorkLog({
    workLogId: values.workLogId,
    workerLineKey: values.workerLineKey,
    excludeId: id,
  });
  if (activePayrollExists) {
    throw {
      type: "validation",
      errors: {
        workerLineKey:
          "Line operator Work Log ini sudah memiliki payroll aktif lain. Payroll aktif ganda untuk operator yang sama tidak diizinkan.",
      },
    };
  }

  const payload = normalizePayload(values, currentUser, true);
  await updateDoc(doc(db, COLLECTION_NAME, id), payload);

  await syncWorkLogPayrollState(payload.workLogId, payload.updatedBy);

  return id;
};

export const updatePayrollStatus = async (id, status, paymentStatus, extra = {}) => {
  const currentPayroll = await getProductionPayrollById(id);

  if (status === "confirmed" && currentPayroll.status !== "draft") {
    throw new Error("Payroll hanya boleh dikonfirmasi dari status draft");
  }

  if (status === "paid" && currentPayroll.status !== "confirmed") {
    throw new Error("Payroll harus dikonfirmasi dulu sebelum ditandai paid");
  }

  if (status === "cancelled" && currentPayroll.status === "paid") {
    throw new Error("Payroll yang sudah paid tidak boleh langsung dibatalkan");
  }

  const nextPayload = {
    status,
    paymentStatus,
    ...extra,
    updatedAt: serverTimestamp(),
    updatedBy: "system",
  };

  if (status === "confirmed" && !extra.confirmedAt) {
    nextPayload.confirmedAt = new Date();
  }

  if (status === "cancelled") {
    nextPayload.paidAt = null;
  }

  await updateDoc(doc(db, COLLECTION_NAME, id), nextPayload);

  await syncWorkLogPayrollState(currentPayroll.workLogId, "system");

  return id;
};

export { formatPayrollRuleSourceLabel };
