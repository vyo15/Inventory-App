const fs = require("fs");
const path = require("path");
const {
  closeDb,
  getDb,
  getDbPath,
  getDbQueueStatus,
  runInTransaction,
  runSerializedDbOperation,
} = require("../../db/connection");
const env = require("../../config/env");
const { createAuditLog } = require("../../utils/auditLog");
const { safeJsonParse } = require("../../utils/jsonUtils");
const { upsertStockReadModel } = require("../../utils/sqliteStockEngine");
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

const STOCK_READ_MODEL_CLEANUP_CONFIRM_KEYWORD = "BERSIHKAN DATA STOK";

const STOCK_READ_MODEL_SOURCES = Object.freeze([
  { sourceType: "product", sourceCollection: "products", sourceLabel: "Produk" },
  { sourceType: "raw_material", sourceCollection: "raw_materials", sourceLabel: "Bahan Baku" },
  { sourceType: "semi_finished", sourceCollection: "semi_finished_materials", sourceLabel: "Barang Setengah Jadi" },
]);


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

const toFiniteInteger = (value = 0) => {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? Math.round(numericValue) : 0;
};

const normalizeAuditText = (value = "") => String(value ?? "").trim();

const getVariantAuditKey = (variant = {}, index = 0) => normalizeAuditText(
  variant.variantKey
  || variant.key
  || variant.id
  || variant.variantId
  || variant.code
  || variant.sku
  || variant.label
  || variant.name
  || `variant-${index}`,
).toLowerCase();

const getCanonicalVariantSnapshot = (payload = {}) => {
  const variants = Array.isArray(payload.variants) && payload.variants.length
    ? payload.variants
    : Array.isArray(payload.variantOptions)
      ? payload.variantOptions
      : [];

  return variants.map((variant, index) => ({
    key: getVariantAuditKey(variant, index),
    currentStock: toFiniteInteger(variant.currentStock ?? variant.stock ?? 0),
    reservedStock: toFiniteInteger(variant.reservedStock ?? 0),
    availableStock: toFiniteInteger(
      variant.availableStock
      ?? (toFiniteInteger(variant.currentStock ?? variant.stock ?? 0) - toFiniteInteger(variant.reservedStock ?? 0)),
    ),
    isActive: variant.isActive !== false,
    isArchived: variant.isArchived === true,
  })).sort((left, right) => left.key.localeCompare(right.key));
};

const toInventoryMasterPayload = (row = {}) => ({
  ...safeJsonParse(row.payload_json, {}),
  id: row.id,
  code: row.code || "",
  name: row.name || "",
  status: row.status || "active",
  isActive: row.is_active === 0 ? false : true,
  currentStock: toFiniteInteger(row.current_stock),
  stock: toFiniteInteger(row.current_stock),
  reservedStock: toFiniteInteger(row.reserved_stock),
  availableStock: toFiniteInteger(row.available_stock),
  minStockAlert: toFiniteInteger(row.min_stock_alert),
});

const getStockReadModelExpectedSnapshot = (payload = {}, sourceConfig = {}) => ({
  id: `${sourceConfig.sourceType}__${normalizeAuditText(payload.id)}`,
  sourceType: sourceConfig.sourceType,
  sourceCollection: sourceConfig.sourceCollection,
  sourceId: normalizeAuditText(payload.id),
  code: normalizeAuditText(payload.code).toUpperCase(),
  name: normalizeAuditText(payload.name),
  status: normalizeAuditText(payload.status || "active") || "active",
  isActive: payload.isActive !== false,
  currentStock: toFiniteInteger(payload.currentStock ?? payload.stock),
  reservedStock: toFiniteInteger(payload.reservedStock),
  availableStock: toFiniteInteger(payload.availableStock),
  minStockAlert: toFiniteInteger(payload.minStockAlert),
  variants: getCanonicalVariantSnapshot(payload),
});

