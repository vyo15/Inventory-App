// =====================================================
// Production Planning Service
// Fungsi:
// - menjadi layer target sebelum Production Order;
// - menyimpan rencana produksi mingguan/bulanan/custom;
// - menghitung progress dari Work Log completed melalui PO terkait.
// Hubungan flow aplikasi:
// - Planning -> Production Order -> Work Log -> Payroll/HPP -> Dashboard.
// Status:
// - aktif untuk fitur Production Planning;
// - guarded: tidak ada mutasi stok, payroll, expense, atau HPP dari service ini.
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
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  createProductionOrder,
  getActiveProductionBomOptions,
  getProductionOrderById,
} from "./productionOrdersService";
import { inferHasVariants } from "../../utils/variants/variantStockHelpers";

const COLLECTION_NAME = "production_plans";

const safeTrim = (value) => String(value || "").trim();
const toNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

// =====================================================
// ACTIVE - helper tanggal lokal berbasis YYYY-MM-DD.
// Fungsi:
// - menghindari status overdue meleset karena parsing timezone ISO;
// - dipakai untuk filter minggu/bulan dan status planning.
// Status:
// - aktif; bukan logic stok dan aman untuk UI monitoring.
// =====================================================
const pad = (value) => String(value || 0).padStart(2, "0");

const formatDateYmd = (date = new Date()) => {
  const safeDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(safeDate.getTime())) return "";
  return `${safeDate.getFullYear()}-${pad(safeDate.getMonth() + 1)}-${pad(safeDate.getDate())}`;
};

const parseDateOnly = (value) => {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const match = safeTrim(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const toComparableDate = (value) => {
  const date = parseDateOnly(value);
  return date ? date.getTime() : 0;
};

const getCurrentWeekRange = () => {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffToMonday);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return {
    start: formatDateYmd(start),
    end: formatDateYmd(end),
  };
};

const getCurrentMonthRange = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    start: formatDateYmd(start),
    end: formatDateYmd(end),
  };
};

const isRangeOverlap = ({ startA, endA, startB, endB }) => {
  const aStart = toComparableDate(startA);
  const aEnd = toComparableDate(endA || startA);
  const bStart = toComparableDate(startB);
  const bEnd = toComparableDate(endB || startB);

  if (!aStart || !bStart) return false;
  return aStart <= bEnd && bStart <= aEnd;
};

// =====================================================
// ACTIVE - normalisasi item master planning.
// Fungsi:
// - menyamakan field produk jadi dan semi finished untuk dropdown;
// - menyertakan variants agar planning bisa mengunci target varian.
// Status:
// - aktif; hanya read-only dari master data.
// =====================================================
const normalizeReferenceItem = (docItem) => {
  const raw = {
    id: docItem.id,
    ...docItem.data(),
  };

  return {
    ...raw,
    code:
      safeTrim(raw.code) ||
      safeTrim(raw.itemCode) ||
      safeTrim(raw.sku) ||
      safeTrim(raw.productCode),
    name:
      safeTrim(raw.name) ||
      safeTrim(raw.productName) ||
      safeTrim(raw.materialName) ||
      safeTrim(raw.title),
    unit: safeTrim(raw.unit) || safeTrim(raw.stockUnit) || safeTrim(raw.baseUnit) || "pcs",
    hasVariants: inferHasVariants(raw),
    isActive: raw?.isActive,
  };
};

const fetchCollectionSafe = async (collectionName) => {
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs
      .map((docItem) => normalizeReferenceItem(docItem))
      .filter((item) => item?.isActive !== false);
  } catch (error) {
    console.error(`Gagal memuat reference ${collectionName}`, error);
    return [];
  }
};

const getCollectionNameByTargetType = (targetType = "") => {
  if (targetType === "product") return "products";
  if (targetType === "semi_finished" || targetType === "semi_finished_material") {
    return "semi_finished_materials";
  }
  return "";
};

