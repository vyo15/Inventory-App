import { listFinanceExpenses, listFinanceIncomes } from "../Finance/financeService";
import { getInventoryLogs } from "../Inventory/inventoryService";
import { getStockIssueReadModels, getStockReadModelRows } from "../Inventory/stockReadModelService";
import { listenProducts } from "../MasterData/productsService";
import { listenRawMaterials } from "../MasterData/rawMaterialsService";
import { getAllProductionOrders } from "../Produksi/productionOrdersService";
import { getAllProductionPayrolls } from "../Produksi/productionPayrollsService";
import { getAllProductionPlans } from "../Produksi/productionPlanningService";
import { getAllProductionWorkLogs } from "../Produksi/productionWorkLogsService";
import { fetchSalesRecords } from "../Transaksi/salesService";

const LISTENER_TIMEOUT_MS = 7000;
const DASHBOARD_SCAN_LIMIT = 1000;

const EMPTY_PLANNING_PERIOD_SUMMARY = {
  count: 0,
  targetQty: 0,
  actualCompletedQty: 0,
  remainingQty: 0,
  progressPercent: 0,
  priorityPlans: [],
};

const EMPTY_PLANNING_SUMMARY = {
  weekly: EMPTY_PLANNING_PERIOD_SUMMARY,
  monthly: EMPTY_PLANNING_PERIOD_SUMMARY,
  overdueCount: 0,
  behindTargetCount: 0,
  priorityPlans: [],
};

export const createEmptyDashboardData = () => ({
  lowStockRows: [],
  criticalStockPreview: [],
  recentActivities: [],
  productionOrders: [],
  workLogs: [],
  payrolls: [],
  expenses: [],
  incomes: [],
  revenues: [],
  sales: [],
  stockAuditRows: [],
  stockIssueMeta: {},
  planningSummary: {
    ...EMPTY_PLANNING_SUMMARY,
    weekly: { ...EMPTY_PLANNING_PERIOD_SUMMARY },
    monthly: { ...EMPTY_PLANNING_PERIOD_SUMMARY },
    priorityPlans: [],
  },
});

const toArray = (value) => (Array.isArray(value) ? value : []);
const toNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const safeTrim = (value) => String(value || "").trim();

const normalizeStatus = (value) => safeTrim(value).toLowerCase();

const getDateValue = (record = {}) => {
  const candidates = [
    record?.date,
    record?.transactionDate,
    record?.paidAt,
    record?.completedAt,
    record?.createdAt,
    record?.timestamp,
    record?.updatedAt,
    record?.dueDate,
    record?.planDate,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate?.toDate === "function") return candidate.toDate();
    if (candidate instanceof Date) return candidate;

    const parsedDate = new Date(candidate);
    if (!Number.isNaN(parsedDate.getTime())) return parsedDate;
  }

  return null;
};

const getTimeValue = (record = {}) => getDateValue(record)?.getTime?.() || 0;

const sortByLatestDate = (rows = []) => [...toArray(rows)].sort((left, right) => getTimeValue(right) - getTimeValue(left));

const onceFromListener = (listener, { timeoutMs = LISTENER_TIMEOUT_MS } = {}) => new Promise((resolve, reject) => {
  let settled = false;
  let cleanupPending = false;
  let listenerRegistered = false;
  let unsubscribe = null;
  let timer = null;

  const cleanup = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    try {
      if (typeof unsubscribe === "function") unsubscribe();
    } catch {
      // Listener cleanup is best-effort only.
    }
  };

  const settle = (handler, value) => {
    if (settled) return;
    settled = true;
    handler(value);

    if (listenerRegistered) {
      cleanup();
    } else {
      cleanupPending = true;
    }
  };

  timer = setTimeout(() => {
    settle(reject, new Error("Timeout membaca data listener Dashboard."));
  }, timeoutMs);

  try {
    const maybeUnsubscribe = listener(
      (rows) => settle(resolve, toArray(rows)),
      (error) => settle(reject, error),
    );

    unsubscribe = typeof maybeUnsubscribe === "function" ? maybeUnsubscribe : () => {};
    listenerRegistered = true;

    if (cleanupPending) {
      cleanup();
    }
  } catch (error) {
    settle(reject, error);
  }
});

const readDashboardSection = async (key, loader, fallback) => {
  try {
    const rows = await loader();
    return {
      key,
      rows: typeof fallback === "function" ? fallback(rows) : rows,
      failed: false,
    };
  } catch (error) {
    console.warn(`Dashboard section ${key} gagal dimuat:`, error);
    return {
      key,
      rows: typeof fallback === "function" ? fallback() : fallback,
      failed: true,
    };
  }
};

