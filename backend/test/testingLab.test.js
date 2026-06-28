const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { after, before, beforeEach, test } = require("node:test");

process.env.IMS_ENABLE_TESTING_LAB = "true";
process.env.IMS_DATABASE_PURPOSE = "sandbox";

const { configureTestDatabase } = require("./helpers/testDatabase");
const testDatabase = configureTestDatabase("testing-lab");
const {
  BASELINE_CONFIRM_KEYWORD,
  OPERATIONAL_CLONE_CONFIRM_KEYWORD,
  RESET_CONFIRM_KEYWORD,
  cloneOperationalSourceToSandbox,
  completeTestingSession,
  createTestingBaseline,
  exportLastTestingResult,
  getTestingLabStatus,
  previewOperationalSource,
  resetSandboxToBaseline,
  setActiveTestingBaseline,
  startTestingSession,
} = require("../src/modules/testingLab/testingLab.service");
const { listBackups } = require("../src/modules/maintenance/maintenance.service");
const {
  getTestingLabWriteActivity,
  registerTestingLabWriteRequest,
} = require("../src/modules/testingLab/testingLab.runtime");
const env = require("../src/config/env");

const createOperationalSourceFixture = async () => {
  const sourcePath = path.join(testDatabase.tempDir, "operational-source.sqlite");
  fs.rmSync(sourcePath, { force: true });
  const db = await testDatabase.getDb();
  const admin = await db.get("SELECT id FROM users WHERE username_lower = 'lab-admin'");
  await db.run(
    "INSERT INTO categories (code, name, type, status) VALUES ('OPS-CAT', 'Kategori Operasional', 'product_form', 'active')",
  );
  await db.run(
    "INSERT INTO local_user_sessions (user_id, token_hash, expires_at) VALUES (?, 'ops-session-token', '2099-01-01T00:00:00.000Z')",
    [admin.id],
  );
  await db.run(
    "INSERT INTO backup_logs (filename, path, size_bytes, status) VALUES ('ops-old.imsbackup', '/operational/backup/ops-old.imsbackup', 100, 'verified')",
  );
  await db.run(
    "INSERT INTO restore_logs (filename, backup_path, plan_status, actor) VALUES ('ops-old.imsbackup', '/operational/backup/ops-old.imsbackup', 'executed_guarded', 'ops-admin')",
  );
  await db.run(
    "INSERT INTO audit_logs (module, action, entity_type, entity_id, description, actor) VALUES ('maintenance', 'daily_backup_create', 'backup_log', '1', 'Audit backup operasional lama', 'ops-admin')",
  );
  await db.run(
    "INSERT INTO app_settings (key, value) VALUES (?, ?)",
    ["testing_lab.active_session", JSON.stringify({ status: "active" })],
  );
  await db.exec(`VACUUM INTO '${sourcePath.replace(/'/g, "''")}'`);
  await testDatabase.reset();
  await db.run("DELETE FROM app_settings WHERE key LIKE 'testing_lab.%'");
  await ensureAdmin();
  env.operationalSourceDbPath = sourcePath;
  return sourcePath;
};

const ensureAdmin = async () => {
  const db = await testDatabase.getDb();
  await db.run(`
    INSERT INTO users (username, username_lower, display_name, password_hash, role, status)
    VALUES ('lab-admin', 'lab-admin', 'Lab Admin', 'test-password-hash', 'administrator', 'active')
    ON CONFLICT(username_lower) DO UPDATE SET status = 'active', role = 'administrator'
  `);
};

before(testDatabase.initialize);
beforeEach(async () => {
  await testDatabase.reset();
  const db = await testDatabase.getDb();
  await db.run("DELETE FROM app_settings WHERE key LIKE 'testing_lab.%'");
  await ensureAdmin();
});
after(testDatabase.cleanup);

test("Lab Pengujian hanya aktif pada sandbox terpisah dan baseline memakai backup test verified", async () => {
  const statusBefore = await getTestingLabStatus({ role: "administrator" });
  assert.equal(statusBefore.guard.available, true);
  assert.equal(statusBefore.guard.isSandbox, true);
  assert.equal(statusBefore.activeBaseline, null);

  await assert.rejects(
    () => createTestingBaseline({ confirmKeyword: "SALAH", actor: "lab-admin" }),
    (error) => error.errorCode === "TESTING_LAB_BASELINE_CONFIRMATION_REQUIRED",
  );

  const baseline = await createTestingBaseline({
    confirmKeyword: BASELINE_CONFIRM_KEYWORD,
    actor: "lab-admin",
  });
  assert.match(baseline.filename, /-test\.imsbackup$/);

  const statusAfter = await getTestingLabStatus({ role: "administrator" });
  assert.equal(statusAfter.activeBaseline.filename, baseline.filename);
  assert.equal(statusAfter.baselines.some((item) => item.filename === baseline.filename), true);
  assert.equal(statusAfter.guard.separateBackupStorage, true);
  assert.equal(statusAfter.writeActivity.activeRequestCount, 0);
});

