const path = require("path");

const backendRoot = path.resolve(__dirname, "../..");

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
};

const parseOrigins = (value = "") => String(value || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter((origin) => origin && origin !== "*");

const resolveFromBackend = (value, fallback) => {
  const rawValue = value || fallback;
  if (path.isAbsolute(rawValue)) return rawValue;
  return path.resolve(backendRoot, rawValue);
};

const env = {
  port: Number(process.env.PORT || 3001),
  host: process.env.HOST || "0.0.0.0",
  corsOrigin: process.env.IMS_SQLITE_CORS_ORIGIN || "",
  corsOrigins: parseOrigins(process.env.IMS_SQLITE_CORS_ORIGIN),
  dbPath: resolveFromBackend(process.env.IMS_SQLITE_DB_PATH, "../data/ims-sqlite-sidecar.sqlite"),
  backupDir: resolveFromBackend(process.env.IMS_SQLITE_BACKUP_DIR, "../backups/sqlite"),
  logDir: resolveFromBackend(process.env.IMS_LOG_DIR, "../logs"),
  logToFile: parseBoolean(process.env.IMS_LOG_TO_FILE, process.env.NODE_ENV !== "test"),
  logMaxBytes: parsePositiveInteger(process.env.IMS_LOG_MAX_BYTES, 5 * 1024 * 1024),
  logRetentionDays: parsePositiveInteger(process.env.IMS_LOG_RETENTION_DAYS, 30),
  dbQueueSlowWaitMs: parsePositiveInteger(process.env.IMS_DB_QUEUE_SLOW_WAIT_MS, 1_000),
  dbQueueSlowOperationMs: parsePositiveInteger(process.env.IMS_DB_QUEUE_SLOW_OPERATION_MS, 5_000),
  authLoginRateLimitWindowMs: parsePositiveInteger(process.env.IMS_AUTH_LOGIN_RATE_LIMIT_WINDOW_MS, 60_000),
  authLoginRateLimitMax: parsePositiveInteger(process.env.IMS_AUTH_LOGIN_RATE_LIMIT_MAX, 5),
  authCookieSecure: parseBoolean(process.env.IMS_AUTH_COOKIE_SECURE, false),
  authAllowLegacyBearer: parseBoolean(process.env.IMS_AUTH_ALLOW_LEGACY_BEARER, false),
  authBootstrapCode: String(process.env.IMS_AUTH_BOOTSTRAP_CODE || "").trim(),
};

module.exports = env;
