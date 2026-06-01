import { getImsLocalDb } from "../local/imsLocalDb";
import {
  LOCAL_DB_TABLES,
  LOCAL_SYNC_STATUSES,
} from "../local/localDbSchema";
import { setLocalDbMeta } from "../local/localDbMeta";
import { getAllProductionPlans } from "../../services/Produksi/productionPlanningService";
import { getAllProductionOrders } from "../../services/Produksi/productionOrdersService";
import {
  getAllProductionWorkLogs,
  getCompletedProductionWorkLogs,
} from "../../services/Produksi/productionWorkLogsService";
import { getAllProductionBoms } from "../../services/Produksi/productionBomsService";
import { getAllProductionPayrolls } from "../../services/Produksi/productionPayrollsService";
import { getAllProductionSteps } from "../../services/Produksi/productionStepsService";
import {
  isProductionPayrollLineFinal,
  isProductionPayrollLineHppIncluded,
  resolveWorkLogLaborCostDisplay,
} from "../../utils/produksi/productionPayrollRuleHelpers";

export const FIREBASE_TO_LOCAL_PRODUCTION_SNAPSHOT_CONFIRMATION =
  "PULL PRODUCTION SNAPSHOT READ ONLY";

const PRODUCTION_SNAPSHOT_META_KEY = "lastProductionSnapshotPullAt";
const PRODUCTION_SNAPSHOT_SCOPE = "production_readonly_snapshot";

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nowIso = () => new Date().toISOString();

const cloneRecord = (record = null) => JSON.parse(JSON.stringify(record || null));

const safeString = (value) => String(value || "").trim();

const getRecordTimestamp = (record = {}, fallback = nowIso()) =>
  record.updatedAt || record.completedAt || record.createdAt || fallback;

const isLocalRecordDirty = (record = null) => {
  if (!record) return false;
  return [
    LOCAL_SYNC_STATUSES.PENDING,
    LOCAL_SYNC_STATUSES.SYNCING,
    LOCAL_SYNC_STATUSES.CONFLICT,
    LOCAL_SYNC_STATUSES.FAILED,
  ].includes(record.syncStatus);
};

const getRelatedPayrollsForWorkLog = ({ workLog = {}, payrolls = [] } = {}) => {
  const workLogId = safeString(workLog.id);
  const workNumber = safeString(workLog.workNumber);

  return payrolls.filter((item) => (
    (workLogId && safeString(item.workLogId) === workLogId) ||
    (workNumber && safeString(item.workNumber) === workNumber)
  ));
};

