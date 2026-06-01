const path = require("path");

const resolveFromBackend = (value, fallback) => {
  const rawValue = value || fallback;
  if (path.isAbsolute(rawValue)) return rawValue;
  return path.resolve(process.cwd(), rawValue);
};

const env = {
  port: Number(process.env.PORT || 3001),
  host: process.env.HOST || "0.0.0.0",
  corsOrigin: process.env.IMS_SQLITE_CORS_ORIGIN || "*",
  dbPath: resolveFromBackend(process.env.IMS_SQLITE_DB_PATH, "../data/ims-sqlite-sidecar.sqlite"),
  backupDir: resolveFromBackend(process.env.IMS_SQLITE_BACKUP_DIR, "../backups/sqlite"),
};

module.exports = env;