const getStockReadModelActualSnapshot = (row = {}) => {
  const payload = safeJsonParse(row.payload_json, {}) || {};
  return {
    id: normalizeAuditText(row.id),
    sourceType: normalizeAuditText(payload.sourceType || row.source_type),
    sourceCollection: normalizeAuditText(payload.sourceCollection),
    sourceId: normalizeAuditText(payload.sourceId || row.source_id),
    code: normalizeAuditText(row.code || payload.code).toUpperCase(),
    name: normalizeAuditText(row.name || payload.name),
    status: normalizeAuditText(row.status || payload.status || "active") || "active",
    isActive: row.is_active === 0 ? false : payload.isActive !== false,
    currentStock: toFiniteInteger(row.current_stock ?? payload.currentStock ?? payload.stock),
    reservedStock: toFiniteInteger(row.reserved_stock ?? payload.reservedStock),
    availableStock: toFiniteInteger(row.available_stock ?? payload.availableStock),
    minStockAlert: toFiniteInteger(row.min_stock_alert ?? payload.minStockAlert),
    variants: getCanonicalVariantSnapshot(payload),
  };
};

const getSnapshotIssues = (expected = {}, actual = {}) => {
  const issues = [];
  const scalarFields = [
    ["sourceType", "tipe sumber"],
    ["sourceCollection", "collection sumber"],
    ["sourceId", "ID sumber"],
    ["code", "kode"],
    ["name", "nama"],
    ["status", "status"],
    ["isActive", "status aktif"],
    ["currentStock", "current stock"],
    ["reservedStock", "reserved stock"],
    ["availableStock", "available stock"],
    ["minStockAlert", "minimum stock"],
  ];

  for (const [field, label] of scalarFields) {
    if (expected[field] !== actual[field]) issues.push(label);
  }

  if (JSON.stringify(expected.variants) !== JSON.stringify(actual.variants)) {
    issues.push("snapshot varian");
  }

  return issues;
};

const buildStockReadModelAudit = async (db) => {
  const sourceRows = [];
  const sourceMap = new Map();

  for (const sourceConfig of STOCK_READ_MODEL_SOURCES) {
    const rows = await db.all(
      `SELECT * FROM ${sourceConfig.sourceCollection} WHERE status != 'deleted' ORDER BY id`,
    );
    for (const row of rows) {
      const payload = toInventoryMasterPayload(row);
      const expected = getStockReadModelExpectedSnapshot(payload, sourceConfig);
      sourceRows.push({ sourceConfig, payload, expected });
      sourceMap.set(expected.id, { sourceConfig, payload, expected });
    }
  }

  const readModelRows = await db.all(
    "SELECT * FROM stock_read_models WHERE status != 'deleted' ORDER BY id",
  );
  const readModelMap = new Map(readModelRows.map((row) => [normalizeAuditText(row.id), row]));
  const rows = [];

  for (const sourceRow of sourceRows) {
    const actualRow = readModelMap.get(sourceRow.expected.id);
    if (!actualRow) {
      rows.push({
        key: sourceRow.expected.id,
        readModelId: sourceRow.expected.id,
        sourceCollection: sourceRow.sourceConfig.sourceCollection,
        sourceType: sourceRow.sourceConfig.sourceType,
        sourceId: sourceRow.expected.sourceId,
        sourceLabel: sourceRow.sourceConfig.sourceLabel,
        itemName: sourceRow.expected.name || sourceRow.expected.code || sourceRow.expected.sourceId,
        category: "safe_repair",
        issueType: "missing",
        issue: "Data turunan stok belum tersedia.",
      });
      continue;
    }

    const actual = getStockReadModelActualSnapshot(actualRow);
    const issues = getSnapshotIssues(sourceRow.expected, actual);
    rows.push({
      key: sourceRow.expected.id,
      readModelId: sourceRow.expected.id,
      sourceCollection: sourceRow.sourceConfig.sourceCollection,
      sourceType: sourceRow.sourceConfig.sourceType,
      sourceId: sourceRow.expected.sourceId,
      sourceLabel: sourceRow.sourceConfig.sourceLabel,
      itemName: sourceRow.expected.name || sourceRow.expected.code || sourceRow.expected.sourceId,
      category: issues.length ? "safe_repair" : "ok",
      issueType: issues.length ? "stale" : "ok",
      issue: issues.length ? `Data turunan berbeda pada: ${issues.join(", ")}.` : "Data turunan stok sinkron.",
    });
  }

  for (const readModelRow of readModelRows) {
    const readModelId = normalizeAuditText(readModelRow.id);
    if (sourceMap.has(readModelId)) continue;
    const actual = getStockReadModelActualSnapshot(readModelRow);
    rows.push({
      key: readModelId,
      readModelId,
      sourceCollection: actual.sourceCollection || "unknown",
      sourceType: actual.sourceType || "unknown",
      sourceId: actual.sourceId || "",
      sourceLabel: "Data turunan tanpa master",
      itemName: actual.name || actual.code || readModelId,
      category: "manual",
      issueType: "orphan",
      issue: "Data turunan stok tidak memiliki master source aktif dan hanya boleh dibersihkan setelah konfirmasi eksplisit.",
    });
  }

  const missingCount = rows.filter((row) => row.issueType === "missing").length;
  const staleCount = rows.filter((row) => row.issueType === "stale").length;
  const orphanCount = rows.filter((row) => row.issueType === "orphan").length;
  const executablePlanCount = missingCount + staleCount;

  return {
    mode: "read_only_audit",
    dryRun: true,
    rows,
    affectedCollections: [
      ...STOCK_READ_MODEL_SOURCES.map((item) => item.sourceCollection),
      "stock_read_models",
    ],
    summary: {
      checkedRecords: sourceRows.length + readModelRows.length,
      sourceRecords: sourceRows.length,
      readModelRecords: readModelRows.length,
      missingCount,
      staleCount,
      orphanCount,
      issueCount: missingCount + staleCount + orphanCount,
      safeRepairCount: executablePlanCount,
      executablePlanCount,
      manualReviewCount: orphanCount,
      restockMetadataRepairCount: 0,
    },
  };
};