const buildProductionHppSnapshots = async () => {
  const [workLogs, payrolls, productionSteps] = await Promise.all([
    getCompletedProductionWorkLogs(),
    getAllProductionPayrolls(),
    getAllProductionSteps(),
  ]);
  const steps = Array.isArray(productionSteps?.items) ? productionSteps.items : productionSteps;

  return (workLogs || []).map((workLog) => {
    const relatedPayrolls = getRelatedPayrollsForWorkLog({ workLog, payrolls });
    const productionStep = (steps || []).find((item) => item.id === workLog.stepId) || null;
    const laborDisplay = resolveWorkLogLaborCostDisplay({
      workLog,
      relatedPayrolls,
      productionStep,
    });
    const materialCost = toSafeNumber(workLog.materialCostActual);
    const overheadCost = toSafeNumber(workLog.overheadCostActual);
    const displayLaborCost = toSafeNumber(laborDisplay.displayAmount);
    const finalLaborCost = laborDisplay.isFinal ? toSafeNumber(laborDisplay.finalAmount || laborDisplay.amount) : 0;
    const laborExcludedFromHpp = laborDisplay.source === "step_excluded_from_hpp";
    const isFinalReady = Boolean(laborDisplay.isFinal || laborExcludedFromHpp);
    const goodQty = toSafeNumber(workLog.goodQty);
    const previewTotalCost = materialCost + displayLaborCost + overheadCost;
    const finalTotalCost = materialCost + finalLaborCost + overheadCost;
    const previewHppPerUnit = goodQty > 0 ? previewTotalCost / goodQty : 0;
    const finalHppPerUnit = isFinalReady && goodQty > 0 ? finalTotalCost / goodQty : 0;

    return {
      id: `hpp-${workLog.id}`,
      workLogId: workLog.id,
      workNumber: workLog.workNumber || workLog.id,
      productionOrderId: workLog.productionOrderId || "",
      productionOrderNumber: workLog.productionOrderNumber || workLog.orderNumber || "",
      targetType: workLog.targetType || "",
      targetItemId: workLog.targetItemId || "",
      targetItemName: workLog.targetItemName || workLog.productName || workLog.semiFinishedMaterialName || "",
      goodQty,
      materialCost,
      overheadCost,
      displayLaborCost,
      finalLaborCost,
      previewTotalCost,
      finalTotalCost: isFinalReady ? finalTotalCost : 0,
      previewHppPerUnit,
      finalHppPerUnit,
      isHppFinalReady: isFinalReady,
      costStatus: isFinalReady ? "final" : "preview",
      costStatusLabel: isFinalReady ? "Final" : (laborDisplay.totalStatusLabel || laborDisplay.statusLabel || "Preview"),
      laborSource: laborDisplay.source || "",
      laborHelper: laborDisplay.helper || "",
      relatedPayrollIds: relatedPayrolls.map((item) => item.id).filter(Boolean),
      hppIncludedPayrollIds: relatedPayrolls
        .filter(isProductionPayrollLineHppIncluded)
        .map((item) => item.id)
        .filter(Boolean),
      finalPayrollIds: relatedPayrolls
        .filter(isProductionPayrollLineFinal)
        .map((item) => item.id)
        .filter(Boolean),
      updatedAt: getRecordTimestamp(workLog),
      sourceWorkLogUpdatedAt: getRecordTimestamp(workLog),
      guardNotes:
        "Read-only HPP snapshot. HPP final hanya dari payroll confirmed/paid atau step yang tidak masuk HPP; draft/estimasi hanya preview.",
    };
  });
};

const PRODUCTION_SNAPSHOT_COLLECTIONS = Object.freeze({
  [LOCAL_DB_TABLES.PRODUCTION_PLANS]: Object.freeze({
    label: "Planning snapshot",
    tableName: LOCAL_DB_TABLES.PRODUCTION_PLANS,
    listRemote: getAllProductionPlans,
    getDisplayName: (record = {}) => record.title || record.planTitle || record.planCode || record.id || "-",
  }),
  [LOCAL_DB_TABLES.PRODUCTION_ORDERS]: Object.freeze({
    label: "Production Order snapshot",
    tableName: LOCAL_DB_TABLES.PRODUCTION_ORDERS,
    listRemote: getAllProductionOrders,
    getDisplayName: (record = {}) =>
      record.productionOrderNumber || record.orderNumber || record.code || record.id || "-",
  }),
  [LOCAL_DB_TABLES.PRODUCTION_WORK_LOGS]: Object.freeze({
    label: "Work Log snapshot",
    tableName: LOCAL_DB_TABLES.PRODUCTION_WORK_LOGS,
    listRemote: getAllProductionWorkLogs,
    getDisplayName: (record = {}) => record.workNumber || record.workLogNumber || record.id || "-",
  }),
  [LOCAL_DB_TABLES.PRODUCTION_BOMS]: Object.freeze({
    label: "BOM snapshot",
    tableName: LOCAL_DB_TABLES.PRODUCTION_BOMS,
    listRemote: getAllProductionBoms,
    getDisplayName: (record = {}) => record.name || record.bomName || record.code || record.id || "-",
  }),
  [LOCAL_DB_TABLES.PRODUCTION_PAYROLLS]: Object.freeze({
    label: "Payroll snapshot (read-only)",
    tableName: LOCAL_DB_TABLES.PRODUCTION_PAYROLLS,
    listRemote: getAllProductionPayrolls,
    getDisplayName: (record = {}) => record.payrollNumber || record.workerName || record.id || "-",
  }),
  [LOCAL_DB_TABLES.PRODUCTION_HPP_SNAPSHOTS]: Object.freeze({
    label: "HPP snapshot (derived read-only)",
    tableName: LOCAL_DB_TABLES.PRODUCTION_HPP_SNAPSHOTS,
    listRemote: buildProductionHppSnapshots,
    getDisplayName: (record = {}) => record.workNumber || record.targetItemName || record.id || "-",
  }),
});

