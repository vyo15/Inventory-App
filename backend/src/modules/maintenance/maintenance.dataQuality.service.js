const { normalizeLowerText } = require("../../utils/textNormalization");
const {
  getDb,
  getDatabaseGeneration,
  getDbPath,
  getDbQueueStatus,
  runInTransaction,
  runSerializedDbOperation,
} = require("../../db/connection");
const { TABLES } = require("../../db/schema");
const env = require("../../config/env");
const { createAuditLog } = require("../../utils/auditLog");
const { safeJsonParse } = require("../../utils/jsonUtils");
const { createHttpError } = require("./maintenance.shared");
const { upsertStockReadModel } = require("../stock/engine");
const { getRealtimeRuntimeStatus } = require("../realtime/realtime.service");
const {
  buildStockReadModelSourceAuditRow,
  getSnapshotIssues,
  getStockReadModelActualSnapshot,
  getStockReadModelExpectedSnapshot,
  normalizeAuditText,
  toInventoryMasterPayload,
} = require("./maintenance.auditHelpers");
const {
  BACKUP_LIFECYCLE_INTERVAL_MS,
  RESTORE_CONFIRM_KEYWORD,
  createOfficialSqliteBackup,
  enrichBackupLog,
  getBackupLifecycleRuntimeStatus,
  getManagedBackupPathStatus,
  getTableCounts,
} = require("./backup");

const STOCK_READ_MODEL_CLEANUP_CONFIRM_KEYWORD = "BERSIHKAN DATA STOK";
const MAINTENANCE_STATUS_CONTRACT_VERSION = 3;
const BACKEND_STARTED_AT = new Date(Date.now() - Math.round(process.uptime() * 1000)).toISOString();
const BACKEND_RUNTIME_INSTANCE_ID = `${process.pid}-${Date.now().toString(36)}`;
const EXPECTED_SQLITE_TABLES = Object.freeze(Object.values(TABLES));

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


let tableRecordStatusCapabilityCache = null;

const getTableRecordStatusCapabilities = async (db) => {
  if (tableRecordStatusCapabilityCache) return tableRecordStatusCapabilityCache;

  const capabilities = {};
  for (const tableName of EXPECTED_SQLITE_TABLES) {
    const columns = await db.all(`PRAGMA table_info(${tableName})`);
    const columnNames = new Set(columns.map((column) => column.name));
    capabilities[tableName] = {
      hasStatus: columnNames.has("status"),
      hasIsActive: columnNames.has("is_active"),
    };
  }
  tableRecordStatusCapabilityCache = capabilities;
  return capabilities;
};

const getTableRecordStatusCounts = async (db) => {
  const result = {};
  const capabilities = await getTableRecordStatusCapabilities(db);

  for (const tableName of EXPECTED_SQLITE_TABLES) {
    const { hasStatus, hasIsActive } = capabilities[tableName] || {};

    if (!hasStatus && !hasIsActive) {
      const row = await db.get(`SELECT COUNT(*) AS stored_total FROM ${tableName}`);
      const storedTotal = Number(row?.stored_total || 0);
      result[tableName] = {
        storedTotal,
        active: storedTotal,
        inactive: 0,
        deleted: 0,
        statusAware: false,
      };
      continue;
    }

    const statusExpression = hasStatus ? "LOWER(COALESCE(status, 'active'))" : "'active'";
    const activeExpression = hasIsActive
      ? `${statusExpression} NOT IN ('inactive', 'deleted') AND COALESCE(is_active, 1) <> 0`
      : `${statusExpression} NOT IN ('inactive', 'deleted')`;
    const inactiveExpression = hasIsActive
      ? `(${statusExpression} = 'inactive' OR (${statusExpression} <> 'deleted' AND COALESCE(is_active, 1) = 0))`
      : `${statusExpression} = 'inactive'`;
    const row = await db.get(
      `SELECT
         COUNT(*) AS stored_total,
         SUM(CASE WHEN ${activeExpression} THEN 1 ELSE 0 END) AS active_count,
         SUM(CASE WHEN ${inactiveExpression} THEN 1 ELSE 0 END) AS inactive_count,
         SUM(CASE WHEN ${statusExpression} = 'deleted' THEN 1 ELSE 0 END) AS deleted_count
       FROM ${tableName}`
    );

    result[tableName] = {
      storedTotal: Number(row?.stored_total || 0),
      active: Number(row?.active_count || 0),
      inactive: Number(row?.inactive_count || 0),
      deleted: Number(row?.deleted_count || 0),
      statusAware: true,
    };
  }
  return result;
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
      rows.push(buildStockReadModelSourceAuditRow(sourceRow, {
        category: "safe_repair",
        issueType: "missing",
        issue: "Data turunan stok belum tersedia.",
      }));
      continue;
    }

    const actual = getStockReadModelActualSnapshot(actualRow);
    const issues = getSnapshotIssues(sourceRow.expected, actual);
    rows.push(buildStockReadModelSourceAuditRow(sourceRow, {
      category: issues.length ? "safe_repair" : "ok",
      issueType: issues.length ? "stale" : "ok",
      issue: issues.length ? `Data turunan berbeda pada: ${issues.join(", ")}.` : "Data turunan stok sinkron.",
    }));
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

