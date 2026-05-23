import { collection, getDocs, limit, orderBy, query, Timestamp, where } from "firebase/firestore";
import { db } from "../../firebase";
import { getProductionPlanningDashboardSummary } from "../Produksi/productionPlanningService";
import {
  formatAffectedVariantStockSummary,
  getLowStockVariantEntries,
} from "../../utils/stock/stockHelpers";

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

const getItemDisplayName = (item = {}) =>
  item?.name || item?.productName || item?.materialName || "-";

const getItemStock = (item = {}) =>
  getNumericValue(item?.availableStock ?? item?.currentStock ?? item?.stock ?? 0);

const getItemMinStock = (item = {}, sourceType = "") => {
  if (sourceType === "material") return getNumericValue(item?.minStock ?? 0);
  if (sourceType === "product" || sourceType === "semi_finished") {
    return getNumericValue(item?.minStockAlert ?? 0);
  }

  return getNumericValue(item?.minStockAlert ?? item?.minStock ?? 0);
};

const isStockMonitoringActiveItem = (item = {}) => item?.isActive !== false;

const getItemCurrentStock = (item = {}) =>
  getNumericValue(item?.currentStock ?? item?.stock ?? 0);

const getItemReservedStock = (item = {}) =>
  getNumericValue(item?.reservedStock ?? 0);

const getLowStockSeverity = (item = {}, sourceType = "") => {
  const stock = getItemStock(item);
  const minStock = getItemMinStock(item, sourceType);
  const affectedVariants = getLowStockVariantEntries(item, {
    sourceType,
    threshold: minStock,
    unit: item?.stockUnit || item?.unit || "pcs",
  });

  if (affectedVariants.some((variant) => variant.status === "empty")) return { label: "Kosong", color: "red" };
  if (affectedVariants.length > 0) return { label: "Menipis", color: "gold" };
  if (stock <= 0) return { label: "Kosong", color: "red" };
  if (minStock > 0 && stock <= minStock) return { label: "Menipis", color: "gold" };
  return { label: "Aman", color: "green" };
};

const buildLowStockRows = (products = [], materials = [], semiFinishedMaterials = []) => {
  const activeProducts = products.filter(isStockMonitoringActiveItem);
  const activeMaterials = materials.filter(isStockMonitoringActiveItem);
  const activeSemiFinishedMaterials = semiFinishedMaterials.filter(isStockMonitoringActiveItem);

  const buildRow = (item, sourceType, type, to, unit) => {
    const stock = getItemStock(item);
    const minStock = getItemMinStock(item, sourceType);
    const affectedVariants = getLowStockVariantEntries(item, {
      sourceType,
      threshold: minStock,
      unit,
    });
    const variantGap = affectedVariants.length
      ? Math.min(...affectedVariants.map((variant) => variant.stock - Math.max(variant.threshold, 0)))
      : null;

    return {
      key: `${sourceType}-${item.id}`,
      id: item.id,
      name: getItemDisplayName(item),
      stock,
      minStock,
      unit,
      type,
      sourceType,
      severity: getLowStockSeverity(item, sourceType),
      affectedVariantSummary: formatAffectedVariantStockSummary(item, {
        sourceType,
        threshold: minStock,
        unit,
        maxItems: 2,
      }),
      sortGap: variantGap ?? stock - Math.max(minStock, 0),
      to,
      snapshot: item,
    };
  };

  const rows = [
    ...activeProducts.map((item) => buildRow(item, "product", "Produk Jadi", "/stock-management", item?.unit || "pcs")),
    ...activeMaterials.map((item) => buildRow(item, "material", "Bahan Baku", "/stock-management", item?.stockUnit || item?.unit || "pcs")),
    ...activeSemiFinishedMaterials.map((item) => buildRow(item, "semi_finished", "Semi Finished", "/produksi/semi-finished-materials", item?.unit || "pcs")),
  ].filter((item) => item.affectedVariantSummary || item.stock <= 0 || (item.minStock > 0 && item.stock <= item.minStock));

  return rows.sort((left, right) => left.sortGap - right.sortGap);
};

const buildStockAuditRows = (products = [], materials = [], semiFinishedMaterials = []) => {
  const mapRows = (items = [], type = "Item", sourceType = "item", to = "/stock-management") =>
    items.map((item) => {
      const stock = getItemStock(item);
      const currentStock = getItemCurrentStock(item);
      const reservedStock = getItemReservedStock(item);

      return {
        key: `${sourceType}-${item.id}`,
        id: item.id,
        name: getItemDisplayName(item),
        type,
        sourceType,
        unit: item?.stockUnit || item?.unit || "pcs",
        stock,
        currentStock,
        reservedStock,
        minStock: getItemMinStock(item, sourceType),
        to,
        isNegativeStock: stock < 0 || currentStock < 0,
        isReservedOverrun: reservedStock > 0 && (reservedStock > Math.max(currentStock, 0) || stock < 0),
      };
    });

  return [
    ...mapRows(products, "Produk Jadi", "product", "/stock-management"),
    ...mapRows(materials, "Bahan Baku", "material", "/stock-management"),
    ...mapRows(semiFinishedMaterials, "Semi Finished", "semi_finished", "/produksi/semi-finished-materials"),
  ].filter((item) => item.isNegativeStock || item.isReservedOverrun);
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

const buildRestockAssistantRows = (lowStockRows = [], purchases = []) => (
  lowStockRows.map((item) => {
    if (item.sourceType !== "material") return item;

    const latestPurchase = getLatestPurchaseForMaterial(purchases, item.id);
    const supplierId = String(
      latestPurchase?.supplierId ||
        latestPurchase?.supplierRefId ||
        latestPurchase?.supplierReferenceId ||
        item.snapshot?.supplierId ||
        "",
    ).trim();
    const supplierName = String(
      latestPurchase?.supplierName ||
        latestPurchase?.supplierLabel ||
        latestPurchase?.supplierStoreName ||
        item.snapshot?.supplierName ||
        "",
    ).trim();
    const productLink = getPurchaseProductLink(latestPurchase);

    return {
      ...item,
      latestPurchase,
      restockSupplierId: supplierId,
      restockSupplierName: supplierName,
      restockProductLink: productLink,
      lastPurchasePrice: getPurchaseLastUnitPrice(latestPurchase),
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
// - hanya membaca stock master, inventory logs, produksi, payroll, finance, sales, dan planning summary;
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
    readDashboardSnapshot("products", getDocs(collection(db, "products"))),
    readDashboardSnapshot("raw_materials", getDocs(collection(db, "raw_materials"))),
    readDashboardSnapshot("semi_finished_materials", getDocs(collection(db, "semi_finished_materials"))),
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

const fetchPurchaseRecordsForRestockRows = async (lowStockRows = [], { maxItems = 5 } = {}) => {
  const materialIds = [...new Set(
    lowStockRows
      .filter((item) => item.sourceType === "material")
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

  const products = dataByKey.products || [];
  const materials = dataByKey.raw_materials || [];
  const semiFinishedMaterials = dataByKey.semi_finished_materials || [];
  const lowStockRows = buildLowStockRows(products, materials, semiFinishedMaterials);
  const stockAuditRows = buildStockAuditRows(products, materials, semiFinishedMaterials);
  const dashboardFailedReads = [...failedReads];

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
