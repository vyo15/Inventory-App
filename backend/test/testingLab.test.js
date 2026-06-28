const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");

process.env.IMS_ENABLE_TESTING_LAB = "true";
process.env.IMS_DATABASE_PURPOSE = "sandbox";

const { configureTestDatabase } = require("./helpers/testDatabase");
const testDatabase = configureTestDatabase("testing-lab");
const {
  BASELINE_CONFIRM_KEYWORD,
  RESET_CONFIRM_KEYWORD,
  completeTestingSession,
  createTestingBaseline,
  exportLastTestingResult,
  getTestingLabStatus,
  resetSandboxToBaseline,
  setActiveTestingBaseline,
  startTestingSession,
} = require("../src/modules/testingLab/testingLab.service");
const { listBackups } = require("../src/modules/maintenance/maintenance.service");
const {
  getTestingLabWriteActivity,
  registerTestingLabWriteRequest,
} = require("../src/modules/testingLab/testingLab.runtime");

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