const runDatabaseIntegrityChecks = async (db) => {
  const integrityRows = await db.all("PRAGMA integrity_check;");
  const foreignKeyRows = await db.all("PRAGMA foreign_key_check;");
  const integrityMessages = integrityRows
    .map((row) => row.integrity_check || Object.values(row)[0])
    .filter(Boolean);
  const integrityOk = integrityMessages.length === 1
    && String(integrityMessages[0]).toLowerCase() === "ok";

  return {
    integrityRows,
    foreignKeyRows,
    integrityIssues: integrityOk ? [] : integrityMessages,
    integrityCheck: integrityOk ? "ok" : integrityMessages.join("; ") || "unknown",
    valid: integrityOk && foreignKeyRows.length === 0,
  };
};

const buildFinanceLedgerAudit = async (db) => {
  const [incomeRows, expenseRows, ledgerRows] = await Promise.all([
    db.all("SELECT * FROM incomes ORDER BY updated_at DESC"),
    db.all("SELECT * FROM expenses ORDER BY updated_at DESC"),
    db.all("SELECT * FROM money_movement_ledger ORDER BY updated_at DESC"),
  ]);
  const movements = [
    ...incomeRows.map((row) => ({ ...row, movementTable: "incomes", expectedDirection: "in" })),
    ...expenseRows.map((row) => ({ ...row, movementTable: "expenses", expectedDirection: "out" })),
  ];
  const movementById = new Map(movements.map((row) => [String(row.id), row]));
  const issues = [];
    const isActive = (row) => normalizeLowerText(row.status) !== "deleted";
  const toAmount = (row) => Number(row.total_amount || 0);
  const toPayload = (row) => safeJsonParse(row.payload_json, {});
  const getLedgerMatches = (movement) => ledgerRows.filter((ledger) => (
    String(ledger.id) === `ledger_${movement.id}`
      || String(ledger.source_id || "") === String(movement.id)
  ));

  for (const movement of movements.filter(isActive)) {
    const matches = getLedgerMatches(movement);
    const activeMatches = matches.filter(isActive);
    const deletedMatches = matches.filter((row) => !isActive(row));
    const reference = movement.code || movement.id;

    if (activeMatches.length === 0) {
      issues.push({
        issueType: deletedMatches.length ? "ledger_deleted_for_active_movement" : "missing_ledger",
        collectionName: movement.movementTable,
        reference,
        issue: deletedMatches.length
          ? "Transaksi kas aktif hanya memiliki pasangan ledger yang sudah deleted."
          : "Transaksi kas aktif belum memiliki pasangan ledger aktif.",
      });
      continue;
    }

    if (activeMatches.length > 1) {
      issues.push({
        issueType: "duplicate_ledger",
        collectionName: movement.movementTable,
        reference,
        issue: `Transaksi kas memiliki ${activeMatches.length} pasangan ledger aktif.`,
      });
    }

    for (const ledger of activeMatches) {
      const ledgerPayload = toPayload(ledger);
      const direction = String(ledgerPayload.direction || "").toLowerCase();
      const movementAmount = Math.abs(toAmount(movement));
      const ledgerAmount = Math.abs(toAmount(ledger));
      if (movementAmount !== ledgerAmount) {
        issues.push({
          issueType: "amount_mismatch",
          collectionName: movement.movementTable,
          reference,
          issue: `Nominal kas ${movementAmount} berbeda dengan ledger ${ledgerAmount}.`,
        });
      }
      if (direction && direction !== movement.expectedDirection) {
        issues.push({
          issueType: "direction_mismatch",
          collectionName: movement.movementTable,
          reference,
          issue: `Arah ledger ${direction} tidak sesuai dengan transaksi ${movement.expectedDirection}.`,
        });
      }
      const movementPayload = toPayload(movement);
      const expectedSourceType = String(movementPayload.sourceModule || "").trim().toLowerCase();
      const actualSourceType = String(ledger.source_type || "").trim().toLowerCase();
      if (String(ledger.source_id || "") !== String(movement.id)) {
        issues.push({
          issueType: "source_id_mismatch",
          collectionName: movement.movementTable,
          reference,
          issue: `Source ID ledger ${ledger.source_id || "-"} tidak sesuai dengan transaksi ${movement.id}.`,
        });
      }
      if (expectedSourceType && actualSourceType !== expectedSourceType) {
        issues.push({
          issueType: "source_type_mismatch",
          collectionName: movement.movementTable,
          reference,
          issue: `Source type ledger ${ledger.source_type || "-"} tidak sesuai dengan ${movementPayload.sourceModule}.`,
        });
      }
      const debit = Number(ledgerPayload.debit || 0);
      const credit = Number(ledgerPayload.credit || 0);
      if (
        (movement.expectedDirection === "in" && (debit !== ledgerAmount || credit !== 0))
        || (movement.expectedDirection === "out" && (credit !== ledgerAmount || debit !== 0))
      ) {
        issues.push({
          issueType: "debit_credit_mismatch",
          collectionName: movement.movementTable,
          reference,
          issue: "Nilai debit/credit ledger tidak sesuai dengan arah transaksi kas.",
        });
      }
    }
  }

  for (const ledger of ledgerRows.filter(isActive)) {
    const sourceLinkedId = String(ledger.source_id || "");
    const idLinkedId = String(ledger.id || "").replace(/^ledger_/, "");
    const movement = movementById.get(sourceLinkedId) || movementById.get(idLinkedId);
    if (!movement) {
      issues.push({
        issueType: "orphan_ledger",
        collectionName: "money_movement_ledger",
        reference: ledger.code || ledger.id,
        issue: "Ledger aktif tidak memiliki source transaksi kas.",
      });
    } else if (!isActive(movement)) {
      issues.push({
        issueType: "active_ledger_for_deleted_movement",
        collectionName: "money_movement_ledger",
        reference: ledger.code || ledger.id,
        issue: "Ledger masih aktif sementara source transaksi kas sudah deleted.",
      });
    }
  }

  return {
    issues,
    checkedRecords: movements.length + ledgerRows.length,
  };
};

