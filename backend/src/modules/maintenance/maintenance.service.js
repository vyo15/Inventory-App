const fs = require("fs");
const path = require("path");
const { closeDb, getDb, getDbPath } = require("../../db/connection");
const env = require("../../config/env");
const { createAuditLog } = require("../../utils/auditLog");
const { safeJsonParse } = require("../../utils/jsonUtils");
const { runMigrations } = require("../../db/migrate");
const {
  RESTORE_CONFIRM_KEYWORD,
  SUPPORTED_BACKUP_FILE_SUFFIXES,
  createOfficialSqliteBackup,
  enrichBackupLog,
  enrichBackupLogs,
  extractBackupDatabaseToTemp,
  getBackupPreview,
  isSupportedBackupPackageName,
  normalizeBackupFilename,
  sanitizeImportedBackupFilename,
} = require("../../utils/sqliteBackup");

const IMPORT_BACKUP_MAX_BYTES = 200 * 1024 * 1024;

const MASTER_DATA_EXPORT_TABLES = [
  { key: "products", label: "Products", table: "products", openingStock: true },
  { key: "raw_materials", label: "Raw Materials", table: "raw_materials", openingStock: true },
  { key: "semi_finished_materials", label: "Semi Finished Materials", table: "semi_finished_materials", openingStock: true },
  { key: "supplierPurchases", label: "Supplier / Vendor Restock", table: "suppliers" },
  { key: "customers", label: "Customers", table: "customers" },
  { key: "production_steps", label: "Production Steps", table: "production_steps" },
  { key: "production_employees", label: "Production Employees", table: "production_employees" },
  { key: "production_boms", label: "Production BOMs", table: "production_boms" },
  { key: "pricing_rules", label: "Pricing Rules", table: "pricing_rules" },
  { key: "categories", label: "Categories", table: "categories" },
  { key: "production_profiles", label: "Production Profiles", table: "production_profiles" },
];

const createHttpError = (message, statusCode = 400, errorCode = "MAINTENANCE_ERROR") => {
  const error = new Error(message);
  error.publicMessage = message;
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
};

const getUniqueBackupPath = (targetDir, filename) => {
  let candidateName = filename;
  let candidatePath = path.join(targetDir, candidateName);
  const extension = SUPPORTED_BACKUP_FILE_SUFFIXES.find((suffix) => candidateName.toLowerCase().endsWith(suffix))
    || path.extname(candidateName);
  const baseName = extension ? candidateName.slice(0, -extension.length) : candidateName;
  let index = 1;

  while (fs.existsSync(candidatePath)) {
    candidateName = `${baseName}-${index}${extension}`;
    candidatePath = path.join(targetDir, candidateName);
    index += 1;
  }

  return { filename: candidateName, path: candidatePath };
};

const decodeImportFilename = (value) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";
  try {
    return decodeURIComponent(rawValue);
  } catch (_error) {
    return rawValue;
  }
};

const pickRowCode = (row = {}) => row.code || row.customer_code || row.supplier_code || row.id || "";

const normalizeExportRow = (row = {}, tableConfig = {}) => {
  const payload = safeJsonParse(row.payload_json, null);
  const normalized = {
    ...row,
    sourceTable: tableConfig.table,
  };
  delete normalized.payload_json;
  if (payload) normalized.payload = payload;
  return normalized;
};

const buildOpeningStockReference = (collection, rows = []) => rows.map((row) => {
  const payload = safeJsonParse(row.payload_json, {}) || {};
  return {
    collectionKey: collection.key,
    sourceTable: collection.table,
    id: row.id,
    code: pickRowCode(row),
    name: row.name || payload.name || payload.productName || payload.materialName || "",
    status: row.status || payload.status || "active",
    unit: payload.unit || payload.stockUnit || payload.baseUnit || "",
    currentStock: Number(row.current_stock ?? payload.currentStock ?? 0),
    reservedStock: Number(row.reserved_stock ?? payload.reservedStock ?? 0),
    availableStock: Number(row.available_stock ?? payload.availableStock ?? 0),
    minStockAlert: Number(row.min_stock_alert ?? payload.minStockAlert ?? 0),
  };
});

