const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { after, before, beforeEach, test } = require("node:test");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("maintenance-backup-restore");
const {
  createBackup,
  createRestorePlan,
  executeRestore,
  getMaintenanceStatus,
  importBackupFile,
  listBackups,
} = require("../src/modules/maintenance/maintenance.service");
const {
  RESTORE_CONFIRM_KEYWORD,
  applyBackupRetention,
  createOfficialSqliteBackup,
  ensureDailyBackupForToday,
  ensureMonthlyBackups,
  getBackupPreview,
  readBackupManifest,
} = require("../src/utils/sqliteBackup");

const createLocalDate = (year, monthIndex, day, hour = 12) => new Date(year, monthIndex, day, hour, 0, 0, 0);

const resetBackupDirectory = () => {
  fs.rmSync(testDatabase.backupDir, { recursive: true, force: true });
  fs.mkdirSync(testDatabase.backupDir, { recursive: true });
};

const upsertCategory = async ({ code, name }) => {
  const db = await testDatabase.getDb();
  await db.run(
    `
      INSERT INTO categories (code, name, type, status)
      VALUES (?, ?, 'test', 'active')
      ON CONFLICT(code) DO UPDATE SET name = excluded.name, updated_at = CURRENT_TIMESTAMP
    `,
    [code, name],
  );
};

const getCategory = async (code) => {
  const db = await testDatabase.getDb();
  return db.get("SELECT * FROM categories WHERE code = ?", [code]);
};

before(testDatabase.initialize);
beforeEach(async () => {
  await testDatabase.reset();
  resetBackupDirectory();
});
after(testDatabase.cleanup);

test("backup resmi membuat package, manifest, checksum validation, log, dan audit", async () => {
  await upsertCategory({ code: "CAT-BACKUP", name: "Kategori Snapshot" });

  const backup = await createBackup({
    type: "test",
    actor: "backup-tester",
    notes: "Automated backup test",
  });

  assert.equal(backup.status, "verified");
  assert.equal(backup.backupType, "test");
  assert.equal(fs.existsSync(backup.path), true);
  assert.equal(fs.existsSync(`${backup.path}.manifest.json`), false);
  assert.equal(path.basename(path.dirname(backup.path)), "manual");

  const manifest = readBackupManifest(backup.path);
  assert.equal(manifest.backupFormat, "imsbackup");
  assert.equal(manifest.backupType, "test");
  assert.equal(manifest.integrityCheck, "ok");
  assert.equal(manifest.foreignKeyCheck, "ok");
  assert.match(manifest.databaseSha256, /^[a-f0-9]{64}$/);

  const preview = await getBackupPreview(backup);
  assert.equal(preview.validForRestore, true);
  assert.equal(preview.validation.valid, true);

  const db = await testDatabase.getDb();
  const backupLog = await db.get("SELECT * FROM backup_logs WHERE id = ?", [backup.id]);
  const auditLog = await db.get(
    "SELECT * FROM audit_logs WHERE action = 'backup_create' ORDER BY id DESC LIMIT 1",
  );

  assert.equal(backupLog.status, "verified");
  assert.equal(auditLog.actor, "backup-tester");
});

test("auto daily backup idempotent untuk hari yang sama", async () => {
  const first = await ensureDailyBackupForToday();
  const second = await ensureDailyBackupForToday();

  assert.equal(first.created, true);
  assert.equal(second.created, false);

  const backups = await listBackups();
  assert.equal(backups.filter((item) => item.backupType === "daily").length, 1);
});



test("monthly dipromosikan dari daily terakhir bulan sebelumnya dan idempotent", async () => {
  const db = await testDatabase.getDb();
  const januaryEarly = await createOfficialSqliteBackup(db, {
    type: "daily",
    actor: "monthly-tester",
    createdAt: createLocalDate(2026, 0, 10),
  });
  const januaryLatest = await createOfficialSqliteBackup(db, {
    type: "daily",
    actor: "monthly-tester",
    createdAt: createLocalDate(2026, 0, 31, 23),
  });

  const first = await ensureMonthlyBackups({
    actor: "monthly-tester",
    referenceDate: createLocalDate(2026, 1, 1, 2),
  });
  const second = await ensureMonthlyBackups({
    actor: "monthly-tester",
    referenceDate: createLocalDate(2026, 1, 1, 3),
  });

  assert.equal(first.created.length, 1);
  assert.equal(second.created.length, 0);
  assert.equal(first.created[0].backupType, "monthly");
  assert.equal(first.created[0].manifest.promotedFrom, januaryLatest.filename);
  assert.equal(new Date(first.created[0].manifest.createdAt).getMonth(), 0);
  assert.notEqual(first.created[0].manifest.promotedFrom, januaryEarly.filename);
  assert.equal(path.basename(path.dirname(first.created[0].path)), "monthly");
  assert.equal(fs.existsSync(`${first.created[0].path}.manifest.json`), false);
});