const getStockRoute = (row = {}) => {
  const sourceType = normalizeStatus(row.sourceType);
  if (sourceType === "product") return "/products";
  if (sourceType === "semi_finished") return "/produksi/semi-finished-materials";
  return "/raw-materials";
};

const getStockTypeLabel = (row = {}) => {
  const sourceType = normalizeStatus(row.sourceType);
  if (sourceType === "product") return "Produk";
  if (sourceType === "semi_finished") return "Semi Finished";
  return "Bahan Baku";
};

const getDashboardSourceType = (row = {}) => {
  const sourceType = normalizeStatus(row.sourceType);
  if (sourceType === "raw_material") return "material";
  return sourceType || "stock";
};

const getStockSeverity = ({ stock = 0, minStock = 0 } = {}) => {
  if (stock <= 0) return { label: "Kosong", color: "red" };
  if (minStock > 0 && stock <= Math.max(1, Math.floor(minStock / 2))) return { label: "Sangat rendah", color: "orange" };
  return { label: "Menipis", color: "gold" };
};

const mapLowStockRow = (row = {}) => {
  const stock = toNumber(row.availableStock ?? row.currentStock ?? row.stock);
  const minStock = toNumber(row.minStockAlert ?? row.minStock);
  const sourceId = row.sourceId || row.itemId || row.id || row.code || row.readModelId || "";
  const name = row.name || row.itemName || row.productName || row.materialName || row.targetName || row.code || "Item stok";

  return {
    ...row,
    id: sourceId,
    key: row.id || row.readModelId || `${row.sourceType || "stock"}-${sourceId}`,
    name,
    type: getStockTypeLabel(row),
    sourceType: getDashboardSourceType(row),
    stock,
    minStock,
    unit: row.stockUnit || row.unit || "pcs",
    to: getStockRoute(row),
    severity: getStockSeverity({ stock, minStock }),
    affectedVariantSummary: row.affectedVariantSummary || row.variantSummary || row.variantLabel || "",
    restockSupplierId: row.restockSupplierId || row.lastSupplierId || row.supplierId || "",
    restockSupplierName: row.restockSupplierName || row.lastSupplierName || row.supplierName || "",
    restockProductLink: row.restockProductLink || row.productLink || row.storeLink || "",
    lastPurchasePrice: toNumber(row.lastPurchasePrice || row.referencePrice || row.price),
  };
};

const mapStockAuditRow = (row = {}) => {
  const currentStock = toNumber(row.currentStock ?? row.stock);
  const reservedStock = toNumber(row.reservedStock);
  const availableStock = toNumber(row.availableStock ?? Math.max(currentStock - reservedStock, 0));
  const minStock = toNumber(row.minStockAlert ?? row.minStock);
  const sourceId = row.sourceId || row.itemId || row.id || row.code || row.readModelId || "";

  return {
    ...row,
    id: sourceId,
    key: row.id || row.readModelId || `${row.sourceType || "stock"}-${sourceId}`,
    name: row.name || row.itemName || row.productName || row.materialName || row.targetName || row.code || "Item stok",
    type: getStockTypeLabel(row),
    currentStock,
    reservedStock,
    availableStock,
    minStock,
    unit: row.stockUnit || row.unit || "pcs",
    to: getStockRoute(row),
    isNegativeStock: currentStock < 0 || availableStock < 0,
    isReservedOverrun: reservedStock > currentStock && reservedStock > 0,
  };
};

const normalizeLowStockReadResult = (result) => {
  if (Array.isArray(result)) return { rows: result, meta: { total: result.length } };

  const rows = toArray(result?.rows || result?.data);
  return {
    rows,
    meta: result?.meta || { total: rows.length },
  };
};

const isCompletedStatus = (status) => ["completed", "complete", "selesai", "done"].includes(normalizeStatus(status));
const isCancelledStatus = (status) => ["cancelled", "canceled", "cancel", "dibatalkan", "batal"].includes(normalizeStatus(status));

const getPlanTargetQty = (plan = {}) => toNumber(plan.targetQty ?? plan.quantity ?? plan.plannedQty ?? plan.qty);
const getPlanActualQty = (plan = {}) => toNumber(plan.actualCompletedQty ?? plan.completedQty ?? plan.actualQty ?? plan.goodQty ?? plan.outputQty);
const getPlanRemainingQty = (plan = {}) => {
  const explicitRemaining = plan.remainingQty ?? plan.remainingTargetQty;
  if (explicitRemaining !== undefined && explicitRemaining !== null) return Math.max(toNumber(explicitRemaining), 0);
  return Math.max(getPlanTargetQty(plan) - getPlanActualQty(plan), 0);
};
const getPlanDueDate = (plan = {}) => getDateValue({ dueDate: plan.dueDate || plan.deadline || plan.targetDate || plan.planDate || plan.date });

