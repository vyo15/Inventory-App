const path = require("node:path");
const crypto = require("node:crypto");
const env = require("../../config/env");
const { getDb, getDbPath, runInTransaction } = require("../../db/connection");
const { TABLES } = require("../../db/schema");
const { createAuditLog } = require("../../utils/auditLog");
const { getRealtimeRuntimeStatus } = require("../realtime/realtime.service");
const {
  createOfficialSqliteBackup,
  getBackupPreview,
  RESTORE_CONFIRM_KEYWORD,
} = require("../maintenance/backup");
const { listBackups } = require("../maintenance/maintenance.catalog.service");
const { executeRestore } = require("../maintenance/maintenance.restore.service");
const {
  getStockReadModelMaintenanceAudit,
  runDatabaseIntegrityChecks,
} = require("../maintenance/maintenance.dataQuality.service");
const { createHttpError } = require("../maintenance/maintenance.shared");
const {
  beginTestingLabWriteLock,
  endTestingLabWriteLock,
  getTestingLabWriteActivity,
  getTestingLabWriteLock,
} = require("./testingLab.runtime");

const BASELINE_SETTING_KEY = "testing_lab.active_baseline";
const SESSION_SETTING_KEY = "testing_lab.active_session";
const LAST_RESULT_SETTING_KEY = "testing_lab.last_result";
const BASELINE_CONFIRM_KEYWORD = "BUAT BASELINE TESTING";
const RESET_CONFIRM_KEYWORD = "RESET SANDBOX";
const MAX_RESULT_BYTES = 750_000;

const TRANSACTION_TABLES = Object.freeze([
  TABLES.STOCK_ADJUSTMENTS,
  TABLES.INVENTORY_LOGS,
  TABLES.PURCHASES,
  TABLES.SALES,
  TABLES.RETURNS,
  TABLES.INCOMES,
  TABLES.EXPENSES,
  TABLES.MONEY_MOVEMENT_LEDGER,
  TABLES.PRODUCTION_PLANNING,
  TABLES.PRODUCTION_ORDERS,
  TABLES.PRODUCTION_WORK_LOGS,
  TABLES.PRODUCTION_PAYROLLS,
  TABLES.REPORT_SNAPSHOTS,
]);

const MASTER_READINESS_TABLES = Object.freeze({
  products: TABLES.PRODUCTS,
  rawMaterials: TABLES.RAW_MATERIALS,
  semiFinishedMaterials: TABLES.SEMI_FINISHED_MATERIALS,
  customers: TABLES.CUSTOMERS,
  suppliers: TABLES.SUPPLIERS,
  categories: TABLES.CATEGORIES,
  productionSteps: TABLES.PRODUCTION_STEPS,
  productionEmployees: TABLES.PRODUCTION_EMPLOYEES,
  productionBoms: TABLES.PRODUCTION_BOMS,
});

