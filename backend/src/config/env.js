const path = require("path");

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
  return path.resolve(process.cwd(), rawValue);
};

const env = {
  port: Number(process.env.PORT || 3001),
  host: process.env.HOST || "0.0.0.0",
  corsOrigin: process.env.IMS_SQLITE_CORS_ORIGIN || "",
  corsOrigins: parseOrigins(process.env.IMS_SQLITE_CORS_ORIGIN),
  dbPath: resolveFromBackend(process.env.IMS_SQLITE_DB_PATH, "../data/ims-sqlite-sidecar.sqlite"),
  backupDir: resolveFromBackend(process.env.IMS_SQLITE_BACKUP_DIR, "../backups/sqlite"),
  authLoginRateLimitWindowMs: parsePositiveInteger(process.env.IMS_AUTH_LOGIN_RATE_LIMIT_WINDOW_MS, 60_000),
  authLoginRateLimitMax: parsePositiveInteger(process.env.IMS_AUTH_LOGIN_RATE_LIMIT_MAX, 5),
  authCookieSecure: parseBoolean(process.env.IMS_AUTH_COOKIE_SECURE, false),
  authAllowLegacyBearer: parseBoolean(process.env.IMS_AUTH_ALLOW_LEGACY_BEARER, true),
  authBootstrapCode: String(process.env.IMS_AUTH_BOOTSTRAP_CODE || "").trim(),
};

module.exports = env;