const getPeriodRange = (type, referenceDate = new Date()) => {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);

  if (type === "week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
  } else {
    start.setDate(1);
  }

  const end = new Date(start);
  if (type === "week") {
    end.setDate(start.getDate() + 7);
  } else {
    end.setMonth(start.getMonth() + 1);
  }

  return { start, end };
};

const isDateInRange = (date, range) => date && date >= range.start && date < range.end;

const normalizePlanningRow = (plan = {}, referenceDate = new Date()) => {
  const targetQty = getPlanTargetQty(plan);
  const actualCompletedQty = getPlanActualQty(plan);
  const remainingQty = getPlanRemainingQty(plan);
  const dueDate = getPlanDueDate(plan);
  const baseStatus = normalizeStatus(plan.status || "draft");
  const isDone = isCompletedStatus(baseStatus) || remainingQty <= 0;
  const isCancelled = isCancelledStatus(baseStatus);
  const isOverdue = Boolean(!isDone && !isCancelled && dueDate && dueDate < referenceDate);
  const progressPercent = targetQty > 0 ? Math.min(Math.round((actualCompletedQty / targetQty) * 100), 100) : 0;
  const isBehindTarget = Boolean(!isDone && !isCancelled && !isOverdue && targetQty > 0 && progressPercent < 100);
  const normalizedStatus = isDone ? "completed" : isOverdue ? "overdue" : isBehindTarget ? "behind" : baseStatus || "draft";

  return {
    ...plan,
    targetQty,
    actualCompletedQty,
    remainingQty,
    progressPercent,
    dueDate: dueDate?.toISOString?.() || plan.dueDate || plan.deadline || plan.targetDate || plan.planDate || plan.date || "",
    status: normalizedStatus,
  };
};

const buildPlanningPeriodSummary = (plans = [], type, referenceDate = new Date()) => {
  const range = getPeriodRange(type, referenceDate);
  const periodPlans = plans.filter((plan) => isDateInRange(getPlanDueDate(plan) || getDateValue(plan), range));
  const targetQty = periodPlans.reduce((total, plan) => total + toNumber(plan.targetQty), 0);
  const actualCompletedQty = periodPlans.reduce((total, plan) => total + toNumber(plan.actualCompletedQty), 0);
  const remainingQty = periodPlans.reduce((total, plan) => total + toNumber(plan.remainingQty), 0);

  return {
    count: periodPlans.length,
    targetQty,
    actualCompletedQty,
    remainingQty,
    progressPercent: targetQty > 0 ? Math.min(Math.round((actualCompletedQty / targetQty) * 100), 100) : 0,
    priorityPlans: periodPlans.filter((plan) => toNumber(plan.remainingQty) > 0),
  };
};

const buildPlanningSummary = (plans = [], referenceDate = new Date()) => {
  const normalizedPlans = toArray(plans).map((plan) => normalizePlanningRow(plan, referenceDate));
  const activePriorityPlans = normalizedPlans
    .filter((plan) => !isCompletedStatus(plan.status) && !isCancelledStatus(plan.status) && toNumber(plan.remainingQty) > 0)
    .sort((left, right) => (getPlanDueDate(left)?.getTime?.() || Number.MAX_SAFE_INTEGER) - (getPlanDueDate(right)?.getTime?.() || Number.MAX_SAFE_INTEGER));

  return {
    weekly: buildPlanningPeriodSummary(normalizedPlans, "week", referenceDate),
    monthly: buildPlanningPeriodSummary(normalizedPlans, "month", referenceDate),
    overdueCount: activePriorityPlans.filter((plan) => normalizeStatus(plan.status) === "overdue").length,
    behindTargetCount: activePriorityPlans.filter((plan) => normalizeStatus(plan.status) === "behind").length,
    priorityPlans: activePriorityPlans,
  };
};

const normalizeActivityRows = (rows = [], maxListItems = 5) => sortByLatestDate(rows)
  .slice(0, maxListItems)
  .map((row, index) => ({
    ...row,
    id: row.id || row.referenceNumber || row.code || `activity-${index}`,
    itemName: row.itemName || row.name || row.productName || row.materialName || row.sourceName || row.description || "Aktivitas stok",
    quantityChange: row.quantityChange ?? row.deltaCurrent ?? row.quantity ?? row.qty ?? 0,
    type: row.type || row.reason || row.sourceType || row.sourceModule || "stock",
    note: row.note || row.notes || row.description || row.referenceNumber || row.sourceRef || "",
  }));

