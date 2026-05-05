// =====================================================
// Production Payrolls Service
// Generate payroll dari work log completed
// =====================================================

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  runTransaction,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { calculatePayrollAmounts } from "../../constants/productionPayrollOptions";
import { getCompletedProductionWorkLogs } from "./productionWorkLogsService";

const COLLECTION_NAME = "production_payrolls";
const EXPENSE_COLLECTION_NAME = "expenses";
const PAYROLL_EXPENSE_SOURCE_MODULE = "production_payroll";
const WORK_LOG_COLLECTION_NAME = "production_work_logs";
const PRODUCTION_STEPS_COLLECTION_NAME = "production_steps";
const PRODUCTION_EMPLOYEES_COLLECTION_NAME = "production_employees";

// =====================================================
// ACTIVE / GUARDED - sort payroll tanpa index tambahan
// Fungsi blok:
// - menyamakan urutan payroll terbaru di query utama dan fallback;
// - mendukung Timestamp Firestore maupun string tanggal lama.
// Alasan blok ini dipakai:
// - fallback plain collection tidak boleh membutuhkan composite index.
// Status:
// - aktif dipakai; bukan legacy.
// =====================================================
const getPayrollSortTime = (value) => {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortProductionPayrollsNewestFirst = (items = []) =>
  [...items].sort((a, b) => {
    const dateDiff = getPayrollSortTime(b.payrollDate) - getPayrollSortTime(a.payrollDate);
    if (dateDiff !== 0) return dateDiff;
    return String(b.payrollNumber || "").localeCompare(String(a.payrollNumber || ""));
  });

// =====================================================
// ACTIVE / GUARDED - helper aman untuk payroll otomatis Work Log
// Fungsi blok:
// - menyiapkan key deterministik agar payroll tidak dobel saat user klik selesai berulang;
// - menjaga penomoran line payroll tetap rapi dan mudah ditelusuri dari Work Log.
// Alasan blok ini dipakai:
// - auto payroll harus idempotent tanpa mengubah posting stok/output Work Log.
// Status:
// - aktif dipakai oleh generatePayrollLinesFromCompletedWorkLog; bukan legacy.
// =====================================================
const safeTrim = (value) => String(value || "").trim();

const getActorName = (currentUser = null) =>
  currentUser?.email ||
  currentUser?.displayName ||
  currentUser?.uid ||
  "system";

// IMS NOTE [AKTIF] - metadata audit saja; tidak mengubah finalAmount/status/expense.
const buildPayrollAuditFields = (currentUser = null, includeCreatedFields = false) => {
  const actorName = getActorName(currentUser);
  return {
    updatedAt: serverTimestamp(),
    updatedBy: actorName,
    ...(includeCreatedFields
      ? { createdAt: serverTimestamp(), createdBy: actorName }
      : {}),
  };
};

const sanitizePayrollKeySegment = (value, fallback = "line") => {
  const normalized = safeTrim(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
};

const resolvePayrollOutputQty = (workLog = {}, payrollOutputBasis = "good_qty") => {
  if (payrollOutputBasis === "actual_output_qty") {
    return Number(workLog.actualOutputQty || workLog.goodQty || 0);
  }

  return Number(workLog.goodQty || 0);
};

const getWorkerSnapshotFromWorkLog = async (workLog = {}) => {
  const workerIds = Array.isArray(workLog.workerIds) ? workLog.workerIds : [];
  const workerCodes = Array.isArray(workLog.workerCodes) ? workLog.workerCodes : [];
  const workerNames = Array.isArray(workLog.workerNames) ? workLog.workerNames : [];

  const workers = await Promise.all(
    workerIds.map(async (workerId, index) => {
      if (!workerId) {
        return {
          workerId: "",
          workerCode: safeTrim(workerCodes[index]),
          workerName: safeTrim(workerNames[index]),
          workerSourceType: "legacy_worker_snapshot",
        };
      }

      try {
        const employeeSnap = await getDoc(doc(db, PRODUCTION_EMPLOYEES_COLLECTION_NAME, workerId));
        if (employeeSnap.exists()) {
          const employee = employeeSnap.data() || {};
          return {
            workerId,
            workerCode: safeTrim(employee.code) || safeTrim(workerCodes[index]),
            workerName: safeTrim(employee.name) || safeTrim(workerNames[index]),
            workerSourceType: "production_employee",
          };
        }
      } catch (error) {
        console.error("Gagal membaca karyawan untuk auto payroll, pakai snapshot Work Log", error);
      }

      return {
        workerId,
        workerCode: safeTrim(workerCodes[index]),
        workerName: safeTrim(workerNames[index]),
        workerSourceType: "production_employee_snapshot",
      };
    }),
  );

  // Legacy fallback:
  // - aktif hanya untuk Work Log lama yang mungkin menyimpan nama/kode operator tanpa id;
  // - bukan source utama, tetapi mencegah payroll hilang pada data lama.
  if (workers.length === 0 && (workerCodes.length > 0 || workerNames.length > 0)) {
    const maxLength = Math.max(workerCodes.length, workerNames.length);
    return Array.from({ length: maxLength }).map((_, index) => ({
      workerId: "",
      workerCode: safeTrim(workerCodes[index]),
      workerName: safeTrim(workerNames[index]),
      workerSourceType: "legacy_worker_snapshot",
    }));
  }

  return workers.filter((item) => item.workerId || item.workerCode || item.workerName);
};

// =====================================================
// ACTIVE / GUARDED - guard idempotent lintas doc id
// Fungsi blok:
// - mendeteksi payroll existing dari Work Log + Step + Operator meski dibuat manual dengan doc id lama;
// - mencegah auto payroll membuat line dobel.
// Alasan blok ini dipakai:
// - data lama/manual tidak selalu memakai doc id deterministik auto payroll.
// Status:
// - aktif dipakai; kandidat cleanup hanya jika semua payroll lama sudah memakai key final.
// =====================================================
const findExistingPayrollLineForWorker = async (workLogId, stepId, worker = {}) => {
  if (!workLogId) return null;

  const snapshot = await getDocs(
    query(collection(db, COLLECTION_NAME), where("workLogId", "==", workLogId)),
  );
  const workerId = safeTrim(worker.workerId);
  const workerCode = safeTrim(worker.workerCode).toLowerCase();
  const workerName = safeTrim(worker.workerName).toLowerCase();

  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .find((line) => {
      if (line.status === "cancelled") return false;
      if (safeTrim(line.stepId) !== safeTrim(stepId)) return false;

      const lineWorkerId = safeTrim(line.workerId);
      const lineWorkerCode = safeTrim(line.workerCode).toLowerCase();
      const lineWorkerName = safeTrim(line.workerName).toLowerCase();

      if (workerId && lineWorkerId && workerId === lineWorkerId) return true;
      if (workerCode && lineWorkerCode && workerCode === lineWorkerCode) return true;
      return Boolean(workerName && lineWorkerName && workerName === lineWorkerName);
    }) || null;
};

const getStepPayrollRuleSnapshot = async (workLog = {}) => {
  if (!workLog.stepId) {
    return {
      payrollMode: "per_qty",
      payrollRate: 0,
      payrollQtyBase: 1,
      payrollOutputBasis: "good_qty",
      payrollClassification: "direct_labor",
      includePayrollInHpp: true,
      payrollRuleSource: "default_no_step",
      legacyPayrollFallbackUsed: true,
      payrollNotes: "Tahapan produksi tidak ditemukan pada Work Log.",
    };
  }

  try {
    const stepSnap = await getDoc(doc(db, PRODUCTION_STEPS_COLLECTION_NAME, workLog.stepId));
    if (stepSnap.exists()) {
      const step = stepSnap.data() || {};
      return {
        payrollMode: step.payrollMode || "per_qty",
        payrollRate: Number(step.payrollRate || 0),
        payrollQtyBase: Number(step.payrollQtyBase || 1),
        payrollOutputBasis: step.payrollOutputBasis || "good_qty",
        payrollClassification: step.payrollClassification || "direct_labor",
        includePayrollInHpp: step.includePayrollInHpp !== false,
        payrollRuleSource: "production_step",
        legacyPayrollFallbackUsed: false,
        payrollNotes: safeTrim(step.payrollNotes),
      };
    }
  } catch (error) {
    console.error("Gagal membaca rule payroll tahapan produksi", error);
  }

  return {
    payrollMode: "per_qty",
    payrollRate: 0,
    payrollQtyBase: 1,
    payrollOutputBasis: "good_qty",
    payrollClassification: "direct_labor",
    includePayrollInHpp: true,
    payrollRuleSource: "fallback_step_unavailable",
    legacyPayrollFallbackUsed: true,
    payrollNotes: "Rule payroll tahapan gagal dibaca, line tetap dibuat dengan nominal 0 agar audit tidak hilang.",
  };
};

const normalizePayload = (values = {}, currentUser = null, isEdit = false) => {
  const totals = calculatePayrollAmounts(values);

  const payload = {
    payrollNumber: String(values.payrollNumber || "")
      .trim()
      .toUpperCase(),
    payrollDate: values.payrollDate || null,

    workLogId: values.workLogId || "",
    workNumber: String(values.workNumber || "").trim(),

    bomId: values.bomId || "",
    bomCode: String(values.bomCode || "").trim(),

    targetType: values.targetType || "",
    targetId: values.targetId || "",
    targetCode: String(values.targetCode || "").trim(),
    targetName: String(values.targetName || "").trim(),

    stepId: values.stepId || "",
    stepCode: String(values.stepCode || "").trim(),
    stepName: String(values.stepName || "").trim(),
    sequenceNo: Number(values.sequenceNo || 1),

    workerLineKey: String(values.workerLineKey || "").trim(),
    workerSourceType: values.workerSourceType || "production_employee",
    workerId: values.workerId || "",
    workerCode: String(values.workerCode || "").trim(),
    workerName: String(values.workerName || "").trim(),

    payrollMode: values.payrollMode || "per_qty",
    payrollRate: Number(values.payrollRate || 0),
    payrollQtyBase: Number(values.payrollQtyBase || 1),
    payrollOutputBasis: values.payrollOutputBasis || "good_qty",
    payrollClassification: values.payrollClassification || "direct_labor",
    includePayrollInHpp: values.includePayrollInHpp !== false,

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

    notes: String(values.notes || "").trim(),
    calculationNotes: String(values.calculationNotes || "").trim(),
    payrollRuleSource: values.payrollRuleSource || "work_log_step_snapshot",
    legacyPayrollFallbackUsed: Boolean(values.legacyPayrollFallbackUsed),
    payrollEligibilityStatus: values.payrollEligibilityStatus || "eligible",
    payrollEligibilityBlockingReasons: Array.isArray(values.payrollEligibilityBlockingReasons)
      ? values.payrollEligibilityBlockingReasons
      : [],
    payrollEligibilityWarningReasons: Array.isArray(values.payrollEligibilityWarningReasons)
      ? values.payrollEligibilityWarningReasons
      : [],
    payrollEligibilityNotes: String(values.payrollEligibilityNotes || "").trim(),

    ...buildPayrollAuditFields(currentUser, !isEdit),
  };

  return payload;
};

export const validateProductionPayroll = (values = {}) => {
  const errors = {};

  if (!String(values.payrollNumber || "").trim()) {
    errors.payrollNumber = "Nomor payroll wajib diisi";
  }

  if (!values.payrollDate) {
    errors.payrollDate = "Tanggal payroll wajib diisi";
  }

  if (!values.workLogId) {
    errors.workLogId = "Work log wajib dipilih";
  }

  if (!values.workerName && !values.workerId) {
    errors.workerId = "Karyawan wajib dipilih";
  }

  if (Number(values.outputQtyUsed || 0) < 0) {
    errors.outputQtyUsed = "Output qty tidak boleh negatif";
  }

  return errors;
};

export const getPayrollReferenceData = async () => {
  const [completedWorkLogs, employeesResult] = await Promise.all([
    getCompletedProductionWorkLogs(),
    (async () => {
      try {
        const snapshot = await getDocs(collection(db, "production_employees"));
        return {
          items: snapshot.docs
            .map((documentItem) => ({ id: documentItem.id, ...documentItem.data() }))
            .filter((item) => item.isActive !== false)
            .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
        };
      } catch (error) {
        console.error("Gagal memuat referensi karyawan payroll produksi", error);
        return { items: [] };
      }
    })(),
  ]);

  return {
    completedWorkLogs,
    employees: employeesResult.items,
  };
};

export const buildPayrollDraftFromWorkLog = (workLog, employee = null) => {
  const basisOutput =
    workLog?.goodQty && Number(workLog.goodQty || 0) > 0
      ? Number(workLog.goodQty || 0)
      : Number(workLog.actualOutputQty || 0);

  let payrollMode = "per_qty";
  let payrollRate = 0;
  let payrollQtyBase = 1;
  let payrollOutputBasis = "good_qty";

  if (employee?.useCustomPayrollRate) {
    payrollMode = employee.customPayrollMode || "per_qty";
    payrollRate = Number(employee.customPayrollRate || 0);
    payrollQtyBase = Number(employee.customPayrollQtyBase || 1);
    payrollOutputBasis = employee.customPayrollOutputBasis || "good_qty";
  }

  const outputQtyUsed = basisOutput;
  const calculated = calculatePayrollAmounts({
    payrollMode,
    payrollRate,
    payrollQtyBase,
    outputQtyUsed,
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

    stepId: workLog?.stepId || "",
    stepCode: workLog?.stepCode || "",
    stepName: workLog?.stepName || "",
    sequenceNo: Number(workLog?.sequenceNo || 1),

    workerId: employee?.id || "",
    workerCode: employee?.code || "",
    workerName: employee?.name || "",

    payrollMode,
    payrollRate,
    payrollQtyBase,
    payrollOutputBasis,

    totalWorkLogOutputQty: basisOutput,
    workedQty: basisOutput,
    outputQtyUsed,
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
    calculationNotes: "Draft payroll dibuat dari work log completed",
  };
};

// =====================================================
// SECTION: Sinkronisasi summary Payroll -> Work Log
// Fungsi:
// - menjaga Work Log detail menampilkan labor/final cost dari payroll line terbaru
// - mencegah user melihat labor 0 padahal payroll line sudah ada
// Status:
// - aktif dipakai oleh flow create/update/status payroll
// - kandidat cleanup hanya jika nanti summary costing Work Log dipisah penuh ke read-model khusus
// =====================================================
const syncWorkLogPayrollSummary = async (workLogId) => {
  if (!workLogId) return;

  const workLogRef = doc(db, WORK_LOG_COLLECTION_NAME, workLogId);
  const workLogSnap = await getDoc(workLogRef);

  if (!workLogSnap.exists()) return;

  const workLogData = workLogSnap.data() || {};
  const payrollSnapshot = await getDocs(
    query(collection(db, COLLECTION_NAME), where("workLogId", "==", workLogId)),
  );

  const payrollLines = payrollSnapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));

  const activeLines = payrollLines.filter((line) => line.status !== "cancelled");
  const paidLines = activeLines.filter((line) => line.paymentStatus === "paid");
  const payrollIds = activeLines.map((line) => line.id);
  const payrollFinalAmount = activeLines.reduce(
    (sum, line) => sum + Number(line.finalAmount || 0),
    0,
  );

  const materialCostActual = Number(workLogData.materialCostActual || 0);
  const overheadCostActual = Number(workLogData.overheadCostActual || 0);
  const goodQty = Number(workLogData.goodQty || 0);
  const totalCostActual = materialCostActual + payrollFinalAmount + overheadCostActual;
  const costPerGoodUnit = goodQty > 0 ? totalCostActual / goodQty : 0;

  await updateDoc(workLogRef, {
    payrollCalculated: activeLines.length > 0,
    payrollCalculationStatus:
      activeLines.length === 0
        ? "pending"
        : paidLines.length === activeLines.length
          ? "posted"
          : "calculated",
    payrollIds,
    payrollLineCount: activeLines.length,
    paidPayrollLineCount: paidLines.length,
    payrollFinalAmount,
    laborCostActual: payrollFinalAmount,
    totalCostActual,
    costPerGoodUnit,
    updatedAt: serverTimestamp(),
    updatedBy: "system",
  });
};

// =====================================================
// ACTIVE / GUARDED - Auto payroll dari Work Log completed
// Fungsi blok:
// - membuat line payroll otomatis setelah Work Log selesai;
// - membuat satu line per operator produksi;
// - memakai id dokumen deterministik workLogId + stepId + operator agar idempotent.
// Alasan blok ini dipakai:
// - regression sebelumnya Work Log selesai tetapi menu Payroll Produksi tetap kosong.
// - guard idempotent wajib mencegah payroll dobel saat user klik Selesaikan ulang/refresh.
// Status:
// - aktif dipakai dari flow Selesaikan Work Log Produksi; bukan legacy.
// =====================================================
export const generatePayrollLinesFromCompletedWorkLog = async (workLogId, currentUser = null) => {
  if (!workLogId) return [];

  const workLogRef = doc(db, WORK_LOG_COLLECTION_NAME, workLogId);
  const workLogSnap = await getDoc(workLogRef);

  if (!workLogSnap.exists()) {
    throw new Error("Data work log untuk payroll tidak ditemukan");
  }

  const workLog = {
    id: workLogSnap.id,
    ...workLogSnap.data(),
  };

  if (workLog.status !== "completed") {
    throw new Error("Payroll hanya bisa dibuat dari Work Log yang sudah completed");
  }

  const workers = await getWorkerSnapshotFromWorkLog(workLog);
  if (workers.length === 0) {
    throw new Error("Operator Produksi wajib dipilih sebelum payroll dibuat");
  }

  const stepRule = await getStepPayrollRuleSnapshot(workLog);
  const payrollOutputBasis = stepRule.payrollOutputBasis || "good_qty";
  const outputQtyUsed = resolvePayrollOutputQty(workLog, payrollOutputBasis);
  const workedQty = Number(workLog.plannedQty || 0);
  const totalWorkLogOutputQty = Number(workLog.goodQty || workLog.actualOutputQty || 0);
  const actor = getActorName(currentUser);
  const createdIds = [];
  const skippedIds = [];

  for (const [index, worker] of workers.entries()) {
    const workerKey = sanitizePayrollKeySegment(
      worker.workerId || worker.workerCode || worker.workerName,
      `worker-${index + 1}`,
    );
    const lineKey = [
      sanitizePayrollKeySegment(workLog.id, "worklog"),
      sanitizePayrollKeySegment(workLog.stepId || workLog.stepName, "step"),
      workerKey,
    ].join("__");
    const payrollRef = doc(db, COLLECTION_NAME, lineKey);
    const existingLine = await findExistingPayrollLineForWorker(workLog.id, workLog.stepId || "", worker);
    const existingSnap = await getDoc(payrollRef);

    if (existingLine || existingSnap.exists()) {
      skippedIds.push(existingLine?.id || payrollRef.id);
      continue;
    }

    const payrollNumberSource = safeTrim(workLog.workNumber) || workLog.id;
    const payrollNumber = `${payrollNumberSource}-PAY-${String(index + 1).padStart(3, "0")}`.toUpperCase();
    const calculation = calculatePayrollAmounts({
      payrollMode: stepRule.payrollMode,
      payrollRate: stepRule.payrollRate,
      payrollQtyBase: stepRule.payrollQtyBase,
      outputQtyUsed,
      workedQty,
      bonusAmount: 0,
      deductionAmount: 0,
    });

    const payload = normalizePayload(
      {
        payrollNumber,
        payrollDate: new Date(),
        workLogId: workLog.id,
        workNumber: workLog.workNumber || "",
        bomId: workLog.bomId || "",
        bomCode: workLog.bomCode || "",
        targetType: workLog.targetType || "",
        targetId: workLog.targetId || "",
        targetCode: workLog.targetCode || "",
        targetName: workLog.targetName || "",
        stepId: workLog.stepId || "",
        stepCode: workLog.stepCode || "",
        stepName: workLog.stepName || "",
        sequenceNo: Number(workLog.sequenceNo || 1),
        workerLineKey: lineKey,
        workerSourceType: worker.workerSourceType || "production_employee",
        workerId: worker.workerId || "",
        workerCode: worker.workerCode || "",
        workerName: worker.workerName || "",
        payrollMode: stepRule.payrollMode,
        payrollRate: stepRule.payrollRate,
        payrollQtyBase: stepRule.payrollQtyBase,
        payrollOutputBasis,
        payrollClassification: stepRule.payrollClassification,
        includePayrollInHpp: stepRule.includePayrollInHpp,
        totalWorkLogOutputQty,
        workedQty,
        outputQtyUsed,
        payableQtyFactor: calculation.payableQtyFactor,
        amountCalculated: calculation.amountCalculated,
        bonusAmount: 0,
        deductionAmount: 0,
        finalAmount: calculation.finalAmount,
        sharedWorkLog: workers.length > 1,
        teamWorkerCount: workers.length,
        status: "draft",
        paymentStatus: "unpaid",
        notes: "",
        calculationNotes: `Auto payroll dari Work Log completed. Rule: ${stepRule.payrollRuleSource}.`,
        payrollRuleSource: stepRule.payrollRuleSource,
        legacyPayrollFallbackUsed: stepRule.legacyPayrollFallbackUsed,
        payrollEligibilityStatus: outputQtyUsed > 0 ? "eligible" : "warning_zero_output",
        payrollEligibilityWarningReasons: outputQtyUsed > 0 ? [] : ["output_qty_zero"],
        payrollEligibilityNotes:
          outputQtyUsed > 0
            ? ""
            : "Output payroll 0; line tetap dibuat untuk audit dan nominal mengikuti rule tahapan.",
      },
      currentUser,
      false,
    );

    await setDoc(payrollRef, {
      ...payload,
      autoGenerated: true,
      autoGeneratedFrom: "work_log_completed",
      autoGeneratedAt: serverTimestamp(),
      autoGeneratedBy: actor,
    });
    createdIds.push(payrollRef.id);
  }

  await syncWorkLogPayrollSummary(workLog.id);

  return {
    createdIds,
    skippedIds,
    createdCount: createdIds.length,
    skippedCount: skippedIds.length,
  };
};

export const getAllProductionPayrolls = async () => {
  // =====================================================
  // ACTIVE / FINAL - QUERY UTAMA PAYROLL
  // Fungsi blok:
  // - memuat payroll produksi untuk summary read-only di halaman karyawan;
  // - urutan server-side dipakai bila composite index sudah tersedia.
  // Alasan blok ini dipakai:
  // - payroll adalah data pendukung, bukan syarat agar employee tampil.
  // Status:
  // - aktif dipakai; bukan legacy.
  // =====================================================
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("payrollDate", "desc"),
      orderBy("payrollNumber", "desc"),
    );

    const snapshot = await getDocs(q);

    return sortProductionPayrollsNewestFirst(
      snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })),
    );
  } catch (error) {
    // =====================================================
    // ACTIVE / GUARDED - FALLBACK PAYROLL TANPA INDEX
    // Fungsi blok:
    // - membaca plain collection jika query dengan dua orderBy membutuhkan index;
    // - sort dilakukan di client agar halaman Karyawan Produksi tidak ikut kosong.
    // Alasan blok ini dipakai:
    // - fallback ini menjaga data pendukung payroll tidak menjatuhkan data utama employee.
    // Status:
    // - aktif sebagai guard; kandidat cleanup hanya jika index Firestore sudah dibuat.
    // =====================================================
    console.error("Query payroll produksi utama gagal, pakai fallback plain collection", error);
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));

    return sortProductionPayrollsNewestFirst(
      snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })),
    );
  }
};

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