const normalizeTargetType = (value = "") => {
  const normalized = safeTrim(value).toLowerCase();
  if (["semi_finished", "semi finished", "semi_finished_material"].includes(normalized)) {
    return "semi_finished_material";
  }
  return normalized || "product";
};

const getTargetItemSnapshot = async ({ targetType = "product", targetItemId = "" }) => {
  const collectionName = getCollectionNameByTargetType(normalizeTargetType(targetType));
  if (!collectionName || !targetItemId) return null;

  const ref = doc(db, collectionName, targetItemId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  return normalizeReferenceItem(snap);
};

// =====================================================
// ACTIVE - generator kode planning.
// Fungsi:
// - membuat kode manusiawi untuk audit dan referensi PO;
// - tidak menjadi source stok atau accounting.
// Status:
// - aktif untuk create planning baru.
// =====================================================
export const generateProductionPlanCode = async () => {
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));
  const maxNumber = snapshot.docs.reduce((max, docItem) => {
    const code = safeTrim(docItem.data()?.planCode || docItem.data()?.code);
    const match = code.match(/(\d+)(?!.*\d)/);
    const numberValue = match ? Number(match[1]) : 0;
    return Math.max(max, numberValue || 0);
  }, 0);

  return `PP-${formatDateYmd(new Date()).replaceAll("-", "")}-${String(maxNumber + 1).padStart(4, "0")}`;
};

// =====================================================
// ACTIVE - reference data halaman planning.
// Fungsi:
// - membaca produk jadi, semi finished, dan BOM aktif;
// - BOM dipakai saat user membuat PO dari planning.
// Status:
// - read-only; tidak mengubah master data.
// =====================================================
export const getProductionPlanningReferenceData = async () => {
  const [products, semiFinishedMaterials, productBoms, semiFinishedBoms] = await Promise.all([
    fetchCollectionSafe("products"),
    fetchCollectionSafe("semi_finished_materials"),
    getActiveProductionBomOptions("product"),
    getActiveProductionBomOptions("semi_finished_material"),
  ]);

  return {
    products,
    semiFinishedMaterials,
    boms: [...productBoms, ...semiFinishedBoms],
  };
};

// =====================================================
// ACTIVE - hitung status planning.
// Fungsi:
// - status computed dari progress aktual dan due date;
// - status cancelled manual tetap dikunci.
// Status:
// - aktif; tidak dipakai untuk stok/payroll/HPP.
// =====================================================
export const calculateProductionPlanStatus = (plan = {}, progress = {}) => {
  const manualStatus = safeTrim(plan.status || "active").toLowerCase();
  if (manualStatus === "cancelled") return "cancelled";

  const targetQty = toNumber(plan.targetQty || progress.targetQty || 0);
  const actualCompletedQty = toNumber(progress.actualCompletedQty || 0);
  if (targetQty > 0 && actualCompletedQty >= targetQty) return "completed";

  const today = toComparableDate(formatDateYmd(new Date()));
  const dueDate = toComparableDate(plan.dueDate);
  if (dueDate && today > dueDate) return "overdue";

  const startDate = toComparableDate(plan.periodStartDate);
  if (startDate && today < startDate) return "draft";

  return "active";
};

