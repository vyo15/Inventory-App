import { getImsLocalDb } from "./imsLocalDb";
import {
  LOCAL_DB_BACKUP_TABLE_ALLOWLIST,
  LOCAL_DB_PRODUCTION_SNAPSHOT_TABLES,
  LOCAL_DB_REPORT_SNAPSHOT_TABLES,
  LOCAL_DB_READONLY_SNAPSHOT_TABLES,
  LOCAL_DB_TABLES,
  LOCAL_SYNC_COLLECTIONS,
  LOCAL_SYNC_OPERATIONS,
  LOCAL_SYNC_STATUSES,
} from "./localDbSchema";
import { findSensitiveLocalDbFieldPaths } from "./localDbSecurityPolicy";

const MAX_PENDING_AGE_HOURS = 24;
const MAX_SYNCING_AGE_MINUTES = 15;

const ISSUE_SEVERITY = Object.freeze({
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
});

const DIRTY_LOCAL_STATUSES = Object.freeze([
  LOCAL_SYNC_STATUSES.PENDING,
  LOCAL_SYNC_STATUSES.SYNCING,
  LOCAL_SYNC_STATUSES.FAILED,
  LOCAL_SYNC_STATUSES.CONFLICT,
]);

const nowTime = () => Date.now();

const normalizeText = (value = "") => String(value || "").trim();
const normalizeKey = (value = "") => normalizeText(value).toUpperCase();

const getRecordCode = (record = {}) =>
  normalizeKey(record.code || record.customerCode || record.categoryCode || record.id);

const toDateTime = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

const getAgeHours = (value) => {
  const timestamp = toDateTime(value);
  if (!timestamp) return null;
  return (nowTime() - timestamp) / (1000 * 60 * 60);
};

const createIssueId = ({ type, collectionName = "local_db", referenceId = "-" }) =>
  `${type}:${collectionName}:${referenceId}`;

const buildIssue = ({
  severity = ISSUE_SEVERITY.INFO,
  type,
  collectionName = "local_db",
  referenceId = "-",
  title,
  description,
  action = "Review manual dari Offline Database Center.",
} = {}) => ({
  id: createIssueId({ type, collectionName, referenceId }),
  severity,
  type,
  collectionName,
  referenceId,
  title,
  description,
  action,
});

const buildSummary = ({ issues = [], tableCounts = {}, queueRows = [], conflictRows = [] } = {}) => {
  const summary = {
    totalIssues: issues.length,
    errors: 0,
    warnings: 0,
    info: 0,
    tableCounts,
    queueTotal: queueRows.length,
    unresolvedConflicts: conflictRows.filter((row) => !row?.resolvedAt).length,
    readOnlySnapshotTables: LOCAL_DB_READONLY_SNAPSHOT_TABLES.length,
    productionSnapshotTables: LOCAL_DB_PRODUCTION_SNAPSHOT_TABLES.length,
    reportSnapshotTables: LOCAL_DB_REPORT_SNAPSHOT_TABLES.length,
    ready: issues.every((issue) => issue.severity !== ISSUE_SEVERITY.ERROR),
  };

  issues.forEach((issue) => {
    if (issue.severity === ISSUE_SEVERITY.ERROR) summary.errors += 1;
    else if (issue.severity === ISSUE_SEVERITY.WARNING) summary.warnings += 1;
    else summary.info += 1;
  });

  return summary;
};

const isSnapshotTable = (collectionName) =>
  LOCAL_DB_READONLY_SNAPSHOT_TABLES.includes(collectionName) ||
  LOCAL_DB_PRODUCTION_SNAPSHOT_TABLES.includes(collectionName) ||
  LOCAL_DB_REPORT_SNAPSHOT_TABLES.includes(collectionName);