const SCENARIOS = Object.freeze({
  purchase_stock: Object.freeze({
    key: "purchase_stock",
    label: "Pembelian → Stok",
    description: "Uji pembelian bahan/produk melalui UI normal lalu pastikan stok, histori, supplier, dan finance konsisten.",
    required: ["suppliers", "rawMaterials"],
    scopes: ["purchases", "stock", "suppliers", "finance"],
    steps: [
      "Catat snapshot sebelum pengujian.",
      "Buka menu Pembelian dan buat satu pembelian testing melalui form resmi.",
      "Pastikan pembelian tersimpan satu kali dan kode tidak duplikat.",
      "Periksa stok item serta Histori Stok.",
      "Selesaikan sesi untuk membandingkan perubahan dan menjalankan validasi.",
    ],
  }),
  sales_return_finance: Object.freeze({
    key: "sales_return_finance",
    label: "Penjualan → Pemasukan → Retur",
    description: "Uji penjualan sampai selesai, posting pemasukan, lalu retur melalui jalur resmi.",
    required: ["customers", "products"],
    scopes: ["sales", "returns", "stock", "finance"],
    steps: [
      "Pastikan produk testing memiliki stok yang cukup.",
      "Buat penjualan melalui menu Penjualan.",
      "Ubah status sesuai flow hingga Selesai dan verifikasi pemasukan hanya satu kali.",
      "Buat retur terkait penjualan dengan qty tidak melebihi sisa.",
      "Selesaikan sesi dan periksa diff stok, sales, retur, pemasukan, dan ledger.",
    ],
  }),
  production_payroll_hpp: Object.freeze({
    key: "production_payroll_hpp",
    label: "Produksi → Work Log → Payroll → HPP",
    description: "Uji flow produksi lengkap memakai master, BOM, pekerja, stok, payroll, dan HPP yang sama dengan operasional.",
    required: ["products", "rawMaterials", "productionSteps", "productionEmployees", "productionBoms"],
    scopes: ["production", "stock", "finance"],
    steps: [
      "Buat Planning dan Production Order dari master testing yang sudah siap.",
      "Catat Work Log melalui flow resmi dan pastikan material actual tercatat.",
      "Finalkan Payroll sesuai Work Log.",
      "Periksa output stok, biaya material, payroll, overhead, dan HPP final.",
      "Selesaikan sesi untuk validasi projection stok dan finance.",
    ],
  }),
  realtime_multi_client: Object.freeze({
    key: "realtime_multi_client",
    label: "Realtime Laptop ↔ HP",
    description: "Uji event SSE dan refresh data antarperangkat tanpa menimpa form aktif.",
    required: [],
    scopes: ["database", "realtime"],
    steps: [
      "Buka sandbox dari laptop dan HP dengan akun testing.",
      "Mulai sesi dari salah satu perangkat.",
      "Tambahkan atau ubah satu master testing dari perangkat A.",
      "Pastikan perangkat B menerima perubahan tanpa reload browser manual.",
      "Uji saat form aktif: perubahan harus ditahan sebagai pemberitahuan data baru.",
    ],
  }),
  concurrency_guard: Object.freeze({
    key: "concurrency_guard",
    label: "Concurrency & Double Submit",
    description: "Uji request paralel, kode unik, stok terakhir, dan perlindungan submit ganda melalui dua client.",
    required: ["products"],
    scopes: ["database", "transactions", "stock"],
    steps: [
      "Siapkan item testing dengan stok terbatas.",
      "Kirim dua transaksi bersamaan dari laptop dan HP.",
      "Pastikan tidak ada kode, ledger, atau inventory log duplikat.",
      "Pastikan transaksi kedua ditolak bila stok tidak cukup.",
      "Selesaikan sesi dan periksa hasil diff serta audit log.",
    ],
  }),
});

const parseJson = (value, fallback = null) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const sanitizeStoredJson = (value) => {
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > MAX_RESULT_BYTES) {
    throw createHttpError("Hasil sesi testing terlalu besar untuk disimpan.", 413, "TESTING_LAB_RESULT_TOO_LARGE");
  }
  return serialized;
};