test("sesi guided menyimpan snapshot, diff, validasi, dan export JSON", async () => {
  await createTestingBaseline({
    confirmKeyword: BASELINE_CONFIRM_KEYWORD,
    actor: "lab-admin",
  });

  const session = await startTestingSession({
    scenarioKey: "realtime_multi_client",
    actor: "lab-admin",
  });
  assert.equal(session.status, "active");
  assert.equal(session.scenarioKey, "realtime_multi_client");

  const db = await testDatabase.getDb();
  await db.run(
    "INSERT INTO categories (code, name, type, status) VALUES ('LAB-CAT', 'Kategori Lab', 'product_form', 'active')",
  );

  const result = await completeTestingSession({ actor: "lab-admin", notes: "Skenario smoke test" });
  assert.equal(result.scenarioKey, "realtime_multi_client");
  assert.equal(result.diff.tableCounts.categories, 1);
  assert.ok(["completed", "failed"].includes(result.status));

  const exported = await exportLastTestingResult();
  assert.equal(exported.exportMeta.exportType, "testing-lab-result");
  assert.equal(exported.result.id, result.id);

  const statusAfter = await getTestingLabStatus({ role: "administrator" });
  assert.equal(statusAfter.sessionHistory.some((entry) => entry.action === "session_complete"), true);
});

test("reset sandbox mengembalikan database ke baseline dan membuat backup pre-reset", async () => {
  const db = await testDatabase.getDb();
  await db.run(
    "INSERT INTO categories (code, name, type, status) VALUES ('BASE-CAT', 'Kategori Baseline', 'product_form', 'active')",
  );
  const baseline = await createTestingBaseline({
    confirmKeyword: BASELINE_CONFIRM_KEYWORD,
    actor: "lab-admin",
  });

  await db.run(
    "INSERT INTO categories (code, name, type, status) VALUES ('AFTER-CAT', 'Kategori Setelah Baseline', 'product_form', 'active')",
  );

  await assert.rejects(
    () => resetSandboxToBaseline({ confirmKeyword: "SALAH", actor: "lab-admin" }),
    (error) => error.errorCode === "TESTING_LAB_RESET_CONFIRMATION_REQUIRED",
  );

  const reset = await resetSandboxToBaseline({
    confirmKeyword: RESET_CONFIRM_KEYWORD,
    actor: "lab-admin",
  });
  assert.equal(reset.reset, true);
  assert.equal(reset.baseline.filename, baseline.filename);

  const restoredDb = await testDatabase.getDb();
  assert.ok(await restoredDb.get("SELECT id FROM categories WHERE code = 'BASE-CAT'"));
  assert.equal(await restoredDb.get("SELECT id FROM categories WHERE code = 'AFTER-CAT'"), undefined);

  const backups = await listBackups();
  assert.equal(backups.some((item) => item.backupType === "pre-reset"), true);
});

test("reset sandbox ditolak saat masih ada operasi tulis aktif", async () => {
  await createTestingBaseline({
    confirmKeyword: BASELINE_CONFIRM_KEYWORD,
    actor: "lab-admin",
  });

  const release = registerTestingLabWriteRequest({ method: "POST", path: "/api/customers" });
  assert.equal(getTestingLabWriteActivity().activeRequestCount, 1);
  try {
    await assert.rejects(
      () => resetSandboxToBaseline({
        confirmKeyword: RESET_CONFIRM_KEYWORD,
        actor: "lab-admin",
      }),
      (error) => error.errorCode === "TESTING_LAB_ACTIVE_WRITES" && error.statusCode === 423,
    );
  } finally {
    release();
  }
  assert.equal(getTestingLabWriteActivity().activeRequestCount, 0);
});



test("skenario tidak dapat dimulai sebelum baseline verified tersedia", async () => {
  await assert.rejects(
    () => startTestingSession({
      scenarioKey: "realtime_multi_client",
      actor: "lab-admin",
    }),
    (error) => error.errorCode === "TESTING_LAB_BASELINE_REQUIRED" && error.statusCode === 409,
  );
});

test("baseline tidak dapat dibuat atau diganti ketika sesi testing masih aktif", async () => {
  const baseline = await createTestingBaseline({
    confirmKeyword: BASELINE_CONFIRM_KEYWORD,
    actor: "lab-admin",
  });
  await startTestingSession({
    scenarioKey: "realtime_multi_client",
    actor: "lab-admin",
  });

  await assert.rejects(
    () => createTestingBaseline({
      confirmKeyword: BASELINE_CONFIRM_KEYWORD,
      actor: "lab-admin",
    }),
    (error) => error.errorCode === "TESTING_LAB_SESSION_ACTIVE" && error.statusCode === 409,
  );

  await assert.rejects(
    () => setActiveTestingBaseline({
      filename: baseline.filename,
      actor: "lab-admin",
    }),
    (error) => error.errorCode === "TESTING_LAB_SESSION_ACTIVE" && error.statusCode === 409,
  );
});