const normalizeProductionSnapshotCollectionName = (
  collectionName = LOCAL_DB_TABLES.PRODUCTION_PLANS,
) => {
  if (PRODUCTION_SNAPSHOT_COLLECTIONS[collectionName]) return collectionName;
  throw new Error(
    `Collection ${collectionName || "kosong"} belum diizinkan untuk Production Snapshot. Snapshot produksi hanya read-only dan tidak masuk sync queue.`,
  );
};

const normalizeRemoteForLocal = ({ remoteRecord = {}, collectionName, timestamp }) => {
  const cloned = cloneRecord(remoteRecord) || {};
  const updatedAt = getRecordTimestamp(cloned, timestamp);

  return {
    ...cloned,
    id: cloned.id,
    _deleted: false,
    syncStatus: LOCAL_SYNC_STATUSES.SYNCED,
    source: "firebase_production_snapshot",
    readOnlySnapshot: true,
    offlineMutationAllowed: false,
    lastSyncedAt: timestamp,
    remoteUpdatedAt: updatedAt,
    updatedAt,
    localUpdatedAt: timestamp,
    syncMetadata: {
      ...(cloned.syncMetadata || {}),
      lastFirebasePullAt: timestamp,
      scope: PRODUCTION_SNAPSHOT_SCOPE,
      collectionName,
      guarded: true,
    },
  };
};

const buildPreviewRows = async ({ collectionName }) => {
  const normalizedCollection = normalizeProductionSnapshotCollectionName(collectionName);
  const config = PRODUCTION_SNAPSHOT_COLLECTIONS[normalizedCollection];
  const db = getImsLocalDb();
  const table = db.table(config.tableName);
  const remoteRows = await config.listRemote();
  const timestamp = nowIso();

  const rows = [];
  for (const remoteRecord of remoteRows || []) {
    const documentId = remoteRecord?.id;
    if (!documentId) {
      rows.push({
        collectionName: normalizedCollection,
        documentId: "-",
        displayName: config.getDisplayName(remoteRecord),
        action: "skip",
        canPull: false,
        blockedReason: "Record snapshot tidak memiliki ID stabil.",
        remoteRecord,
        localRecord: null,
      });
      continue;
    }

    const localRecord = await table.get(documentId);
    const dirtyLocal = isLocalRecordDirty(localRecord);
    const action = !localRecord ? "create_snapshot" : dirtyLocal ? "skip_dirty_local" : "refresh_snapshot";

    rows.push({
      collectionName: normalizedCollection,
      documentId,
      displayName: config.getDisplayName(remoteRecord),
      action,
      canPull: !dirtyLocal,
      blockedReason: dirtyLocal
        ? "Local snapshot terlihat punya status pending/conflict. Review manual sebelum pull ulang agar tidak menutup data dev."
        : "",
      remoteRecord: normalizeRemoteForLocal({
        remoteRecord,
        collectionName: normalizedCollection,
        timestamp,
      }),
      localRecord: localRecord || null,
      localSyncStatus: localRecord?.syncStatus || "missing",
      remoteUpdatedAt: remoteRecord?.updatedAt || "",
    });
  }

  return rows;
};

const summarizeRows = (rows = []) => rows.reduce(
  (summary, row) => {
    summary.total += 1;
    if (row.canPull) summary.pullable += 1;
    if (!row.canPull) summary.blocked += 1;
    summary.byAction[row.action] = (summary.byAction[row.action] || 0) + 1;
    return summary;
  },
  { total: 0, pullable: 0, blocked: 0, byAction: {} },
);

export const getProductionSnapshotCollections = () =>
  Object.entries(PRODUCTION_SNAPSHOT_COLLECTIONS).map(([value, config]) => ({
    value,
    label: config.label,
  }));