const getSandboxGuard = () => {
  const activeDbPath = path.resolve(getDbPath());
  const activeBackupDir = path.resolve(env.backupDir);
  const activeLogDir = path.resolve(env.logDir);
  const separateDatabase = env.getRuntimePathIdentity(activeDbPath)
    !== env.getRuntimePathIdentity(env.defaultDbPath);
  const separateBackupStorage = env.getRuntimePathIdentity(activeBackupDir)
    !== env.getRuntimePathIdentity(env.defaultBackupDir);
  const separateLogStorage = env.getRuntimePathIdentity(activeLogDir)
    !== env.getRuntimePathIdentity(env.defaultLogDir);
  const sandboxPurpose = env.databasePurpose === "sandbox";
  const available = env.testingLabEnabled
    && sandboxPurpose
    && separateDatabase
    && separateBackupStorage;
  const blockers = [];
  const warnings = [];

  if (!env.testingLabEnabled) blockers.push("IMS_ENABLE_TESTING_LAB belum aktif.");
  if (!sandboxPurpose) blockers.push("IMS_DATABASE_PURPOSE belum bernilai sandbox.");
  if (!separateDatabase) blockers.push("Path database masih sama dengan database operasional default.");
  if (!separateBackupStorage) blockers.push("Folder backup sandbox masih sama dengan backup operasional.");
  if (!separateLogStorage) warnings.push("Folder log sandbox masih bercampur dengan log operasional.");

  return {
    available,
    enabled: env.testingLabEnabled,
    databasePurpose: env.databasePurpose,
    isSandbox: sandboxPurpose,
    separateDatabase,
    separateBackupStorage,
    separateLogStorage,
    databaseFilename: path.basename(activeDbPath),
    backupDirectoryName: path.basename(activeBackupDir),
    blockers,
    warnings,
  };
};

const assertTestingLabAvailable = () => {
  const guard = getSandboxGuard();
  if (!guard.available) {
    throw createHttpError(
      "Lab Pengujian ditolak karena backend belum berjalan dengan database sandbox terpisah dan guard testing aktif.",
      409,
      "TESTING_LAB_SANDBOX_REQUIRED",
    );
  }
  return guard;
};

const readSetting = async (db, key, fallback = null) => {
  const row = await db.get("SELECT value FROM app_settings WHERE key = ?", [key]);
  return parseJson(row?.value, fallback);
};

const writeSetting = async (db, key, value) => {
  await db.run(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    [key, sanitizeStoredJson(value)],
  );
};

const clearSetting = async (db, key) => {
  await writeSetting(db, key, null);
};

const getActiveCount = async (db, tableName) => {
  const row = await db.get(
    `SELECT COUNT(*) AS count FROM ${tableName} WHERE COALESCE(status, 'active') NOT IN ('deleted', 'inactive')`,
  ).catch(() => null);
  return Number(row?.count || 0);
};

const getDatabaseSnapshot = async (db) => {
  const tableCounts = {};
  for (const tableName of Object.values(TABLES)) {
    const row = await db.get(`SELECT COUNT(*) AS count FROM ${tableName}`).catch(() => null);
    tableCounts[tableName] = Number(row?.count || 0);
  }

  const masterReadiness = {};
  for (const [key, tableName] of Object.entries(MASTER_READINESS_TABLES)) {
    masterReadiness[key] = await getActiveCount(db, tableName);
  }

  const stockTotals = {};
  for (const tableName of [TABLES.PRODUCTS, TABLES.RAW_MATERIALS, TABLES.SEMI_FINISHED_MATERIALS]) {
    const row = await db.get(`
      SELECT
        COALESCE(SUM(current_stock), 0) AS current_stock,
        COALESCE(SUM(reserved_stock), 0) AS reserved_stock,
        COALESCE(SUM(available_stock), 0) AS available_stock
      FROM ${tableName}
      WHERE COALESCE(status, 'active') != 'deleted'
    `).catch(() => null);
    stockTotals[tableName] = {
      currentStock: Number(row?.current_stock || 0),
      reservedStock: Number(row?.reserved_stock || 0),
      availableStock: Number(row?.available_stock || 0),
    };
  }

  const financeTotals = {};
  for (const tableName of [TABLES.INCOMES, TABLES.EXPENSES, TABLES.MONEY_MOVEMENT_LEDGER]) {
    const row = await db.get(`SELECT COALESCE(SUM(total_amount), 0) AS total FROM ${tableName}`).catch(() => null);
    financeTotals[tableName] = Number(row?.total || 0);
  }

  return {
    capturedAt: new Date().toISOString(),
    tableCounts,
    transactionCounts: Object.fromEntries(TRANSACTION_TABLES.map((tableName) => [tableName, tableCounts[tableName] || 0])),
    masterReadiness,
    stockTotals,
    financeTotals,
  };
};