test("riwayat sesi Lab Pengujian tetap tersedia setelah sandbox direset ke baseline", async () => {
  await createTestingBaseline({
    confirmKeyword: BASELINE_CONFIRM_KEYWORD,
    actor: "lab-admin",
  });
  const session = await startTestingSession({
    scenarioKey: "realtime_multi_client",
    actor: "lab-admin",
  });
  await completeTestingSession({ actor: "lab-admin", notes: "Riwayat harus bertahan" });

  const beforeReset = await getTestingLabStatus({ role: "administrator" });
  assert.equal(
    beforeReset.sessionHistory.some(
      (entry) => entry.action === "session_complete" && entry.sessionId === session.id,
    ),
    true,
  );

  const reset = await resetSandboxToBaseline({
    confirmKeyword: RESET_CONFIRM_KEYWORD,
    actor: "lab-admin",
  });
  assert.equal(reset.reset, true);
  assert.ok(reset.restoredHistoryCount >= 2);
  assert.equal(reset.lastResultPreserved, true);

  const exportedAfterReset = await exportLastTestingResult();
  assert.equal(exportedAfterReset.result.id, session.id);

  const afterReset = await getTestingLabStatus({ role: "administrator" });
  assert.equal(
    afterReset.sessionHistory.some(
      (entry) => entry.action === "session_complete" && entry.sessionId === session.id,
    ),
    true,
  );
  assert.equal(afterReset.sessionHistory.some((entry) => entry.action === "sandbox_reset_complete"), true);
});


test("memilih baseline lain membersihkan hasil sesi lama agar tidak tercampur", async () => {
  const baseline = await createTestingBaseline({
    confirmKeyword: BASELINE_CONFIRM_KEYWORD,
    actor: "lab-admin",
  });
  await startTestingSession({
    scenarioKey: "realtime_multi_client",
    actor: "lab-admin",
  });
  await completeTestingSession({ actor: "lab-admin", notes: "Hasil baseline lama" });

  const beforeSelect = await getTestingLabStatus({ role: "administrator" });
  assert.ok(beforeSelect.lastResult);

  await setActiveTestingBaseline({
    filename: baseline.filename,
    actor: "lab-admin",
  });

  const afterSelect = await getTestingLabStatus({ role: "administrator" });
  assert.equal(afterSelect.lastResult, null);
});

test("preview dan clone operasional memakai snapshot read-only lalu membuat baseline sandbox sanitized", async () => {
  const sourcePath = await createOperationalSourceFixture();
  const sourceBefore = fs.statSync(sourcePath);

  const preview = await previewOperationalSource();
  assert.equal(preview.valid, true);
  assert.equal(preview.safeForClone, true);
  assert.equal(preview.businessSummary.products, 0);
  assert.equal(preview.tableCounts.categories, 1);

  await assert.rejects(
    () => cloneOperationalSourceToSandbox({ confirmKeyword: "SALAH", actor: "lab-admin" }),
    (error) => error.errorCode === "TESTING_LAB_OPERATIONAL_CLONE_CONFIRMATION_REQUIRED",
  );

  const cloned = await cloneOperationalSourceToSandbox({
    confirmKeyword: OPERATIONAL_CLONE_CONFIRM_KEYWORD,
    actor: "lab-admin",
  });
  assert.equal(cloned.cloned, true);
  assert.equal(cloned.reloadRequired, true);
  assert.equal(cloned.loginRequired, true);
  assert.equal(cloned.baseline.sourceType, "operational_clone");

  const sandboxDb = await testDatabase.getDb();
  assert.ok(await sandboxDb.get("SELECT id FROM categories WHERE code = 'OPS-CAT'"));
  assert.equal(Number((await sandboxDb.get("SELECT COUNT(*) AS count FROM local_user_sessions")).count), 0);
  assert.equal(
    Number((await sandboxDb.get("SELECT COUNT(*) AS count FROM backup_logs WHERE filename = 'ops-old.imsbackup'")).count),
    0,
  );
  assert.equal(
    Number((await sandboxDb.get("SELECT COUNT(*) AS count FROM restore_logs WHERE actor = 'ops-admin'")).count),
    0,
  );
  assert.equal(
    Number((await sandboxDb.get("SELECT COUNT(*) AS count FROM audit_logs WHERE description = 'Audit backup operasional lama'")).count),
    0,
  );
  const activeBaseline = await sandboxDb.get(
    "SELECT value FROM app_settings WHERE key = 'testing_lab.active_baseline'",
  );
  assert.match(activeBaseline.value, /operational_clone/);

  const sourcePreviewAfterClone = await previewOperationalSource();
  assert.equal(sourcePreviewAfterClone.tableCounts.categories, 1);
  assert.equal(sourcePreviewAfterClone.tableCounts.local_user_sessions, 1);
  assert.equal(sourcePreviewAfterClone.tableCounts.backup_logs, 1);
  const sourceAfter = fs.statSync(sourcePath);
  assert.equal(sourceAfter.size, sourceBefore.size);
  assert.equal(sourceAfter.mtimeMs, sourceBefore.mtimeMs);
});

test("clone operasional ditolak ketika source sama dengan sandbox aktif", async () => {
  env.operationalSourceDbPath = testDatabase.dbPath;
  await assert.rejects(
    () => previewOperationalSource(),
    (error) => error.errorCode === "TESTING_LAB_OPERATIONAL_SOURCE_EQUALS_SANDBOX",
  );
});