const buildDataQualityAudit = async (db) => {
  const categories = [];
  const integrityRows = await db.all("PRAGMA integrity_check;");
  const foreignKeyRows = await db.all("PRAGMA foreign_key_check;");
  const integrityMessages = integrityRows
    .map((row) => row.integrity_check || Object.values(row)[0])
    .filter(Boolean);
  const integrityIssues = integrityMessages.length === 1 && String(integrityMessages[0]).toLowerCase() === "ok"
    ? []
    : integrityMessages;

  categories.push({
    key: "database_integrity",
    label: "Integritas Database",
    collection: "sqlite",
    count: integrityIssues.length + foreignKeyRows.length,
    checkedRecords: integrityRows.length + foreignKeyRows.length,
    samples: [
      ...integrityIssues.slice(0, 5).map((message) => ({ issue: String(message) })),
      ...foreignKeyRows.slice(0, 5).map((row) => ({
        reference: `${row.table || "table"}:${row.rowid || "?"}`,
        issue: `Foreign key ${row.parent || "unknown"} tidak valid.`,
      })),
    ],
    recommendation: "Jika ada temuan, hentikan write operasional dan gunakan backup resmi sebelum tindakan lanjutan.",
  });

  const inventoryIssues = [];
  let inventoryChecked = 0;
  for (const sourceConfig of STOCK_READ_MODEL_SOURCES) {
    const totals = await db.get(`SELECT COUNT(*) AS count FROM ${sourceConfig.sourceCollection} WHERE status != 'deleted'`);
    inventoryChecked += Number(totals?.count || 0);
    const rows = await db.all(
      `SELECT id, code, name, current_stock, reserved_stock, available_stock
       FROM ${sourceConfig.sourceCollection}
       WHERE status != 'deleted'
         AND (
           current_stock < 0
           OR reserved_stock < 0
           OR available_stock < 0
           OR reserved_stock > current_stock
           OR available_stock != (current_stock - reserved_stock)
         )
       ORDER BY updated_at DESC
       LIMIT 50`,
    );
    inventoryIssues.push(...rows.map((row) => ({
      collectionName: sourceConfig.sourceLabel,
      reference: row.code || row.id,
      name: row.name || "",
      issue: `Invariant stok tidak valid: current=${row.current_stock}, reserved=${row.reserved_stock}, available=${row.available_stock}.`,
    })));
  }

  categories.push({
    key: "inventory_invariants",
    label: "Invariant Stok Master",
    collection: "inventory_master",
    count: inventoryIssues.length,
    checkedRecords: inventoryChecked,
    samples: inventoryIssues.slice(0, 10),
    recommendation: "Jangan repair stok master otomatis. Review transaksi, inventory log, dan sumber perubahan sebelum koreksi guarded.",
  });

  const stockReadModelAudit = await buildStockReadModelAudit(db);
  categories.push({
    key: "stock_read_models",
    label: "Data Turunan Stok",
    collection: "stock_read_models",
    count: stockReadModelAudit.summary.issueCount,
    checkedRecords: stockReadModelAudit.summary.checkedRecords,
    safeRepairCount: stockReadModelAudit.summary.executablePlanCount,
    samples: stockReadModelAudit.rows
      .filter((row) => row.category !== "ok")
      .slice(0, 10)
      .map((row) => ({
        collectionName: row.sourceLabel,
        reference: row.readModelId,
        name: row.itemName,
        issue: row.issue,
      })),
    recommendation: "Missing/stale projection dapat direbuild dari master. Orphan hanya dibersihkan dengan keyword eksplisit.",
  });

  const backupRows = await db.all(
    "SELECT id, filename, path, status FROM backup_logs WHERE status != 'retention_deleted' ORDER BY id DESC LIMIT 500",
  );
  const missingBackupFiles = backupRows.filter((row) => !row.path || !fs.existsSync(row.path));
  categories.push({
    key: "backup_registry",
    label: "Registry Backup",
    collection: "backup_logs",
    count: missingBackupFiles.length,
    checkedRecords: backupRows.length,
    samples: missingBackupFiles.slice(0, 10).map((row) => ({
      reference: row.filename || row.id,
      issue: "Log backup menunjuk ke file yang tidak ditemukan.",
    })),
    recommendation: "Verifikasi media backup eksternal. Jangan menghapus log tanpa memastikan file memang sudah tidak diperlukan.",
  });

  const financeIssues = await db.all(
    `SELECT movement_table, movement_id, movement_code FROM (
       SELECT 'incomes' AS movement_table, movement.id AS movement_id, movement.code AS movement_code
       FROM incomes movement
       LEFT JOIN money_movement_ledger ledger
         ON (
           ledger.id = ('ledger_' || movement.id)
           OR (ledger.source_id = movement.id AND ledger.source_type = movement.source_type)
         )
        AND ledger.status != 'deleted'
       WHERE movement.status != 'deleted' AND ledger.id IS NULL
       UNION ALL
       SELECT 'expenses' AS movement_table, movement.id AS movement_id, movement.code AS movement_code
       FROM expenses movement
       LEFT JOIN money_movement_ledger ledger
         ON (
           ledger.id = ('ledger_' || movement.id)
           OR (ledger.source_id = movement.id AND ledger.source_type = movement.source_type)
         )
        AND ledger.status != 'deleted'
       WHERE movement.status != 'deleted' AND ledger.id IS NULL
     )
     LIMIT 100`,
  );
  const financeCountRows = await Promise.all([
    db.get("SELECT COUNT(*) AS count FROM incomes WHERE status != 'deleted'"),
    db.get("SELECT COUNT(*) AS count FROM expenses WHERE status != 'deleted'"),
  ]);
  categories.push({
    key: "finance_ledger_pairs",
    label: "Pasangan Kas dan Ledger",
    collection: "money_movement_ledger",
    count: financeIssues.length,
    checkedRecords: financeCountRows.reduce((total, row) => total + Number(row?.count || 0), 0),
    samples: financeIssues.slice(0, 10).map((row) => ({
      collectionName: row.movement_table,
      reference: row.movement_code || row.movement_id,
      issue: "Transaksi kas aktif belum memiliki pasangan ledger aktif.",
    })),
    recommendation: "Review sumber transaksi dan audit log. Finance tidak diperbaiki otomatis oleh tool ini.",
  });

  const summary = categories.reduce((result, category) => {
    result.checkedRecords += Number(category.checkedRecords || 0);
    result.issueCount += Number(category.count || 0);
    result.safeRepairCount += Number(category.safeRepairCount || 0);
    return result;
  }, { checkedRecords: 0, issueCount: 0, safeRepairCount: 0 });

  return {
    mode: "read_only_audit",
    dryRun: true,
    auditedAt: new Date().toISOString(),
    summary: {
      ...summary,
      checkedAreas: categories.length,
      totalIssues: summary.issueCount,
    },
    categories,
    affectedCollections: categories.map((item) => item.collection).filter(Boolean),
    stockReadModelSummary: stockReadModelAudit.summary,
  };
};