const mergeDashboardData = (data = {}) => {
  const fallback = createEmptyDashboardData();
  const planningSummary = data.planningSummary || fallback.planningSummary;

  return {
    ...fallback,
    ...data,
    lowStockRows: toArray(data.lowStockRows),
    criticalStockPreview: toArray(data.criticalStockPreview),
    recentActivities: toArray(data.recentActivities),
    productionOrders: toArray(data.productionOrders),
    workLogs: toArray(data.workLogs),
    payrolls: toArray(data.payrolls),
    expenses: toArray(data.expenses),
    incomes: toArray(data.incomes),
    revenues: toArray(data.revenues),
    sales: toArray(data.sales),
    stockAuditRows: toArray(data.stockAuditRows),
    stockIssueMeta: data.stockIssueMeta && typeof data.stockIssueMeta === "object" ? data.stockIssueMeta : {},
    planningSummary: {
      ...fallback.planningSummary,
      ...planningSummary,
      weekly: { ...fallback.planningSummary.weekly, ...(planningSummary.weekly || {}) },
      monthly: { ...fallback.planningSummary.monthly, ...(planningSummary.monthly || {}) },
      priorityPlans: toArray(planningSummary.priorityPlans),
    },
  };
};

export const normalizeDashboardData = mergeDashboardData;

export const readDashboardData = async ({ maxListItems = 5 } = {}) => {
  const reads = await Promise.all([
    readDashboardSection("products", () => onceFromListener(listenProducts), toArray),
    readDashboardSection("raw_materials", () => onceFromListener(listenRawMaterials), toArray),
    readDashboardSection("stock_issues", () => getStockIssueReadModels({ maxResults: DASHBOARD_SCAN_LIMIT, includeMeta: true }), normalizeLowStockReadResult),
    readDashboardSection("stock_read_models", () => getStockReadModelRows({ limit: DASHBOARD_SCAN_LIMIT }), toArray),
    readDashboardSection("sales", () => fetchSalesRecords(), toArray),
    readDashboardSection("incomes", () => listFinanceIncomes({ limit: DASHBOARD_SCAN_LIMIT }), toArray),
    readDashboardSection("expenses", () => listFinanceExpenses({ limit: DASHBOARD_SCAN_LIMIT }), toArray),
    readDashboardSection("production_orders", () => getAllProductionOrders(), toArray),
    readDashboardSection("production_work_logs", () => getAllProductionWorkLogs(), toArray),
    readDashboardSection("production_payrolls", () => getAllProductionPayrolls(), toArray),
    readDashboardSection("production_planning", () => getAllProductionPlans(), toArray),
    readDashboardSection("inventory_logs", () => getInventoryLogs({ limit: DASHBOARD_SCAN_LIMIT }), toArray),
  ]);

  const byKey = reads.reduce((accumulator, read) => ({
    ...accumulator,
    [read.key]: read.rows,
  }), {});
  const failedReads = reads.filter((read) => read.failed).map((read) => read.key);

  const lowStockResult = byKey.stock_issues || { rows: [], meta: {} };
  const lowStockRows = toArray(lowStockResult.rows).map(mapLowStockRow);
  const stockAuditRows = toArray(byKey.stock_read_models).map(mapStockAuditRow);
  const recentActivities = normalizeActivityRows(byKey.inventory_logs, maxListItems);
  const sales = sortByLatestDate(byKey.sales);
  const incomes = sortByLatestDate(byKey.incomes);
  const expenses = sortByLatestDate(byKey.expenses);
  const productionOrders = sortByLatestDate(byKey.production_orders);
  const workLogs = sortByLatestDate(byKey.production_work_logs);
  const payrolls = sortByLatestDate(byKey.production_payrolls);
  const planningSummary = buildPlanningSummary(byKey.production_planning);

  const dashboardData = mergeDashboardData({
    lowStockRows,
    criticalStockPreview: lowStockRows.slice(0, maxListItems),
    recentActivities,
    productionOrders,
    workLogs,
    payrolls,
    expenses,
    incomes,
    revenues: [],
    sales,
    stockAuditRows,
    stockIssueMeta: {
      ...(lowStockResult.meta || {}),
      hasMore: toNumber(lowStockResult.meta?.total) > lowStockRows.length,
      isLimited: toNumber(lowStockResult.meta?.total) > lowStockRows.length,
    },
    planningSummary,
    summary: {
      productCount: toArray(byKey.products).length,
      rawMaterialCount: toArray(byKey.raw_materials).length,
      salesCount: sales.length,
      incomeTotal: incomes.reduce((sum, item) => sum + toNumber(item.totalAmount ?? item.amount ?? item.total), 0),
      expenseTotal: expenses.reduce((sum, item) => sum + toNumber(item.totalAmount ?? item.amount ?? item.total), 0),
    },
  });

  return {
    dashboardData,
    failedReads,
  };
};
