import { getImsLocalDb } from "../local/imsLocalDb";
import {
  LOCAL_DB_TABLES,
  LOCAL_SYNC_STATUSES,
} from "../local/localDbSchema";
import { setLocalDbMeta } from "../local/localDbMeta";
import { readDashboardData } from "../../services/Dashboard/dashboardService";
import {
  fetchProfitLossReportData,
  fetchPurchasesReportData,
  fetchSalesReportData,
} from "../../services/Laporan/reportsService";
import { fetchStockReportData } from "../../services/Laporan/stockReportService";

export const FIREBASE_TO_LOCAL_REPORT_SNAPSHOT_CONFIRMATION =
  "PULL REPORT SNAPSHOT READ ONLY";

const REPORT_SNAPSHOT_META_KEY = "lastReportSnapshotPullAt";
const REPORT_SNAPSHOT_SCOPE = "report_finance_readonly_snapshot";
const REPORT_SNAPSHOT_PERIOD_KEY = "latest";
const MAX_REPORT_SNAPSHOT_ROWS = 1000;

const nowIso = () => new Date().toISOString();

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const safeString = (value) => String(value || "").trim();

const serializeForLocalSnapshot = (value) => {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeForLocalSnapshot);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        serializeForLocalSnapshot(nestedValue),
      ])
    );
  }
  return value;
};

const cloneForLocalSnapshot = (value) => serializeForLocalSnapshot(value);

const buildBaseSummary = (rows = []) => ({
  rowCount: rows.length,
  limited: rows.length >= MAX_REPORT_SNAPSHOT_ROWS,
  maxRows: MAX_REPORT_SNAPSHOT_ROWS,
});

const buildSalesSummary = (rows = []) => rows.reduce(
  (summary, row = {}) => {
    const total = Math.round(toSafeNumber(row.total));
    const status = safeString(row.status).toLowerCase();
    return {
      ...summary,
      totalRevenue: summary.totalRevenue + total,
      totalSalesCount: summary.totalSalesCount + 1,
      totalCompletedRevenue: status === "selesai" || status === "completed"
        ? summary.totalCompletedRevenue + total
        : summary.totalCompletedRevenue,
      totalCompletedCount: status === "selesai" || status === "completed"
        ? summary.totalCompletedCount + 1
        : summary.totalCompletedCount,
    };
  },
  {
    ...buildBaseSummary(rows),
    totalRevenue: 0,
    totalSalesCount: 0,
    totalCompletedRevenue: 0,
    totalCompletedCount: 0,
  },
);

const buildPurchasesSummary = (rows = []) => rows.reduce(
  (summary, row = {}) => ({
    ...summary,
    totalActual: summary.totalActual + Math.round(toSafeNumber(row.amount)),
    totalReference: summary.totalReference + Math.round(toSafeNumber(row.totalReferenceAmount)),
    totalSaving: summary.totalSaving + Math.round(toSafeNumber(row.savingAmount)),
    totalTransactions: summary.totalTransactions + 1,
  }),
  {
    ...buildBaseSummary(rows),
    totalActual: 0,
    totalReference: 0,
    totalSaving: 0,
    totalTransactions: 0,
  },
);

const buildFinanceSummary = (rows = []) => rows.reduce(
  (summary, row = {}) => {
    const amount = Math.round(toSafeNumber(row.amount));
    const flow = safeString(row.flow).toLowerCase();
    const sourceCollection = safeString(row.sourceCollection).toLowerCase();
    const isExpense = flow.includes("pengeluaran") || sourceCollection === "expenses";

    return {
      ...summary,
      totalRevenue: isExpense ? summary.totalRevenue : summary.totalRevenue + amount,
      totalCost: isExpense ? summary.totalCost + amount : summary.totalCost,
      netAmount: isExpense ? summary.netAmount - amount : summary.netAmount + amount,
      totalIncomeRows: isExpense ? summary.totalIncomeRows : summary.totalIncomeRows + 1,
      totalExpenseRows: isExpense ? summary.totalExpenseRows + 1 : summary.totalExpenseRows,
    };
  },
  {
    ...buildBaseSummary(rows),
    totalRevenue: 0,
    totalCost: 0,
    netAmount: 0,
    totalIncomeRows: 0,
    totalExpenseRows: 0,
  },
);

const buildStockSummary = (inventory = []) => ({
  ...buildBaseSummary(inventory),
  totalItems: inventory.length,
  criticalStockItems: inventory.filter((item = {}) => item.reportStatus === "Kritis").length,
  lowStockItems: inventory.filter((item = {}) => item.reportStatus === "Menipis").length,
  negativeStockItems: inventory.filter((item = {}) => Number(item.currentStock || 0) < 0).length,
});