const getDataQualityAudit = async () => runSerializedDbOperation(async () => {
  const db = await getDb();
  return buildDataQualityAudit(db);
}, { label: "maintenance_data_quality_audit" });

const getStockReadModelMaintenanceAudit = async () => runSerializedDbOperation(async () => {
  const db = await getDb();
  return buildStockReadModelAudit(db);
}, { label: "maintenance_stock_read_model_audit" });

const rebuildStockReadModels = async ({ actor = "system" } = {}) => runSerializedDbOperation(async () => {
  const db = await getDb();
  const audit = await buildStockReadModelAudit(db);
  const candidates = audit.rows.filter((row) => ["missing", "stale"].includes(row.issueType));
  if (!candidates.length) {
    return {
      message: "Data turunan stok sudah sinkron. Tidak ada data yang diubah.",
      updatedCount: 0,
      affectedCollections: ["stock_read_models"],
      summary: audit.summary,
    };
  }

  const preRepairBackup = await createOfficialSqliteBackup(db, {
    type: "pre-repair",
    actor,
    action: "pre_stock_read_model_repair_backup",
    notes: "Backup otomatis sebelum rebuild data turunan stock read model.",
  });

  return runInTransaction(async (transactionDb) => {
    let updatedCount = 0;
    for (const candidate of candidates) {
      const sourceConfig = STOCK_READ_MODEL_SOURCES.find(
        (item) => item.sourceCollection === candidate.sourceCollection,
      );
      if (!sourceConfig) continue;
      const sourceRow = await transactionDb.get(
        `SELECT * FROM ${sourceConfig.sourceCollection} WHERE id = ? AND status != 'deleted'`,
        [candidate.sourceId],
      );
      if (!sourceRow) continue;
      await upsertStockReadModel(transactionDb, toInventoryMasterPayload(sourceRow), {
        sourceType: sourceConfig.sourceType,
        sourceCollection: sourceConfig.sourceCollection,
        lastSyncedFrom: "maintenance_safe_repair",
      });
      updatedCount += 1;
    }

    const summary = {
      ...audit.summary,
      repairedCount: updatedCount,
      preRepairBackup: preRepairBackup.filename,
    };
    await createAuditLog({
      module: "maintenance",
      action: "stock_read_model_rebuild",
      entityType: "stock_read_models",
      entityId: "batch",
      actor,
      description: "Data turunan stock read model direbuild dari master stock dalam transaction guarded",
      metadata: summary,
    });

    return {
      message: `${updatedCount} data turunan stok berhasil diperbarui dari master stock.`,
      updatedCount,
      preRepairBackup,
      affectedCollections: ["stock_read_models"],
      summary,
    };
  }, { label: "maintenance_stock_read_model_rebuild_commit" });
}, { label: "maintenance_stock_read_model_rebuild" });

