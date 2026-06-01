import {
  collection,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  getWorkLogPayrollRuleSnapshot,
  getWorkLogPayrollSnapshotReconcilePatch,
} from "../../utils/produksi/productionPayrollRuleHelpers";

// =============================================================================
// Payroll / Work Log Snapshot Maintenance Service
// ACTIVE / FINAL FOUNDATION:
// - service ini khusus audit dan repair aman untuk snapshot payroll Work Log;
// - tidak membuat payroll line, tidak confirm/paid payroll, dan tidak mengubah
//   stok, kas, atau HPP final;
// - service ini dipakai oleh menu Reset & Maintenance Data sebagai jembatan
//   sebelum cleanup besar logic payroll legacy dilakukan.
// =============================================================================

const COLLECTIONS = {
  steps: "production_steps",
  workLogs: "production_work_logs",
  payrolls: "production_payrolls",
};

const BATCH_LIMIT = 350;

const safeTrim = (value) => String(value || "").trim();
const normalize = (value) => safeTrim(value).toLowerCase();
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildDocItem = (itemDoc) => ({
  id: itemDoc.id,
  ref: itemDoc.ref,
  ...itemDoc.data(),
});

const readCollectionDocs = async (collectionName) => {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map(buildDocItem);
};

const buildMap = (items = []) => new Map(items.map((item) => [safeTrim(item.id), item]));

const hasPayrollHistory = ({ workLog = {}, payrollLines = [] }) => {
  const payrollIds = Array.isArray(workLog.payrollIds) ? workLog.payrollIds.filter(Boolean) : [];
  return (
    payrollIds.length > 0 ||
    safeTrim(workLog.payrollId) ||
    toNumber(workLog.payrollLineCount, 0) > 0 ||
    payrollLines.length > 0
  );
};

const buildMismatchMessages = ({ workLog = {}, step = {} }) => {
  const messages = [];
  if (toNumber(workLog.stepPayrollRate, 0) !== toNumber(step.payrollRate, 0)) {
    messages.push(`payrollRate snapshot=${toNumber(workLog.stepPayrollRate, 0)} berbeda dari master=${toNumber(step.payrollRate, 0)}`);
  }
  if (safeTrim(workLog.stepPayrollMode) !== safeTrim(step.payrollMode)) {
    messages.push(`payrollMode snapshot=${safeTrim(workLog.stepPayrollMode) || "-"} berbeda dari master=${safeTrim(step.payrollMode) || "-"}`);
  }
  if (toNumber(workLog.stepPayrollQtyBase, 1) !== toNumber(step.payrollQtyBase, 1)) {
    messages.push(`payrollQtyBase snapshot=${toNumber(workLog.stepPayrollQtyBase, 1)} berbeda dari master=${toNumber(step.payrollQtyBase, 1)}`);
  }
  if (safeTrim(workLog.stepPayrollOutputBasis) !== safeTrim(step.payrollOutputBasis)) {
    messages.push(`payrollOutputBasis snapshot=${safeTrim(workLog.stepPayrollOutputBasis) || "-"} berbeda dari master=${safeTrim(step.payrollOutputBasis) || "-"}`);
  }
  return messages;
};

const buildSummary = ({ rows = [], checkedRecords = 0 }) => ({
  checkedRecords,
  okCount: Math.max(checkedRecords - rows.length, 0),
  safeRepairCount: rows.filter((row) => row.category === "safe_repair").length,
  displayRepairCount: rows.filter((row) => row.category === "display_repair").length,
  scopedResetCount: rows.filter((row) => row.category === "scoped_reset").length,
  manualReviewCount: rows.filter((row) => row.category === "manual").length,
  executablePlanCount: rows.filter((row) => ["safe_repair", "display_repair", "scoped_reset"].includes(row.category)).length,
});

const buildAuditRow = ({
  workLog = {},
  step = null,
  category = "manual",
  issue = "",
  recommendation = "",
  resetScope = "",
  payrollHistoryCount = 0,
}) => ({
  key: `payroll-snapshot-${workLog.id}`,
  scope: "payroll_work_log_snapshot",
  code: safeTrim(workLog.workNumber || workLog.code || workLog.id),
  status: safeTrim(workLog.status || workLog.payrollCalculationStatus || "work_log"),
  category,
  issue,
  recommendation,
  resetScope,
  workLogId: workLog.id,
  stepId: safeTrim(workLog.stepId),
  stepName: safeTrim(workLog.stepName),
  masterStepName: safeTrim(step?.name || workLog.stepName),
  payrollHistoryCount,
  snapshotRate: toNumber(workLog.stepPayrollRate, 0),
  masterRate: toNumber(step?.payrollRate, 0),
  snapshotMode: safeTrim(workLog.stepPayrollMode),
  masterMode: safeTrim(step?.payrollMode),
  ruleSource: safeTrim(workLog.stepPayrollRuleSource || getWorkLogPayrollRuleSnapshot(workLog).source),
  workerSummary: Array.isArray(workLog.workerNames) ? workLog.workerNames.filter(Boolean).join(", ") : safeTrim(workLog.workerName),
});

const buildRepairPatch = ({ workLog = {}, step = {} }) => {
  const patch = getWorkLogPayrollSnapshotReconcilePatch({
    workLog,
    productionStep: step,
  });

  if (!patch) return null;

  return {
    ...patch,
    payrollCalculated: false,
    payrollCalculationStatus: normalize(workLog.status) === "completed" ? "pending" : safeTrim(workLog.payrollCalculationStatus || "pending"),
    payrollId: "",
    payrollIds: [],
    payrollLineCount: 0,
    paidPayrollLineCount: 0,
    payrollFinalAmount: 0,
    payrollMaintenanceReconciledAt: serverTimestamp(),
    payrollMaintenanceReconciledFrom: "production_step_master",
  };
};