const subtractNumbers = (after = {}, before = {}) => Object.fromEntries(
  [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])].map((key) => [
    key,
    Number(after?.[key] || 0) - Number(before?.[key] || 0),
  ]),
);

const buildSnapshotDiff = (before = {}, after = {}) => ({
  capturedAt: new Date().toISOString(),
  tableCounts: subtractNumbers(after.tableCounts, before.tableCounts),
  transactionCounts: subtractNumbers(after.transactionCounts, before.transactionCounts),
  masterReadiness: subtractNumbers(after.masterReadiness, before.masterReadiness),
  stockTotals: Object.fromEntries(
    [...new Set([...Object.keys(before.stockTotals || {}), ...Object.keys(after.stockTotals || {})])].map((key) => [
      key,
      subtractNumbers(after.stockTotals?.[key], before.stockTotals?.[key]),
    ]),
  ),
  financeTotals: subtractNumbers(after.financeTotals, before.financeTotals),
});

const runTestingValidation = async () => {
  assertTestingLabAvailable();
  const db = await getDb();
  const integrity = await runDatabaseIntegrityChecks(db);
  const stockProjection = await getStockReadModelMaintenanceAudit();
  const activeAdmin = await db.get(
    "SELECT COUNT(*) AS count FROM users WHERE role = 'administrator' AND status = 'active'",
  );
  const invalidStock = {};

  for (const tableName of [TABLES.PRODUCTS, TABLES.RAW_MATERIALS, TABLES.SEMI_FINISHED_MATERIALS]) {
    const row = await db.get(`
      SELECT COUNT(*) AS count
      FROM ${tableName}
      WHERE current_stock < 0
         OR reserved_stock < 0
         OR available_stock < 0
         OR available_stock != current_stock - reserved_stock
    `).catch(() => null);
    invalidStock[tableName] = Number(row?.count || 0);
  }

  const duplicateLedgerSources = await db.all(`
    SELECT source_type, source_id, COUNT(*) AS count
    FROM money_movement_ledger
    WHERE source_id IS NOT NULL AND TRIM(source_id) != ''
    GROUP BY source_type, source_id
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 50
  `).catch(() => []);

  const checks = [
    {
      key: "sqlite_integrity",
      label: "Integrity SQLite",
      status: integrity.valid ? "passed" : "failed",
      summary: integrity.integrityCheck,
    },
    {
      key: "foreign_keys",
      label: "Foreign key",
      status: integrity.foreignKeyRows.length === 0 ? "passed" : "failed",
      summary: integrity.foreignKeyRows.length === 0 ? "Tidak ada pelanggaran." : `${integrity.foreignKeyRows.length} pelanggaran.`,
    },
    {
      key: "active_administrator",
      label: "Administrator aktif",
      status: Number(activeAdmin?.count || 0) > 0 ? "passed" : "failed",
      summary: `${Number(activeAdmin?.count || 0)} administrator aktif.`,
    },
    {
      key: "stock_projection",
      label: "Projection stok",
      status: Number(stockProjection.issueCount || 0) === 0 ? "passed" : "failed",
      summary: `${Number(stockProjection.issueCount || 0)} masalah projection.`,
    },
    {
      key: "stock_balance",
      label: "Saldo stok master",
      status: Object.values(invalidStock).every((count) => count === 0) ? "passed" : "failed",
      summary: `${Object.values(invalidStock).reduce((sum, count) => sum + count, 0)} record stok tidak konsisten.`,
    },
    {
      key: "ledger_source_uniqueness",
      label: "Sumber ledger ganda",
      status: duplicateLedgerSources.length === 0 ? "passed" : "warning",
      summary: duplicateLedgerSources.length === 0 ? "Tidak ditemukan." : `${duplicateLedgerSources.length} sumber memiliki lebih dari satu baris ledger.`,
    },
  ];

  return {
    checkedAt: new Date().toISOString(),
    overallStatus: checks.some((check) => check.status === "failed")
      ? "failed"
      : checks.some((check) => check.status === "warning") ? "warning" : "passed",
    checks,
    details: {
      invalidStock,
      duplicateLedgerSources,
      stockProjection,
    },
  };
};

