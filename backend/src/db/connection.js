const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const env = require("../config/env");

let dbPromise = null;

const ensureDirectory = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const getDbPath = () => env.dbPath;

async function getDb() {
  if (!dbPromise) {
    ensureDirectory(env.dbPath);
    dbPromise = open({
      filename: env.dbPath,
      driver: sqlite3.Database,
    }).then(async (db) => {
      await db.exec("PRAGMA journal_mode = WAL;");
      await db.exec("PRAGMA foreign_keys = ON;");
      await db.exec("PRAGMA busy_timeout = 5000;");
      return db;
    });
  }

  return dbPromise;
}

async function closeDb() {
  if (!dbPromise) return;

  const db = await dbPromise;
  await db.close();
  dbPromise = null;
}

module.exports = { getDb, getDbPath, closeDb };