// =====================================================
// ACTIVE - normalisasi output completed Work Log.
// Fungsi:
// - membaca goodQty dari outputs jika tersedia;
// - fallback ke goodQty top-level untuk data lama.
// Hubungan flow:
// - hanya menghitung Work Log completed; draft/in_progress/cancelled tidak dihitung.
// Status:
// - aktif untuk progress planning; guarded read-only terhadap Work Log.
// =====================================================
const getCompletedQtyFromWorkLog = ({ workLog = {}, plan = {} }) => {
  if (workLog?.status !== "completed") return 0;

  const planTargetType = normalizeTargetType(plan.targetType);
  const planTargetId = safeTrim(plan.targetItemId || plan.targetId);
  const planVariantKey = safeTrim(plan.targetVariantKey).toLowerCase();

  const outputLines = Array.isArray(workLog.outputs) ? workLog.outputs : [];
  const outputQty = outputLines.reduce((sum, line) => {
    const outputType = normalizeTargetType(line.outputType || workLog.targetType);
    const outputId = safeTrim(line.outputIdRef || line.outputItemId || workLog.targetId);
    const outputVariantKey = safeTrim(line.outputVariantKey || workLog.targetVariantKey).toLowerCase();

    if (outputType !== planTargetType) return sum;
    if (planTargetId && outputId !== planTargetId) return sum;
    if (planVariantKey && outputVariantKey !== planVariantKey) return sum;

    return sum + toNumber(line.goodQty || 0);
  }, 0);

  if (outputQty > 0) return outputQty;

  const fallbackType = normalizeTargetType(workLog.targetType);
  const fallbackId = safeTrim(workLog.targetId);
  const fallbackVariantKey = safeTrim(workLog.targetVariantKey).toLowerCase();

  if (fallbackType !== planTargetType) return 0;
  if (planTargetId && fallbackId !== planTargetId) return 0;
  if (planVariantKey && fallbackVariantKey !== planVariantKey) return 0;

  return toNumber(workLog.goodQty || 0);
};

const calculatePlanProgress = ({ plan = {}, orders = [], workLogs = [] }) => {
  const linkedIds = new Set(Array.isArray(plan.linkedProductionOrderIds) ? plan.linkedProductionOrderIds : []);

  orders.forEach((order) => {
    if (safeTrim(order.planningId) === plan.id) linkedIds.add(order.id);
  });

  const countedWorkLogIds = new Set();
  const actualCompletedQty = workLogs.reduce((sum, workLog) => {
    if (!linkedIds.has(workLog.productionOrderId)) return sum;
    if (countedWorkLogIds.has(workLog.id)) return sum;

    countedWorkLogIds.add(workLog.id);
    return sum + getCompletedQtyFromWorkLog({ workLog, plan });
  }, 0);

  const targetQty = toNumber(plan.targetQty || 0);
  const remainingQty = Math.max(targetQty - actualCompletedQty, 0);
  const progressPercent = targetQty > 0 ? Math.min((actualCompletedQty / targetQty) * 100, 999) : 0;

  return {
    linkedProductionOrderIds: Array.from(linkedIds),
    actualCompletedQty,
    remainingQty,
    progressPercent,
    targetQty,
  };
};

const normalizePlan = ({ plan = {}, orders = [], workLogs = [] }) => {
  const progress = calculatePlanProgress({ plan, orders, workLogs });
  const status = calculateProductionPlanStatus(plan, progress);

  const linkedOrders = orders.filter((order) => progress.linkedProductionOrderIds.includes(order.id));

  return {
    ...plan,
    targetType: normalizeTargetType(plan.targetType),
    targetItemId: safeTrim(plan.targetItemId || plan.targetId),
    actualCompletedQty: progress.actualCompletedQty,
    remainingQty: progress.remainingQty,
    progressPercent: progress.progressPercent,
    status,
    computedStatus: status,
    linkedProductionOrderIds: progress.linkedProductionOrderIds,
    linkedProductionOrderCodes: linkedOrders.map((order) => order.code).filter(Boolean),
    linkedProductionOrders: linkedOrders,
  };
};

const getAllProductionOrdersSafe = async () => {
  const snapshot = await getDocs(collection(db, "production_orders"));
  return snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
};

const getCompletedWorkLogsSafe = async () => {
  const snapshot = await getDocs(collection(db, "production_work_logs"));
  return snapshot.docs
    .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
    .filter((item) => item.status === "completed");
};

export const getAllProductionPlans = async () => {
  let planDocs = [];

  try {
    const planQuery = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(planQuery);
    planDocs = snapshot.docs;
  } catch (error) {
    console.error("Query planning orderBy gagal, pakai fallback", error);
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    planDocs = snapshot.docs;
  }

  const [orders, workLogs] = await Promise.all([
    getAllProductionOrdersSafe(),
    getCompletedWorkLogsSafe(),
  ]);

  return planDocs
    .map((docItem) => normalizePlan({
      plan: { id: docItem.id, ...docItem.data() },
      orders,
      workLogs,
    }))
    .sort((a, b) => {
      const byDue = toComparableDate(a.dueDate) - toComparableDate(b.dueDate);
      if (byDue !== 0) return byDue;
      return safeTrim(b.planCode).localeCompare(safeTrim(a.planCode));
    });
};

