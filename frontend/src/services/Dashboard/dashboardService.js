import { listFinanceExpenses, listFinanceIncomes } from "../Finance/financeService";
import { getInventoryLogs } from "../Inventory/inventoryService";
import { getStockIssueReadModels, getStockReadModelRows } from "../Inventory/stockReadModelService";
import { getAllProductionOrders } from "../Produksi/productionOrdersService";
import { getAllProductionPayrolls } from "../Produksi/productionPayrollsService";
import { getAllProductionPlans } from "../Produksi/productionPlanningService";
import { getAllProductionWorkLogs } from "../Produksi/productionWorkLogsService";
import { fetchSalesRecords } from "../Transaksi/salesService";
import { getSqliteInitialSetupReadiness } from "../System/sqliteBackendStatusService";
import { canAccessRoute, ROUTE_ACCESS_KEYS } from "../../utils/auth/roleAccess";
import { APP_ROUTES } from "../../config/appRoutes";

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
  setupReadiness: null,
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

const getStockRoute = (row = {}, role) => {
  const sourceType = normalizeStatus(row.sourceType);
  const routeConfig = sourceType === "product"
    ? { routeKey: ROUTE_ACCESS_KEYS.PRODUCTS, to: "/products" }
    : sourceType === "semi_finished"
      ? { routeKey: ROUTE_ACCESS_KEYS.SEMI_FINISHED_MATERIALS, to: APP_ROUTES.PRODUCTION.SEMI_FINISHED_MATERIALS }
      : { routeKey: ROUTE_ACCESS_KEYS.RAW_MATERIALS, to: "/raw-materials" };

  if (canAccessRoute(routeConfig.routeKey, role)) {
    return routeConfig.to;
  }

  if (canAccessRoute(ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT, role)) {
    return APP_ROUTES.INVENTORY.STOCK_MANAGEMENT;
  }

  return "/dashboard";
};

const getStockTypeLabel = (row = {}) => {
  const sourceType = normalizeStatus(row.sourceType);
  if (sourceType === "product") return "Produk";
  if (sourceType === "semi_finished") return "Produk Setengah Jadi";
  return "Bahan Baku";
};

const getDashboardSourceType = (row = {}) => {
  const sourceType = normalizeStatus(row.sourceType);
  if (sourceType === "raw_material") return "material";
  return sourceType || "stock";
};

const getStockSeverity = ({ stock = 0, currentStock = 0, reservedStock = 0, minStock = 0 } = {}) => {
  if (stock < 0 || currentStock < 0) return { label: "Minus", color: "red", rank: 0 };
  if (stock <= 0) return { label: "Kosong", color: "red", rank: 1 };
  if (reservedStock > currentStock && reservedStock > 0) {
    return { label: "Dipesan melebihi stok", color: "red", rank: 2 };
  }
  if (minStock > 0 && stock <= Math.max(1, Math.floor(minStock / 2))) {
    return { label: "Sangat rendah", color: "gold", rank: 3 };
  }
  return { label: "Menipis", color: "gold", rank: 4 };
};

const mapLowStockRow = (row = {}, role) => {
  const stock = toNumber(row.availableStock ?? row.currentStock ?? row.stock);
  const currentStock = toNumber(row.currentStock ?? row.stock);
  const reservedStock = toNumber(row.reservedStock);
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
    currentStock,
    reservedStock,
    minStock,
    unit: row.stockUnit || row.unit || "pcs",
    to: getStockRoute(row, role),
    severity: getStockSeverity({ stock, currentStock, reservedStock, minStock }),
    affectedVariantSummary: row.affectedVariantSummary || row.variantSummary || row.variantLabel || "",
    restockSupplierId: row.restockSupplierId || row.lastSupplierId || row.supplierId || "",
    restockSupplierName: row.restockSupplierName || row.lastSupplierName || row.supplierName || "",
    restockProductLink: row.restockProductLink || row.productLink || row.storeLink || "",
    lastPurchasePrice: toNumber(row.lastPurchasePrice || row.referencePrice || row.price),
  };
};

