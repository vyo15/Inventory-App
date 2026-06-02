const SCHEMA_VERSION = 5;

const TABLES = {
  SCHEMA_META: "schema_meta",
  APP_SETTINGS: "app_settings",
  AUDIT_LOGS: "audit_logs",
  BACKUP_LOGS: "backup_logs",
  RESTORE_LOGS: "restore_logs",
  MODULE_MIGRATION_STATUS: "module_migration_status",
  BUSINESS_CODE_COUNTERS: "business_code_counters",
  ROLES: "roles",
  USERS: "users",
  LOCAL_USER_SESSIONS: "local_user_sessions",
  CUSTOMERS: "customers",
  CATEGORIES: "categories",
  SUPPLIERS: "suppliers",
  PRICING_RULES: "pricing_rules",
};

module.exports = { SCHEMA_VERSION, TABLES };