export const isPayrollNumberExists = async (
  payrollNumber,
  excludeId = null,
) => {
  const normalized = String(payrollNumber || "")
    .trim()
    .toUpperCase();
  if (!normalized) return false;

  const snapshot = await getDocs(
    query(
      collection(db, COLLECTION_NAME),
      where("payrollNumber", "==", normalized),
    ),
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

  const payload = normalizePayload(values, currentUser, false);
  const result = await addDoc(collection(db, COLLECTION_NAME), payload);
  await syncWorkLogPayrollSummary(payload.workLogId || values.workLogId || "");
  return result.id;
};

export const updateProductionPayroll = async (
  id,
  values,
  currentUser = null,
) => {
  const currentRecord = await getProductionPayrollById(id);
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

  const payload = normalizePayload(values, currentUser, true);
  await updateDoc(doc(db, COLLECTION_NAME, id), payload);
  await syncWorkLogPayrollSummary(currentRecord.workLogId || "");
  if ((payload.workLogId || "") !== (currentRecord.workLogId || "")) {
    await syncWorkLogPayrollSummary(payload.workLogId || "");
  }
  return id;
};

// ACTIVE / GUARDED: payroll paid membuat expense idempotent via sourceModule + sourceId.
const buildPayrollExpenseDocId = (payrollId) =>
  PAYROLL_EXPENSE_SOURCE_MODULE + "__" + sanitizePayrollKeySegment(payrollId, "payroll");

const normalizePaidAtDate = (value) => {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;

  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const findExistingPayrollExpense = async (payrollId) => {
  if (!payrollId) return null;

  try {
    const snapshot = await getDocs(
      query(
        collection(db, EXPENSE_COLLECTION_NAME),
        where("sourceModule", "==", PAYROLL_EXPENSE_SOURCE_MODULE),
        where("sourceId", "==", payrollId),
      ),
    );

    if (!snapshot.empty) {
      const first = snapshot.docs[0];
      return { id: first.id, ...first.data() };
    }
  } catch (error) {
    // LEGACY fallback: plain collection menjaga idempotency bila query source gagal.
    console.error("Query expense payroll by source gagal, pakai fallback plain collection", error);
    const snapshot = await getDocs(collection(db, EXPENSE_COLLECTION_NAME));
    const found = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .find(
        (item) =>
          item.sourceModule === PAYROLL_EXPENSE_SOURCE_MODULE &&
          String(item.sourceId || "") === String(payrollId || ""),
      );

    return found || null;
  }

  return null;
};

const buildPayrollExpensePayload = ({ payroll = {}, payrollId = "", paidAtDate = new Date() }) => {
  const amount = Math.round(Number(payroll.finalAmount || 0));
  const sourceRef = payroll.payrollNumber || payrollId;
  const workerName = payroll.workerName || "Operator Produksi";

  return {
    amount,
    description: "Payroll Produksi - " + sourceRef + " - " + workerName,
    date: Timestamp.fromDate(paidAtDate),
    type: "Payroll Produksi",
    totalReferenceAmount: amount,
    savingAmount: 0,
    savingStatus: "normal",
    savingLabel: "Sesuai Payroll",
    sourceModule: PAYROLL_EXPENSE_SOURCE_MODULE,
    sourceId: payrollId,
    sourceRef,
    sourceType: "auto_generated",
    createdByAutomation: true,
    payrollId,
    payrollNumber: sourceRef,
    workerId: payroll.workerId || "",
    workerName,
    workLogId: payroll.workLogId || "",
    workNumber: payroll.workNumber || "",
    stepId: payroll.stepId || "",
    stepName: payroll.stepName || "",
    notes: "Expense otomatis dibuat saat Payroll Produksi ditandai paid. Jangan input manual lagi untuk payroll line ini agar tidak double expense.",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
};

// IMS NOTE [GUARDED] - payload status paid; guard expense tetap eksplisit di transaction.
const buildPayrollStatusUpdatePayload = ({ status, paymentStatus, extra = {} }) => ({
  status,
  paymentStatus,
  ...extra,
  updatedAt: serverTimestamp(),
  updatedBy: "system",
});

// IMS NOTE [GUARDED] - field audit expense payroll; sourceModule/sourceId/sourceRef tidak berubah.
const buildPayrollExpenseSyncFields = ({
  expenseId = "",
  sourceId = "",
  sourceRef = "",
  syncStatus = "",
  syncNotes = "",
  includeCreatedAt = false,
} = {}) => ({
  expenseId,
  expenseSourceModule: PAYROLL_EXPENSE_SOURCE_MODULE,
  expenseSourceId: sourceId,
  expenseSourceRef: sourceRef,
  expenseSyncStatus: syncStatus,
  expenseSyncNotes: syncNotes,
  ...(includeCreatedAt ? { expenseCreatedAt: serverTimestamp() } : {}),
});

export const updatePayrollStatus = async (
  id,
  status,
  paymentStatus,
  extra = {},
) => {
  const currentRecord = await getProductionPayrollById(id);
  const shouldCreatePayrollExpense = status === "paid" && paymentStatus === "paid";
  const paidAtDate = shouldCreatePayrollExpense
    ? normalizePaidAtDate(extra.paidAt || currentRecord.paidAt || new Date())
    : null;
  const legacyExistingExpense = shouldCreatePayrollExpense
    ? await findExistingPayrollExpense(id)
    : null;
  let expenseSyncResult = { status: "not_applicable", expenseId: "" };

  await runTransaction(db, async (transaction) => {
    const payrollRef = doc(db, COLLECTION_NAME, id);
    const payrollSnap = await transaction.get(payrollRef);

    if (!payrollSnap.exists()) {
      throw new Error("Data payroll produksi tidak ditemukan");
    }

    const latestPayroll = {
      id: payrollSnap.id,
      ...payrollSnap.data(),
    };
    const updatePayload = buildPayrollStatusUpdatePayload({ status, paymentStatus, extra });

    if (shouldCreatePayrollExpense) {
      const finalAmount = Math.round(Number(latestPayroll.finalAmount || 0));
      const expenseDocId = buildPayrollExpenseDocId(id);
      const expenseRef = doc(db, EXPENSE_COLLECTION_NAME, expenseDocId);
      const expenseSnap = await transaction.get(expenseRef);

      if (finalAmount <= 0) {
        updatePayload.expenseSyncStatus = "skipped_zero_amount";
        updatePayload.expenseSyncNotes = "Payroll paid tidak membuat Cash Out karena finalAmount <= 0.";
        expenseSyncResult = { status: "skipped_zero_amount", expenseId: "" };
      } else if (expenseSnap.exists() || legacyExistingExpense) {
        const expenseId = expenseSnap.exists() ? expenseRef.id : legacyExistingExpense.id;
        Object.assign(
          updatePayload,
          buildPayrollExpenseSyncFields({
            expenseId,
            sourceId: id,
            sourceRef: latestPayroll.payrollNumber || id,
            syncStatus: "already_exists",
            syncNotes: "Cash Out payroll sudah ada, tidak dibuat ulang.",
          }),
        );
        expenseSyncResult = { status: "already_exists", expenseId };
      } else {
        const expensePayload = buildPayrollExpensePayload({
          payroll: latestPayroll,
          payrollId: id,
          paidAtDate,
        });

        transaction.set(expenseRef, expensePayload);
        Object.assign(
          updatePayload,
          buildPayrollExpenseSyncFields({
            expenseId: expenseRef.id,
            sourceId: id,
            sourceRef: expensePayload.sourceRef,
            syncStatus: "created",
            syncNotes: "Cash Out otomatis dibuat dari payroll paid.",
            includeCreatedAt: true,
          }),
        );
        expenseSyncResult = { status: "created", expenseId: expenseRef.id };
      }
    }

    transaction.update(payrollRef, updatePayload);
  });

  await syncWorkLogPayrollSummary(currentRecord.workLogId || "");

  return {
    id,
    expenseSyncStatus: expenseSyncResult.status,
    expenseId: expenseSyncResult.expenseId,
  };
};