const buildScenarioCatalog = (masterReadiness = {}) => Object.values(SCENARIOS).map((scenario) => {
  const missingRequirements = scenario.required.filter((key) => Number(masterReadiness[key] || 0) < 1);
  return {
    ...scenario,
    ready: missingRequirements.length === 0,
    missingRequirements,
  };
});



const getActiveTestingSession = async (db) => readSetting(db, SESSION_SETTING_KEY, null);

const assertNoActiveTestingSession = async (db, actionLabel) => {
  const session = await getActiveTestingSession(db);
  if (session?.status === "active") {
    throw createHttpError(
      `Selesaikan atau batalkan sesi testing aktif sebelum ${actionLabel}.`,
      409,
      "TESTING_LAB_SESSION_ACTIVE",
    );
  }
};

const captureTestingLabAuditHistory = async (db) => db.all(`
  SELECT action, entity_type, entity_id, description, metadata_json, actor, created_at
  FROM audit_logs
  WHERE module = 'testing_lab'
  ORDER BY id ASC
`);

const restoreTestingLabAuditHistory = async (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  return runInTransaction(async (db) => {
    let inserted = 0;
    for (const row of rows) {
      const result = await db.run(`
        INSERT INTO audit_logs (
          module, action, entity_type, entity_id, description,
          metadata_json, actor, created_at
        )
        SELECT 'testing_lab', ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM audit_logs
          WHERE module = 'testing_lab'
            AND action = ?
            AND COALESCE(entity_id, '') = COALESCE(?, '')
            AND created_at = ?
        )
      `, [
        row.action,
        row.entity_type || null,
        row.entity_id || null,
        row.description || "",
        row.metadata_json || null,
        row.actor || "system",
        row.created_at,
        row.action,
        row.entity_id || null,
        row.created_at,
      ]);
      inserted += Number(result?.changes || 0);
    }
    return inserted;
  }, { label: "testing_lab_restore_audit_history" });
};

const listTestingSessionHistory = async (db) => {
  const rows = await db.all(`
    SELECT id, action, entity_id, description, metadata_json, actor, created_at
    FROM audit_logs
    WHERE module = 'testing_lab'
      AND action IN ('session_start', 'session_complete', 'session_cancel', 'sandbox_reset_complete')
    ORDER BY id DESC
    LIMIT 30
  `);
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    sessionId: row.entity_id || null,
    description: row.description || "",
    actor: row.actor,
    createdAt: row.created_at,
    metadata: parseJson(row.metadata_json, null),
  }));
};

const getTestingLabRuntimeStatus = () => ({
  contractVersion: 1,
  guard: getSandboxGuard(),
  writeLock: getTestingLabWriteLock(),
  writeActivity: getTestingLabWriteActivity(),
});

const getTestingLabStatus = async ({ role = "" } = {}) => {
  const db = await getDb();
  const guard = getSandboxGuard();
  const [activeBaseline, activeSession, lastResult, snapshot, baselines, sessionHistory] = await Promise.all([
    readSetting(db, BASELINE_SETTING_KEY, null),
    readSetting(db, SESSION_SETTING_KEY, null),
    readSetting(db, LAST_RESULT_SETTING_KEY, null),
    getDatabaseSnapshot(db),
    listBackups(),
    listTestingSessionHistory(db),
  ]);

  return {
    contractVersion: 1,
    guard,
    writeLock: getTestingLabWriteLock(),
    writeActivity: getTestingLabWriteActivity(),
    activeBaseline,
    activeSession,
    lastResult,
    sessionHistory,
    snapshot,
    scenarios: buildScenarioCatalog(snapshot.masterReadiness),
    baselines: baselines.filter((backup) => backup.backupType === "test" && backup.fileExists && backup.managedPath),
    realtime: getRealtimeRuntimeStatus({ role }),
    confirmKeywords: {
      createBaseline: BASELINE_CONFIRM_KEYWORD,
      resetSandbox: RESET_CONFIRM_KEYWORD,
    },
  };
};

