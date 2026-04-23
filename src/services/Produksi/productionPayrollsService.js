// =====================================================
// Production Payrolls Service
//
// ACTIVE / GUARDED
// Flow final payroll produksi sekarang adalah:
// Work Log completed -> resolve rule payroll step -> buat payroll draft ->
// simpan payroll -> sinkronkan flag payroll di Work Log.
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
import { getCompletedProductionWorkLogs } from "./productionWorkLogsService";
import {
  buildPayrollCalculationNotes,
  formatPayrollRuleSourceLabel,
  getWorkLogPayrollMetrics,
  resolveCompletedWorkLogPayrollRule,
} from "../../utils/produksi/productionPayrollRuleHelpers";

const COLLECTION_NAME = "production_payrolls";
const WORK_LOG_COLLECTION_NAME = "production_work_logs";

const safeTrim = (value) => String(value || "").trim();

const buildWorkerSummaryFromWorkLog = (workLog = {}) => {
  const workerNames = Array.isArray(workLog.workerNames)
    ? workLog.workerNames.filter(Boolean)
    : [];

  if (workerNames.length > 0) {
    return workerNames.join(", ");
  }

  if (safeTrim(workLog.workerName)) {
    return safeTrim(workLog.workerName);
  }

  const workerCount = Number(workLog.workerCount || 0);
  if (workerCount > 1) {
    return `Tim Produksi (${workerCount} orang)`;
  }

  if (workerCount === 1) {
    return "Operator Produksi";
  }

  return "-";
};