test("retention menghapus daily lebih dari 60 hari hanya jika monthly tersedia", async () => {
  const db = await testDatabase.getDb();
  const oldDaily = await createOfficialSqliteBackup(db, {
    type: "daily",
    actor: "retention-tester",
    createdAt: "2026-01-15T03:00:00.000Z",
  });
  const protectedDaily = await createOfficialSqliteBackup(db, {
    type: "daily",
    actor: "retention-tester",
    createdAt: "2025-12-15T03:00:00.000Z",
  });

  await ensureMonthlyBackups({
    actor: "retention-tester",
    referenceDate: new Date("2026-02-01T03:00:00.000Z"),
  });

  const monthlyRows = await db.all("SELECT * FROM backup_logs WHERE filename LIKE '%-monthly.imsbackup'");
  const decemberMonthly = monthlyRows.find((row) => row.filename.includes("202512"));
  if (decemberMonthly?.path) {
    fs.rmSync(decemberMonthly.path, { force: true });
    await db.run("UPDATE backup_logs SET status = 'retention_deleted' WHERE id = ?", [decemberMonthly.id]);
  }

  const result = await applyBackupRetention({
    actor: "retention-tester",
    referenceDate: new Date("2026-04-01T03:00:00.000Z"),
  });

  assert.equal(result.deleted.some((item) => item.filename === oldDaily.filename), true);
  assert.equal(fs.existsSync(oldDaily.path), false);
  assert.equal(fs.existsSync(protectedDaily.path), true);
});

test("restore plan dan keyword salah tidak mengubah database aktif", async () => {
  await upsertCategory({ code: "CAT-RESTORE", name: "Nama dari Backup" });
  const backup = await createBackup({ type: "test", actor: "restore-tester" });
  await upsertCategory({ code: "CAT-RESTORE", name: "Nama Aktif Terbaru" });

  const plan = await createRestorePlan({
    filename: backup.filename,
    actor: "restore-tester",
  });
  assert.equal(plan.mode, "preview_only");
  assert.equal(plan.destructiveAllowed, false);
  assert.equal(plan.validForRestore, true);
  assert.equal((await getCategory("CAT-RESTORE")).name, "Nama Aktif Terbaru");

  const rejected = await executeRestore({
    filename: backup.filename,
    confirmKeyword: "WRONG KEYWORD",
    actor: "restore-tester",
  });
  assert.equal(rejected.restored, false);
  assert.equal(rejected.destructiveAllowed, false);
  assert.equal((await getCategory("CAT-RESTORE")).name, "Nama Aktif Terbaru");
});

test("restore guarded membuat pre-restore backup dan memulihkan snapshot secara utuh", async () => {
  await upsertCategory({ code: "CAT-RESTORE", name: "Nama Snapshot" });
  const backup = await createBackup({ type: "test", actor: "restore-tester" });

  await upsertCategory({ code: "CAT-RESTORE", name: "Nama Setelah Backup" });
  await upsertCategory({ code: "CAT-EXTRA", name: "Data Setelah Backup" });

  const restored = await executeRestore({
    filename: backup.filename,
    confirmKeyword: RESTORE_CONFIRM_KEYWORD,
    actor: "restore-tester",
  });

  assert.equal(restored.restored, true);
  assert.equal(restored.mode, "executed_guarded");
  assert.equal(restored.activeDatabaseValidation.valid, true);
  assert.equal(restored.preRestoreBackup.backupType, "pre-restore");
  assert.equal(fs.existsSync(restored.preRestoreBackup.path), true);
  assert.equal(
    fs.readdirSync(path.dirname(testDatabase.dbPath)).some((name) => name.includes(".restore-candidate-") || name.includes(".restore-rollback-")),
    false,
  );

  assert.equal((await getCategory("CAT-RESTORE")).name, "Nama Snapshot");
  assert.equal(await getCategory("CAT-EXTRA"), undefined);

  const db = await testDatabase.getDb();
  const restoreLog = await db.get(
    "SELECT * FROM restore_logs WHERE plan_status = 'executed_guarded' ORDER BY id DESC LIMIT 1",
  );
  const restoreAudit = await db.get(
    "SELECT * FROM audit_logs WHERE action = 'restore_execute' ORDER BY id DESC LIMIT 1",
  );
  const preRestoreLog = await db.get(
    "SELECT * FROM backup_logs WHERE filename = ? ORDER BY id DESC LIMIT 1",
    [restored.preRestoreBackup.filename],
  );

  assert.equal(restoreLog.destructive_allowed, 1);
  assert.equal(restoreAudit.actor, "restore-tester");
  assert.equal(preRestoreLog.status, "verified");
});

