const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("realtime-database-events");

const { TABLES } = require("../src/db/schema");
const {
  extractMutationTables,
  getDb,
  runInTransaction,
} = require("../src/db/connection");
const {
  TABLE_SCOPE_MAP,
  buildClientEventPayload,
  buildScopesForTables,
  broadcastRealtimeEvent,
  flushQueuedDatabaseMutations,
  getRealtimeRevisionForRole,
  getRealtimeRuntimeStatus,
  queueDatabaseMutation,
} = require("../src/modules/realtime/realtime.service");

const settleRealtime = async () => {
  await new Promise((resolve) => setTimeout(resolve, 80));
  flushQueuedDatabaseMutations();
};

before(testDatabase.initialize);
beforeEach(async () => {
  await testDatabase.reset();
  await settleRealtime();
});
after(testDatabase.cleanup);

test("mutation parser dan scope realtime mencakup multi statement tanpa tabel sqlite internal", () => {
  assert.deepEqual(
    extractMutationTables(`
      INSERT INTO customers (name) VALUES ('A');
      UPDATE products SET name = 'B';
      DELETE FROM sqlite_sequence WHERE name = 'customers';
    `),
    ["customers", "products"],
  );
  const scopes = buildScopesForTables(["customers", "products"]);
  assert.ok(scopes.includes("customers"));
  assert.ok(scopes.includes("products"));
  assert.ok(scopes.includes("dashboard"));
  assert.ok(scopes.includes("maintenance"));
});

test("seluruh tabel canonical memiliki mapping scope realtime", () => {
  const missingTables = Object.values(TABLES).filter((tableName) => !TABLE_SCOPE_MAP[tableName]);
  assert.deepEqual(missingTables, []);
  assert.deepEqual(TABLE_SCOPE_MAP.local_user_sessions, ["auth_session"]);
  assert.ok(TABLE_SCOPE_MAP.users.includes("auth"));
});

test("payload realtime user operasional tidak membuka tabel atau scope administrator", () => {
  const payload = buildClientEventPayload(
    { role: "user" },
    "data_changed",
    {
      tables: ["purchases", "expenses", "users"],
      scopes: ["purchases", "transactions", "finance", "cash_out", "auth", "maintenance"],
      metadata: { internal: true },
    },
  );

  assert.deepEqual(payload.tables, []);
  assert.deepEqual(payload.scopes, ["purchases", "transactions", "auth"]);
  assert.equal(payload.metadata, null);
  assert.equal(buildClientEventPayload(
    { role: "user" },
    "data_changed",
    { tables: ["audit_logs"], scopes: ["audit", "maintenance"] },
  ), null);
});

test("revision fallback user hanya berubah untuk event yang terlihat oleh role user", () => {
  const adminBefore = getRealtimeRuntimeStatus().revision;
  const userBefore = getRealtimeRevisionForRole("user");

  broadcastRealtimeEvent({ tables: ["audit_logs"] });
  assert.ok(getRealtimeRuntimeStatus().revision > adminBefore);
  assert.equal(getRealtimeRevisionForRole("user"), userBefore);

  broadcastRealtimeEvent({ tables: ["customers"] });
  assert.ok(getRealtimeRevisionForRole("user") > userBefore);
  assert.equal(
    getRealtimeRuntimeStatus({ role: "user" }).revision,
    getRealtimeRevisionForRole("user"),
  );
});

test("event data_changed hanya terbit setelah transaction commit", async () => {
  const beforeRevision = getRealtimeRuntimeStatus().revision;
  await runInTransaction(async (db) => {
    await db.run(
      "INSERT INTO customers (customer_code, name, status) VALUES ('CUS-RT', 'Realtime', 'active')",
    );
  });
  await settleRealtime();

  const status = getRealtimeRuntimeStatus();
  assert.ok(status.revision > beforeRevision);
  assert.equal(status.lastEvent.type, "data_changed");
  assert.ok(status.lastEvent.tables.includes("customers"));
});

test("transaction rollback tidak menerbitkan event dan tidak meninggalkan record", async () => {
  const baseline = getRealtimeRuntimeStatus().revision;
  await assert.rejects(
    runInTransaction(async (db) => {
      await db.run(
        "INSERT INTO customers (customer_code, name, status) VALUES ('CUS-ROLLBACK-RT', 'Rollback', 'active')",
      );
      throw new Error("forced rollback realtime");
    }),
    /forced rollback realtime/,
  );
  await settleRealtime();

  assert.equal(getRealtimeRuntimeStatus().revision, baseline);
  const db = await getDb();
  assert.equal(
    await db.get("SELECT id FROM customers WHERE customer_code = 'CUS-ROLLBACK-RT'"),
    undefined,
  );
});


test("mutation campuran client dan system tidak menekan event kembali ke client", () => {
  queueDatabaseMutation({ tables: ["customers"], originClientId: "client-a" });
  queueDatabaseMutation({ tables: ["products"], originClientId: "" });
  const payload = flushQueuedDatabaseMutations();

  assert.equal(payload.originClientId, null);
  assert.ok(payload.tables.includes("customers"));
  assert.ok(payload.tables.includes("products"));
});
