const SCHEMA_VERSION = 3;

const TABLES = {
  SCHEMA_META: "schema_meta",
  APP_SETTINGS: "app_settings",
  AUDIT_LOGS: "audit_logs",
  BACKUP_LOGS: "backup_logs",
  RESTORE_LOGS: "restore_logs",
  MODULE_MIGRATION_STATUS: "module_migration_status",
  BUSINESS_CODE_COUNTERS: "business_code_counters",
  CUSTOMERS: "customers",
  CATEGORIES: "categories",
};

module.exports = { SCHEMA_VERSION, TABLES };