const deleteOrphanStockReadModels = async ({ confirmKeyword = "", actor = "system" } = {}) => {
  if (normalizeAuditText(confirmKeyword) !== STOCK_READ_MODEL_CLEANUP_CONFIRM_KEYWORD) {
    throw createHttpError(
      `Ketik ${STOCK_READ_MODEL_CLEANUP_CONFIRM_KEYWORD} untuk cleanup data turunan stok yatim.`,
      400,
      "STOCK_READ_MODEL_CLEANUP_CONFIRMATION_REQUIRED",
    );
  }

  return runSerializedDbOperation(async () => {
    const db = await getDb();
    const audit = await buildStockReadModelAudit(db);
    const candidates = audit.rows.filter((row) => row.issueType === "orphan");
    if (!candidates.length) {
      return {
        message: "Tidak ada data turunan stok yatim. Tidak ada data yang dihapus.",
        deletedCount: 0,
        affectedCollections: ["stock_read_models"],
        summary: audit.summary,
      };
    }

    const preRepairBackup = await createOfficialSqliteBackup(db, {
      type: "pre-repair",
      actor,
      action: "pre_stock_read_model_cleanup_backup",
      notes: "Backup otomatis sebelum cleanup orphan stock read model.",
    });

    return runInTransaction(async (transactionDb) => {
      let deletedCount = 0;
      for (const candidate of candidates) {
        const result = await transactionDb.run(
          "DELETE FROM stock_read_models WHERE id = ?",
          [candidate.readModelId],
        );
        deletedCount += Number(result?.changes || 0);
      }

      const summary = {
        ...audit.summary,
        deletedCount,
        preRepairBackup: preRepairBackup.filename,
      };
      await createAuditLog({
        module: "maintenance",
        action: "stock_read_model_orphan_cleanup",
        entityType: "stock_read_models",
        entityId: "batch",
        actor,
        description: "Orphan stock read model dihapus setelah audit, backup, keyword konfirmasi, dan transaction guarded",
        metadata: summary,
      });

      return {
        message: `${deletedCount} data turunan stok yatim berhasil dibersihkan.`,
        deletedCount,
        preRepairBackup,
        affectedCollections: ["stock_read_models"],
        summary,
      };
    }, { label: "maintenance_stock_read_model_cleanup_commit" });
  }, { label: "maintenance_stock_read_model_cleanup" });
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
      preRepairStoredAsManual: true,
      singleFilePackage: true,
      verifyChecksum: true,
      verifyIntegrityCheck: true,
      externalCopyReminderDays: 7,
    },
    restoreMode: "guarded_confirm_keyword",
    restoreConfirmKeyword: RESTORE_CONFIRM_KEYWORD,
    databaseQueue: getDbQueueStatus(),
    logging: {
      structured: true,
      fileLoggingEnabled: env.logToFile,
      logDir: env.logDir,
      maxFileBytes: env.logMaxBytes,
      retentionDays: env.logRetentionDays,
    },
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