const buildMasterDataExportPayload = async ({ includeOpeningStock = true } = {}) => {
  const db = await getDb();
  const collections = [];
  const warnings = [];
  const openingStockReference = [];

  for (const collection of MASTER_DATA_EXPORT_TABLES) {
    try {
      const rows = await db.all(`SELECT * FROM ${collection.table} ORDER BY updated_at DESC, created_at DESC`);
      collections.push({
        key: collection.key,
        label: collection.label,
        sourceTable: collection.table,
        totalRecords: rows.length,
        records: rows.map((row) => normalizeExportRow(row, collection)),
      });

      if (includeOpeningStock && collection.openingStock) {
        openingStockReference.push(...buildOpeningStockReference(collection, rows));
      }
    } catch (error) {
      warnings.push({
        collectionKey: collection.key,
        label: collection.label,
        sourceTable: collection.table,
        message: error?.message || "Collection tidak bisa dibaca.",
      });
    }
  }

  return {
    exportMeta: {
      project: "IMS Bunga Flanel",
      exportType: "master-data-json",
      dataSource: "sqlite_backend_read_only",
      exportedAt: new Date().toISOString(),
      includeOpeningStock,
      restoreMode: "not_restore_package",
      note: "Export ini untuk arsip/review data master. Restore penuh tetap menggunakan File Backup IMS .imsbackup.",
    },
    summary: {
      totalCollections: collections.length,
      totalRecords: collections.reduce((total, item) => total + Number(item.totalRecords || 0), 0),
      openingStockRows: openingStockReference.length,
      warnings: warnings.length,
    },
    collections,
    openingStockReference,
    warnings,
  };
};

const getMaintenanceStatus = async () => {
  const db = await getDb();
  const [
    schemaVersion,
    userCount,
    activeAdminCount,
    customerCount,
    categoryCount,
    supplierCount,
    auditCount,
    backupCount,
    restorePlanCount,
    moduleRuntimeStatusCount,
    latestBackup,
    legacyBearerMigrationSummary,
    recentLegacyBearerMigrationCount,
  ] = await Promise.all([
    db.get("SELECT value FROM schema_meta WHERE key = 'schema_version'"),
    db.get("SELECT COUNT(*) AS count FROM users"),
    db.get("SELECT COUNT(*) AS count FROM users WHERE role = 'administrator' AND status = 'active'"),
    db.get("SELECT COUNT(*) AS count FROM customers WHERE status != 'deleted'"),
    db.get("SELECT COUNT(*) AS count FROM categories WHERE status != 'deleted'"),
    db.get("SELECT COUNT(*) AS count FROM suppliers WHERE status != 'deleted'"),
    db.get("SELECT COUNT(*) AS count FROM audit_logs"),
    db.get("SELECT COUNT(*) AS count FROM backup_logs WHERE status != 'retention_deleted'"),
    db.get("SELECT COUNT(*) AS count FROM restore_logs"),
    db.get("SELECT COUNT(*) AS count FROM module_migration_status"),
    db.get("SELECT * FROM backup_logs WHERE status != 'retention_deleted' ORDER BY id DESC LIMIT 1"),
    db.get(
      `SELECT COUNT(*) AS count, MAX(created_at) AS latest_at
       FROM audit_logs
       WHERE module = 'auth' AND action = 'legacy_bearer_migrated'`
    ),
    db.get(
      `SELECT COUNT(*) AS count
       FROM audit_logs
       WHERE module = 'auth'
         AND action = 'legacy_bearer_migrated'
         AND created_at >= datetime('now', '-7 days')`
    ),
  ]);

  return {
    dbPath: getDbPath(),
    backupDir: env.backupDir,
    schemaVersion: schemaVersion?.value || "unknown",
    userCount: userCount?.count || 0,
    activeAdministratorCount: activeAdminCount?.count || 0,
    customerCount: customerCount?.count || 0,
    categoryCount: categoryCount?.count || 0,
    supplierCount: supplierCount?.count || 0,
    auditCount: auditCount?.count || 0,
    backupCount: backupCount?.count || 0,
    restorePlanCount: restorePlanCount?.count || 0,
    moduleRuntimeStatusCount: moduleRuntimeStatusCount?.count || 0,
    migrationStatusCount: moduleRuntimeStatusCount?.count || 0,
    latestBackup: enrichBackupLog(latestBackup),
    backupFormat: "imsbackup_single_file_manifest_checksum",
    backupPolicy: {
      folders: ["daily", "monthly", "manual"],
      manual: true,
      autoDaily: true,
      dailyRetentionDays: 60,
      autoMonthlyPromotion: true,
      monthlyRetentionCount: 12,
      manualAutoDelete: false,
      preRestoreStoredAsManual: true,
      singleFilePackage: true,
      verifyChecksum: true,
      verifyIntegrityCheck: true,
      externalCopyReminderDays: 7,
    },
    restoreMode: "guarded_confirm_keyword",
    restoreConfirmKeyword: RESTORE_CONFIRM_KEYWORD,
    authCompatibility: {
      legacyBearerEnabled: env.authAllowLegacyBearer,
      cookieSessionActive: true,
      removalReady: env.authAllowLegacyBearer === false,
      manualConfirmationRequired: env.authAllowLegacyBearer === true,
      migrationEvidence: {
        totalMigrations: Number(legacyBearerMigrationSummary?.count || 0),
        recentMigrations7d: Number(recentLegacyBearerMigrationCount?.count || 0),
        latestMigrationAt: legacyBearerMigrationSummary?.latest_at || null,
        quietWindowDays: 7,
      },
    },
  };
};