const addSnapshotEmptyIssues = ({ issues, tableCounts }) => {
  [LOCAL_DB_TABLES.CATEGORIES, LOCAL_DB_TABLES.CUSTOMERS].forEach((collectionName) => {
    if (Number(tableCounts[collectionName] || 0) === 0) {
      issues.push(buildIssue({
        severity: ISSUE_SEVERITY.INFO,
        type: "empty_local_write_pilot_table",
        collectionName,
        title: "Data write pilot local masih kosong",
        description:
          "Jika Offline Mode aktif, halaman master data bisa terlihat kosong sampai Firebase → Offline dijalankan.",
        action: "Jalankan Preview dan Sync Firebase → Offline untuk collection ini sebelum kerja offline.",
      }));
    }
  });

  [
    ...LOCAL_DB_READONLY_SNAPSHOT_TABLES,
    ...LOCAL_DB_PRODUCTION_SNAPSHOT_TABLES,
    ...LOCAL_DB_REPORT_SNAPSHOT_TABLES,
  ].forEach((collectionName) => {
    if (Number(tableCounts[collectionName] || 0) === 0) {
      issues.push(buildIssue({
        severity: ISSUE_SEVERITY.INFO,
        type: "empty_readonly_snapshot_table",
        collectionName,
        title: "Snapshot read-only masih kosong",
        description:
          "Table snapshot ini belum berisi data local. Ini aman, tetapi data tidak tersedia saat offline sampai dipull manual.",
        action: "Pull snapshot dari Firebase jika data ini perlu dibaca saat offline.",
      }));
    }
  });
};

const addRecordStatusIssues = ({ issues, rowsByCollection }) => {
  const validStatuses = Object.values(LOCAL_SYNC_STATUSES);

  Object.entries(rowsByCollection).forEach(([collectionName, rows]) => {
    rows.forEach((row = {}) => {
      if (row.syncStatus && !validStatuses.includes(row.syncStatus)) {
        issues.push(buildIssue({
          severity: ISSUE_SEVERITY.WARNING,
          type: "invalid_local_sync_status",
          collectionName,
          referenceId: row.id,
          title: "syncStatus local tidak valid",
          description: `Record local memiliki syncStatus '${row.syncStatus}' yang tidak dikenal oleh offline pilot.`,
          action: "Review record local atau restore dari backup yang valid sebelum sync.",
        }));
      }

      if (row._deleted && !row.deletedAt) {
        issues.push(buildIssue({
          severity: ISSUE_SEVERITY.WARNING,
          type: "invalid_tombstone",
          collectionName,
          referenceId: row.id,
          title: "Tombstone local tidak lengkap",
          description: "Record sudah ditandai _deleted tetapi tidak memiliki deletedAt.",
          action: "Review record tombstone sebelum mencoba sync atau restore data local.",
        }));
      }

      if (isSnapshotTable(collectionName)) {
        if (DIRTY_LOCAL_STATUSES.includes(row.syncStatus)) {
          issues.push(buildIssue({
            severity: ISSUE_SEVERITY.ERROR,
            type: "readonly_snapshot_dirty_status",
            collectionName,
            referenceId: row.id,
            title: "Snapshot read-only memiliki status mutation",
            description:
              "Table snapshot read-only tidak boleh punya status pending/syncing/failed/conflict karena tidak boleh dipush ke Firebase.",
            action: "Pull ulang snapshot dari Firebase atau restore backup local DB yang valid.",
          }));
        }

        if (row.offlineMutationAllowed === true) {
          issues.push(buildIssue({
            severity: ISSUE_SEVERITY.ERROR,
            type: "readonly_snapshot_mutation_allowed",
            collectionName,
            referenceId: row.id,
            title: "Snapshot read-only membuka offline mutation",
            description:
              "Record snapshot memiliki offlineMutationAllowed=true. Ini melanggar kontrak supplier/product/raw/semi/stock/production/report/finance read-only.",
            action: "Pull ulang snapshot dari Firebase. Jangan push record ini ke Firebase.",
          }));
        }

        if (row.readOnlySnapshot !== true) {
          issues.push(buildIssue({
            severity: ISSUE_SEVERITY.WARNING,
            type: "readonly_snapshot_flag_missing",
            collectionName,
            referenceId: row.id,
            title: "Flag readOnlySnapshot tidak sesuai",
            description:
              "Record snapshot tidak memiliki flag readOnlySnapshot=true. Data tetap tidak boleh dipush, tetapi metadata perlu dicek.",
            action: "Pull ulang snapshot dari Firebase agar metadata snapshot konsisten.",
          }));
        }
      }
    });
  });
};

