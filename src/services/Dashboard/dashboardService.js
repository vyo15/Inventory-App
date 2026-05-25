import { collection, getDocs, limit, orderBy, query, Timestamp, where } from "firebase/firestore";
import { db } from "../../firebase";
import { getProductionPlanningDashboardSummary } from "../Produksi/productionPlanningService";
import { buildStockReadModelRow } from "../../utils/stock/stockHelpers";
import {
  getStockIssueReadModels,
  getStockReadModelRows,
} from "../Inventory/stockReadModelService";

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

const mapSnapshotDocs = (snapshot) => snapshot.docs.map((docItem) => ({
  id: docItem.id,
  ...docItem.data(),
}));

const getNumericValue = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  if (typeof value === "string") {
    const normalized = value.replace(/[^\d.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const getTransactionDate = (record = {}) => {
  const candidates = [
    record?.date,
    record?.transactionDate,
    record?.paidAt,
    record?.completedAt,
    record?.createdAt,
    record?.timestamp,
    record?.updatedAt,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (typeof candidate?.toDate === "function") return candidate.toDate();
    if (candidate instanceof Date) return candidate;

    if (typeof candidate === "string" || typeof candidate === "number") {
      const parsed = new Date(candidate);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  return null;
};

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const mergeDashboardRowsById = (...rowGroups) => {
  const rowsById = new Map();
  rowGroups.flat().forEach((item) => {
    if (!item?.id) return;
    rowsById.set(item.id, item);
  });
  return Array.from(rowsById.values());
};

const isStockMonitoringActiveItem = (item = {}) => item?.isActive !== false;

const DASHBOARD_STOCK_READ_MODEL_SOURCES = [
  { sourceType: "product", type: "Produk Jadi", to: "/stock-management", getUnit: (item = {}) => item?.unit || "pcs" },
  { sourceType: "material", type: "Bahan Baku", to: "/stock-management", getUnit: (item = {}) => item?.stockUnit || item?.unit || "pcs" },
  { sourceType: "semi_finished", type: "Semi Finished", to: "/produksi/semi-finished-materials", getUnit: (item = {}) => item?.unit || "pcs" },
];

const buildDashboardStockReadRow = (item = {}, sourceConfig = {}) => {
  const readModelRow = buildStockReadModelRow(item, {
    id: item.id,
    sourceType: sourceConfig.sourceType,
    typeLabel: sourceConfig.type,
    route: sourceConfig.to,
    unit: typeof sourceConfig.getUnit === "function" ? sourceConfig.getUnit(item) : undefined,
    affectedVariantMaxItems: 2,
  });
  const variantGap = readModelRow.affectedVariantEntries.length
    ? Math.min(...readModelRow.affectedVariantEntries.map((variant) => variant.stock - Math.max(variant.threshold, 0)))
    : null;

  return {
    ...readModelRow,
    key: `${readModelRow.sourceType}-${item.id}`,
    sourceStock: readModelRow.stock,
    stock: readModelRow.stockDisplay,
    minStock: readModelRow.minStockDisplay,
    unit: readModelRow.unitDisplay,
    severity: readModelRow.statusMeta,
    sortGap: variantGap ?? readModelRow.stockDisplay - Math.max(readModelRow.minStockDisplay, 0),
    snapshot: item,
  };
};

const getRestockLink = (...values) => {
  const validValue = values.find((value) => String(value || "").trim());
  return validValue ? String(validValue).trim() : "";
};

const getLatestPurchaseForMaterial = (purchases = [], materialId = "") => {
  const targetId = String(materialId || "").trim();
  if (!targetId || !Array.isArray(purchases)) return null;

  return purchases
    .filter((purchase) => (
      normalizeStatus(purchase?.type) === "material" &&
      String(purchase?.itemId || "").trim() === targetId
    ))
    .sort((left, right) => {
      const rightDate = getTransactionDate(right)?.getTime() || 0;
      const leftDate = getTransactionDate(left)?.getTime() || 0;
      return rightDate - leftDate;
    })[0] || null;
};

const getPurchaseProductLink = (purchase = null) => {
  if (!purchase || typeof purchase !== "object") return "";

  return getRestockLink(
    purchase?.productLink,
    purchase?.purchaseProductLink,
    purchase?.restockProductLink,
  );
};

const getPurchaseLastUnitPrice = (purchase = null) => {
  if (!purchase || typeof purchase !== "object") return 0;

  return getNumericValue(
    purchase?.actualUnitCost ??
      purchase?.unitCost ??
      purchase?.lastPurchasePrice ??
      purchase?.restockReferencePrice ??
      0,
  );
};

const hasRestockReadModelMetadata = (item = {}) => Boolean(
  getRestockLink(item.restockSupplierId, item.restockSupplierName, item.restockProductLink)
    || getNumericValue(item.lastPurchasePrice) > 0
    || item.lastPurchaseAt,
);

const buildRestockAssistantRows = (lowStockRows = [], purchases = []) => (
  lowStockRows.map((item) => {
    if (item.sourceType !== "material") return item;

    const latestPurchase = getLatestPurchaseForMaterial(purchases, item.id);
    const supplierId = String(
      latestPurchase?.supplierId ||
        latestPurchase?.supplierRefId ||
        latestPurchase?.supplierReferenceId ||
        item.restockSupplierId ||
        item.supplierId ||
        item.snapshot?.supplierId ||
        "",
    ).trim();
    const supplierName = String(
      latestPurchase?.supplierName ||
        latestPurchase?.supplierLabel ||
        latestPurchase?.supplierStoreName ||
        item.restockSupplierName ||
        item.supplierName ||
        item.snapshot?.supplierName ||
        "",
    ).trim();
    const productLink = getPurchaseProductLink(latestPurchase) || item.restockProductLink || item.productLink || "";

    return {
      ...item,
      latestPurchase,
      restockSupplierId: supplierId,
      restockSupplierName: supplierName,
      restockProductLink: productLink,
      lastPurchasePrice: getPurchaseLastUnitPrice(latestPurchase) || item.lastPurchasePrice || 0,
    };
  })
);

const normalizePlanningPeriodSummary = (summary = {}) => ({
  count: getNumericValue(summary.count),
  targetQty: getNumericValue(summary.targetQty),
  actualCompletedQty: getNumericValue(summary.actualCompletedQty),
  remainingQty: getNumericValue(summary.remainingQty),
  progressPercent: Math.max(0, Math.min(getNumericValue(summary.progressPercent), 999)),
  priorityPlans: Array.isArray(summary.priorityPlans) ? summary.priorityPlans : [],
});

const normalizePlanningDashboardSummary = (summary = EMPTY_PLANNING_SUMMARY) => ({
  weekly: normalizePlanningPeriodSummary(summary.weekly),
  monthly: normalizePlanningPeriodSummary(summary.monthly),
  overdueCount: getNumericValue(summary.overdueCount),
  behindTargetCount: getNumericValue(summary.behindTargetCount),
  priorityPlans: Array.isArray(summary.priorityPlans) ? summary.priorityPlans : [],
});

const readDashboardSnapshot = async (key, requestPromise) => {
  try {
    return { key, data: mapSnapshotDocs(await requestPromise), error: null };
  } catch (error) {
    console.warn(`Gagal memuat data Dashboard: ${key}`, error);
    return { key, data: [], error };
  }
};

const getDashboardDateRange = (type = "month", referenceDate = new Date()) => {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);

  if (type === "week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
  } else {
    start.setDate(1);
  }

  const endExclusive = new Date(start);
  if (type === "week") {
    endExclusive.setDate(start.getDate() + 7);
  } else {
    endExclusive.setMonth(start.getMonth() + 1);
  }

  return {
    start,
    endExclusive,
    startTimestamp: Timestamp.fromDate(start),
    endTimestampExclusive: Timestamp.fromDate(endExclusive),
  };
};

const buildDashboardDateRangeQuery = (collectionName, fieldName, dateRange) =>
  query(
    collection(db, collectionName),
    where(fieldName, ">=", dateRange.startTimestamp),
    where(fieldName, "<", dateRange.endTimestampExclusive),
    orderBy(fieldName, "desc"),
  );

// =====================================================
// SECTION: Dashboard read service — AKTIF / READ-ONLY
// Fungsi:
// - memusatkan query orchestration Dashboard agar page tidak lagi memegang Firestore query besar;
// - menjaga Dashboard tetap monitoring read-only dengan range operasional bulan/minggu berjalan.
// Hubungan flow:
// - membaca stock_item_read_models untuk stok, lalu inventory logs, produksi, payroll, finance, sales, dan planning summary;
// - tidak membuat transaksi, auto-fix, auto-purchase, auto-payroll, atau mutasi stok.
// Risiko:
// - Jika ada query baru yang butuh composite index Firestore, catat di docs dan jangan fallback permanen ke full collection scan.
// =====================================================
const readDashboardSnapshotData = async ({ maxListItems = 5 } = {}) => {
  const monthRange = getDashboardDateRange("month");
  const weekRange = getDashboardDateRange("week");
  const recentActivitiesQuery = query(
    collection(db, "inventory_logs"),
    orderBy("timestamp", "desc"),
    limit(maxListItems),
  );
  const productionOrdersFocusQuery = query(
    collection(db, "production_orders"),
    where("status", "in", ["shortage", "ready"]),
  );
  const runningWorkLogsQuery = query(
    collection(db, "production_work_logs"),
    where("status", "==", "in_progress"),
  );
  const weeklyWorkLogsQuery = buildDashboardDateRangeQuery(
    "production_work_logs",
    "workDate",
    weekRange,
  );
  const pendingPayrollsQuery = query(
    collection(db, "production_payrolls"),
    where("status", "in", ["draft", "confirmed"]),
  );
  const monthlyPayrollsQuery = buildDashboardDateRangeQuery(
    "production_payrolls",
    "payrollDate",
    monthRange,
  );

  const dashboardReads = await Promise.all([
    readDashboardSnapshot("inventory_logs", getDocs(recentActivitiesQuery)),
    readDashboardSnapshot("production_orders_focus", getDocs(productionOrdersFocusQuery)),
    readDashboardSnapshot("production_work_logs_running", getDocs(runningWorkLogsQuery)),
    readDashboardSnapshot("production_work_logs_week", getDocs(weeklyWorkLogsQuery)),
    readDashboardSnapshot("production_payrolls_pending", getDocs(pendingPayrollsQuery)),
    readDashboardSnapshot("production_payrolls_month", getDocs(monthlyPayrollsQuery)),
    readDashboardSnapshot("expenses", getDocs(buildDashboardDateRangeQuery("expenses", "date", monthRange))),
    readDashboardSnapshot("incomes", getDocs(buildDashboardDateRangeQuery("incomes", "date", monthRange))),
    readDashboardSnapshot("revenues", getDocs(buildDashboardDateRangeQuery("revenues", "date", monthRange))),
    readDashboardSnapshot("sales", getDocs(buildDashboardDateRangeQuery("sales", "date", monthRange))),
  ]);

  const dataByKey = dashboardReads.reduce((accumulator, item) => {
    accumulator[item.key] = item.data;
    return accumulator;
  }, {});

  const failedReads = dashboardReads.filter((item) => item.error).map((item) => item.key);
  let planningSummary = EMPTY_PLANNING_SUMMARY;

  try {
    planningSummary = await getProductionPlanningDashboardSummary();
  } catch (error) {
    console.warn("Gagal memuat summary production planning:", error);
    failedReads.push("production_planning_summary");
  }

  return {
    dataByKey,
    failedReads,
    planningSummary,
  };
};

const readDashboardStockRowsFromReadModel = async ({ maxResults = 1000 } = {}) => {
  const { rows = [], meta = {} } = await getStockReadModelRows({ maxResults, includeMeta: true });

  return {
    rows: rows.filter((item) => item.isActive !== false),
    meta,
  };
};

const readDashboardStockIssueRowsFromReadModel = async ({ maxResults = 50 } = {}) => {
  const { rows = [], meta = {} } = await getStockIssueReadModels({
    maxResults,
    includeMeta: true,
  });

  return {
    rows: rows.filter((item) => item.isActive !== false),
    meta,
  };
};

const readDashboardStockRowsFromMasterFallback = async () => {
  const fallbackReads = await Promise.all([
    readDashboardSnapshot("products_fallback", getDocs(collection(db, "products"))),
    readDashboardSnapshot("raw_materials_fallback", getDocs(collection(db, "raw_materials"))),
    readDashboardSnapshot("semi_finished_materials_fallback", getDocs(collection(db, "semi_finished_materials"))),
  ]);
  const dataByKey = fallbackReads.reduce((accumulator, item) => {
    accumulator[item.key] = item.data;
    return accumulator;
  }, {});

  return {
    rows: [
      ...(dataByKey.products_fallback || []).filter(isStockMonitoringActiveItem).map((item) =>
        buildDashboardStockReadRow(item, DASHBOARD_STOCK_READ_MODEL_SOURCES[0]),
      ),
      ...(dataByKey.raw_materials_fallback || []).filter(isStockMonitoringActiveItem).map((item) =>
        buildDashboardStockReadRow(item, DASHBOARD_STOCK_READ_MODEL_SOURCES[1]),
      ),
      ...(dataByKey.semi_finished_materials_fallback || []).filter(isStockMonitoringActiveItem).map((item) =>
        buildDashboardStockReadRow(item, DASHBOARD_STOCK_READ_MODEL_SOURCES[2]),
      ),
    ],
    failedReads: fallbackReads.filter((item) => item.error).map((item) => item.key),
  };
};

const readDashboardStockRows = async ({ maxResults = 1000, maxIssueResults = 50 } = {}) => {
  try {
    const issueResult = await readDashboardStockIssueRowsFromReadModel({
      maxResults: maxIssueResults,
    });

    if (issueResult.rows.length > 0) {
      return {
        rows: issueResult.rows,
        failedReads: [],
        source: "stock_item_read_models_issue_query",
        meta: issueResult.meta,
      };
    }

    // Guard: zero issue rows can be a valid healthy stock state, but an empty
    // read model after deploy/backfill should still fallback to source master.
    const probeResult = await getStockReadModelRows({ maxResults: 1, includeMeta: true });
    if ((probeResult?.rows || []).length > 0) {
      return {
        rows: [],
        failedReads: [],
        source: "stock_item_read_models_issue_query",
        meta: issueResult.meta,
      };
    }

    const fallbackResult = await readDashboardStockRowsFromMasterFallback();
    return {
      ...fallbackResult,
      failedReads: [...fallbackResult.failedReads, "stock_item_read_models_empty_fallback"],
      source: "master_stock_fallback",
    };
  } catch (error) {
    console.warn("Gagal memuat issue query stock_item_read_models Dashboard, fallback ke read model umum/master stock:", error);

    try {
      const fullReadResult = await readDashboardStockRowsFromReadModel({ maxResults });

      if (fullReadResult.rows.length > 0) {
        return {
          rows: fullReadResult.rows,
          failedReads: ["stock_item_read_models_issue_query_fallback"],
          source: "stock_item_read_models_full_fallback",
          meta: fullReadResult.meta,
        };
      }
    } catch (fallbackError) {
      console.warn("Gagal memuat stock_item_read_models Dashboard, fallback ke master stock:", fallbackError);
    }

    const fallbackResult = await readDashboardStockRowsFromMasterFallback();
    return {
      ...fallbackResult,
      failedReads: [...fallbackResult.failedReads, "stock_item_read_models_fallback"],
      source: "master_stock_fallback",
    };
  }
};

const fetchPurchaseRecordsForRestockRows = async (lowStockRows = [], { maxItems = 5 } = {}) => {
  const materialIds = [...new Set(
    lowStockRows
      .filter((item) => item.sourceType === "material")
      .filter((item) => !hasRestockReadModelMetadata(item))
      .map((item) => String(item.id || "").trim())
      .filter(Boolean),
  )].slice(0, maxItems);

  if (!materialIds.length) return [];

  const purchaseRecordsQuery = query(
    collection(db, "purchases"),
    where("itemId", "in", materialIds),
  );

  const purchaseRecordsSnapshot = await getDocs(purchaseRecordsQuery);

  return purchaseRecordsSnapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));
};

// =====================================================
// SECTION: Dashboard final read model — AKTIF / READ-ONLY
// Fungsi:
// - mengembalikan dashboardData final yang siap dirender page;
// - memusatkan query orchestration + mapper Dashboard di service agar page tidak memanggil helper data satu per satu.
// Hubungan flow:
// - tetap read-only, tidak membuat transaksi, tidak melakukan auto-repair, dan tidak mengubah stok/kas/produksi.
// Risiko:
// - jika perlu read model baru berbasis collection summary, buat batch schema terpisah.
// =====================================================
export const readDashboardData = async ({ maxListItems = 5 } = {}) => {
  const { dataByKey, failedReads, planningSummary } = await readDashboardSnapshotData({
    maxListItems,
  });

  const dashboardFailedReads = [...failedReads];
  const stockReadResult = await readDashboardStockRows({
    maxResults: Math.max(maxListItems * 200, 1000),
    maxIssueResults: Math.max(maxListItems * 20, 50),
  });
  dashboardFailedReads.push(...stockReadResult.failedReads);

  const stockRows = stockReadResult.rows || [];
  const stockIssueMeta = stockReadResult.meta || {};
  const lowStockRows = stockRows
    .filter((item) => item.status !== "Normal")
    .sort((left, right) => Number(left.sortGap || 0) - Number(right.sortGap || 0));
  const stockAuditRows = stockRows
    .map((item) => ({
      ...item,
      isNegativeStock: item.isNegativeStock === true || item.availableStock < 0 || item.currentStock < 0 || item.sourceStock < 0,
      isReservedOverrun: item.isReservedOverrun === true || (item.reservedStock > 0 && (
        item.reservedStock > Math.max(item.currentStock, 0) || item.availableStock < 0
      )),
    }))
    .filter((item) => item.isNegativeStock || item.isReservedOverrun);

  let purchaseRecords = [];
  try {
    purchaseRecords = await fetchPurchaseRecordsForRestockRows(
      lowStockRows.slice(0, maxListItems),
      { maxItems: maxListItems },
    );
  } catch (error) {
    console.warn("Gagal memuat lookup purchase Restock Assistant:", error);
    dashboardFailedReads.push("purchases_restock_lookup");
  }

  const criticalStockPreview = buildRestockAssistantRows(
    lowStockRows.slice(0, maxListItems),
    purchaseRecords,
  );

  return {
    dashboardData: {
      lowStockRows,
      criticalStockPreview,
      stockAuditRows,
      stockReadModelSource: stockReadResult.source,
      stockIssueMeta: {
        ...(stockIssueMeta || {}),
        loadedRows: stockIssueMeta.loadedRows ?? lowStockRows.length,
        hasMore: Boolean(stockIssueMeta.hasMore || stockIssueMeta.isLimited),
      },
      recentActivities: dataByKey.inventory_logs || [],
      productionOrders: dataByKey.production_orders_focus || [],
      workLogs: mergeDashboardRowsById(
        dataByKey.production_work_logs_running || [],
        dataByKey.production_work_logs_week || [],
      ),
      payrolls: mergeDashboardRowsById(
        dataByKey.production_payrolls_pending || [],
        dataByKey.production_payrolls_month || [],
      ),
      expenses: dataByKey.expenses || [],
      incomes: (dataByKey.incomes || []).map((item) => ({
        ...item,
        sourceCollection: "incomes",
      })),
      revenues: (dataByKey.revenues || []).map((item) => ({
        ...item,
        sourceCollection: "revenues",
      })),
      sales: dataByKey.sales || [],
      planningSummary: normalizePlanningDashboardSummary(planningSummary),
    },
    failedReads: dashboardFailedReads,
  };
};
