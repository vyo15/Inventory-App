const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { after, test } = require("node:test");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ims-db-queue-mock-"));
process.env.IMS_SQLITE_DB_PATH = path.join(tempDir, "queue.sqlite");

const calls = [];
let openCount = 0;
const fakeDb = {
  async exec(sql) {
    calls.push(`exec:${String(sql).trim()}`);
  },
  async run(sql) {
    calls.push(`run:${String(sql).trim()}`);
    return { changes: 1, lastID: 1 };
  },
  async get(sql) {
    calls.push(`get:${String(sql).trim()}`);
    return { ok: 1 };
  },
  async all(sql) {
    calls.push(`all:${String(sql).trim()}`);
    return [];
  },
  async close() {
    calls.push("close");
  },
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "sqlite3") return { Database: function Database() {} };
  if (request === "sqlite") {
    return {
      open: async () => {
        openCount += 1;
        return fakeDb;
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const {
  closeDb,
  getDatabaseGeneration,
  getDb,
  getDbQueueStatus,
  runInTransaction,
  runSerializedDbOperation,
} = require("../src/db/connection");
Module._load = originalLoad;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

after(async () => {
  await closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("transaction paralel diproses FIFO tanpa interleave", async () => {
  const events = [];
  let releaseFirst;
  let markFirstStarted;
  const firstStarted = new Promise((resolve) => {
    markFirstStarted = resolve;
  });
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });

  const first = runInTransaction(async (db) => {
    events.push("first:start");
    await db.run("FIRST WRITE");
    markFirstStarted();
    await firstGate;
    await db.run("FIRST END");
    events.push("first:end");
  });
  await firstStarted;

  const second = runInTransaction(async (db) => {
    events.push("second:start");
    await db.run("SECOND WRITE");
    events.push("second:end");
  });

  await delay(10);
  assert.deepEqual(events, ["first:start"]);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, ["first:start", "first:end", "second:start", "second:end"]);
});

test("read menunggu transaction aktif lalu melihat koneksi setelah commit", async () => {
  let releaseTransaction;
  let markStarted;
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  const gate = new Promise((resolve) => {
    releaseTransaction = resolve;
  });

  const transaction = runInTransaction(async () => {
    markStarted();
    await gate;
  });
  await started;

  const db = await getDb();
  let readFinished = false;
  const read = db.get("BLOCKED READ").then((row) => {
    readFinished = true;
    return row;
  });

  await delay(10);
  assert.equal(readFinished, false);
  releaseTransaction();
  await transaction;
  assert.deepEqual(await read, { ok: 1 });
});


test("getDb tidak membuka ulang koneksi di tengah operasi restore eksklusif", async () => {
  let releaseExclusive;
  let markClosed;
  const closed = new Promise((resolve) => {
    markClosed = resolve;
  });
  const gate = new Promise((resolve) => {
    releaseExclusive = resolve;
  });

  const exclusive = runSerializedDbOperation(async () => {
    await closeDb();
    markClosed();
    await gate;
  });
  await closed;
  const opensWhileClosed = openCount;
  const generationWhileClosed = getDatabaseGeneration();

  const db = await getDb();
  const queuedRead = db.get("READ AFTER RESTORE");
  await delay(10);
  assert.equal(openCount, opensWhileClosed);

  releaseExclusive();
  await exclusive;
  assert.deepEqual(await queuedRead, { ok: 1 });
  assert.equal(openCount, opensWhileClosed + 1);
  assert.equal(getDatabaseGeneration(), generationWhileClosed + 1);
});

test("rejection tidak meracuni queue dan context selesai tidak melewati serialisasi", async () => {
  await assert.rejects(
    runSerializedDbOperation(async () => {
      throw new Error("expected failure");
    }),
    /expected failure/,
  );

  const db = await getDb();
  const row = await db.get("AFTER FAILURE");
  assert.deepEqual(row, { ok: 1 });
  assert.equal(calls.some((entry) => entry === "get:AFTER FAILURE"), true);
});


test("queue diagnostics mencatat antrean, operasi aktif, dan failure tanpa menyimpan payload", async () => {
  let releaseTransaction;
  let markStarted;
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  const gate = new Promise((resolve) => {
    releaseTransaction = resolve;
  });

  const transaction = runInTransaction(async () => {
    markStarted();
    await gate;
  }, { label: "diagnostic_transaction" });
  await started;

  const db = await getDb();
  const queuedRead = db.get("DIAGNOSTIC READ");
  await delay(10);
  const during = getDbQueueStatus();
  assert.equal(during.active.label, "diagnostic_transaction");
  assert.equal(during.queued >= 1, true);
  assert.equal("payload" in during.active, false);

  releaseTransaction();
  await transaction;
  await queuedRead;
  const after = getDbQueueStatus();
  assert.equal(after.active, null);
  assert.equal(after.queued, 0);
  assert.equal(after.totalCompleted > 0, true);
});
