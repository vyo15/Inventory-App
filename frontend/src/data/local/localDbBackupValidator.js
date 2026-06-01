import {
  LOCAL_DB_APP_NAME,
  LOCAL_DB_APP_VERSION,
  LOCAL_DB_BACKUP_TABLE_ALLOWLIST,
  LOCAL_DB_BACKUP_TYPE,
  LOCAL_DB_SCHEMA_VERSION,
} from "./localDbSchema";
import { findSensitiveLocalDbFieldPaths } from "./localDbSecurityPolicy";

const PRIMARY_KEY_BY_TABLE = Object.freeze({
  app_meta: "key",
  local_profiles: "uid",
  sync_queue: "id",
  sync_conflicts: "id",
  audit_logs: "id",
  categories: "id",
  customers: "id",
  suppliers: "id",
  products: "id",
  raw_materials: "id",
  semi_finished_materials: "id",
  stock_snapshots: "id",
  production_plans: "id",
  production_orders: "id",
  production_work_logs: "id",
  production_boms: "id",
  production_payrolls: "id",
  production_hpp_snapshots: "id",
  report_snapshots: "id",
});

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getAllowedTableSet = () => new Set(LOCAL_DB_BACKUP_TABLE_ALLOWLIST);

const countTableRecords = (tables = {}) =>
  Object.fromEntries(
    Object.entries(tables).map(([tableName, rows]) => [
      tableName,
      Array.isArray(rows) ? rows.length : 0,
    ])
  );

export const parseLocalDbBackupJson = (rawText) => {
  try {
    return {
      payload: JSON.parse(rawText),
      error: null,
    };
  } catch (error) {
    return {
      payload: null,
      error,
    };
  }
};

export const createLocalDbBackupSummary = (payload) => {
  const tables = isPlainObject(payload?.tables) ? payload.tables : {};
  return {
    app: payload?.app || null,
    type: payload?.type || null,
    schemaVersion: payload?.schemaVersion ?? null,
    appVersion: payload?.appVersion || null,
    sourceMode: payload?.sourceMode || null,
    exportedAt: payload?.exportedAt || null,
    tableNames: Object.keys(tables),
    recordCounts: countTableRecords(tables),
  };
};

const buildRestorePlan = ({ payload, allowedTables }) => {
  const tables = isPlainObject(payload?.tables) ? payload.tables : {};
  const tableNames = Object.keys(tables);
  const allowedTableNames = tableNames.filter((tableName) => allowedTables.has(tableName));
  const blockedTableNames = tableNames.filter((tableName) => !allowedTables.has(tableName));
  const missingAllowlistTables = LOCAL_DB_BACKUP_TABLE_ALLOWLIST.filter(
    (tableName) => !Object.prototype.hasOwnProperty.call(tables, tableName)
  );

  return {
    appVersion: payload?.appVersion || null,
    expectedAppVersion: LOCAL_DB_APP_VERSION,
    sourceMode: payload?.sourceMode || null,
    targetSchemaVersion: LOCAL_DB_SCHEMA_VERSION,
    backupSchemaVersion: payload?.schemaVersion ?? null,
    restorableTables: allowedTableNames,
    blockedTables: blockedTableNames,
    missingAllowlistTables,
    recordCounts: countTableRecords(tables),
    clearExistingDefault: true,
  };
};

export const validateLocalDbBackupPayload = (payload) => {
  const errors = [];
  const warnings = [];
  const allowedTables = getAllowedTableSet();

  if (!isPlainObject(payload)) {
    return {
      valid: false,
      errors: ["Backup harus berupa JSON object."],
      warnings,
      summary: createLocalDbBackupSummary(null),
    };
  }

  if (payload.app !== LOCAL_DB_APP_NAME) {
    errors.push(`Backup app tidak sesuai. Diharapkan: ${LOCAL_DB_APP_NAME}.`);
  }

  if (payload.type !== LOCAL_DB_BACKUP_TYPE) {
    errors.push(`Tipe backup tidak sesuai. Diharapkan: ${LOCAL_DB_BACKUP_TYPE}.`);
  }

  if (!payload.schemaVersion) {
    errors.push("Backup tidak memiliki schemaVersion.");
  } else if (payload.schemaVersion > LOCAL_DB_SCHEMA_VERSION) {
    errors.push(
      `Versi schema backup (${payload.schemaVersion}) lebih baru dari versi lokal (${LOCAL_DB_SCHEMA_VERSION}).`
    );
  } else if (payload.schemaVersion < LOCAL_DB_SCHEMA_VERSION) {
    warnings.push(
      `Backup memakai schema lama (${payload.schemaVersion}); table baru yang tidak ada di backup akan dilewati.`
    );
  }

  if (!payload.appVersion) {
    warnings.push("Backup tidak memiliki appVersion; kemungkinan dibuat dari patch lama.");
  } else if (payload.appVersion !== LOCAL_DB_APP_VERSION) {
    warnings.push(`Backup dibuat dari appVersion ${payload.appVersion}; target lokal ${LOCAL_DB_APP_VERSION}. Review kompatibilitas sebelum restore.`);
  }

  if (!payload.sourceMode) {
    warnings.push("Backup tidak memiliki sourceMode; mode aktif saat export tidak diketahui.");
  }

  if (!payload.exportedAt) {
    warnings.push("Backup tidak memiliki exportedAt.");
  }

  if (!isPlainObject(payload.tables)) {
    errors.push("Backup harus memiliki field tables berupa object.");
  }

  const tables = isPlainObject(payload.tables) ? payload.tables : {};
  Object.entries(tables).forEach(([tableName, rows]) => {
    if (!allowedTables.has(tableName)) {
      errors.push(`Table ${tableName} tidak termasuk allowlist restore foundation.`);
      return;
    }

    if (!Array.isArray(rows)) {
      errors.push(`Table ${tableName} harus berupa array.`);
      return;
    }

    const primaryKey = PRIMARY_KEY_BY_TABLE[tableName];
    rows.forEach((row, index) => {
      if (!isPlainObject(row)) {
        errors.push(`Row ${tableName}[${index}] harus berupa object.`);
        return;
      }

      if (primaryKey && !row[primaryKey]) {
        errors.push(`Row ${tableName}[${index}] wajib memiliki primary key ${primaryKey}.`);
      }

      const sensitivePaths = findSensitiveLocalDbFieldPaths(row);
      if (sensitivePaths.length) {
        errors.push(
          `Row ${tableName}[${index}] mengandung field sensitif yang tidak boleh direstore: ${sensitivePaths.slice(0, 5).join(", ")}.`
        );
      }
    });
  });

  LOCAL_DB_BACKUP_TABLE_ALLOWLIST.forEach((tableName) => {
    if (!Object.prototype.hasOwnProperty.call(tables, tableName)) {
      warnings.push(`Table ${tableName} tidak ada di backup; restore akan melewati table ini.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: createLocalDbBackupSummary(payload),
    restorePlan: buildRestorePlan({ payload, allowedTables }),
  };
};