const buildDataQualityAudit = async (db) => {
  const categories = [];
  const { integrityRows, foreignKeyRows, integrityIssues } = await runDatabaseIntegrityChecks(db);

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
  let inventoryIssueCount = 0;
  for (const sourceConfig of STOCK_READ_MODEL_SOURCES) {
    const issueWhere = `status != 'deleted'
      AND (
        current_stock < 0
        OR reserved_stock < 0
        OR available_stock < 0
        OR reserved_stock > current_stock
        OR available_stock != (current_stock - reserved_stock)
      )`;
    const [totals, issueTotals, rows] = await Promise.all([
      db.get(`SELECT COUNT(*) AS count FROM ${sourceConfig.sourceCollection} WHERE status != 'deleted'`),
      db.get(`SELECT COUNT(*) AS count FROM ${sourceConfig.sourceCollection} WHERE ${issueWhere}`),
      db.all(
        `SELECT id, code, name, current_stock, reserved_stock, available_stock
         FROM ${sourceConfig.sourceCollection}
         WHERE ${issueWhere}
         ORDER BY updated_at DESC
         LIMIT 50`,
      ),
    ]);
    inventoryChecked += Number(totals?.count || 0);
    inventoryIssueCount += Number(issueTotals?.count || 0);
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
    count: inventoryIssueCount,
    checkedRecords: inventoryChecked,
    isTruncated: inventoryIssueCount > inventoryIssues.length,
    sampleCount: inventoryIssues.length,
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
    "SELECT id, filename, path, status FROM backup_logs WHERE status != 'retention_deleted' ORDER BY id DESC",
  );
  const invalidBackupRegistryRows = backupRows
    .map((row) => ({
      row,
      pathStatus: getManagedBackupPathStatus(row.path, { mustExist: false }),
    }))
    .filter(({ pathStatus }) => !pathStatus.managed || !pathStatus.exists);
  categories.push({
    key: "backup_registry",
    label: "Registry Backup",
    collection: "backup_logs",
    count: invalidBackupRegistryRows.length,
    checkedRecords: backupRows.length,
    isTruncated: invalidBackupRegistryRows.length > 10,
    sampleCount: Math.min(invalidBackupRegistryRows.length, 10),
    samples: invalidBackupRegistryRows.slice(0, 10).map(({ row, pathStatus }) => ({
      reference: row.filename || row.id,
      issue: pathStatus.managed
        ? "Log backup menunjuk ke file yang tidak ditemukan."
        : "Log backup menunjuk ke path di luar folder backup resmi dan tidak boleh digunakan langsung.",
      code: pathStatus.errorCode,
    })),
    recommendation: "Import file backup eksternal melalui Maintenance Center. Jangan menggunakan atau menghapus path registry lama secara langsung.",
  });

  const financeAudit = await buildFinanceLedgerAudit(db);
  categories.push({
    key: "finance_ledger_pairs",
    label: "Rekonsiliasi Kas dan Ledger",
    collection: "money_movement_ledger",
    count: financeAudit.issues.length,
    checkedRecords: financeAudit.checkedRecords,
    isTruncated: financeAudit.issues.length > 10,
    sampleCount: Math.min(financeAudit.issues.length, 10),
    samples: financeAudit.issues.slice(0, 10),
    recommendation: "Review source transaksi, nominal, arah debit/credit, status, dan audit log. Finance tetap manual-review dan tidak diperbaiki otomatis.",
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

const getDataQualityAudit = async ({ actor = "system" } = {}) => runSerializedDbOperation(async () => {
  const db = await getDb();
  const audit = await buildDataQualityAudit(db);
  await createAuditLog({
    module: "maintenance",
    action: "data_quality_audit",
    entityType: "database",
    entityId: "sqlite",
    actor,
    description: "Audit kualitas data read-only dijalankan dari Maintenance",
    metadata: {
      auditedAt: audit.auditedAt,
      summary: audit.summary,
      categories: audit.categories.map((category) => ({
        key: category.key,
        count: category.count,
        checkedRecords: category.checkedRecords,
        isTruncated: category.isTruncated === true,
      })),
    },
  });
  return audit;
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
  const backupLifecycle = getBackupLifecycleRuntimeStatus();
  const [
    schemaVersion,
    tableCounts,
    tableRecordStatusCounts,
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
    getTableCounts(db),
    getTableRecordStatusCounts(db),
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

  const missingTables = EXPECTED_SQLITE_TABLES.filter((tableName) => (
    !Object.prototype.hasOwnProperty.call(tableCounts, tableName)
  ));
  const invalidCountTables = Object.entries(tableCounts)
    .filter(([, value]) => !Number.isFinite(Number(value)) || Number(value) < 0)
    .map(([tableName]) => tableName);
  const unexpectedTables = Object.keys(tableCounts)
    .filter((tableName) => !EXPECTED_SQLITE_TABLES.includes(tableName));
  const summaryWithinStoredTotals = [
    ["categories", Number(categoryCount?.count || 0)],
    ["customers", Number(customerCount?.count || 0)],
    ["suppliers", Number(supplierCount?.count || 0)],
    ["audit_logs", Number(auditCount?.count || 0)],
  ].every(([tableName, filteredCount]) => (
    filteredCount <= Number(tableCounts?.[tableName] || 0)
  ));
  const databaseConsistency = {
    healthy: missingTables.length === 0
      && invalidCountTables.length === 0
      && summaryWithinStoredTotals,
    expectedTableCount: EXPECTED_SQLITE_TABLES.length,
    discoveredTableCount: Object.keys(tableCounts).length,
    missingTables,
    invalidCountTables,
    unexpectedTables,
    summaryWithinStoredTotals,
  };
  const statusGeneratedAt = new Date().toISOString();

  return {
    maintenanceStatusContractVersion: MAINTENANCE_STATUS_CONTRACT_VERSION,
    capabilities: {
      sqliteOnlyRuntime: true,
      tableCounts: true,
      tableRecordStatusCounts: true,
      liveStatusRefresh: true,
      realtimeEvents: true,
      databaseConsistency: true,
    },
    statusGeneratedAt,
    backendStartedAt: BACKEND_STARTED_AT,
    backendRuntimeInstanceId: BACKEND_RUNTIME_INSTANCE_ID,
    databaseGeneration: getDatabaseGeneration(),
    databaseConsistency,
    dbPath: getDbPath(),
    backupDir: env.backupDir,
    schemaVersion: schemaVersion?.value || "unknown",
    tableCounts,
    tableRecordStatusCounts,
    realtime: getRealtimeRuntimeStatus(),
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
    backupLifecycle,
    backupPolicy: {
      folders: ["daily", "monthly", "manual"],
      manual: true,
      autoDaily: backupLifecycle.schedulerActive === true,
      dailyRetentionDays: 60,
      autoMonthlyPromotion: backupLifecycle.schedulerActive === true,
      autoRetention: backupLifecycle.schedulerActive === true,
      lifecycleIntervalMs: backupLifecycle.intervalMs || BACKUP_LIFECYCLE_INTERVAL_MS,
      monthlyRetentionCount: 12,
      manualAutoDelete: false,
      preRestoreStoredAsManual: true,
      preRepairStoredAsManual: true,
      singleFilePackage: true,
      verifyChecksum: true,
      verifyIntegrityCheck: true,
      zip64Supported: false,
      diskSpacePreflight: true,
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


module.exports = {
  buildMasterDataExportPayload,
  deleteOrphanStockReadModels,
  getDataQualityAudit,
  getMaintenanceStatus,
  getTableRecordStatusCounts,
  getStockReadModelMaintenanceAudit,
  rebuildStockReadModels,
  runDatabaseIntegrityChecks,
};