const buildDashboardSummary = (dashboardData = {}) => ({
  lowStockCount: dashboardData.lowStockRows?.length || 0,
  stockAuditCount: dashboardData.stockAuditRows?.length || 0,
  recentActivityCount: dashboardData.recentActivities?.length || 0,
  productionOrderCount: dashboardData.productionOrders?.length || 0,
  workLogCount: dashboardData.workLogs?.length || 0,
  payrollCount: dashboardData.payrolls?.length || 0,
  salesCount: dashboardData.sales?.length || 0,
  incomeRows: (dashboardData.incomes?.length || 0) + (dashboardData.revenues?.length || 0),
  expenseRows: dashboardData.expenses?.length || 0,
  planningSummary: dashboardData.planningSummary || null,
});

const limitRows = (rows = []) => rows.slice(0, MAX_REPORT_SNAPSHOT_ROWS);

const REPORT_SNAPSHOT_TYPES = Object.freeze({
  dashboard_summary: Object.freeze({
    label: "Dashboard Summary (read-only)",
    description: "Snapshot ringkasan Dashboard dari Firebase-primary service.",
    buildSnapshot: async () => {
      const { dashboardData, failedReads } = await readDashboardData({ maxListItems: 5 });
      return {
        summary: buildDashboardSummary(dashboardData || {}),
        payload: { dashboardData, failedReads },
        rowCount: 1,
        failedReads: failedReads || [],
      };
    },
  }),
  stock_report: Object.freeze({
    label: "Stock Report Snapshot (read-only)",
    description: "Snapshot laporan stok dari stock read model Firebase-primary.",
    buildSnapshot: async () => {
      const data = await fetchStockReportData({ maxResults: MAX_REPORT_SNAPSHOT_ROWS });
      const inventory = limitRows(data.inventory || []);
      return {
        summary: {
          ...buildStockSummary(inventory),
          dataSource: data.dataSource || "stock_report_service",
          failedReads: data.failedReads || [],
          reportMeta: data.reportMeta || null,
        },
        payload: { ...data, inventory },
        rowCount: inventory.length,
        failedReads: data.failedReads || [],
      };
    },
  }),
  sales_report: Object.freeze({
    label: "Sales Report Snapshot (read-only)",
    description: "Snapshot laporan sales dari Firebase-primary service.",
    buildSnapshot: async () => {
      const rows = limitRows(await fetchSalesReportData());
      return {
        summary: buildSalesSummary(rows),
        payload: { rows },
        rowCount: rows.length,
        failedReads: [],
      };
    },
  }),
  purchases_report: Object.freeze({
    label: "Purchases Report Snapshot (read-only)",
    description: "Snapshot laporan pembelian dari expense purchase Firebase-primary service.",
    buildSnapshot: async () => {
      const rows = limitRows(await fetchPurchasesReportData());
      return {
        summary: buildPurchasesSummary(rows),
        payload: { rows },
        rowCount: rows.length,
        failedReads: [],
      };
    },
  }),
  finance_summary: Object.freeze({
    label: "Finance Summary Snapshot (read-only)",
    description: "Snapshot ringkasan finance dari revenues/incomes/expenses Firebase-primary service.",
    buildSnapshot: async () => {
      const rows = limitRows(await fetchProfitLossReportData());
      return {
        summary: buildFinanceSummary(rows),
        payload: { rows },
        rowCount: rows.length,
        failedReads: [],
      };
    },
  }),
});

const normalizeReportSnapshotType = (snapshotType = "dashboard_summary") => {
  if (REPORT_SNAPSHOT_TYPES[snapshotType]) return snapshotType;
  throw new Error(
    `Snapshot ${snapshotType || "kosong"} belum diizinkan untuk Report/Finance Snapshot. Snapshot ini hanya read-only dan tidak masuk sync queue.`,
  );
};

