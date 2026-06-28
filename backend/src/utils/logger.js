const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const env = require("../config/env");

let lastCleanupDate = "";

const isPathAtOrInside = (candidatePath, parentPath) => {
  const relative = path.relative(path.resolve(parentPath), path.resolve(candidatePath));
  return relative === "" || (!relative.startsWith(`..${path.sep}`)
    && relative !== ".."
    && !path.isAbsolute(relative));
};

const assertSafeFileLogRuntime = () => {
  const isTestRuntime = env.isTestRuntime ?? (process.env.NODE_ENV === "test" || Boolean(process.env.NODE_TEST_CONTEXT));
  if (!isTestRuntime) return;

  if (typeof env.assertSafeTestRuntimePath === "function") {
    env.assertSafeTestRuntimePath(env.logDir, "folder log");
    return;
  }

  if (!isPathAtOrInside(env.logDir, os.tmpdir())) {
    const error = new Error("Mode test menolak file logging di luar folder temporary sistem.");
    error.code = "TEST_LOG_RUNTIME_PATH_UNSAFE";
    throw error;
  }
};


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
  assertSafeFileLogRuntime();
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
  assertSafeFileLogRuntime();
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