const addDuplicateCustomerCodeIssues = ({ issues, customerRows = [] }) => {
  const codeMap = new Map();

  customerRows
    .filter((row) => !row?._deleted)
    .forEach((row = {}) => {
      const code = getRecordCode(row);
      if (!code) return;
      const existing = codeMap.get(code) || [];
      existing.push(row);
      codeMap.set(code, existing);
    });

  codeMap.forEach((rows, code) => {
    if (rows.length <= 1) return;
    issues.push(buildIssue({
      severity: ISSUE_SEVERITY.ERROR,
      type: "duplicate_customer_code",
      collectionName: LOCAL_DB_TABLES.CUSTOMERS,
      referenceId: code,
      title: "Kode customer local duplikat",
      description: `Ditemukan ${rows.length} customer aktif dengan kode ${code}. Ini bisa membuat sync atau pilihan customer membingungkan.`,
      action: "Ubah salah satu customer local atau restore dari backup sebelum sync Offline → Firebase.",
    }));
  });
};


const addSensitiveFieldIssues = ({ issues, rowsByCollection }) => {
  Object.entries(rowsByCollection).forEach(([collectionName, rows = []]) => {
    rows.forEach((row = {}) => {
      const sensitivePaths = findSensitiveLocalDbFieldPaths(row);
      if (!sensitivePaths.length) return;

      issues.push(buildIssue({
        severity: ISSUE_SEVERITY.ERROR,
        type: "local_sensitive_field_detected",
        collectionName,
        referenceId: row.id || row.key || row.uid || "-",
        title: "Field sensitif terdeteksi di Offline DB",
        description: `Record local mengandung field yang terlihat seperti credential/secret: ${sensitivePaths.slice(0, 5).join(", ")}.`,
        action: "Jangan export/sync data ini. Hapus field sensitif dari source data atau restore backup bersih sebelum melanjutkan.",
      }));
    });
  });
};