const importBackupFile = async ({ body, headers = {}, query = {}, actor = "system" } = {}) => (
  runSerializedDbOperation(async () => {
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
      return await runInTransaction(async (db) => {
        const result = await db.run(
          `
            INSERT INTO backup_logs (filename, path, size_bytes, status)
            VALUES (?, ?, ?, 'verified')
          `,
          [uniqueBackup.filename, importedPath, backupBuffer.length],
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
      }, { label: "maintenance_backup_import_commit" });
    } catch (error) {
      if (importedPath) fs.rmSync(importedPath, { force: true });
      if (importedPath) fs.rmSync(`${importedPath}.manifest.json`, { force: true });
      throw error;
    }
  }, { label: "maintenance_backup_import" })
);

const removeSqliteRuntimeSidecars = (dbPath) => {
  for (const suffix of ["-wal", "-shm"]) {
    const sidecarPath = `${dbPath}${suffix}`;
    if (fs.existsSync(sidecarPath)) fs.rmSync(sidecarPath, { force: true });
  }
};

const createRestoreSiblingPath = (activeDbPath, label) => {
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  return `${activeDbPath}.${label}-${suffix}`;
};

const replaceActiveDatabaseWithCandidate = ({ activeDbPath, candidatePath, swapPath }) => {
  const hadActiveDb = fs.existsSync(activeDbPath);

  if (hadActiveDb) {
    fs.renameSync(activeDbPath, swapPath);
  }

  try {
    fs.renameSync(candidatePath, activeDbPath);
  } catch (error) {
    if (hadActiveDb && fs.existsSync(swapPath) && !fs.existsSync(activeDbPath)) {
      fs.renameSync(swapPath, activeDbPath);
    }
    throw error;
  }

  return { hadActiveDb };
};