export const sortStockIssuesByUrgency = (rows = []) => [...toArray(rows)].sort((left, right) => {
  const rankDifference = toNumber(left?.severity?.rank) - toNumber(right?.severity?.rank);
  if (rankDifference !== 0) return rankDifference;

  const leftDeficit = Math.max(toNumber(left?.minStock) - toNumber(left?.stock), 0);
  const rightDeficit = Math.max(toNumber(right?.minStock) - toNumber(right?.stock), 0);
  if (leftDeficit !== rightDeficit) return rightDeficit - leftDeficit;

  const leftRatio = toNumber(left?.minStock) > 0
    ? toNumber(left?.stock) / toNumber(left?.minStock)
    : Number.POSITIVE_INFINITY;
  const rightRatio = toNumber(right?.minStock) > 0
    ? toNumber(right?.stock) / toNumber(right?.minStock)
    : Number.POSITIVE_INFINITY;
  if (leftRatio !== rightRatio) return leftRatio - rightRatio;

  return safeTrim(left?.name).localeCompare(safeTrim(right?.name), "id");
});

const mapStockAuditRow = (row = {}, role) => {
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
    to: getStockRoute(row, role),
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
    setupReadiness: data.setupReadiness && typeof data.setupReadiness === "object"
      ? data.setupReadiness
      : null,
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

export const readDashboardData = async ({ maxListItems = 5, role } = {}) => {
  const readDefinitions = [
    {
      key: "stock_issues",
      routeKey: ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT,
      loader: () => getStockIssueReadModels({ maxResults: DASHBOARD_SCAN_LIMIT, includeMeta: true }),
      fallback: normalizeLowStockReadResult,
    },
    {
      key: "stock_read_models",
      routeKey: ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT,
      loader: () => getStockReadModelRows({ limit: DASHBOARD_SCAN_LIMIT }),
      fallback: toArray,
    },
    {
      key: "sales",
      routeKey: ROUTE_ACCESS_KEYS.SALES,
      loader: () => fetchSalesRecords(),
      fallback: toArray,
    },
    {
      key: "incomes",
      routeKey: ROUTE_ACCESS_KEYS.CASH_IN,
      loader: () => listFinanceIncomes({ limit: DASHBOARD_SCAN_LIMIT }),
      fallback: toArray,
    },
    {
      key: "expenses",
      routeKey: ROUTE_ACCESS_KEYS.CASH_OUT,
      loader: () => listFinanceExpenses({ limit: DASHBOARD_SCAN_LIMIT }),
      fallback: toArray,
    },
    {
      key: "production_orders",
      routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_ORDERS,
      loader: () => getAllProductionOrders(),
      fallback: toArray,
    },
    {
      key: "production_work_logs",
      routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS,
      loader: () => getAllProductionWorkLogs(),
      fallback: toArray,
    },
    {
      key: "production_payrolls",
      routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PAYROLLS,
      loader: () => getAllProductionPayrolls(),
      fallback: toArray,
    },
    {
      key: "production_planning",
      routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PLANNING,
      loader: () => getAllProductionPlans(),
      fallback: toArray,
    },
    {
      key: "inventory_logs",
      routeKey: ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT,
      loader: () => getInventoryLogs({ limit: Math.max(maxListItems, 1) }),
      fallback: toArray,
    },
    {
      key: "initial_setup_readiness",
      routeKey: ROUTE_ACCESS_KEYS.RESET_MAINTENANCE,
      loader: async () => {
        const result = await getSqliteInitialSetupReadiness();
        return result?.data || null;
      },
      fallback: null,
    },
  ];

  const reads = await Promise.all(
    readDefinitions
      .filter(({ routeKey }) => canAccessRoute(routeKey, role))
      .map(({ key, loader, fallback }) => readDashboardSection(key, loader, fallback)),
  );

  const byKey = reads.reduce((accumulator, read) => ({
    ...accumulator,
    [read.key]: read.rows,
  }), {});
  const failedReads = reads.filter((read) => read.failed).map((read) => read.key);

  const lowStockResult = byKey.stock_issues || { rows: [], meta: {} };
  const lowStockRows = sortStockIssuesByUrgency(
    toArray(lowStockResult.rows).map((row) => mapLowStockRow(row, role)),
  );
  const rawStockAuditRows = toArray(byKey.stock_read_models);
  const stockAuditRows = rawStockAuditRows.map((row) => mapStockAuditRow(row, role));
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
    setupReadiness: byKey.initial_setup_readiness || null,
    summary: {
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
