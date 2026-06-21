const fs = require("fs");
const path = require("path");
const { AsyncLocalStorage } = require("node:async_hooks");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const env = require("../config/env");
const logger = require("../utils/logger");

let rawDbPromise = null;
let databaseGeneration = 0;
let dbQueueTail = Promise.resolve();
let operationSequence = 0;
const dbAccessContext = new AsyncLocalStorage();
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
    };

    return dbAccessContext.run(context, async () => {
      try {
        const result = await callback(context);
        queueMetrics.totalCompleted += 1;
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
  return rawDb[methodName](...args);
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
    await rawDb.close();
    rawDbPromise = null;
    context.rawDb = null;
  }, { label: "database_close" });
}

module.exports = {
  closeDb,
  getDb,
  getDatabaseGeneration,
  getDbPath,
  getDbQueueStatus,
  runInTransaction,
  runSerializedDbOperation,
};