const createTestingBaseline = async ({ confirmKeyword, actor = "system" } = {}) => {
  assertTestingLabAvailable();
  if (String(confirmKeyword || "").trim() !== BASELINE_CONFIRM_KEYWORD) {
    throw createHttpError("Keyword pembuatan baseline belum sesuai.", 400, "TESTING_LAB_BASELINE_CONFIRMATION_REQUIRED");
  }

  const db = await getDb();
  await assertNoActiveTestingSession(db, "membuat baseline baru");
  const validation = await runTestingValidation();
  if (validation.overallStatus === "failed") {
    const error = createHttpError(
      "Baseline tidak dibuat karena validasi sandbox masih gagal.",
      409,
      "TESTING_LAB_BASELINE_VALIDATION_FAILED",
    );
    error.validation = validation;
    throw error;
  }
  const backup = await createOfficialSqliteBackup(db, {
    type: "test",
    actor,
    action: "testing_lab_baseline_create",
    notes: "Baseline verified untuk database sandbox Lab Pengujian.",
  });
  const baseline = {
    filename: backup.filename,
    backupId: backup.id,
    createdAt: backup.manifest?.createdAt || new Date().toISOString(),
    createdBy: actor,
    schemaVersion: backup.manifest?.schemaVersion || null,
    validationStatus: validation.overallStatus,
  };
  await writeSetting(db, BASELINE_SETTING_KEY, baseline);
  await clearSetting(db, SESSION_SETTING_KEY);
  await clearSetting(db, LAST_RESULT_SETTING_KEY);
  return baseline;
};

const setActiveTestingBaseline = async ({ filename, actor = "system" } = {}) => {
  assertTestingLabAvailable();
  const db = await getDb();
  await assertNoActiveTestingSession(db, "mengganti baseline aktif");
  const backups = await listBackups();
  const backup = backups.find((entry) => entry.filename === String(filename || "").trim());
  if (!backup || backup.backupType !== "test" || !backup.fileExists || !backup.managedPath) {
    throw createHttpError("Baseline testing tidak ditemukan atau tidak berada di storage resmi.", 404, "TESTING_LAB_BASELINE_NOT_FOUND");
  }
  const preview = await getBackupPreview(backup);
  if (!preview.validForRestore || !preview.safeForRestore) {
    throw createHttpError("Baseline tidak lolos validasi restore atau tidak memiliki administrator aktif.", 409, "TESTING_LAB_BASELINE_INVALID");
  }

  const baseline = {
    filename: backup.filename,
    backupId: backup.id,
    createdAt: backup.manifest?.createdAt || backup.created_at,
    createdBy: backup.manifest?.createdBy || actor,
    schemaVersion: backup.manifest?.schemaVersion || null,
  };
  await writeSetting(db, BASELINE_SETTING_KEY, baseline);
  await clearSetting(db, LAST_RESULT_SETTING_KEY);
  await createAuditLog({
    module: "testing_lab",
    action: "baseline_select",
    entityType: "backup_log",
    entityId: backup.id,
    actor,
    description: "Backup testing dipilih sebagai baseline aktif sandbox",
    metadata: baseline,
  });
  return baseline;
};