const addQueueIssues = ({ issues, queueRows = [], rowsByCollection }) => {
  const validOperations = Object.values(LOCAL_SYNC_OPERATIONS);
  const validStatuses = Object.values(LOCAL_SYNC_STATUSES);

  queueRows.forEach((queueItem = {}) => {
    const collectionName = queueItem.collectionName || "-";
    const referenceId = queueItem.documentId || queueItem.id || "-";
    const recordRows = rowsByCollection[collectionName] || [];
    const localRecord = queueItem.documentId
      ? recordRows.find((row) => String(row.id) === String(queueItem.documentId))
      : null;
    const ageHours = getAgeHours(queueItem.localUpdatedAt || queueItem.updatedAt || queueItem.createdAt);

    if (!LOCAL_SYNC_COLLECTIONS.includes(collectionName)) {
      issues.push(buildIssue({
        severity: ISSUE_SEVERITY.ERROR,
        type: "queue_collection_not_allowed",
        collectionName,
        referenceId,
        title: "Queue masuk collection di luar allowlist",
        description:
          "Sync queue hanya boleh untuk categories/customers. Supplier/Product/Raw/Semi/Stock/Production/Finance/Report harus read-only atau Firebase-primary.",
        action: "Jangan push queue ini. Review sumber pembuat queue dan hapus/restore local DB jika queue dibuat dari patch lama.",
      }));
    }

    if (!queueItem.documentId) {
      issues.push(buildIssue({
        severity: ISSUE_SEVERITY.ERROR,
        type: "queue_missing_document_id",
        collectionName,
        referenceId: queueItem.id || "-",
        title: "Queue tidak punya documentId",
        description: "sync_queue tanpa documentId tidak bisa dipetakan ke record Firebase/local.",
        action: "Review queue item dan jangan sync sebelum documentId jelas.",
      }));
    }

    if (!validOperations.includes(queueItem.operation)) {
      issues.push(buildIssue({
        severity: ISSUE_SEVERITY.ERROR,
        type: "queue_invalid_operation",
        collectionName,
        referenceId,
        title: "Operation queue tidak valid",
        description: `Operation '${queueItem.operation || "kosong"}' tidak dikenal oleh offline pilot.`,
        action: "Review queue item atau restore backup local DB yang valid.",
      }));
    }

    if (!validStatuses.includes(queueItem.syncStatus)) {
      issues.push(buildIssue({
        severity: ISSUE_SEVERITY.ERROR,
        type: "queue_invalid_status",
        collectionName,
        referenceId,
        title: "Status queue tidak valid",
        description: `Status '${queueItem.syncStatus || "kosong"}' tidak dikenal oleh offline pilot.`,
        action: "Review queue item atau restore backup local DB yang valid.",
      }));
    }

    if (
      queueItem.operation === LOCAL_SYNC_OPERATIONS.UPDATE &&
      queueItem.syncStatus !== LOCAL_SYNC_STATUSES.SYNCED &&
      !queueItem.baseVersion &&
      !queueItem.metadata?.baseRecordFingerprint
    ) {
      issues.push(buildIssue({
        severity: ISSUE_SEVERITY.WARNING,
        type: "update_queue_missing_base_guard",
        collectionName,
        referenceId,
        title: "Queue update belum punya base guard",
        description:
          "Queue update lama tidak memiliki baseVersion/baseRecordFingerprint. Sync akan ditahan sebagai conflict agar tidak overwrite Firebase tanpa review.",
        action: "Review lewat tab Queue/Konflik. Pull ulang data Firebase sebelum membuat update offline baru jika memungkinkan.",
      }));
    }

    if (
      queueItem.operation !== LOCAL_SYNC_OPERATIONS.DELETE &&
      queueItem.syncStatus !== LOCAL_SYNC_STATUSES.SYNCED &&
      !localRecord
    ) {
      issues.push(buildIssue({
        severity: ISSUE_SEVERITY.WARNING,
        type: "orphan_queue_without_local_record",
        collectionName,
        referenceId,
        title: "Queue tidak punya record local aktif",
        description: "Queue create/update masih ada, tetapi record local yang dituju tidak ditemukan.",
        action: "Preview Offline → Firebase dan review detail queue sebelum sync.",
      }));
    }

    if (queueItem.operation === LOCAL_SYNC_OPERATIONS.DELETE) {
      issues.push(buildIssue({
        severity: ISSUE_SEVERITY.INFO,
        type: "delete_queue_guarded",
        collectionName,
        referenceId,
        title: "Delete tombstone terdeteksi",
        description: "Delete Firebase tetap diblokir default dari Offline Database Center agar tidak ada destructive sync tanpa review.",
        action: "Biarkan sebagai tombstone local atau proses delete Firebase lewat flow manual terpisah dengan approval.",
      }));
    }

    if (queueItem.syncStatus === LOCAL_SYNC_STATUSES.FAILED) {
      issues.push(buildIssue({
        severity: ISSUE_SEVERITY.WARNING,
        type: "failed_queue_item",
        collectionName,
        referenceId,
        title: "Ada queue failed",
        description: queueItem.errorMessage || "Queue gagal disync dan perlu review manual.",
        action: "Preview Offline → Firebase, baca alasan failed, lalu retry atau clear lewat Queue Admin dengan keyword guard.",
      }));
    }

    if (queueItem.syncStatus === LOCAL_SYNC_STATUSES.CONFLICT) {
      issues.push(buildIssue({
        severity: ISSUE_SEVERITY.WARNING,
        type: "conflict_queue_item",
        collectionName,
        referenceId,
        title: "Ada queue conflict",
        description: queueItem.errorMessage || "Queue masuk status conflict dan perlu resolve manual.",
        action: "Gunakan tab Konflik di Offline Database Center sebelum sync ulang.",
      }));
    }

    if (queueItem.syncStatus === LOCAL_SYNC_STATUSES.PENDING && ageHours !== null && ageHours >= MAX_PENDING_AGE_HOURS) {
      issues.push(buildIssue({
        severity: ISSUE_SEVERITY.WARNING,
        type: "stale_pending_queue",
        collectionName,
        referenceId,
        title: "Queue pending terlalu lama",
        description: `Queue pending sekitar ${Math.floor(ageHours)} jam. Risiko lupa sync sebelum pindah device.`,
        action: "Segera preview dan sync Offline → Firebase atau backup local DB.",
      }));
    }

    if (
      queueItem.syncStatus === LOCAL_SYNC_STATUSES.SYNCING &&
      ageHours !== null &&
      ageHours * 60 >= MAX_SYNCING_AGE_MINUTES
    ) {
      issues.push(buildIssue({
        severity: ISSUE_SEVERITY.WARNING,
        type: "stale_syncing_queue",
        collectionName,
        referenceId,
        title: "Queue syncing terlalu lama",
        description: "Status syncing terlalu lama dan mungkin tertinggal dari proses sync yang gagal/terputus.",
        action: "Refresh status. Jika masih sama, review queue sebelum sync ulang.",
      }));
    }
  });
};