const createBackup = async ({ type, actor = "system", notes } = {}) => {
  const db = await getDb();
  return createOfficialSqliteBackup(db, {
    type: type || "manual",
    actor,
    action: "backup_create",
    notes: notes || "Backup manual resmi dari UI IMS.",
  });
};

const getBackupDownload = async (filename) => {
  const requestedFilename = normalizeBackupFilename(filename || "");
  if (!requestedFilename) {
    throw createHttpError("Nama file backup wajib dipilih.", 400, "BACKUP_FILENAME_REQUIRED");
  }

  const db = await getDb();
  const backup = await db.get(
    "SELECT * FROM backup_logs WHERE filename = ? ORDER BY id DESC LIMIT 1",
    [requestedFilename]
  );

  if (!backup?.path || !fs.existsSync(backup.path)) {
    throw createHttpError("File backup tidak ditemukan atau belum terdaftar.", 404, "BACKUP_NOT_FOUND");
  }

  return {
    path: backup.path,
    filename: backup.filename,
  };
};

const importBackupFile = async ({ body, headers = {}, query = {}, actor = "system" } = {}) => {
  let importedPath = "";
  try {
    const backupBuffer = Buffer.isBuffer(body) ? body : null;
    if (!backupBuffer?.length) {
      throw createHttpError("File backup wajib dipilih sebelum import.", 400, "BACKUP_IMPORT_EMPTY");
    }
    if (backupBuffer.length > IMPORT_BACKUP_MAX_BYTES) {
      throw createHttpError("File backup terlalu besar untuk import lokal.", 413, "BACKUP_IMPORT_TOO_LARGE");
    }

    const rawFilename = decodeImportFilename(headers["x-ims-backup-filename"] || query?.filename || "");
    const safeSourceName = sanitizeImportedBackupFilename(rawFilename);
    if (!safeSourceName || !isSupportedBackupPackageName(safeSourceName)) {
      throw createHttpError(
        "Format file backup tidak didukung. Gunakan File Backup IMS (.imsbackup) atau backup legacy .imsbak.zip.",
        400,
        "BACKUP_IMPORT_UNSUPPORTED_FORMAT",
      );
    }

    const importedDir = path.join(env.backupDir, "manual");
    fs.mkdirSync(importedDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const uniqueBackup = getUniqueBackupPath(importedDir, `IMPORT-${timestamp}-${safeSourceName}`);
    importedPath = uniqueBackup.path;
    fs.writeFileSync(importedPath, backupBuffer, { flag: "wx" });

    const importedBackup = {
      filename: uniqueBackup.filename,
      path: importedPath,
      size_bytes: backupBuffer.length,
      status: "imported",
    };
    const preview = await getBackupPreview(importedBackup);
    if (!preview.validForRestore) {
      throw createHttpError("File backup berhasil dibaca tetapi tidak valid untuk restore.", 400, "BACKUP_IMPORT_INVALID");
    }

    const manifest = preview.manifest || null;

    const db = await getDb();
    const result = await db.run(
      `
        INSERT INTO backup_logs (filename, path, size_bytes, status)
        VALUES (?, ?, ?, 'verified')
      `,
      [uniqueBackup.filename, importedPath, backupBuffer.length]
    );

    const summary = {
      id: result.lastID,
      filename: uniqueBackup.filename,
      originalFilename: safeSourceName,
      path: importedPath,
      sizeBytes: backupBuffer.length,
      status: "verified",
      backupType: manifest?.backupType || "manual-import",
      storageClass: "manual",
      sourceBackupType: manifest?.backupType || null,
      manifest,
      validation: preview.validation,
      validForRestore: true,
    };

    await createAuditLog({
      module: "maintenance",
      action: "backup_import",
      entityType: "backup_log",
      entityId: result.lastID,
      actor,
      description: "File Backup IMS berhasil diimport dan diverifikasi untuk restore guarded",
      metadata: summary,
    });

    return summary;
  } catch (error) {
    if (importedPath) fs.rmSync(importedPath, { force: true });
    if (importedPath) fs.rmSync(`${importedPath}.manifest.json`, { force: true });
    throw error;
  }
};

const removeSqliteRuntimeSidecars = (dbPath) => {
  for (const suffix of ["-wal", "-shm"]) {
    const sidecarPath = `${dbPath}${suffix}`;
    if (fs.existsSync(sidecarPath)) fs.rmSync(sidecarPath, { force: true });
  }
};

const getActiveDbValidation = async (db) => {
  const integrityRows = await db.all("PRAGMA integrity_check;");
  const foreignKeyRows = await db.all("PRAGMA foreign_key_check;");
  const integrityMessages = integrityRows
    .map((row) => row.integrity_check || Object.values(row)[0])
    .filter(Boolean);
  const integrityCheck = integrityMessages.length === 1 && String(integrityMessages[0]).toLowerCase() === "ok"
    ? "ok"
    : integrityMessages.join("; ") || "unknown";

  return {
    integrityCheck,
    foreignKeyCheck: foreignKeyRows.length ? `${foreignKeyRows.length} issue(s)` : "ok",
    valid: integrityCheck === "ok" && foreignKeyRows.length === 0,
  };
};

const registerRestoredBackupLog = async (db, backup, { status = "verified" } = {}) => {
  if (!backup?.filename || !backup?.path) return null;

  const existing = await db.get(
    "SELECT * FROM backup_logs WHERE filename = ? AND path = ? ORDER BY id DESC LIMIT 1",
    [backup.filename, backup.path]
  );
  if (existing) return enrichBackupLog(existing);

  const sizeBytes = Number(
    backup.sizeBytes
    ?? backup.size_bytes
    ?? (fs.existsSync(backup.path) ? fs.statSync(backup.path).size : 0)
  );
  const createdAt = backup.manifest?.createdAt || backup.createdAt || backup.created_at || new Date().toISOString();
  const result = await db.run(
    `
      INSERT INTO backup_logs (filename, path, size_bytes, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    [backup.filename, backup.path, sizeBytes, status, createdAt]
  );

  return enrichBackupLog({
    id: result.lastID,
    filename: backup.filename,
    path: backup.path,
    size_bytes: sizeBytes,
    status,
    created_at: createdAt,
  });
};

const executeRestore = async ({ confirmKeyword, filename, backupFileName, actor = "system" } = {}) => {
  const tempDir = path.join(env.backupDir, ".tmp", `restore-${Date.now()}`);

  try {
    const normalizedConfirmKeyword = String(confirmKeyword || "").trim();
    if (normalizedConfirmKeyword !== RESTORE_CONFIRM_KEYWORD) {
      return {
        restored: false,
        requiredConfirmKeyword: RESTORE_CONFIRM_KEYWORD,
        destructiveAllowed: false,
      };
    }

    const db = await getDb();
    const requestedFilename = normalizeBackupFilename(filename || backupFileName || "");
    if (!requestedFilename) {
      return {
        restored: false,
        backupRequired: true,
        destructiveAllowed: false,
      };
    }

    const backup = await db.get(
      "SELECT * FROM backup_logs WHERE filename = ? ORDER BY id DESC LIMIT 1",
      [requestedFilename]
    );

    if (!backup?.path || !fs.existsSync(backup.path)) {
      return {
        restored: false,
        backupFound: Boolean(backup),
        backupFileExists: false,
      };
    }

    const preview = await getBackupPreview(backup);
    if (!preview.validForRestore) {
      return {
        restored: false,
        backupFound: true,
        backupFileExists: true,
        destructiveAllowed: false,
        preview,
      };
    }

    const preRestoreBackup = await createOfficialSqliteBackup(db, {
      type: "pre-restore",
      actor,
      action: "pre_restore_backup_create",
      notes: `Backup otomatis sebelum restore dari ${requestedFilename}.`,
    });

    const extractedBackup = await extractBackupDatabaseToTemp(backup, tempDir);
    const activeDbPath = getDbPath();
    await closeDb();
    fs.copyFileSync(extractedBackup.dbPath, activeDbPath);
    removeSqliteRuntimeSidecars(activeDbPath);

    await runMigrations();
    const restoredDb = await getDb();
    const activeValidation = await getActiveDbValidation(restoredDb);
    const registeredPreRestoreBackup = await registerRestoredBackupLog(restoredDb, preRestoreBackup, { status: "verified" });
    const registeredRestoreSourceBackup = await registerRestoredBackupLog(restoredDb, backup, { status: backup.status || "verified" });

    const summary = {
      mode: "executed_guarded",
      restored: true,
      selectedBackup: {
        id: backup.id,
        filename: backup.filename,
        path: backup.path,
        sizeBytes: backup.size_bytes,
        createdAt: backup.created_at,
      },
      backupManifest: extractedBackup.manifest || preview.manifest || null,
      backupValidation: extractedBackup.validation || preview.validation || null,
      activeDatabaseValidation: activeValidation,
      preRestoreBackup,
      registeredPreRestoreBackup,
      registeredRestoreSourceBackup,
      actor,
      note: [
        "Database aktif dioverwrite dari backup setelah backup otomatis dibuat,",
        "checksum/integrity valid, keyword konfirmasi valid, backup pre-restore didaftarkan ulang,",
        "dan backup sumber restore dipastikan tercatat di database hasil restore.",
      ].join(" "),
    };

    const result = await restoredDb.run(
      `
        INSERT INTO restore_logs (filename, backup_path, plan_status, destructive_allowed, summary_json, actor)
        VALUES (?, ?, 'executed_guarded', 1, ?, ?)
      `,
      [backup.filename, backup.path, JSON.stringify(summary), actor]
    );

    await createAuditLog({
      module: "maintenance",
      action: "restore_execute",
      entityType: "restore_log",
      entityId: result.lastID,
      actor,
      description: "Restore database lokal guarded berhasil dijalankan setelah validasi backup",
      metadata: summary,
    });

    if (registeredPreRestoreBackup?.id) {
      await createAuditLog({
        module: "maintenance",
        action: "pre_restore_backup_re_register",
        entityType: "backup_log",
        entityId: registeredPreRestoreBackup.id,
        actor,
        description: "Backup pre-restore otomatis didaftarkan ulang setelah database aktif selesai direstore",
        metadata: {
          filename: registeredPreRestoreBackup.filename,
          path: registeredPreRestoreBackup.path,
          sizeBytes: registeredPreRestoreBackup.size_bytes,
          backupType: registeredPreRestoreBackup.backupType,
          restoreSource: backup.filename,
        },
      });
    }

    if (registeredRestoreSourceBackup?.id) {
      await createAuditLog({
        module: "maintenance",
        action: "restore_source_backup_re_register",
        entityType: "backup_log",
        entityId: registeredRestoreSourceBackup.id,
        actor,
        description: "Backup sumber restore dipastikan tercatat ulang setelah database aktif selesai direstore",
        metadata: {
          filename: registeredRestoreSourceBackup.filename,
          path: registeredRestoreSourceBackup.path,
          sizeBytes: registeredRestoreSourceBackup.size_bytes,
          backupType: registeredRestoreSourceBackup.backupType,
          restoreSource: backup.filename,
        },
      });
    }

    return {
      id: result.lastID,
      ...summary,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const createRestorePlan = async ({ filename, backupFileName, actor = "system" } = {}) => {
  const db = await getDb();
  const requestedFilename = normalizeBackupFilename(filename || backupFileName || "");
  const backup = requestedFilename
    ? await db.get("SELECT * FROM backup_logs WHERE filename = ? ORDER BY id DESC LIMIT 1", [requestedFilename])
    : await db.get("SELECT * FROM backup_logs ORDER BY id DESC LIMIT 1");

  const activeDbExists = fs.existsSync(getDbPath());
  const preview = backup ? await getBackupPreview(backup).catch((error) => ({
    backup: enrichBackupLog(backup),
    validationError: error.message,
    validForRestore: false,
  })) : null;

  const summary = {
    mode: "preview_only",
    destructiveAllowed: false,
    requiredConfirmKeyword: RESTORE_CONFIRM_KEYWORD,
    backupFound: Boolean(backup),
    backupFileExists: Boolean(preview?.backup?.fileExists),
    activeDbExists,
    validForRestore: Boolean(preview?.validForRestore),
    selectedBackup: preview?.backup ? {
      id: preview.backup.id,
      filename: preview.backup.filename,
      path: preview.backup.path,
      sizeBytes: preview.backup.size_bytes,
      createdAt: preview.backup.created_at,
      status: preview.backup.status,
      backupType: preview.backup.backupType,
      manifestStatus: preview.backup.manifestStatus,
    } : null,
    manifest: preview?.manifest || preview?.backup?.manifest || null,
    validation: preview?.validation || null,
    validationError: preview?.validationError || null,
    blockedActions: [
      "Tidak overwrite database aktif.",
      "Tidak menghentikan layanan lokal otomatis.",
      "Tidak menghapus file database lokal aktif.",
      "Restore destructive hanya lewat /api/maintenance/restore-execute dengan session administrator lokal dan keyword konfirmasi.",
    ],
    guidedSteps: [
      "Pilih backup dari daftar resmi.",
      "Validasi checksum dan integrity check.",
      "Review preview jumlah data.",
      `Ketik ${RESTORE_CONFIRM_KEYWORD} untuk eksekusi restore guarded.`,
    ],
    manualSafeSteps: [
      "Buat backup terbaru terlebih dahulu.",
      "Jangan copy file database lokal aktif saat layanan berjalan.",
      "Gunakan restore guarded dari UI agar sistem membuat pre-restore backup otomatis.",
      "Setelah restore, refresh aplikasi dan cek status layanan dari Maintenance Center.",
    ],
  };

  const result = await db.run(
    `
      INSERT INTO restore_logs (filename, backup_path, plan_status, destructive_allowed, summary_json, actor)
      VALUES (?, ?, 'preview_only', 0, ?, ?)
    `,
    [backup?.filename || requestedFilename || null, backup?.path || null, JSON.stringify(summary), actor]
  );

  await createAuditLog({
    module: "maintenance",
    action: "restore_plan_preview",
    entityType: "restore_log",
    entityId: result.lastID,
    actor,
    description: "Restore plan database lokal dibuat sebagai preview-only dengan validasi backup",
    metadata: summary,
  });

  return {
    id: result.lastID,
    ...summary,
  };
};

const listRestoreLogs = async () => {
  const db = await getDb();
  return db.all("SELECT * FROM restore_logs ORDER BY id DESC LIMIT 50");
};

const listBackups = async () => {
  const db = await getDb();
  const rows = await db.all(
    "SELECT * FROM backup_logs WHERE status != 'retention_deleted' ORDER BY created_at DESC, id DESC LIMIT 500"
  );
  return enrichBackupLogs(rows);
};

module.exports = {
  IMPORT_BACKUP_MAX_BYTES,
  buildMasterDataExportPayload,
  createBackup,
  createRestorePlan,
  executeRestore,
  getBackupDownload,
  getMaintenanceStatus,
  importBackupFile,
  listBackups,
  listRestoreLogs,
};
