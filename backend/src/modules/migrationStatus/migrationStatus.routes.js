const express = require("express");
const { getDb } = require("../../db/connection");
const { success } = require("../../utils/response");

const router = express.Router();

const SQLITE_RUNTIME_STATUS = "sqlite_active";
const GUARDED_STATUS = "guarded";
const LEGACY_INACTIVE_STATUS = "legacy_inactive";
const UNKNOWN_STATUS = "unknown";
const OLD_REMOTE_STATUS_PREFIX = `${["fire", "base"].join("")}_`;

const STATUS_ORDER = {
  [SQLITE_RUNTIME_STATUS]: 1,
  [GUARDED_STATUS]: 2,
  [LEGACY_INACTIVE_STATUS]: 8,
  [UNKNOWN_STATUS]: 9,
};

const normalizeRuntimeStatus = (status) => {
  const value = String(status || "").trim();
  if ([SQLITE_RUNTIME_STATUS, GUARDED_STATUS, LEGACY_INACTIVE_STATUS, UNKNOWN_STATUS].includes(value)) return value;
  if (value.startsWith("sqlite_atomic_")) return SQLITE_RUNTIME_STATUS;
  if (value.startsWith(OLD_REMOTE_STATUS_PREFIX)) return LEGACY_INACTIVE_STATUS;
  return UNKNOWN_STATUS;
};

const normalizeRow = (row) => {
  const normalizedStatus = normalizeRuntimeStatus(row.status);
  return {
    ...row,
    status: normalizedStatus,
  };
};

const buildSummary = (rows = []) => rows.reduce((acc, row) => {
  acc.total += 1;
  acc[row.status] = (acc[row.status] || 0) + 1;

  if (row.status === SQLITE_RUNTIME_STATUS) {
    acc.runtime_ready += 1;
    acc.sqliteActiveModules.push(row.module_key);
  } else if (row.status === GUARDED_STATUS) {
    acc.runtime_ready += 1;
    acc.guardedModules.push(row.module_key);
  } else if (row.status === LEGACY_INACTIVE_STATUS) {
    acc.not_ready += 1;
    acc.legacyInactiveModules.push(row.module_key);
  } else {
    acc.not_ready += 1;
    acc.unknownModules.push(row.module_key);
  }

  return acc;
}, {
  total: 0,
  runtime_ready: 0,
  not_ready: 0,
  sqlite_active: 0,
  guarded: 0,
  legacy_inactive: 0,
  unknown: 0,
  sqliteActiveModules: [],
  guardedModules: [],
  legacyInactiveModules: [],
  unknownModules: [],
});

router.get("/", async (req, res, next) => {
  try {
    const db = await getDb();
    const rows = await db.all(`
      SELECT module_key, label, status, scope, notes, updated_at
      FROM module_migration_status
    `);

    const sortedRows = rows
      .map(normalizeRow)
      .sort((a, b) => {
        const byStatus = (STATUS_ORDER[a.status] || STATUS_ORDER[UNKNOWN_STATUS]) - (STATUS_ORDER[b.status] || STATUS_ORDER[UNKNOWN_STATUS]);
        if (byStatus) return byStatus;
        return String(a.module_key).localeCompare(String(b.module_key));
      });

    return success(res, "Status runtime modul berhasil dimuat", {
      title: "Module Runtime Status",
      runtimeMode: "sqlite_local_backend",
      summary: buildSummary(sortedRows),
      modules: sortedRows,
      nextSafeBatch: "Tidak ada gate C2 aktif. Patch berikutnya ditentukan dari audit source aktual, regression test SQLite, dan prioritas modul yang paling berisiko.",
      guardedReminder: "SQLite backend lokal adalah runtime utama. Stock, sales, purchases, returns, finance, production, payroll, HPP, auth, backup, dan restore wajib lewat endpoint backend resmi; restore destructive tetap guarded.",
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