const resetSandboxToBaseline = async ({ confirmKeyword, actor = "system" } = {}) => {
  assertTestingLabAvailable();
  if (String(confirmKeyword || "").trim() !== RESET_CONFIRM_KEYWORD) {
    throw createHttpError("Keyword reset sandbox belum sesuai.", 400, "TESTING_LAB_RESET_CONFIRMATION_REQUIRED");
  }

  beginTestingLabWriteLock({ actor, reason: "sandbox_reset_to_baseline" });
  try {
    const db = await getDb();
    const baseline = await readSetting(db, BASELINE_SETTING_KEY, null);
    const lastResult = await readSetting(db, LAST_RESULT_SETTING_KEY, null);
    const auditHistory = await captureTestingLabAuditHistory(db);
    if (!baseline?.filename) {
      throw createHttpError("Baseline aktif belum dipilih.", 409, "TESTING_LAB_BASELINE_REQUIRED");
    }
    const result = await executeRestore({
      confirmKeyword: RESTORE_CONFIRM_KEYWORD,
      filename: baseline.filename,
      actor,
      preBackupType: "pre-reset",
      preBackupAction: "testing_lab_pre_reset_backup_create",
      preBackupNotes: `Backup otomatis sebelum sandbox dikembalikan ke baseline ${baseline.filename}.`,
      broadcastReason: "testing_lab_baseline_reset_completed",
    });

    if (!result?.restored) {
      throw createHttpError("Reset sandbox tidak berhasil dijalankan.", 409, "TESTING_LAB_RESET_FAILED");
    }

    const restoredDb = await getDb();
    await writeSetting(restoredDb, BASELINE_SETTING_KEY, baseline);
    await clearSetting(restoredDb, SESSION_SETTING_KEY);
    if (lastResult) await writeSetting(restoredDb, LAST_RESULT_SETTING_KEY, lastResult);
    else await clearSetting(restoredDb, LAST_RESULT_SETTING_KEY);
    const restoredHistoryCount = await restoreTestingLabAuditHistory(auditHistory);
    await createAuditLog({
      module: "testing_lab",
      action: "sandbox_reset_complete",
      entityType: "backup_log",
      entityId: baseline.backupId || null,
      actor,
      description: "Database sandbox dikembalikan ke baseline testing verified",
      metadata: {
        baseline,
        preResetBackup: result.preRestoreBackup?.filename || null,
        activeDatabaseValidation: result.activeDatabaseValidation || null,
        restoredHistoryCount,
        lastResultPreserved: Boolean(lastResult),
      },
    });

    return {
      reset: true,
      baseline,
      preResetBackup: result.preRestoreBackup || null,
      validation: result.activeDatabaseValidation || null,
      restoredHistoryCount,
      lastResultPreserved: Boolean(lastResult),
      reloadRequired: true,
    };
  } finally {
    endTestingLabWriteLock();
  }
};