const buildSnapshotRecord = async ({ snapshotType, timestamp }) => {
  const normalizedType = normalizeReportSnapshotType(snapshotType);
  const config = REPORT_SNAPSHOT_TYPES[normalizedType];
  const built = await config.buildSnapshot();
  const safeSummary = cloneForLocalSnapshot(built.summary || {});
  const safePayload = cloneForLocalSnapshot(built.payload || {});

  return {
    id: `report-snapshot-${normalizedType}`,
    snapshotType: normalizedType,
    snapshotLabel: config.label,
    periodKey: REPORT_SNAPSHOT_PERIOD_KEY,
    source: "firebase_primary_report_snapshot",
    sourceDescription: config.description,
    rowCount: built.rowCount ?? safeSummary.rowCount ?? 0,
    summary: safeSummary,
    payload: safePayload,
    failedReads: cloneForLocalSnapshot(built.failedReads || []),
    _deleted: false,
    syncStatus: LOCAL_SYNC_STATUSES.SYNCED,
    readOnlySnapshot: true,
    offlineMutationAllowed: false,
    updatedAt: timestamp,
    localUpdatedAt: timestamp,
    lastSyncedAt: timestamp,
    guardNotes:
      "Read-only report/finance snapshot. Dibangun dari Firebase-primary read service; tidak menghitung ulang ledger/profit-loss dari draft/local unsynced data.",
    syncMetadata: {
      scope: REPORT_SNAPSHOT_SCOPE,
      snapshotType: normalizedType,
      lastFirebasePullAt: timestamp,
      guarded: true,
    },
  };
};

export const getReportSnapshotCollections = () =>
  Object.entries(REPORT_SNAPSHOT_TYPES).map(([value, config]) => ({
    label: config.label,
    value,
    description: config.description,
  }));

export const getReportOfflineGuardContract = () => ({
  scope: REPORT_SNAPSHOT_SCOPE,
  tableName: LOCAL_DB_TABLES.REPORT_SNAPSHOTS,
  readOnly: true,
  offlineMutationAllowed: false,
  firebasePrimary: true,
  syncQueueAllowed: false,
  notes: [
    "Report/Finance Snapshot hanya hasil pull Firebase → Local.",
    "Tidak ada push Offline → Firebase untuk report/finance.",
    "Tidak menghitung ulang ledger/profit-loss dari draft/local unsynced data.",
    "Halaman report final tetap Firebase-primary; snapshot local hanya preview/offline reference.",
  ],
});

export const previewFirebaseToLocalReportSnapshot = async ({ snapshotType = "dashboard_summary" } = {}) => {
  const normalizedType = normalizeReportSnapshotType(snapshotType);
  const db = getImsLocalDb();
  const timestamp = nowIso();
  const snapshotRecord = await buildSnapshotRecord({ snapshotType: normalizedType, timestamp });
  const localRecord = await db.report_snapshots.get(snapshotRecord.id);
  const action = localRecord ? "refresh_snapshot" : "create_snapshot";

  return {
    mode: "firebase_to_local_report_snapshot_preview",
    snapshotType: normalizedType,
    tableName: LOCAL_DB_TABLES.REPORT_SNAPSHOTS,
    generatedAt: timestamp,
    readOnly: true,
    summary: {
      total: 1,
      canPull: 1,
      rowCount: snapshotRecord.rowCount,
      action,
    },
    rows: [{
      collectionName: LOCAL_DB_TABLES.REPORT_SNAPSHOTS,
      documentId: snapshotRecord.id,
      displayName: snapshotRecord.snapshotLabel,
      action,
      canPull: true,
      status: "ready",
      localRecord,
      remoteRecord: snapshotRecord,
      rowCount: snapshotRecord.rowCount,
      blockedReason: "Read-only snapshot; aman dipull karena tidak masuk sync_queue.",
    }],
  };
};

export const syncFirebaseReportSnapshotToLocal = async ({
  snapshotType = "dashboard_summary",
  confirmation = "",
} = {}) => {
  if (confirmation !== FIREBASE_TO_LOCAL_REPORT_SNAPSHOT_CONFIRMATION) {
    throw new Error(
      `Untuk pull Report/Finance Snapshot, isi confirmation: ${FIREBASE_TO_LOCAL_REPORT_SNAPSHOT_CONFIRMATION}`,
    );
  }

  const preview = await previewFirebaseToLocalReportSnapshot({ snapshotType });
  const row = preview.rows[0];
  const snapshotRecord = row.remoteRecord;
  const db = getImsLocalDb();

  await db.report_snapshots.put(snapshotRecord);
  await setLocalDbMeta(REPORT_SNAPSHOT_META_KEY, snapshotRecord.updatedAt);

  return {
    mode: "firebase_to_local_report_snapshot_result",
    snapshotType: preview.snapshotType,
    tableName: LOCAL_DB_TABLES.REPORT_SNAPSHOTS,
    pulled: 1,
    skipped: 0,
    summary: {
      total: 1,
      pulled: 1,
      skipped: 0,
      rowCount: snapshotRecord.rowCount,
    },
    rows: [{
      ...row,
      status: "pulled",
      canPull: true,
      pulledAt: snapshotRecord.updatedAt,
      remoteRecord: undefined,
      localRecord: snapshotRecord,
    }],
  };
};

export default syncFirebaseReportSnapshotToLocal;