export const getProductionPlanById = async (id) => {
  if (!id) return null;
  const snap = await getDoc(doc(db, COLLECTION_NAME, id));
  if (!snap.exists()) return null;

  const [orders, workLogs] = await Promise.all([
    getAllProductionOrdersSafe(),
    getCompletedWorkLogsSafe(),
  ]);

  return normalizePlan({
    plan: { id: snap.id, ...snap.data() },
    orders,
    workLogs,
  });
};

const validatePlanPayload = (values = {}) => {
  const errors = {};

  if (!values.periodType) errors.periodType = "Tipe periode wajib dipilih";
  if (!values.periodStartDate) errors.periodStartDate = "Tanggal mulai periode wajib diisi";
  if (!values.periodEndDate) errors.periodEndDate = "Tanggal akhir periode wajib diisi";
  if (!values.dueDate) errors.dueDate = "Deadline wajib diisi";
  if (!values.targetType) errors.targetType = "Target type wajib dipilih";
  if (!values.targetItemId) errors.targetItemId = "Target item wajib dipilih";
  if (toNumber(values.targetQty) <= 0) errors.targetQty = "Target qty harus lebih dari 0";
  if (values.targetHasVariants === true && !safeTrim(values.targetVariantKey)) {
    errors.targetVariantKey = "Varian target wajib dipilih";
  }

  return errors;
};

const buildPlanPayload = async (values = {}, currentUser = null, isEdit = false) => {
  const targetType = normalizeTargetType(values.targetType);
  const targetItem = await getTargetItemSnapshot({ targetType, targetItemId: values.targetItemId });
  const actor = currentUser?.email || currentUser?.displayName || currentUser?.uid || "system";
  const targetHasVariants = values.targetHasVariants === true || targetItem?.hasVariants === true;

  const payload = {
    planCode: safeTrim(values.planCode) || (isEdit ? "" : await generateProductionPlanCode()),
    title: safeTrim(values.title) || safeTrim(targetItem?.name || values.targetItemName || "Rencana Produksi"),
    periodType: values.periodType || "weekly",
    periodStartDate: values.periodStartDate || "",
    periodEndDate: values.periodEndDate || "",
    dueDate: values.dueDate || "",
    targetType,
    targetItemId: values.targetItemId || "",
    targetItemName: safeTrim(targetItem?.name || values.targetItemName),
    targetItemCode: safeTrim(targetItem?.code || values.targetItemCode),
    targetUnit: safeTrim(targetItem?.unit || values.targetUnit) || "pcs",
    targetHasVariants,
    targetVariantKey: safeTrim(values.targetVariantKey),
    targetVariantLabel: safeTrim(values.targetVariantLabel),
    targetQty: toNumber(values.targetQty),
    status: values.status || "active",
    priority: values.priority || "normal",
    linkedProductionOrderIds: Array.isArray(values.linkedProductionOrderIds)
      ? values.linkedProductionOrderIds
      : [],
    linkedProductionOrderCodes: Array.isArray(values.linkedProductionOrderCodes)
      ? values.linkedProductionOrderCodes
      : [],
    notes: safeTrim(values.notes),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  };

  if (!isEdit) {
    payload.createdAt = serverTimestamp();
    payload.createdBy = actor;
  }

  return payload;
};

export const createProductionPlan = async (values = {}, currentUser = null) => {
  const errors = validatePlanPayload(values);
  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  const payload = await buildPlanPayload(values, currentUser, false);
  const result = await addDoc(collection(db, COLLECTION_NAME), payload);
  return result.id;
};