export const getProductionOfflineGuardContract = () => ({
  sourceOfTruth: "Firebase primary",
  localScope: "read-only production snapshots",
  allowedSnapshots: Object.keys(PRODUCTION_SNAPSHOT_COLLECTIONS),
  blockedOfflineActions: [
    "start_production",
    "finish_production",
    "consume_raw_material",
    "create_payroll",
    "finalize_hpp",
    "stock_mutation",
    "cash_out_payroll",
  ],
});

export const previewFirebaseToLocalProductionSnapshot = async ({
  collectionName = LOCAL_DB_TABLES.PRODUCTION_PLANS,
  limit = 100,
} = {}) => {
  const normalizedCollection = normalizeProductionSnapshotCollectionName(collectionName);
  const rows = await buildPreviewRows({ collectionName: normalizedCollection });
  const limitedRows = rows.slice(0, limit);

  return {
    mode: "firebase_to_local_production_snapshot_preview",
    collectionName: normalizedCollection,
    confirmation: FIREBASE_TO_LOCAL_PRODUCTION_SNAPSHOT_CONFIRMATION,
    guard: getProductionOfflineGuardContract(),
    rows: limitedRows,
    summary: summarizeRows(rows),
    displayedRows: limitedRows.length,
  };
};

const writeProductionSnapshotAuditLog = async ({ collectionName, summary, timestamp }) => {
  const db = getImsLocalDb();
  await db.table(LOCAL_DB_TABLES.AUDIT_LOGS).put({
    id: `production-snapshot-${collectionName}-${Date.now()}`,
    module: "local_db_production_snapshot",
    action: "firebase_to_local_readonly_snapshot_pull",
    referenceId: collectionName,
    createdAt: timestamp,
    metadata: {
      scope: PRODUCTION_SNAPSHOT_SCOPE,
      collectionName,
      summary,
      blockedOfflineActions: getProductionOfflineGuardContract().blockedOfflineActions,
    },
  });
};

export const syncFirebaseProductionSnapshotToLocal = async ({
  collectionName = LOCAL_DB_TABLES.PRODUCTION_PLANS,
  confirmation = "",
  limit = 250,
} = {}) => {
  if (confirmation !== FIREBASE_TO_LOCAL_PRODUCTION_SNAPSHOT_CONFIRMATION) {
    throw new Error(
      `Untuk ambil Production Snapshot read-only, isi confirmation: ${FIREBASE_TO_LOCAL_PRODUCTION_SNAPSHOT_CONFIRMATION}`,
    );
  }

  const normalizedCollection = normalizeProductionSnapshotCollectionName(collectionName);
  const preview = await previewFirebaseToLocalProductionSnapshot({
    collectionName: normalizedCollection,
    limit,
  });
  const timestamp = nowIso();
  const db = getImsLocalDb();
  const table = db.table(normalizedCollection);
  const rowsToPull = preview.rows.filter((row) => row.canPull);

  await db.transaction("rw", table, db.table(LOCAL_DB_TABLES.AUDIT_LOGS), db.table(LOCAL_DB_TABLES.APP_META), async () => {
    for (const row of rowsToPull) {
      await table.put({
        ...row.remoteRecord,
        lastSyncedAt: timestamp,
        localUpdatedAt: timestamp,
      });
    }

    const summary = {
      ...preview.summary,
      pulled: rowsToPull.length,
      skipped: preview.summary.total - rowsToPull.length,
    };
    await writeProductionSnapshotAuditLog({ collectionName: normalizedCollection, summary, timestamp });
    await setLocalDbMeta(PRODUCTION_SNAPSHOT_META_KEY, timestamp);
  });

  return {
    collectionName: normalizedCollection,
    pulled: rowsToPull.length,
    skipped: preview.summary.total - rowsToPull.length,
    summary: {
      ...preview.summary,
      pulled: rowsToPull.length,
      skipped: preview.summary.total - rowsToPull.length,
    },
    rows: preview.rows.map((row) => ({
      collectionName: row.collectionName,
      documentId: row.documentId,
      displayName: row.displayName,
      action: row.action,
      status: row.canPull ? "pulled" : "skipped",
      blockedReason: row.blockedReason,
    })),
  };
};
