const fs = require("node:fs");
const path = require("node:path");
const env = require("../config/env");

let lastCleanupDate = "";

const toSerializableError = (error) => {
  if (!error) return null;
  return {
    name: error.name || "Error",
    message: error.message || String(error),
    code: error.code || error.errorCode || null,
    statusCode: error.statusCode || null,
    stack: error.stack || null,
  };
};

const sanitizeMetadata = (metadata = {}) => Object.fromEntries(
  Object.entries(metadata || {}).map(([key, value]) => [
    key,
    value instanceof Error ? toSerializableError(value) : value,
  ]),
);

const getDateStamp = (date = new Date()) => date.toISOString().slice(0, 10);

const cleanupOldLogs = (referenceDate = new Date()) => {
  if (!env.logToFile) return;
  const dateStamp = getDateStamp(referenceDate);
  if (lastCleanupDate === dateStamp) return;
  lastCleanupDate = dateStamp;

  fs.mkdirSync(env.logDir, { recursive: true });
  const cutoff = referenceDate.getTime() - (env.logRetentionDays * 24 * 60 * 60 * 1000);
  for (const entry of fs.readdirSync(env.logDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.startsWith("ims-") || !entry.name.endsWith(".jsonl")) continue;
    const filePath = path.join(env.logDir, entry.name);
    try {
      if (fs.statSync(filePath).mtimeMs < cutoff) fs.rmSync(filePath, { force: true });
    } catch (_error) {
      // Logging must never break the application because cleanup failed.
    }
  }
};

const resolveLogFile = (date = new Date()) => {
  fs.mkdirSync(env.logDir, { recursive: true });
  const baseName = `ims-${getDateStamp(date)}`;
  let index = 0;
  while (true) {
    const suffix = index === 0 ? "" : `-${index}`;
    const filePath = path.join(env.logDir, `${baseName}${suffix}.jsonl`);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size < env.logMaxBytes) return filePath;
    index += 1;
  }
};

const writeFileLog = (entry) => {
  if (!env.logToFile) return;
  try {
    cleanupOldLogs(new Date(entry.timestamp));
    fs.appendFileSync(resolveLogFile(new Date(entry.timestamp)), `${JSON.stringify(entry)}\n`, "utf8");
  } catch (_error) {
    // Console output remains available when file logging fails.
  }
};

const log = (level, message, metadata = {}) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message: String(message || ""),
    ...sanitizeMetadata(metadata),
  };

  const consoleMethod = level === "error" ? "error" : level === "warn" ? "warn" : "log";
  console[consoleMethod](JSON.stringify(entry));
  writeFileLog(entry);
  return entry;
};

module.exports = {
  debug: (message, metadata) => log("debug", message, metadata),
  error: (message, metadata) => log("error", message, metadata),
  info: (message, metadata) => log("info", message, metadata),
  log,
  warn: (message, metadata) => log("warn", message, metadata),
};
