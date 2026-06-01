const express = require("express");
const { getDb } = require("../../db/connection");
const { success } = require("../../utils/response");

const router = express.Router();

const STATUS_ORDER = {
  sqlite_active: 1,
  firebase_only: 2,
  firebase_auth: 3,
  firebase_primary_snapshot_pending: 4,
  guarded: 5,
};

const buildSummary = (rows = []) => rows.reduce((acc, row) => {
  acc.total += 1;
  acc[row.status] = (acc[row.status] || 0) + 1;
  if (row.status === "guarded") acc.guardedModules.push(row.module_key);
  if (row.status === "sqlite_active") acc.sqliteActiveModules.push(row.module_key);
  return acc;
}, {
  total: 0,
  sqlite_active: 0,
  firebase_only: 0,
  firebase_auth: 0,
  firebase_primary_snapshot_pending: 0,
  guarded: 0,
  guardedModules: [],
  sqliteActiveModules: [],
});

router.get("/", async (req, res, next) => {
  try {
    const db = await getDb();
    const rows = await db.all(`
      SELECT module_key, label, status, scope, notes, updated_at
      FROM module_migration_status
      ORDER BY
        CASE status
          WHEN 'sqlite_active' THEN 1
          WHEN 'firebase_only' THEN 2
          WHEN 'firebase_auth' THEN 3
          WHEN 'firebase_primary_snapshot_pending' THEN 4
          WHEN 'guarded' THEN 5
          ELSE 9
        END,
        module_key ASC
    `);

    const sortedRows = rows.sort((a, b) => {
      const byStatus = (STATUS_ORDER[a.status] || 9) - (STATUS_ORDER[b.status] || 9);
      if (byStatus) return byStatus;
      return String(a.module_key).localeCompare(String(b.module_key));
    });

    return success(res, "Status migrasi SQLite berhasil dimuat", {
      summary: buildSummary(sortedRows),
      modules: sortedRows,
      nextSafeBatch: "C2 hanya boleh dimulai dari master data non-transaksi setelah C1 QA bersih.",
      guardedReminder: "Stock, sales, purchase, returns, finance, production, payroll, HPP, auth, dan restore destructive belum boleh dimigrasi tanpa audit khusus.",
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
