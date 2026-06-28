const fs = require("fs");
const path = require("path");
const { AsyncLocalStorage } = require("node:async_hooks");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const env = require("../config/env");
const logger = require("../utils/logger");
const { getRequestContext } = require("../middlewares/requestContext");
const { queueDatabaseMutation } = require("../modules/realtime/realtime.service");

let rawDbPromise = null;
let databaseGeneration = 0;
let dbQueueTail = Promise.resolve();
let operationSequence = 0;
const dbAccessContext = new AsyncLocalStorage();

const MUTATION_TABLE_PATTERN = /\b(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE(?:\s+OR\s+\w+)?|DELETE\s+FROM)\s+[`"\[]?([a-zA-Z_][a-zA-Z0-9_]*)/gi;

const extractMutationTables = (sql = "") => {
  const tables = new Set();
  const source = String(sql || "");
  let match = MUTATION_TABLE_PATTERN.exec(source);
  while (match) {
    const tableName = String(match[1] || "").trim().toLowerCase();
    if (tableName && !tableName.startsWith("sqlite_")) tables.add(tableName);
    match = MUTATION_TABLE_PATTERN.exec(source);
  }
  MUTATION_TABLE_PATTERN.lastIndex = 0;
  return [...tables];
};

const queueMetrics = {
  queued: 0,
  active: null,
  totalCompleted: 0,
  totalFailed: 0,
  maxQueueDepth: 0,
  slowWaitCount: 0,
  slowOperationCount: 0,
  lastSlowWait: null,
  lastSlowOperation: null,
  lastError: null,
};

const assertSafeTestRuntimeStorage = () => {
  if (!env.isTestRuntime) return;

  const checks = [
    { candidatePath: env.dbPath, label: "database SQLite", code: "TEST_DATABASE_RUNTIME_PATH_UNSAFE" },
    { candidatePath: env.backupDir, label: "folder backup", code: "TEST_BACKUP_RUNTIME_PATH_UNSAFE" },
    { candidatePath: env.logDir, label: "folder log", code: "TEST_LOG_RUNTIME_PATH_UNSAFE" },
  ];

  for (const check of checks) {
    try {
      env.assertSafeTestRuntimePath(check.candidatePath, check.label);
    } catch (error) {
      error.code = check.code;
      throw error;
    }
  }
};

const ensureDirectory = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const getDbPath = () => env.dbPath;
const getDatabaseGeneration = () => databaseGeneration;

const getDbQueueStatus = () => ({
  queued: queueMetrics.queued,
  active: queueMetrics.active ? { ...queueMetrics.active } : null,
  totalCompleted: queueMetrics.totalCompleted,
  totalFailed: queueMetrics.totalFailed,
  maxQueueDepth: queueMetrics.maxQueueDepth,
  slowWaitCount: queueMetrics.slowWaitCount,
  slowOperationCount: queueMetrics.slowOperationCount,
  lastSlowWait: queueMetrics.lastSlowWait ? { ...queueMetrics.lastSlowWait } : null,
  lastSlowOperation: queueMetrics.lastSlowOperation ? { ...queueMetrics.lastSlowOperation } : null,
  lastError: queueMetrics.lastError ? { ...queueMetrics.lastError } : null,
  thresholds: {
    slowWaitMs: env.dbQueueSlowWaitMs,
    slowOperationMs: env.dbQueueSlowOperationMs,
  },
  databaseGeneration,
});

const openRawDb = async () => {
  assertSafeTestRuntimeStorage();
  ensureDirectory(env.dbPath);
  const db = await open({
    filename: env.dbPath,
    driver: sqlite3.Database,
  });
  await db.exec("PRAGMA journal_mode = WAL;");
  await db.exec("PRAGMA foreign_keys = ON;");
  await db.exec("PRAGMA busy_timeout = 5000;");
  databaseGeneration += 1;
  return db;
};

const getRawDb = () => {
  if (!rawDbPromise) {
    rawDbPromise = openRawDb().catch((error) => {
      rawDbPromise = null;
      throw error;
    });
  }
  return rawDbPromise;
};

const enqueueDbAccess = (callback, { label = "database_operation" } = {}) => {
  const activeContext = dbAccessContext.getStore();
  if (activeContext?.exclusive === true && activeContext?.released !== true) {
    return callback(activeContext);
  }

  const requestContext = getRequestContext();
  operationSequence += 1;
  const operationId = operationSequence;
  const queuedAt = Date.now();
  queueMetrics.queued += 1;
  queueMetrics.maxQueueDepth = Math.max(queueMetrics.maxQueueDepth, queueMetrics.queued);

  const execute = () => {
    queueMetrics.queued = Math.max(0, queueMetrics.queued - 1);
    const startedAt = Date.now();
    const waitMs = startedAt - queuedAt;
    const active = {
      id: operationId,
      label,
      queuedAt: new Date(queuedAt).toISOString(),
      startedAt: new Date(startedAt).toISOString(),
      waitMs,
    };
    queueMetrics.active = active;

    if (waitMs >= env.dbQueueSlowWaitMs) {
      queueMetrics.slowWaitCount += 1;
      queueMetrics.lastSlowWait = { ...active };
      logger.warn("sqlite_queue_slow_wait", active);
    }

    const context = {
      exclusive: true,
      released: false,
      transactionActive: false,
      rawDb: null,
      operationId,
      operationLabel: label,
      originClientId: requestContext.clientId || "",
      pendingMutationTables: new Set(),
    };

    return dbAccessContext.run(context, async () => {
      try {
        const result = await callback(context);
        queueMetrics.totalCompleted += 1;
        if (context.pendingMutationTables.size > 0) {
          queueDatabaseMutation({
            tables: [...context.pendingMutationTables],
            originClientId: context.originClientId,
          });
        }
        return result;
      } catch (error) {
        queueMetrics.totalFailed += 1;
        queueMetrics.lastError = {
          id: operationId,
          label,
          at: new Date().toISOString(),
          message: error?.message || String(error),
          code: error?.code || error?.errorCode || null,
        };
        throw error;
      } finally {
        const durationMs = Date.now() - startedAt;
        if (durationMs >= env.dbQueueSlowOperationMs) {
          queueMetrics.slowOperationCount += 1;
          queueMetrics.lastSlowOperation = { ...active, durationMs };
          logger.warn("sqlite_queue_slow_operation", { ...active, durationMs });
        }
        context.released = true;
        if (queueMetrics.active?.id === operationId) queueMetrics.active = null;
      }
    });
  };

  const result = dbQueueTail.then(execute, execute);
  dbQueueTail = result.then(() => undefined, () => undefined);
  return result;
};

const callSerializedDbMethod = (methodName, args) => enqueueDbAccess(async (context) => {
  const rawDb = context.rawDb || await getRawDb();
  context.rawDb = rawDb;
  const result = await rawDb[methodName](...args);
  if (["run", "exec"].includes(methodName)) {
    for (const tableName of extractMutationTables(args[0])) {
      context.pendingMutationTables.add(tableName);
    }
  }
  return result;
}, { label: `db.${methodName}` });

const dbFacade = new Proxy({}, {
  get(_target, property) {
    if (["run", "get", "all", "exec", "each"].includes(property)) {
      return (...args) => callSerializedDbMethod(property, args);
    }

    if (property === "close") {
      return closeDb;
    }

    if (property === "__raw") {
      return undefined;
    }

    return undefined;
  },
});

async function getDb() {
  return dbFacade;
}

const runSerializedDbOperation = async (callback, { label = "database_exclusive_operation" } = {}) => (
  enqueueDbAccess(async (context) => {
    const rawDb = context.rawDb || await getRawDb();
    context.rawDb = rawDb;
    return callback(dbFacade);
  }, { label })
);

const runInTransaction = async (callback, { mode = "IMMEDIATE", label = "database_transaction" } = {}) => {
  const activeContext = dbAccessContext.getStore();
  if (activeContext?.transactionActive === true) {
    return callback(dbFacade);
  }

  const normalizedMode = String(mode || "IMMEDIATE").trim().toUpperCase();
  if (!["DEFERRED", "IMMEDIATE", "EXCLUSIVE"].includes(normalizedMode)) {
    throw new Error(`Mode transaction SQLite tidak valid: ${normalizedMode}`);
  }

  return enqueueDbAccess(async (context) => {
    const rawDb = context.rawDb || await getRawDb();
    context.rawDb = rawDb;
    context.transactionActive = true;

    await rawDb.run(`BEGIN ${normalizedMode} TRANSACTION`);
    try {
      const result = await callback(dbFacade);
      await rawDb.run("COMMIT");
      return result;
    } catch (error) {
      await rawDb.run("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      context.transactionActive = false;
    }
  }, { label });
};

async function closeDb() {
  if (!rawDbPromise) return;

  const activeContext = dbAccessContext.getStore();
  if (activeContext?.transactionActive === true) {
    throw new Error("Koneksi database tidak boleh ditutup ketika transaction masih aktif.");
  }

  await enqueueDbAccess(async (context) => {
    if (!rawDbPromise) return;
    const rawDb = context.rawDb || await rawDbPromise;
    let checkpointError = null;

    try {
      const checkpoint = await rawDb.get("PRAGMA wal_checkpoint(TRUNCATE);");
      if (Number(checkpoint?.busy || 0) > 0) {
        const error = new Error("Checkpoint WAL masih sibuk saat database akan ditutup.");
        error.code = "SQLITE_WAL_CHECKPOINT_BUSY";
        error.checkpoint = checkpoint;
        throw error;
      }
    } catch (error) {
      checkpointError = error;
      logger.warn("sqlite_wal_checkpoint_before_close_failed", { error });
    }

    try {
      await rawDb.close();
    } finally {
      rawDbPromise = null;
      context.rawDb = null;
    }

    if (checkpointError) throw checkpointError;
  }, { label: "database_close" });
}

module.exports = {
  closeDb,
  extractMutationTables,
  getDb,
  getDatabaseGeneration,
  getDbPath,
  getDbQueueStatus,
  runInTransaction,
  runSerializedDbOperation,
};
