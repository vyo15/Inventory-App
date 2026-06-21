const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { after, before, test } = require("node:test");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ims-backup-lifecycle-mock-"));
const backupDir = path.join(tempDir, "backups");
const dbPath = path.join(tempDir, "active.sqlite");
process.env.IMS_SQLITE_BACKUP_DIR = backupDir;
process.env.IMS_SQLITE_DB_PATH = dbPath;

const backupLogs = [];
let lastId = 0;
let vacuumCounter = 0;

const createLocalDate = (year, monthIndex, day, hour = 12) => new Date(year, monthIndex, day, hour, 0, 0, 0);
const normalizeSqliteLiteral = (literal) => literal.slice(1, -1).replace(/''/g, "'");
const likeToRegex = (pattern) => new RegExp(`^${String(pattern).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`);

const fakeDb = {
  async exec(sql) {
    const match = String(sql).match(/VACUUM INTO\s+('(?:''|[^'])*')/i);
    if (match) {
      const filename = normalizeSqliteLiteral(match[1]);
      fs.mkdirSync(path.dirname(filename), { recursive: true });
      vacuumCounter += 1;
      fs.writeFileSync(filename, Buffer.from(`fake-sqlite-snapshot-${vacuumCounter}`));
    }
  },
  async get(sql, params = []) {
    if (String(sql).includes("schema_meta")) return { value: "7" };
    if (String(sql).includes("backup_logs")) {
      if (String(sql).includes("filename = ?")) {
        return [...backupLogs].reverse().find((row) => row.filename === params[0]);
      }
      return [...backupLogs].reverse()[0];
    }
    return null;
  },
  async all(sql, params = []) {
    const statement = String(sql);
    if (!statement.includes("backup_logs")) return [];
    let rows = [...backupLogs];
    if (statement.includes("status IN ('verified', 'success')")) {
      rows = rows.filter((row) => ["verified", "success"].includes(row.status));
    }
    if (statement.includes("status != 'retention_deleted'")) {
      rows = rows.filter((row) => row.status !== "retention_deleted");
    }
    if (statement.includes("filename LIKE ?")) {
      const regexes = params.map(likeToRegex);
      rows = rows.filter((row) => regexes.some((regex) => regex.test(row.filename)));
    }
    return rows.sort((a, b) => b.id - a.id);
  },
  async run(sql, params = []) {
    const statement = String(sql);
    if (statement.includes("INSERT INTO backup_logs")) {
      lastId += 1;
      const hasCreatedAt = statement.includes("created_at");
      const row = {
        id: lastId,
        filename: params[0],
        path: params[1],
        size_bytes: params[2],
        status: "verified",
        created_at: hasCreatedAt ? params[3] : new Date().toISOString(),
      };
      backupLogs.push(row);
      return { lastID: lastId };
    }
    if (statement.includes("UPDATE backup_logs SET status = 'retention_deleted'")) {
      const row = backupLogs.find((item) => item.id === params[0]);
      if (row) row.status = "retention_deleted";
      return { changes: row ? 1 : 0 };
    }
    return { changes: 0, lastID: 0 };
  },
};

const fakeReadonlyDb = {
  async all(sql) {
    const statement = String(sql);
    if (statement.includes("integrity_check")) return [{ integrity_check: "ok" }];
    if (statement.includes("foreign_key_check")) return [];
    if (statement.includes("sqlite_master")) return [];
    return [];
  },
  async get(sql) {
    if (String(sql).includes("schema_meta")) return { value: "7" };
    return { count: 0 };
  },
  async close() {},
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "sqlite3") return { Database: function Database() {}, OPEN_READONLY: 1 };
  if (request === "sqlite") return { open: async () => fakeReadonlyDb };
  if (request === "../db/connection" && parent?.filename?.endsWith("sqliteBackup.js")) {
    return {
      getDb: async () => fakeDb,
      getDbPath: () => dbPath,
      runSerializedDbOperation: async (callback) => callback(fakeDb),
    };
  }
  if (request === "./auditLog" && parent?.filename?.endsWith("sqliteBackup.js")) {
    return { createAuditLog: async () => ({}) };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const backupModule = require("../src/utils/sqliteBackup");
Module._load = originalLoad;

before(() => {
  fs.mkdirSync(backupDir, { recursive: true });
});

after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("storage class hanya daily, monthly, dan manual", () => {
  assert.equal(backupModule.getBackupStorageClass("daily"), "daily");
  assert.equal(backupModule.getBackupStorageClass("monthly"), "monthly");
  assert.equal(backupModule.getBackupStorageClass("manual"), "manual");
  assert.equal(backupModule.getBackupStorageClass("pre-restore"), "manual");
  assert.equal(backupModule.getBackupStorageClass("pre-repair"), "manual");
  assert.equal(backupModule.getBackupStorageClass("manual-import"), "manual");
});

test("backup baru hanya satu package tanpa sidecar manifest", async () => {
  const backup = await backupModule.createOfficialSqliteBackup(fakeDb, {
    type: "manual",
    actor: "mock-tester",
    createdAt: "2026-02-01T03:00:00.000Z",
  });
  assert.equal(path.basename(path.dirname(backup.path)), "manual");
  assert.equal(fs.existsSync(backup.path), true);
  assert.equal(fs.existsSync(`${backup.path}.manifest.json`), false);
  assert.equal(backup.manifest.storageClass, "manual");
});

test("daily terakhir dipromosikan menjadi satu monthly dan retention aman", async () => {
  const early = await backupModule.createOfficialSqliteBackup(fakeDb, {
    type: "daily",
    actor: "mock-tester",
    createdAt: createLocalDate(2026, 0, 5),
  });
  const latest = await backupModule.createOfficialSqliteBackup(fakeDb, {
    type: "daily",
    actor: "mock-tester",
    createdAt: createLocalDate(2026, 0, 31),
  });

  const promoted = await backupModule.ensureMonthlyBackups({
    actor: "mock-tester",
    referenceDate: createLocalDate(2026, 1, 2, 3),
  });
  const repeated = await backupModule.ensureMonthlyBackups({
    actor: "mock-tester",
    referenceDate: createLocalDate(2026, 1, 2, 4),
  });

  assert.equal(promoted.created.length, 1);
  assert.equal(repeated.created.length, 0);
  assert.equal(promoted.created[0].manifest.promotedFrom, latest.filename);
  assert.notEqual(promoted.created[0].manifest.promotedFrom, early.filename);
  assert.equal(path.basename(path.dirname(promoted.created[0].path)), "monthly");

  const retention = await backupModule.applyBackupRetention({
    actor: "mock-tester",
    referenceDate: createLocalDate(2026, 3, 15, 3),
  });
  assert.equal(retention.deleted.some((item) => item.filename === early.filename), true);
  assert.equal(retention.deleted.some((item) => item.filename === latest.filename), true);
  assert.equal(fs.existsSync(early.path), false);
  assert.equal(fs.existsSync(latest.path), false);
  assert.equal(fs.existsSync(promoted.created[0].path), true);
});