const addConflictIssues = ({ issues, conflictRows = [] }) => {
  conflictRows
    .filter((row) => !row?.resolvedAt)
    .forEach((row = {}) => {
      issues.push(buildIssue({
        severity: ISSUE_SEVERITY.WARNING,
        type: "unresolved_conflict",
        collectionName: row.collectionName,
        referenceId: row.documentId || row.id,
        title: "Conflict belum diselesaikan",
        description: row.message || `Conflict ${row.conflictType || "unknown"} masih aktif.`,
        action: "Buka tab Konflik dan pilih Lewati/Pakai Local/Pakai Firebase sesuai review manual.",
      }));
    });
};

const dedupeIssues = (issues = []) => {
  const map = new Map();
  issues.forEach((issue) => {
    if (!map.has(issue.id)) map.set(issue.id, issue);
  });
  return Array.from(map.values());
};

const readRowsByCollection = async (db) => {
  const entries = await Promise.all(
    LOCAL_DB_BACKUP_TABLE_ALLOWLIST.map(async (tableName) => [
      tableName,
      await db.table(tableName).toArray(),
    ])
  );
  return Object.fromEntries(entries);
};

// =====================================================
// SECTION: Local Data Health Audit — AKTIF / READ-ONLY / BATCH 48
// Fungsi:
// - Audit IndexedDB untuk semua table offline/snapshot Phase 1–6 agar user tahu kondisi queue, conflict, tombstone, duplikasi, dan flag read-only sebelum sync.
// - Tidak menulis data, tidak mengubah schema, tidak menyentuh Firebase, dan tidak membuka modul guarded.
// =====================================================
export const getLocalDataHealthAudit = async () => {
  const db = getImsLocalDb();
  const rowsByCollection = await readRowsByCollection(db);
  const queueRows = rowsByCollection[LOCAL_DB_TABLES.SYNC_QUEUE] || [];
  const conflictRows = rowsByCollection[LOCAL_DB_TABLES.SYNC_CONFLICTS] || [];
  const customerRows = rowsByCollection[LOCAL_DB_TABLES.CUSTOMERS] || [];
  const tableCounts = Object.fromEntries(
    Object.entries(rowsByCollection).map(([tableName, rows]) => [
      tableName,
      rows.filter((row) => !row?._deleted).length,
    ])
  );
  const issues = [];

  addSnapshotEmptyIssues({ issues, tableCounts });
  addRecordStatusIssues({ issues, rowsByCollection });
  addSensitiveFieldIssues({ issues, rowsByCollection });
  addDuplicateCustomerCodeIssues({ issues, customerRows });
  addQueueIssues({ issues, queueRows, rowsByCollection });
  addConflictIssues({ issues, conflictRows });

  const dedupedIssues = dedupeIssues(issues);

  return {
    checkedAt: new Date().toISOString(),
    scope: "phase_1_to_6_offline_snapshot_guard",
    summary: buildSummary({
      issues: dedupedIssues,
      tableCounts,
      queueRows,
      conflictRows,
    }),
    issues: dedupedIssues,
  };
};

export default getLocalDataHealthAudit;
