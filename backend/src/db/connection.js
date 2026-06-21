const fs = require("fs");
const path = require("path");
const { AsyncLocalStorage } = require("node:async_hooks");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const env = require("../config/env");

let rawDbPromise = null;
let dbQueueTail = Promise.resolve();
const dbAccessContext = new AsyncLocalStorage();

const ensureDirectory = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const getDbPath = () => env.dbPath;

const openRawDb = async () => {
  ensureDirectory(env.dbPath);
  const db = await open({
    filename: env.dbPath,
    driver: sqlite3.Database,
  });
  await db.exec("PRAGMA journal_mode = WAL;");
  await db.exec("PRAGMA foreign_keys = ON;");
  await db.exec("PRAGMA busy_timeout = 5000;");
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

const enqueueDbAccess = (callback) => {
  const activeContext = dbAccessContext.getStore();
  if (activeContext?.exclusive === true && activeContext?.released !== true) {
    return callback(activeContext);
  }

  const execute = () => {
    const context = {
      exclusive: true,
      released: false,
      transactionActive: false,
      rawDb: null,
    };
    return dbAccessContext.run(context, async () => {
      try {
        return await callback(context);
      } finally {
        context.released = true;
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
});

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

const runSerializedDbOperation = async (callback) => enqueueDbAccess(async (context) => {
  const rawDb = context.rawDb || await getRawDb();
  context.rawDb = rawDb;
  return callback(dbFacade);
});

const runInTransaction = async (callback, { mode = "IMMEDIATE" } = {}) => {
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
  });
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
  });
}

module.exports = {
  closeDb,
  getDb,
  getDbPath,
  runInTransaction,
  runSerializedDbOperation,
};