export const updateProductionPlan = async (id, values = {}, currentUser = null) => {
  const currentPlan = await getProductionPlanById(id);
  if (!currentPlan) throw new Error("Planning tidak ditemukan");
  if (currentPlan.status === "cancelled") {
    throw new Error("Planning yang sudah dibatalkan tidak bisa diedit");
  }

  const mergedValues = {
    ...currentPlan,
    ...values,
    planCode: currentPlan.planCode,
    linkedProductionOrderIds: currentPlan.linkedProductionOrderIds || [],
    linkedProductionOrderCodes: currentPlan.linkedProductionOrderCodes || [],
    status: currentPlan.status === "completed" ? "active" : values.status || currentPlan.status || "active",
  };

  const errors = validatePlanPayload(mergedValues);
  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  const payload = await buildPlanPayload(mergedValues, currentUser, true);
  delete payload.createdAt;
  delete payload.createdBy;

  await updateDoc(doc(db, COLLECTION_NAME, id), payload);
  return id;
};

export const cancelProductionPlan = async (id, currentUser = null) => {
  const actor = currentUser?.email || currentUser?.displayName || currentUser?.uid || "system";
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    status: "cancelled",
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: actor,
  });
  return id;
};

// =====================================================
// ACTIVE / GUARDED - create PO dari planning.
// Fungsi:
// - user memilih aksi eksplisit untuk membuat PO dari target planning;
// - PO tetap dibuat oleh createProductionOrder existing agar BOM/requirement tetap final.
// Status:
// - aktif; tidak otomatis membuat stok/payroll/expense.
// =====================================================
export const createProductionOrderFromPlan = async ({
  planId,
  bomId,
  orderQty,
  plannedStartDate = "",
  plannedEndDate = "",
  notes = "",
  priority = "",
} = {}, currentUser = null) => {
  const plan = await getProductionPlanById(planId);
  if (!plan) throw new Error("Planning tidak ditemukan");
  if (plan.status === "cancelled") throw new Error("Planning cancelled tidak bisa dibuatkan PO");
  if (!bomId) throw new Error("BOM wajib dipilih untuk membuat PO dari planning");
  if (toNumber(orderQty) <= 0) throw new Error("Qty batch PO harus lebih dari 0");

  const orderId = await createProductionOrder(
    {
      targetType: plan.targetType,
      bomId,
      targetVariantKey: plan.targetVariantKey || "",
      targetVariantLabel: plan.targetVariantLabel || "",
      orderQty: toNumber(orderQty),
      priority: priority || plan.priority || "normal",
      plannedStartDate: plannedStartDate || plan.periodStartDate || "",
      plannedEndDate: plannedEndDate || plan.dueDate || "",
      notes: safeTrim(notes) || `Dibuat dari planning ${plan.planCode || ""}`,
      planningId: plan.id,
      planningCode: plan.planCode || "",
      planningTitle: plan.title || "",
    },
    currentUser,
  );

  const order = await getProductionOrderById(orderId);
  const nextIds = Array.from(new Set([...(plan.linkedProductionOrderIds || []), orderId]));
  const nextCodes = Array.from(new Set([...(plan.linkedProductionOrderCodes || []), order?.code].filter(Boolean)));

  await updateDoc(doc(db, COLLECTION_NAME, plan.id), {
    linkedProductionOrderIds: nextIds,
    linkedProductionOrderCodes: nextCodes,
    status: plan.status === "draft" ? "active" : plan.status || "active",
    updatedAt: serverTimestamp(),
    updatedBy:
      currentUser?.email || currentUser?.displayName || currentUser?.uid || "system",
  });

  return order || { id: orderId };
};