// =====================================================
// ACTIVE / GUARDED
// Sinkronisasi flag payroll pada Work Log completed.
//
// Fungsi:
// - menjaga audit trail Work Log -> Payroll tetap jelas
// - menghindari flow lama yang mengandalkan tebakan / fallback diam-diam
// =====================================================
const syncWorkLogPayrollState = async (
  {
    workLogId,
    payrollId,
    payrollNumber,
    finalAmount,
    status,
    paymentStatus,
  } = {},
  actor = "system",
) => {
  if (!workLogId) return;

  const isCancelled = status === "cancelled";
  const normalizedCalculationStatus = isCancelled
    ? "cancelled"
    : paymentStatus === "paid"
      ? "paid"
      : status || "draft";

  await updateDoc(doc(db, WORK_LOG_COLLECTION_NAME, workLogId), {
    payrollCalculated: !isCancelled,
    payrollCalculationStatus: normalizedCalculationStatus,
    payrollId: !isCancelled ? payrollId || "" : "",
    payrollNumber: !isCancelled ? safeTrim(payrollNumber) : "",
    payrollFinalAmount: !isCancelled ? Number(finalAmount || 0) : 0,
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
    // Kolom worker sekarang bersifat summary operator/tim dari Work Log.
    // workerId/workerCode dipertahankan untuk kompatibilitas schema lama,
    // tetapi tidak lagi menjadi source of truth hitung payroll.
    // =====================================================
    workerId: values.workerId || "",
    workerCode: safeTrim(values.workerCode),
    workerName: safeTrim(values.workerName),

    payrollMode: values.payrollMode || "per_qty",
    payrollRate: Number(values.payrollRate || 0),
    payrollQtyBase: Number(values.payrollQtyBase || 1),
    payrollOutputBasis: values.payrollOutputBasis || "good_qty",
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
    paidAt: values.paidAt || null,

    notes: safeTrim(values.notes),
    calculationNotes: safeTrim(values.calculationNotes),

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

  if (!safeTrim(values.workerName) && !values.workerId) {
    errors.workerId = "Operator / tim dari work log wajib terbaca";
  }

  if (!values.stepId) {
    errors.stepId = "Step produksi wajib terbaca dari work log";
  }

  if (Number(values.outputQtyUsed || 0) < 0) {
    errors.outputQtyUsed = "Output qty tidak boleh negatif";
  }

  if (Number(values.workedQty || 0) < 0) {
    errors.workedQty = "Worked qty tidak boleh negatif";
  }

  return errors;
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

const hasActivePayrollForWorkLog = async (workLogId, excludeId = null) => {
  if (!workLogId) return false;

  const snapshot = await getDocs(
    query(collection(db, COLLECTION_NAME), where("workLogId", "==", workLogId)),
  );

  return snapshot.docs.some((item) => {
    if (item.id === excludeId) return false;
    const data = item.data() || {};
    return data.status !== "cancelled";
  });
};

// =====================================================
// ACTIVE / GUARDED
// Referensi payroll baru hanya menampilkan Work Log completed yang masih
// eligible untuk dibuat payroll aktif.
// =====================================================
export const getPayrollReferenceData = async () => {
  const [completedWorkLogs, productionSteps, payrolls] = await Promise.all([
    getCompletedProductionWorkLogs(),
    getAllProductionStepsForPayroll(),
    getAllProductionPayrollDocs(),
  ]);

  const activePayrollWorkLogIds = new Set(
    payrolls
      .filter((item) => item.status !== "cancelled")
      .map((item) => item.workLogId)
      .filter(Boolean),
  );

  const eligibleCompletedWorkLogs = completedWorkLogs.filter(
    (item) => !activePayrollWorkLogIds.has(item.id),
  );

  return {
    completedWorkLogs: eligibleCompletedWorkLogs,
    productionSteps,
  };
};

// =====================================================
// ACTIVE / GUARDED
// Draft payroll final wajib membaca rule payroll step dari snapshot
// Work Log. Employee custom payroll tidak lagi dipakai di jalur aktif.
//
// LEGACY / DEPRECATED
// Jika work log lama belum punya snapshot payroll step, service ini masih
// boleh fallback sekali ke master step dan menandainya eksplisit.
// =====================================================
export const buildPayrollDraftFromWorkLog = (workLog, productionStep = null) => {
  const resolvedRule = resolveCompletedWorkLogPayrollRule({
    workLog,
    productionStep,
  });
  const payrollRule = resolvedRule.rule || DEFAULT_PRODUCTION_PAYROLL_FORM;
  const metrics = getWorkLogPayrollMetrics(workLog, payrollRule);
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

    workerId: "",
    workerCode: "",
    workerName: buildWorkerSummaryFromWorkLog(workLog),

    payrollMode: payrollRule.payrollMode,
    payrollRate: payrollRule.payrollRate,
    payrollQtyBase: payrollRule.payrollQtyBase,
    payrollOutputBasis: payrollRule.payrollOutputBasis,
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

    sharedWorkLog: (workLog?.workerIds || []).length > 1,
    teamWorkerCount: Number(workLog?.workerCount || 1),

    status: "draft",
    paymentStatus: "unpaid",
    paidAt: null,

    notes: "",
    calculationNotes: buildPayrollCalculationNotes({
      workLog,
      payrollRule,
      payrollSource: resolvedRule.source,
      legacyFallbackUsed: resolvedRule.legacyFallbackUsed,
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

  const activePayrollExists = await hasActivePayrollForWorkLog(values.workLogId);
  if (activePayrollExists) {
    throw {
      type: "validation",
      errors: {
        workLogId:
          "Work log ini sudah memiliki payroll aktif. Cancel payroll lama terlebih dahulu jika ingin membuat ulang.",
      },
    };
  }

  const payload = normalizePayload(values, currentUser, false);
  const result = await addDoc(collection(db, COLLECTION_NAME), payload);

  await syncWorkLogPayrollState(
    {
      workLogId: payload.workLogId,
      payrollId: result.id,
      payrollNumber: payload.payrollNumber,
      finalAmount: payload.finalAmount,
      status: payload.status,
      paymentStatus: payload.paymentStatus,
    },
    payload.updatedBy,
  );

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

  const activePayrollExists = await hasActivePayrollForWorkLog(values.workLogId, id);
  if (activePayrollExists) {
    throw {
      type: "validation",
      errors: {
        workLogId:
          "Work log ini sudah memiliki payroll aktif lain. Payroll aktif ganda untuk satu work log tidak diizinkan di flow final.",
      },
    };
  }

  const payload = normalizePayload(values, currentUser, true);
  await updateDoc(doc(db, COLLECTION_NAME, id), payload);

  await syncWorkLogPayrollState(
    {
      workLogId: payload.workLogId,
      payrollId: id,
      payrollNumber: payload.payrollNumber,
      finalAmount: payload.finalAmount,
      status: payload.status,
      paymentStatus: payload.paymentStatus,
    },
    payload.updatedBy,
  );

  return id;
};

export const updatePayrollStatus = async (id, status, paymentStatus, extra = {}) => {
  const currentPayroll = await getProductionPayrollById(id);

  const nextPayload = {
    status,
    paymentStatus,
    ...extra,
    updatedAt: serverTimestamp(),
    updatedBy: "system",
  };

  await updateDoc(doc(db, COLLECTION_NAME, id), nextPayload);

  await syncWorkLogPayrollState(
    {
      workLogId: currentPayroll.workLogId,
      payrollId: id,
      payrollNumber: currentPayroll.payrollNumber,
      finalAmount: currentPayroll.finalAmount,
      status,
      paymentStatus,
    },
    "system",
  );

  return id;
};

export { formatPayrollRuleSourceLabel };
