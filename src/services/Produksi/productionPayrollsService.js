// =====================================================
// Production Payrolls Service
// Generate payroll dari work log completed
// =====================================================

import {
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
import { generateDailySequenceCode } from "../../utils/references/businessCodeGenerator";
import { calculatePayrollAmounts } from "../../constants/productionPayrollOptions";
import {
  getCompletedProductionWorkLogs,
  reconcileCompletedWorkLogOutputHpp,
} from "./productionWorkLogsService";

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

const toSafeNumber = (value, fallback = 0) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const getActorName = (currentUser = null) =>
  currentUser?.email ||
  currentUser?.displayName ||
  currentUser?.uid ||
  "system";

const buildPayrollRuleFromStep = (step = {}, source = "production_step") => ({
  payrollMode: step.payrollMode === "per_batch" ? "per_batch" : "per_qty",
  payrollRate: toSafeNumber(step.payrollRate || 0),
  payrollQtyBase: Math.max(1, toSafeNumber(step.payrollQtyBase || 1)),
  payrollOutputBasis: step.payrollOutputBasis || "good_qty",
  payrollClassification: step.payrollClassification || "direct_labor",
  includePayrollInHpp: step.includePayrollInHpp !== false,
  payrollRuleSource: source,
  legacyPayrollFallbackUsed: false,
});

const buildPayrollRuleFromWorkLogSnapshot = (workLog = {}) => {
  if (!safeTrim(workLog.stepPayrollRuleSource) && toSafeNumber(workLog.stepPayrollRate || 0) <= 0) {
    return null;
  }

  return buildPayrollRuleFromStep(
    {
      payrollMode: workLog.stepPayrollMode,
      payrollRate: workLog.stepPayrollRate,
      payrollQtyBase: workLog.stepPayrollQtyBase,
      payrollOutputBasis: workLog.stepPayrollOutputBasis,
      payrollClassification: workLog.stepPayrollClassification,
      includePayrollInHpp: workLog.stepPayrollIncludeInHpp,
    },
    safeTrim(workLog.stepPayrollRuleSource) || "work_log_step_snapshot",
  );
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

/*
=====================================================
SECTION: Payroll generation eligibility guard — GUARDED
Fungsi:
- Memastikan payroll otomatis hanya dibuat jika rule step, basis output, rate, dan qty sumber valid.

Dipakai oleh:
- generatePayrollLinesFromCompletedWorkLog sebelum menulis line payroll otomatis.

Alasan perubahan:
- Work Log completed tidak boleh menghasilkan payroll 0 diam-diam ketika step rate/basis belum diset.

Catatan cleanup:
- Jika nanti ada mode payroll baru, tambahkan validasi mode dan basis di helper ini.

Risiko:
- Melonggarkan guard ini bisa membuat labor cost/HPP terlihat 0 tanpa alasan jelas.
=====================================================
*/
const isPayrollLineFinalForHpp = (line = {}) => {
  if (line.status === "cancelled" || line.includePayrollInHpp === false) return false;

  const status = safeTrim(line.status).toLowerCase();
  const paymentStatus = safeTrim(line.paymentStatus).toLowerCase();

  if (["confirmed", "paid"].includes(status)) return true;
  if (paymentStatus === "paid") return true;

  // LEGACY-COMPAT: payroll lama bisa belum punya status/paymentStatus, tetapi sudah menyimpan finalAmount valid.
  return !status && !paymentStatus && toSafeNumber(line.finalAmount) > 0;
};

const assertPayrollGenerationEligibility = ({ workLog = {}, stepRule = {}, outputQtyUsed = 0, workedQty = 0 } = {}) => {
  const payrollMode = safeTrim(stepRule.payrollMode || "per_qty");
  const payrollOutputBasis = safeTrim(stepRule.payrollOutputBasis || "good_qty");
  const validModes = new Set(["per_qty", "per_batch"]);
  const validOutputBasis = new Set(["good_qty", "actual_output_qty"]);

  if (workLog.status !== "completed") {
    throw new Error("Payroll hanya bisa dibuat dari Work Log yang sudah completed");
  }

  if (!validModes.has(payrollMode)) {
    throw new Error(`Mode payroll tahapan tidak valid: ${payrollMode || "(kosong)"}. Cek master Tahapan Produksi.`);
  }

  if (!validOutputBasis.has(payrollOutputBasis)) {
    throw new Error(`Basis output payroll tidak valid: ${payrollOutputBasis || "(kosong)"}. Cek master Tahapan Produksi.`);
  }

  if (Number(stepRule.payrollRate || 0) <= 0) {
    throw new Error(`Rate payroll tahapan ${workLog.stepName || workLog.stepCode || "produksi"} masih 0. Isi rate di master Tahapan Produksi sebelum generate payroll.`);
  }

  if (payrollMode === "per_qty" && Number(outputQtyUsed || 0) <= 0) {
    throw new Error("Output payroll 0. Isi Good Qty/Actual Output Work Log sesuai basis payroll sebelum generate payroll.");
  }

  if (payrollMode === "per_batch" && Number(workedQty || outputQtyUsed || 0) <= 0) {
    throw new Error("Qty batch/output payroll 0. Isi Qty Batch atau output Work Log sebelum generate payroll.");
  }
};

const getStepPayrollRuleSnapshot = async (workLog = {}) => {
  if (workLog.stepId) {
    try {
      const stepSnap = await getDoc(doc(db, PRODUCTION_STEPS_COLLECTION_NAME, workLog.stepId));
      if (stepSnap.exists()) {
        return buildPayrollRuleFromStep(stepSnap.data() || {}, "production_step");
      }
    } catch (error) {
      console.error("Gagal membaca rule payroll tahapan produksi", error);
    }
  }

  const workLogSnapshotRule = buildPayrollRuleFromWorkLogSnapshot(workLog);
  if (workLogSnapshotRule) {
    return workLogSnapshotRule;
  }

  return {
    payrollMode: "per_qty",
    payrollRate: 0,
    payrollQtyBase: 1,
    payrollOutputBasis: "good_qty",
    payrollClassification: "direct_labor",
    includePayrollInHpp: true,
    payrollRuleSource: workLog.stepId ? "fallback_step_unavailable" : "default_no_step",
    legacyPayrollFallbackUsed: true,
  };
};

const normalizePayload = (values = {}, currentUser = null, isEdit = false) => {
  const totals = calculatePayrollAmounts(values);

  const normalizedPayrollNumber = String(values.payrollNumber || "")
    .trim()
    .toUpperCase();

  const payload = {
    payrollNumber: normalizedPayrollNumber,
    code: normalizedPayrollNumber,
    referenceNumber: normalizedPayrollNumber,
    sourceRef: normalizedPayrollNumber,
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

    payrollMode: values.payrollMode === "per_batch" ? "per_batch" : "per_qty",
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
  const [completedWorkLogs, employeesResult, stepsResult] = await Promise.all([
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
    (async () => {
      try {
        const snapshot = await getDocs(collection(db, PRODUCTION_STEPS_COLLECTION_NAME));
        return {
          items: snapshot.docs
            .map((documentItem) => ({ id: documentItem.id, ...documentItem.data() }))
            .filter((item) => item.isActive !== false),
        };
      } catch (error) {
        console.error("Gagal memuat referensi step payroll produksi", error);
        return { items: [] };
      }
    })(),
  ]);

  return {
    completedWorkLogs,
    employees: employeesResult.items,
    productionSteps: stepsResult.items,
  };
};

export const buildPayrollDraftFromWorkLog = (workLog, employee = null, productionStep = null) => {
  const stepRule = productionStep
    ? buildPayrollRuleFromStep(productionStep, "production_step")
    : buildPayrollRuleFromWorkLogSnapshot(workLog) || {
        payrollMode: "per_qty",
        payrollRate: 0,
        payrollQtyBase: 1,
        payrollOutputBasis: "good_qty",
        payrollClassification: "direct_labor",
        includePayrollInHpp: true,
        payrollRuleSource: "manual_default_no_step",
        legacyPayrollFallbackUsed: true,
      };
  const outputQtyUsed = resolvePayrollOutputQty(workLog, stepRule.payrollOutputBasis || "good_qty");
  const workedQty = Number(workLog?.plannedQty || outputQtyUsed || 0);
  const calculated = calculatePayrollAmounts({
    payrollMode: stepRule.payrollMode,
    payrollRate: stepRule.payrollRate,
    payrollQtyBase: stepRule.payrollQtyBase,
    outputQtyUsed,
    workedQty,
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

    payrollMode: stepRule.payrollMode,
    payrollRate: stepRule.payrollRate,
    payrollQtyBase: stepRule.payrollQtyBase,
    payrollOutputBasis: stepRule.payrollOutputBasis,
    payrollClassification: stepRule.payrollClassification,
    includePayrollInHpp: stepRule.includePayrollInHpp,

    totalWorkLogOutputQty: Number(workLog?.goodQty || workLog?.actualOutputQty || 0),
    workedQty,
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
    calculationNotes: `Draft payroll dari Work Log completed. Rule: ${stepRule.payrollRuleSource}.`,
    payrollRuleSource: stepRule.payrollRuleSource,
    legacyPayrollFallbackUsed: Boolean(stepRule.legacyPayrollFallbackUsed),
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
  const hppLaborLines = activeLines.filter(isPayrollLineFinalForHpp);
  const payrollIds = activeLines.map((line) => line.id);
  /*
  =====================================================
  SECTION: Payroll final amount for HPP — GUARDED
  Fungsi:
  - Menjumlahkan labor cost Work Log hanya dari line payroll final yang boleh masuk HPP.

  Dipakai oleh:
  - syncWorkLogPayrollSummary setelah create/update/status payroll.

  Alasan perubahan:
  - Draft/cancelled payroll serta line includePayrollInHpp=false tidak boleh menaikkan HPP final produksi.

  Catatan cleanup:
  - Line count tetap memakai activeLines untuk audit payroll; nominal HPP memakai hppLaborLines final.

  Risiko:
  - Jika includePayrollInHpp diabaikan, laporan HPP dan Profit/Loss bisa double count labor non-produksi inti.
  =====================================================
  */
  const payrollFinalAmount = hppLaborLines.reduce(
    (sum, line) => sum + toSafeNumber(line.finalAmount),
    0,
  );

  const materialCostActual = toSafeNumber(workLogData.materialCostActual);
  const overheadCostActual = toSafeNumber(workLogData.overheadCostActual);
  const goodQty = toSafeNumber(workLogData.goodQty);
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

  /* =====================================================
  SECTION: Payroll final -> output HPP reconcile — GUARDED
  Fungsi:
  - setelah labor final disinkronkan ke Work Log, master output produk/semi ikut disesuaikan tanpa menambah stok ulang.

  Dipakai oleh:
  - create/update/status payroll, termasuk payroll paid yang masuk HPP final.

  Alasan perubahan:
  - Complete Work Log terjadi sebelum payroll final; tanpa reconcile, BOM bertingkat bisa membaca averageCostPerUnit Semi Finished yang masih material-only.

  Catatan cleanup:
  - Reconcile lama tidak melakukan backfill massal; audit data lama tetap lewat Data Quality Audit.

  Risiko:
  - Jangan pindahkan logic ini ke UI; perubahan HPP harus atomic di service agar tidak bergantung halaman mana yang dibuka user.
  ===================================================== */
  await reconcileCompletedWorkLogOutputHpp(workLogId, {
    actor: "system",
    source: "payroll_summary_sync",
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
  assertPayrollGenerationEligibility({
    workLog,
    stepRule,
    outputQtyUsed,
    workedQty,
  });
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

    const payrollNumber = await generateProductionPayrollNumber({ payrollDate: new Date() });
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

const resolvePayrollDateForCode = (values = {}) => {
  const source = values.payrollDate || new Date();
  if (source?.toDate) return source.toDate();
  if (source instanceof Date) return source;
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

/* =====================================================
SECTION: Payroll number generator — GUARDED
Fungsi:
- Membuat nomor PAY-DDMMYYYY-001 untuk payroll produksi.

Dipakai oleh:
- createProductionPayroll dan auto payroll dari Work Log.

Alasan perubahan:
- Standar final IMS mengganti PAY-YYYYMMDD-0001 menjadi PAY-DDMMYYYY-001.

Catatan cleanup:
- Data lama PAY YYYYMMDD tetap compatibility, tidak di-rename.

Risiko:
- Jangan mengubah formula payroll, lifecycle paid, atau expense amount dari section ini.
===================================================== */
export const generateProductionPayrollNumber = async (values = {}) => {
  return generateDailySequenceCode({
    db,
    collectionName: COLLECTION_NAME,
    fieldNames: ["payrollNumber", "code", "referenceNumber", "sourceRef"],
    prefix: "PAY",
    date: resolvePayrollDateForCode(values),
  });
};

export const isPayrollNumberExists = async (
  payrollNumber,
  excludeId = null,
) => {
  const normalized = String(payrollNumber || "")
    .trim()
    .toUpperCase();
  if (!normalized) return false;

  const directSnapshot = await getDoc(doc(db, COLLECTION_NAME, normalized));
  if (directSnapshot.exists() && directSnapshot.id !== excludeId) return true;

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

  const normalizedPayrollNumber = String(values.payrollNumber || "").trim().toUpperCase() || (await generateProductionPayrollNumber(values));
  const nextValues = { ...values, payrollNumber: normalizedPayrollNumber };

  const exists = await isPayrollNumberExists(normalizedPayrollNumber);
  if (exists) {
    throw {
      type: "validation",
      errors: {
        payrollNumber: "Nomor payroll sudah digunakan",
      },
    };
  }

  /*
  =====================================================
  SECTION: Payroll sync anti double — GUARDED
  Fungsi:
  - Mencegah payroll aktif dobel untuk kombinasi Work Log + Step + Operator ketika line dibuat manual.

  Dipakai oleh:
  - createProductionPayroll sebelum addDoc payroll manual.

  Alasan perubahan:
  - Auto payroll sudah idempotent, tetapi line manual juga perlu guard agar HPP tidak double count.

  Catatan cleanup:
  - Bisa digabung dengan guard auto payroll jika service payroll dibuat helper transaksi tunggal.

  Risiko:
  - Jika guard ini dilepas, satu operator bisa punya beberapa payroll aktif pada Work Log yang sama.
  =====================================================
  */
  const duplicateLine = await findExistingPayrollLineForWorker(nextValues.workLogId, nextValues.stepId || "", nextValues);
  if (duplicateLine) {
    throw {
      type: "validation",
      errors: {
        workerId: "Payroll aktif untuk operator ini pada Work Log dan step yang sama sudah ada",
      },
    };
  }

  const payload = normalizePayload(nextValues, currentUser, false);
  /* =====================================================
  SECTION: Manual Payroll document ID = business code — GUARDED
  Fungsi:
  - Menyimpan payroll manual baru dengan document ID sama seperti nomor PAY.

  Dipakai oleh:
  - createProductionPayroll.

  Alasan perubahan:
  - Payroll adalah guarded reference dari JOB ke pembayaran/HPP, sehingga data baru perlu ID audit-friendly.

  Catatan cleanup:
  - Auto payroll yang sudah idempotent memakai doc ID deterministic sendiri tetap dipertahankan.

  Risiko:
  - Jangan mengubah formula payroll/status paid/expense dari section ini.
  ===================================================== */
  const resultRef = doc(db, COLLECTION_NAME, normalizedPayrollNumber);
  await setDoc(resultRef, payload);
  await syncWorkLogPayrollSummary(payload.workLogId || nextValues.workLogId || "");
  return resultRef.id;
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

  const normalizedPayrollNumber = String(values.payrollNumber || "").trim().toUpperCase() || (await generateProductionPayrollNumber(values));
  const nextValues = { ...values, payrollNumber: normalizedPayrollNumber };

  const exists = await isPayrollNumberExists(normalizedPayrollNumber, id);
  if (exists) {
    throw {
      type: "validation",
      errors: {
        payrollNumber: "Nomor payroll sudah digunakan",
      },
    };
  }

  const duplicateLine = await findExistingPayrollLineForWorker(nextValues.workLogId, nextValues.stepId || "", nextValues);
  if (duplicateLine && duplicateLine.id !== id) {
    throw {
      type: "validation",
      errors: {
        workerId: "Payroll aktif untuk operator ini pada Work Log dan step yang sama sudah ada",
      },
    };
  }

  const payload = normalizePayload(nextValues, currentUser, true);
  await updateDoc(doc(db, COLLECTION_NAME, id), payload);
  await syncWorkLogPayrollSummary(currentRecord.workLogId || "");
  if ((payload.workLogId || "") !== (currentRecord.workLogId || "")) {
    await syncWorkLogPayrollSummary(payload.workLogId || "");
  }
  return id;
};

// =====================================================
// ACTIVE / GUARDED - expense otomatis dari payroll paid
// Fungsi blok:
// - menyiapkan Cash Out/Expense ketika payroll produksi ditandai paid;
// - memakai sourceModule + sourceId + doc id deterministik agar tidak double expense.
// Alasan blok ini dipakai:
// - integrasi IMS final mengharuskan payroll paid otomatis masuk expenses,
//   sehingga Profit Loss cukup membaca collection expenses tanpa menghitung payroll dua kali.
// Status:
// - aktif dipakai oleh updatePayrollStatus; guarded karena menyentuh kas & laporan.
// =====================================================
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
    // Legacy/fallback guard:
    // - aktif hanya jika query sourceModule+sourceId butuh index/terganggu;
    // - plain collection dipakai agar idempotent tetap berjalan sebelum auto expense dibuat.
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
  const amount = Math.round(toSafeNumber(payroll.finalAmount));
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
    const updatePayload = {
      status,
      paymentStatus,
      ...extra,
      updatedAt: serverTimestamp(),
      updatedBy: "system",
    };

    if (shouldCreatePayrollExpense) {
      const finalAmount = Math.round(toSafeNumber(latestPayroll.finalAmount));
      const expenseDocId = buildPayrollExpenseDocId(id);
      const expenseRef = doc(db, EXPENSE_COLLECTION_NAME, expenseDocId);
      const expenseSnap = await transaction.get(expenseRef);

      if (finalAmount <= 0) {
        updatePayload.expenseSyncStatus = "skipped_zero_amount";
        updatePayload.expenseSyncNotes = "Payroll paid tidak membuat Cash Out karena finalAmount <= 0.";
        expenseSyncResult = { status: "skipped_zero_amount", expenseId: "" };
      } else if (expenseSnap.exists() || legacyExistingExpense) {
        const expenseId = expenseSnap.exists() ? expenseRef.id : legacyExistingExpense.id;
        updatePayload.expenseId = expenseId;
        updatePayload.expenseSourceModule = PAYROLL_EXPENSE_SOURCE_MODULE;
        updatePayload.expenseSourceId = id;
        updatePayload.expenseSourceRef = latestPayroll.payrollNumber || id;
        updatePayload.expenseSyncStatus = "already_exists";
        updatePayload.expenseSyncNotes = "Cash Out payroll sudah ada, tidak dibuat ulang.";
        expenseSyncResult = { status: "already_exists", expenseId };
      } else {
        const expensePayload = buildPayrollExpensePayload({
          payroll: latestPayroll,
          payrollId: id,
          paidAtDate,
        });

        transaction.set(expenseRef, expensePayload);
        updatePayload.expenseId = expenseRef.id;
        updatePayload.expenseSourceModule = PAYROLL_EXPENSE_SOURCE_MODULE;
        updatePayload.expenseSourceId = id;
        updatePayload.expenseSourceRef = expensePayload.sourceRef;
        updatePayload.expenseSyncStatus = "created";
        updatePayload.expenseSyncNotes = "Cash Out otomatis dibuat dari payroll paid.";
        updatePayload.expenseCreatedAt = serverTimestamp();
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