// =====================================================
// ACTIVE - helper priority plans Dashboard.
// Fungsi:
// - memilih planning aktif/overdue yang masih punya sisa target;
// - sorting: overdue -> deadline terdekat -> progress rendah -> sisa target besar.
// Hubungan flow:
// - hanya membaca progress yang sudah dihitung dari Work Log completed;
// - tidak menyimpan field baru dan tidak mengubah schema Firestore.
// Status:
// - aktif untuk Dashboard operational control center.
// =====================================================
const buildDashboardPriorityPlans = (items = [], maxItems = 3) =>
  items
    .filter((plan) => !["completed", "cancelled"].includes(plan.status))
    .filter((plan) => toNumber(plan.remainingQty) > 0)
    .sort((left, right) => {
      const leftOverdueRank = left.status === "overdue" ? 0 : 1;
      const rightOverdueRank = right.status === "overdue" ? 0 : 1;
      if (leftOverdueRank !== rightOverdueRank) return leftOverdueRank - rightOverdueRank;

      const byDueDate = toComparableDate(left.dueDate) - toComparableDate(right.dueDate);
      if (byDueDate !== 0) return byDueDate;

      const byProgress = toNumber(left.progressPercent) - toNumber(right.progressPercent);
      if (byProgress !== 0) return byProgress;

      return toNumber(right.remainingQty) - toNumber(left.remainingQty);
    })
    .slice(0, maxItems)
    .map((plan) => ({
      id: plan.id,
      planCode: plan.planCode || "",
      title: plan.title || "",
      targetItemName: plan.targetItemName || "",
      targetVariantLabel: plan.targetVariantLabel || "",
      targetQty: toNumber(plan.targetQty),
      actualCompletedQty: toNumber(plan.actualCompletedQty),
      remainingQty: toNumber(plan.remainingQty),
      progressPercent: toNumber(plan.progressPercent),
      dueDate: plan.dueDate || "",
      status: plan.status || "active",
      priority: plan.priority || "normal",
      targetUnit: plan.targetUnit || "pcs",
    }));

// =====================================================
// ACTIVE - summary compact dashboard.
// Fungsi:
// - menghitung target/progress minggu dan bulan berjalan;
// - menghitung overdue, planning kurang target, dan planning prioritas.
// Hubungan flow:
// - actual progress tetap berasal dari Work Log completed lewat normalizePlan;
// - Dashboard hanya membaca hasil summary dan tidak mengubah planning/PO/Work Log.
// Status:
// - read-only untuk Dashboard; tidak mengubah planning atau produksi.
// =====================================================
export const getProductionPlanningDashboardSummary = async () => {
  const plans = await getAllProductionPlans();
  const weekRange = getCurrentWeekRange();
  const monthRange = getCurrentMonthRange();

  const activePlans = plans.filter((plan) => plan.status !== "cancelled");
  const weeklyPlans = activePlans.filter((plan) =>
    isRangeOverlap({
      startA: plan.periodStartDate,
      endA: plan.periodEndDate,
      startB: weekRange.start,
      endB: weekRange.end,
    }),
  );
  const monthlyPlans = activePlans.filter((plan) =>
    isRangeOverlap({
      startA: plan.periodStartDate,
      endA: plan.periodEndDate,
      startB: monthRange.start,
      endB: monthRange.end,
    }),
  );

  const summarize = (items = []) => {
    const targetQty = items.reduce((sum, item) => sum + toNumber(item.targetQty), 0);
    const actualCompletedQty = items.reduce((sum, item) => sum + toNumber(item.actualCompletedQty), 0);
    return {
      count: items.length,
      targetQty,
      actualCompletedQty,
      remainingQty: Math.max(targetQty - actualCompletedQty, 0),
      progressPercent: targetQty > 0 ? Math.min((actualCompletedQty / targetQty) * 100, 999) : 0,
      priorityPlans: buildDashboardPriorityPlans(items, 3),
    };
  };

  return {
    weekRange,
    monthRange,
    weekly: summarize(weeklyPlans),
    monthly: summarize(monthlyPlans),
    overdueCount: activePlans.filter((plan) => plan.status === "overdue").length,
    behindTargetCount: activePlans.filter(
      (plan) => !["completed", "cancelled"].includes(plan.status) && toNumber(plan.remainingQty) > 0,
    ).length,
    overduePlans: activePlans.filter((plan) => plan.status === "overdue").slice(0, 5),
    priorityPlans: buildDashboardPriorityPlans(activePlans, 3),
  };
};