test("restore gagal setelah swap mengembalikan database aktif secara otomatis", async () => {
  const db = await testDatabase.getDb();
  await db.exec(`
    CREATE TRIGGER force_restore_log_failure
    BEFORE INSERT ON restore_logs
    WHEN NEW.plan_status = 'executed_guarded'
    BEGIN
      SELECT RAISE(ABORT, 'forced restore log failure');
    END;
  `);

  await upsertCategory({ code: "CAT-ROLLBACK", name: "Nama Snapshot Restore" });
  const backup = await createBackup({ type: "test", actor: "rollback-tester" });
  await upsertCategory({ code: "CAT-ROLLBACK", name: "Nama Aktif Sebelum Restore" });

  await assert.rejects(
    executeRestore({
      filename: backup.filename,
      confirmKeyword: RESTORE_CONFIRM_KEYWORD,
      actor: "rollback-tester",
    }),
    (error) => error?.errorCode === "RESTORE_ROLLED_BACK"
      && error?.rollback?.rollbackSucceeded === true,
  );

  assert.equal((await getCategory("CAT-ROLLBACK")).name, "Nama Aktif Sebelum Restore");

  const rollbackDb = await testDatabase.getDb();
  const rollbackLog = await rollbackDb.get(
    "SELECT * FROM restore_logs WHERE plan_status = 'rolled_back_guarded' ORDER BY id DESC LIMIT 1",
  );
  const rollbackAudit = await rollbackDb.get(
    "SELECT * FROM audit_logs WHERE action = 'restore_rollback' ORDER BY id DESC LIMIT 1",
  );

  assert.equal(rollbackLog.destructive_allowed, 0);
  assert.equal(rollbackAudit.actor, "rollback-tester");
  assert.equal(
    fs.readdirSync(path.dirname(testDatabase.dbPath)).some((name) => (
      name.includes(".restore-candidate-")
      || name.includes(".restore-rollback-")
      || name.includes(".automatic-rollback-candidate-")
    )),
    false,
  );
});

test("backup rusak diblokir pada preview tanpa mengubah database aktif", async () => {
  await upsertCategory({ code: "CAT-CORRUPT", name: "Snapshot Valid" });
  const backup = await createBackup({ type: "test", actor: "restore-tester" });
  await upsertCategory({ code: "CAT-CORRUPT", name: "Data Aktif Aman" });

  const corruptPath = path.join(testDatabase.backupDir, "corrupt-test.imsbackup");
  const corrupted = fs.readFileSync(backup.path);
  corrupted[Math.max(0, Math.floor(corrupted.length / 2))] ^= 0xff;
  fs.writeFileSync(corruptPath, corrupted);

  const db = await testDatabase.getDb();
  await db.run(
    "INSERT INTO backup_logs (filename, path, size_bytes, status) VALUES (?, ?, ?, 'verified')",
    [path.basename(corruptPath), corruptPath, corrupted.length],
  );

  const plan = await createRestorePlan({
    filename: path.basename(corruptPath),
    actor: "restore-tester",
  });

  assert.equal(plan.validForRestore, false);
  assert.ok(plan.validationError || plan.validation?.valid === false);
  assert.equal((await getCategory("CAT-CORRUPT")).name, "Data Aktif Aman");
});

test("import backup menormalkan filename dan hanya menerima package valid", async () => {
  await upsertCategory({ code: "CAT-IMPORT", name: "Import Source" });
  const backup = await createBackup({ type: "test", actor: "import-tester" });
  const packageBuffer = fs.readFileSync(backup.path);

  const imported = await importBackupFile({
    body: packageBuffer,
    headers: { "x-ims-backup-filename": encodeURIComponent("../unsafe backup.imsbackup") },
    actor: "import-tester",
  });

  assert.equal(imported.validForRestore, true);
  assert.equal(imported.originalFilename, "unsafe backup.imsbackup");
  assert.equal(path.dirname(imported.path), path.join(testDatabase.backupDir, "manual"));
  assert.equal(fs.existsSync(imported.path), true);

  await assert.rejects(
    importBackupFile({
      body: Buffer.from("not-a-backup"),
      headers: { "x-ims-backup-filename": encodeURIComponent("invalid.txt") },
      actor: "import-tester",
    }),
    (error) => error?.errorCode === "BACKUP_IMPORT_UNSUPPORTED_FORMAT",
  );
});


test("status maintenance menampilkan evidence migrasi Bearer tanpa menyimpulkan semua perangkat siap", async () => {
  const db = await testDatabase.getDb();
  await db.run(
    `INSERT INTO audit_logs (module, action, entity_type, entity_id, description, actor)
     VALUES ('auth', 'legacy_bearer_migrated', 'local_user_session', '101', 'Migrasi test', 'admin')`
  );

  const status = await getMaintenanceStatus();

  assert.equal(status.authCompatibility.legacyBearerEnabled, true);
  assert.equal(status.authCompatibility.removalReady, false);
  assert.equal(status.authCompatibility.manualConfirmationRequired, true);
  assert.equal(status.authCompatibility.migrationEvidence.totalMigrations, 1);
  assert.equal(status.authCompatibility.migrationEvidence.recentMigrations7d, 1);
  assert.ok(status.authCompatibility.migrationEvidence.latestMigrationAt);
});