export const getPayrollSnapshotMaintenanceAudit = async () => {
  const [steps, workLogs, payrolls] = await Promise.all([
    readCollectionDocs(COLLECTIONS.steps),
    readCollectionDocs(COLLECTIONS.workLogs),
    readCollectionDocs(COLLECTIONS.payrolls),
  ]);

  const stepMap = buildMap(steps);
  const payrollsByWorkLog = payrolls.reduce((map, payroll) => {
    const workLogId = safeTrim(payroll.workLogId);
    if (!workLogId) return map;
    const current = map.get(workLogId) || [];
    current.push(payroll);
    map.set(workLogId, current);
    return map;
  }, new Map());

  const rows = workLogs.flatMap((workLog) => {
    const step = stepMap.get(safeTrim(workLog.stepId));
    const payrollHistory = payrollsByWorkLog.get(workLog.id) || [];
    const patch = step ? buildRepairPatch({ workLog, step }) : null;

    if (!step && safeTrim(workLog.stepId)) {
      return [
        buildAuditRow({
          workLog,
          step: null,
          payrollHistoryCount: payrollHistory.length,
          category: normalize(workLog.status) === "completed" ? "manual" : "scoped_reset",
          issue: "Master Production Step tidak ditemukan untuk Work Log ini.",
          recommendation: "Lakukan manual review atau reset scoped produksi jika ini hanya data testing.",
          resetScope: "production",
        }),
      ];
    }

    if (!patch) {
      return [];
    }

    const mismatches = buildMismatchMessages({ workLog, step }).join("; ");
    const hasHistory = hasPayrollHistory({ workLog, payrollLines: payrollHistory });

    if (hasHistory) {
      return [
        buildAuditRow({
          workLog,
          step,
          payrollHistoryCount: payrollHistory.length,
          category: "manual",
          issue: `Snapshot payroll stale tetapi Work Log sudah punya history payroll. ${mismatches}`,
          recommendation: "Jangan auto-repair. Review manual atau reset scoped payroll produksi jika data masih testing.",
          resetScope: "production_payrolls_only",
        }),
      ];
    }

    return [
      buildAuditRow({
        workLog,
        step,
        payrollHistoryCount: payrollHistory.length,
        category: "safe_repair",
        issue: `Snapshot payroll stale dan aman direkonsiliasi. ${mismatches}`,
        recommendation: "Jalankan Repair Snapshot Payroll agar Work Log kembali sinkron dengan master Production Step tanpa posting stok ulang.",
        resetScope: "payroll_snapshot_repair",
      }),
    ];
  });

  return {
    generatedAt: new Date().toISOString(),
    rows,
    summary: buildSummary({ rows, checkedRecords: workLogs.length }),
  };
};

export const repairPayrollSnapshotMaintenance = async (currentUser = null) => {
  const [steps, workLogs, payrolls] = await Promise.all([
    readCollectionDocs(COLLECTIONS.steps),
    readCollectionDocs(COLLECTIONS.workLogs),
    readCollectionDocs(COLLECTIONS.payrolls),
  ]);

  const stepMap = buildMap(steps);
  const payrollsByWorkLog = payrolls.reduce((map, payroll) => {
    const workLogId = safeTrim(payroll.workLogId);
    if (!workLogId) return map;
    const current = map.get(workLogId) || [];
    current.push(payroll);
    map.set(workLogId, current);
    return map;
  }, new Map());

  let batch = writeBatch(db);
  let operationCount = 0;
  let updatedCount = 0;
  const repairedRows = [];
  const skippedRows = [];

  for (const workLog of workLogs) {
    const step = stepMap.get(safeTrim(workLog.stepId));
    if (!step) continue;

    const patch = buildRepairPatch({ workLog, step });
    if (!patch) continue;

    const payrollHistory = payrollsByWorkLog.get(workLog.id) || [];
    if (hasPayrollHistory({ workLog, payrollLines: payrollHistory })) {
      skippedRows.push(
        buildAuditRow({
          workLog,
          step,
          payrollHistoryCount: payrollHistory.length,
          category: "manual",
          issue: "Snapshot stale tetapi history payroll sudah ada.",
          recommendation: "Dilewati saat repair aman. Perlu manual review atau reset scoped jika data testing.",
          resetScope: "production_payrolls_only",
        }),
      );
      continue;
    }

    batch.update(workLog.ref, patch);
    operationCount += 1;
    updatedCount += 1;
    repairedRows.push(
      buildAuditRow({
        workLog,
        step,
        payrollHistoryCount: payrollHistory.length,
        category: "safe_repair",
        issue: "Snapshot payroll berhasil direkonsiliasi dari master Step.",
        recommendation: "Work Log sekarang aman untuk auto-draft payroll pada flow final berikutnya.",
        resetScope: "payroll_snapshot_repair",
      }),
    );

    if (operationCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }

  return {
    message: `Repair snapshot payroll selesai. ${updatedCount} Work Log direkonsiliasi aman.`,
    updatedCount,
    skippedCount: skippedRows.length,
    executedBy: safeTrim(currentUser?.uid || currentUser?.email || "client-ui"),
    summary: {
      checkedRecords: workLogs.length,
      safeRepairCount: repairedRows.length,
      manualReviewCount: skippedRows.length,
      executablePlanCount: repairedRows.length,
    },
    rows: [...repairedRows, ...skippedRows],
  };
};
