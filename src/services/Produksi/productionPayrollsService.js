// =====================================================
// Production Payrolls Service
// Generate payroll dari work log completed
// =====================================================

import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { calculatePayrollAmounts } from "../../constants/productionPayrollOptions";

const COLLECTION_NAME = "production_payrolls";

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

    workerId: values.workerId || "",
    workerCode: String(values.workerCode || "").trim(),
    workerName: String(values.workerName || "").trim(),

    payrollMode: values.payrollMode || "per_qty",
    payrollRate: Number(values.payrollRate || 0),
    payrollQtyBase: Number(values.payrollQtyBase || 1),
    payrollOutputBasis: values.payrollOutputBasis || "good_qty",

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

    notes: String(values.notes || "").trim(),
    calculationNotes: String(values.calculationNotes || "").trim(),

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
  const [completedWorkLogsSnap, employeesSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, "production_work_logs"),
        where("status", "==", "completed"),
        orderBy("workDate", "desc"),
      ),
    ),
    getDocs(
      query(
        collection(db, "production_employees"),
        where("isActive", "==", true),
        orderBy("name", "asc"),
      ),
    ),
  ]);

  return {
    completedWorkLogs: completedWorkLogsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })),
    employees: employeesSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })),
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

export const getAllProductionPayrolls = async () => {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("payrollDate", "desc"),
    orderBy("payrollNumber", "desc"),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
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
  return result.id;
};

export const updateProductionPayroll = async (
  id,
  values,
  currentUser = null,
) => {
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
  return id;
};

export const updatePayrollStatus = async (
  id,
  status,
  paymentStatus,
  extra = {},
) => {
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    status,
    paymentStatus,
    ...extra,
    updatedAt: serverTimestamp(),
    updatedBy: "system",
  });

  return id;
};