const startTestingSession = async ({ scenarioKey, actor = "system" } = {}) => {
  assertTestingLabAvailable();
  const scenario = SCENARIOS[String(scenarioKey || "").trim()];
  if (!scenario) throw createHttpError("Skenario testing tidak valid.", 400, "TESTING_LAB_SCENARIO_INVALID");

  const db = await getDb();
  const baseline = await readSetting(db, BASELINE_SETTING_KEY, null);
  if (!baseline?.filename) {
    throw createHttpError(
      "Buat atau pilih baseline verified sebelum memulai skenario.",
      409,
      "TESTING_LAB_BASELINE_REQUIRED",
    );
  }
  const current = await readSetting(db, SESSION_SETTING_KEY, null);
  if (current?.status === "active") {
    throw createHttpError("Masih ada sesi testing aktif. Selesaikan atau batalkan sesi tersebut.", 409, "TESTING_LAB_SESSION_ACTIVE");
  }

  const before = await getDatabaseSnapshot(db);
  const catalogEntry = buildScenarioCatalog(before.masterReadiness).find((entry) => entry.key === scenario.key);
  if (!catalogEntry.ready) {
    throw createHttpError(
      `Master data belum siap untuk skenario ini: ${catalogEntry.missingRequirements.join(", ")}.`,
      409,
      "TESTING_LAB_SCENARIO_NOT_READY",
    );
  }

  const session = {
    id: `TL-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    scenarioKey: scenario.key,
    scenarioLabel: scenario.label,
    status: "active",
    startedAt: new Date().toISOString(),
    startedBy: actor,
    before,
    steps: scenario.steps,
  };
  await writeSetting(db, SESSION_SETTING_KEY, session);
  await createAuditLog({
    module: "testing_lab",
    action: "session_start",
    entityType: "testing_session",
    entityId: session.id,
    actor,
    description: `Sesi Lab Pengujian dimulai: ${scenario.label}`,
    metadata: { scenarioKey: scenario.key, scopes: scenario.scopes },
  });
  return session;
};

const completeTestingSession = async ({ actor = "system", notes = "" } = {}) => {
  assertTestingLabAvailable();
  const db = await getDb();
  const session = await readSetting(db, SESSION_SETTING_KEY, null);
  if (!session || session.status !== "active") {
    throw createHttpError("Tidak ada sesi testing aktif.", 409, "TESTING_LAB_SESSION_NOT_ACTIVE");
  }

  const after = await getDatabaseSnapshot(db);
  const validation = await runTestingValidation();
  const result = {
    id: session.id,
    scenarioKey: session.scenarioKey,
    scenarioLabel: session.scenarioLabel,
    status: validation.overallStatus === "failed" ? "failed" : "completed",
    startedAt: session.startedAt,
    completedAt: new Date().toISOString(),
    startedBy: session.startedBy,
    completedBy: actor,
    notes: String(notes || "").trim().slice(0, 2_000),
    before: session.before,
    after,
    diff: buildSnapshotDiff(session.before, after),
    validation,
  };
  await writeSetting(db, LAST_RESULT_SETTING_KEY, result);
  await clearSetting(db, SESSION_SETTING_KEY);
  await createAuditLog({
    module: "testing_lab",
    action: "session_complete",
    entityType: "testing_session",
    entityId: result.id,
    actor,
    description: `Sesi Lab Pengujian selesai: ${result.scenarioLabel}`,
    metadata: {
      status: result.status,
      validationStatus: validation.overallStatus,
      completedAt: result.completedAt,
    },
  });
  return result;
};

const cancelTestingSession = async ({ actor = "system" } = {}) => {
  assertTestingLabAvailable();
  const db = await getDb();
  const session = await readSetting(db, SESSION_SETTING_KEY, null);
  if (!session) return { canceled: false };
  await clearSetting(db, SESSION_SETTING_KEY);
  await createAuditLog({
    module: "testing_lab",
    action: "session_cancel",
    entityType: "testing_session",
    entityId: session.id || null,
    actor,
    description: `Sesi Lab Pengujian dibatalkan: ${session.scenarioLabel || session.scenarioKey || "unknown"}`,
    metadata: { scenarioKey: session.scenarioKey || null },
  });
  return { canceled: true, sessionId: session.id || null };
};

const exportLastTestingResult = async () => {
  assertTestingLabAvailable();
  const db = await getDb();
  const result = await readSetting(db, LAST_RESULT_SETTING_KEY, null);
  if (!result) throw createHttpError("Belum ada hasil sesi testing untuk diekspor.", 404, "TESTING_LAB_RESULT_NOT_FOUND");
  return {
    exportMeta: {
      project: "IMS Bunga Flanel",
      exportType: "testing-lab-result",
      exportedAt: new Date().toISOString(),
      databasePurpose: env.databasePurpose,
      databaseFilename: path.basename(getDbPath()),
    },
    result,
  };
};

module.exports = {
  BASELINE_CONFIRM_KEYWORD,
  RESET_CONFIRM_KEYWORD,
  cancelTestingSession,
  completeTestingSession,
  createTestingBaseline,
  exportLastTestingResult,
  getSandboxGuard,
  getTestingLabRuntimeStatus,
  getTestingLabStatus,
  resetSandboxToBaseline,
  runTestingValidation,
  setActiveTestingBaseline,
  startTestingSession,
};