const restoreActiveDatabaseFromSwap = ({ activeDbPath, swapPath, hadActiveDb }) => {
  if (!hadActiveDb || !fs.existsSync(swapPath)) {
    return false;
  }

  fs.rmSync(activeDbPath, { force: true });
  removeSqliteRuntimeSidecars(activeDbPath);
  fs.renameSync(swapPath, activeDbPath);
  removeSqliteRuntimeSidecars(activeDbPath);
  return true;
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

const executeRestore = async ({ confirmKeyword, filename, backupFileName, actor = "system" } = {}) => runSerializedDbOperation(async () => {
  const tempDir = path.join(env.backupDir, ".tmp", `restore-${Date.now()}`);
  const activeDbPath = getDbPath();
  let requestedFilename = "";
  let backup = null;
  let preRestoreBackup = null;
  let candidatePath = "";
  let swapPath = "";
  let activeDatabaseReplaced = false;
  let hadActiveDb = false;
  let restoreSucceeded = false;

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
    requestedFilename = normalizeBackupFilename(filename || backupFileName || "");
    if (!requestedFilename) {
      return {
        restored: false,
        backupRequired: true,
        destructiveAllowed: false,
      };
    }

    backup = await db.get(
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

    preRestoreBackup = await createOfficialSqliteBackup(db, {
      type: "pre-restore",
      actor,
      action: "pre_restore_backup_create",
      notes: `Backup otomatis sebelum restore dari ${requestedFilename}.`,
    });

    const extractedBackup = await extractBackupDatabaseToTemp(backup, tempDir);
    candidatePath = createRestoreSiblingPath(activeDbPath, "restore-candidate");
    swapPath = createRestoreSiblingPath(activeDbPath, "restore-rollback");
    fs.copyFileSync(extractedBackup.dbPath, candidatePath, fs.constants.COPYFILE_EXCL);

    await closeDb();
    removeSqliteRuntimeSidecars(activeDbPath);

    const replacement = replaceActiveDatabaseWithCandidate({
      activeDbPath,
      candidatePath,
      swapPath,
    });
    hadActiveDb = replacement.hadActiveDb;
    activeDatabaseReplaced = true;
    candidatePath = "";

    await runMigrations();
    const restoredDb = await getDb();
    const activeValidation = await getActiveDbValidation(restoredDb);

    if (!activeValidation.valid) {
      throw createHttpError(
        "Database hasil restore gagal validasi integrity/foreign key.",
        500,
        "RESTORE_POST_VALIDATION_FAILED"
      );
    }

    const registeredPreRestoreBackup = await registerRestoredBackupLog(restoredDb, preRestoreBackup, { status: "verified" });
    const registeredRestoreSourceBackup = await registerRestoredBackupLog(restoredDb, backup, { status: backup.status || "verified" });

    const summary = {
      mode: "executed_guarded",
      restored: true,
      rollbackAvailable: Boolean(hadActiveDb && swapPath),
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
        "Database aktif diganti secara staged setelah backup otomatis dibuat,",
        "checksum/integrity valid, keyword konfirmasi valid, dan validasi database aktif lulus.",
        "Jika migrasi, validasi, atau audit gagal, database sebelum restore dikembalikan otomatis.",
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
      description: "Restore database lokal guarded berhasil dijalankan setelah validasi backup dan database aktif",
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

    restoreSucceeded = true;
    fs.rmSync(swapPath, { force: true });
    swapPath = "";

    return {
      id: result.lastID,
      ...summary,
    };
  } catch (error) {
    if (!activeDatabaseReplaced) {
      throw error;
    }

    const rollbackSummary = {
      mode: "automatic_restore_rollback",
      restored: false,
      rollbackAttempted: true,
      rollbackSucceeded: false,
      selectedBackup: requestedFilename || backup?.filename || null,
      preRestoreBackup: preRestoreBackup?.filename || null,
      originalErrorCode: error?.errorCode || error?.code || "RESTORE_EXECUTION_FAILED",
      originalErrorMessage: error?.message || "Restore gagal setelah database aktif diganti.",
      actor,
    };

    try {
      await closeDb().catch(() => {});

      let restoredFromSwap = restoreActiveDatabaseFromSwap({
        activeDbPath,
        swapPath,
        hadActiveDb,
      });

      if (!restoredFromSwap && preRestoreBackup) {
        const rollbackTempDir = path.join(tempDir, "automatic-rollback");
        const rollbackBackup = await extractBackupDatabaseToTemp(preRestoreBackup, rollbackTempDir);
        const rollbackCandidatePath = createRestoreSiblingPath(activeDbPath, "automatic-rollback-candidate");

        try {
          fs.copyFileSync(rollbackBackup.dbPath, rollbackCandidatePath, fs.constants.COPYFILE_EXCL);
          fs.rmSync(activeDbPath, { force: true });
          removeSqliteRuntimeSidecars(activeDbPath);
          fs.renameSync(rollbackCandidatePath, activeDbPath);
          restoredFromSwap = true;
        } finally {
          fs.rmSync(rollbackCandidatePath, { force: true });
        }
      }

      if (!restoredFromSwap) {
        throw new Error("Snapshot database sebelum restore tidak tersedia untuk rollback otomatis.");
      }

      const rollbackDb = await getDb();
      const rollbackValidation = await getActiveDbValidation(rollbackDb);
      if (!rollbackValidation.valid) {
        throw new Error(
          `Database hasil rollback tidak valid: integrity=${rollbackValidation.integrityCheck}, foreignKey=${rollbackValidation.foreignKeyCheck}`
        );
      }

      rollbackSummary.rollbackSucceeded = true;
      rollbackSummary.activeDatabaseValidation = rollbackValidation;

      const rollbackLog = await rollbackDb.run(
        `
          INSERT INTO restore_logs (filename, backup_path, plan_status, destructive_allowed, summary_json, actor)
          VALUES (?, ?, 'rolled_back_guarded', 0, ?, ?)
        `,
        [
          backup?.filename || requestedFilename || "unknown",
          backup?.path || "",
          JSON.stringify(rollbackSummary),
          actor,
        ]
      );

      await createAuditLog({
        module: "maintenance",
        action: "restore_rollback",
        entityType: "restore_log",
        entityId: rollbackLog.lastID,
        actor,
        description: "Restore gagal dan database aktif sebelum restore berhasil dikembalikan otomatis",
        metadata: rollbackSummary,
      });
    } catch (rollbackError) {
      const fatalError = createHttpError(
        "Restore gagal dan rollback otomatis juga gagal. Hentikan layanan lokal dan pulihkan backup pre-restore secara manual.",
        500,
        "RESTORE_ROLLBACK_FAILED"
      );
      fatalError.cause = error;
      fatalError.rollbackError = rollbackError;
      throw fatalError;
    }

    const safeError = createHttpError(
      "Restore gagal. Database aktif berhasil dikembalikan otomatis ke kondisi sebelum restore.",
      500,
      "RESTORE_ROLLED_BACK"
    );
    safeError.cause = error;
    safeError.rollback = rollbackSummary;
    throw safeError;
  } finally {
    if (!restoreSucceeded && candidatePath) {
      fs.rmSync(candidatePath, { force: true });
    }
    if (restoreSucceeded && swapPath) {
      fs.rmSync(swapPath, { force: true });
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

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
  getDataQualityAudit,
  getMaintenanceStatus,
  getStockReadModelMaintenanceAudit,
  importBackupFile,
  rebuildStockReadModels,
  deleteOrphanStockReadModels,
  listBackups,
  listRestoreLogs,
};
