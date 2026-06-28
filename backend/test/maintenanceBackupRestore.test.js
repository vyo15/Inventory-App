const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { after, before, beforeEach, test } = require("node:test");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("maintenance-backup-restore");
const {
  createBackup,
  createRestorePlan,
  executeRestore,
  getMaintenanceStatus,
  importBackupFile,
  listBackups,
  listInactivePurgeCandidates,
  purgeInactiveRecord,
} = require("../src/modules/maintenance/maintenance.service");
const {
  RESTORE_CONFIRM_KEYWORD,
  applyBackupRetention,
  createOfficialSqliteBackup,
  ensureDailyBackupForToday,
  ensureMonthlyBackups,
  getBackupPreview,
  readBackupManifest,
  validateSqliteFile,
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

const ensureActiveAdministrator = async () => {
  const db = await testDatabase.getDb();
  await db.run(
    `
      INSERT INTO users (username, username_lower, display_name, password_hash, role, status)
      VALUES ('restore-admin', 'restore-admin', 'Restore Admin', 'test-password-hash', 'administrator', 'active')
      ON CONFLICT(username_lower) DO UPDATE SET
        display_name = excluded.display_name,
        role = excluded.role,
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP
    `
  );
};

before(testDatabase.initialize);
beforeEach(async () => {
  await testDatabase.reset();
  resetBackupDirectory();
  await ensureActiveAdministrator();
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
  assert.equal(preview.safeForRestore, true);
  assert.equal(preview.accountSummary.activeAdministrators, 1);
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
  assert.equal(plan.safeForRestore, true);
  assert.equal(plan.accountSummary.activeAdministrators, 1);
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

test("preview menandai backup tanpa administrator aktif dan execute restore menolaknya sebelum pre-restore", async () => {
  await upsertCategory({ code: "CAT-NO-ADMIN", name: "Snapshot tanpa admin" });
  const db = await testDatabase.getDb();
  await db.run("DELETE FROM users");
  const backup = await createBackup({ type: "test", actor: "account-guard-tester" });

  await ensureActiveAdministrator();
  await upsertCategory({ code: "CAT-NO-ADMIN", name: "Database aktif tetap aman" });
  const preRestoreBefore = await db.get(
    "SELECT COUNT(*) AS count FROM backup_logs WHERE filename LIKE '%pre-restore%'"
  );

  const plan = await createRestorePlan({
    filename: backup.filename,
    actor: "account-guard-tester",
  });

  assert.equal(plan.validForRestore, true);
  assert.equal(plan.safeForRestore, false);
  assert.equal(plan.accountSummary.totalUsers, 0);
  assert.equal(plan.accountSummary.activeAdministrators, 0);
  assert.match(plan.restoreSafety.messages.join(" "), /Restore normal diblokir/);
  assert.doesNotMatch(plan.restoreSafety.messages.join(" "), /Setup Administrator Pertama/);
  assert.equal(plan.restoreSafety.accountGuardPassed, false);
  assert.equal(plan.restoreSafety.severity, "blocked");

  await assert.rejects(
    executeRestore({
      filename: backup.filename,
      confirmKeyword: RESTORE_CONFIRM_KEYWORD,
      actor: "account-guard-tester",
    }),
    (error) => error?.errorCode === "RESTORE_ACTIVE_ADMIN_REQUIRED" && error?.statusCode === 409,
  );

  assert.equal((await getCategory("CAT-NO-ADMIN")).name, "Database aktif tetap aman");
  assert.equal((await db.get("SELECT COUNT(*) AS count FROM users WHERE role = 'administrator' AND status = 'active'")).count, 1);
  const preRestoreAfter = await db.get(
    "SELECT COUNT(*) AS count FROM backup_logs WHERE filename LIKE '%pre-restore%'"
  );
  assert.equal(preRestoreAfter.count, preRestoreBefore.count);
});

test("validasi backup tanpa tabel users tetap read-only dan diblokir secara operasional", async () => {
  const missingUsersPath = path.join(testDatabase.tempDir, "missing-users.sqlite");
  const rawDb = await open({ filename: missingUsersPath, driver: sqlite3.Database });
  try {
    await rawDb.exec(`
      CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO schema_meta (key, value) VALUES ('schema_version', '9');
      CREATE TABLE products (id TEXT PRIMARY KEY);
    `);
  } finally {
    await rawDb.close();
  }

  const validation = await validateSqliteFile(missingUsersPath);
  assert.equal(validation.valid, true);
  assert.equal(validation.accountSummary.usersTableExists, false);
  assert.equal(validation.accountSummary.activeAdministrators, 0);
  assert.equal(validation.restoreSafety.accountGuardPassed, false);
  assert.equal(validation.restoreSafety.severity, "blocked");
});

test("preview menandai backup awal kosong tanpa user sebagai blocked", async () => {
  const db = await testDatabase.getDb();
  await db.run("DELETE FROM users");
  const backup = await createBackup({ type: "test", actor: "empty-backup-tester" });
  await ensureActiveAdministrator();

  const plan = await createRestorePlan({
    filename: backup.filename,
    actor: "empty-backup-tester",
  });

  assert.equal(plan.validForRestore, true);
  assert.equal(plan.safeForRestore, false);
  assert.equal(plan.restoreSafety.likelyEmptyDatabase, true);
  assert.equal(plan.restoreSafety.messages.some((message) => message.includes("database awal atau kosong")), true);
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



test("import backup rollback log dan menghapus file ketika audit gagal", async () => {
  await upsertCategory({ code: "CAT-IMPORT-ROLLBACK", name: "Import rollback source" });
  const backup = await createBackup({ type: "test", actor: "import-rollback-tester" });
  const packageBuffer = fs.readFileSync(backup.path);
  const db = await testDatabase.getDb();
  const beforeCount = await db.get("SELECT COUNT(*) AS count FROM backup_logs");
  const beforeFiles = new Set(fs.readdirSync(path.join(testDatabase.backupDir, "manual")));

  await db.exec(`
    CREATE TRIGGER force_backup_import_audit_failure
    BEFORE INSERT ON audit_logs
    WHEN NEW.action = 'backup_import'
    BEGIN
      SELECT RAISE(ABORT, 'forced backup import audit failure');
    END;
  `);

  await assert.rejects(
    importBackupFile({
      body: packageBuffer,
      headers: { "x-ims-backup-filename": encodeURIComponent("rollback-test.imsbackup") },
      actor: "import-rollback-tester",
    }),
    /forced backup import audit failure/,
  );

  const afterCount = await db.get("SELECT COUNT(*) AS count FROM backup_logs");
  const afterFiles = fs.readdirSync(path.join(testDatabase.backupDir, "manual"));
  assert.equal(afterCount.count, beforeCount.count);
  assert.deepEqual(new Set(afterFiles), beforeFiles);
});

test("status maintenance menampilkan Bearer legacy nonaktif secara default dan tetap menyimpan evidence", async () => {
  const db = await testDatabase.getDb();
  await db.run(
    `INSERT INTO audit_logs (module, action, entity_type, entity_id, description, actor)
     VALUES ('auth', 'legacy_bearer_migrated', 'local_user_session', '101', 'Migrasi test', 'admin')`
  );

  const status = await getMaintenanceStatus();

  assert.equal(status.maintenanceStatusContractVersion, 3);
  assert.equal(status.capabilities.sqliteOnlyRuntime, true);
  assert.equal(status.capabilities.tableCounts, true);
  assert.equal(status.capabilities.tableRecordStatusCounts, true);
  assert.equal(status.capabilities.realtimeEvents, true);
  assert.ok(status.statusGeneratedAt);
  assert.ok(status.backendStartedAt);
  assert.ok(status.backendRuntimeInstanceId);
  assert.equal(typeof status.databaseGeneration, "number");
  assert.equal(status.databaseConsistency.healthy, true);
  assert.deepEqual(status.databaseConsistency.missingTables, []);
  assert.equal(status.authCompatibility.legacyBearerEnabled, false);
  assert.equal(status.authCompatibility.removalReady, true);
  assert.equal(status.authCompatibility.manualConfirmationRequired, false);
  assert.equal(status.authCompatibility.migrationEvidence.totalMigrations, 1);
  assert.equal(status.authCompatibility.migrationEvidence.recentMigrations7d, 1);
  assert.ok(status.authCompatibility.migrationEvidence.latestMigrationAt);
  assert.equal(typeof status.tableCounts.products, "number");
  assert.equal(status.tableCounts.audit_logs, status.auditCount);
  assert.equal(typeof status.tableCounts.production_work_logs, "number");
  assert.equal(status.tableRecordStatusCounts.audit_logs.storedTotal, status.auditCount);
  assert.equal(typeof status.realtime.revision, "number");
  assert.equal(status.backupLifecycle.schedulerActive, false);
  assert.equal(status.backupPolicy.autoDaily, false);
  assert.equal(status.backupPolicy.autoMonthlyPromotion, false);
  assert.equal(status.backupPolicy.autoRetention, false);
  assert.equal(status.backupPolicy.diskSpacePreflight, true);
  assert.equal(status.backupPolicy.zip64Supported, false);
});

test("status maintenance membaca perubahan kategori dari koneksi SQLite aktif yang sama", async () => {
  const db = await testDatabase.getDb();
  const before = await db.get("SELECT COUNT(*) AS count FROM categories");
  await upsertCategory({ code: "CAT-LIVE-STATUS", name: "Kategori realtime" });

  const status = await getMaintenanceStatus();
  const after = await db.get("SELECT COUNT(*) AS count FROM categories");

  assert.equal(after.count, before.count + 1);
  assert.equal(status.tableCounts.categories, after.count);
  assert.equal(status.categoryCount, after.count);
  assert.equal(status.databaseConsistency.healthy, true);
});


test("status maintenance membedakan customer aktif, nonaktif, deleted, dan total tersimpan", async () => {
  const db = await testDatabase.getDb();
  await db.run(
    `INSERT INTO customers (customer_code, name, status)
     VALUES ('CUS-ACTIVE', 'Customer Aktif', 'active'),
            ('CUS-INACTIVE', 'Customer Nonaktif', 'inactive'),
            ('CUS-DELETED', 'Customer Deleted', 'deleted')`
  );

  const status = await getMaintenanceStatus();
  assert.deepEqual(status.tableRecordStatusCounts.customers, {
    storedTotal: 3,
    active: 1,
    inactive: 1,
    deleted: 1,
    statusAware: true,
  });
  assert.equal(status.customerCount, 2);
  assert.equal(status.tableCounts.customers, 3);
});

test("purge maintenance hanya menghapus customer nonaktif yang aman setelah backup dan audit snapshot", async () => {
  const db = await testDatabase.getDb();
  const insertResult = await db.run(
    `INSERT INTO customers (customer_code, name, status, notes)
     VALUES ('CUS-PURGE', 'Customer Purge', 'deleted', 'snapshot audit')`
  );
  const customerId = insertResult.lastID;

  const preview = await listInactivePurgeCandidates({
    entityType: "customer",
    actorUser: { id: 999, username: "admin" },
  });
  const candidate = preview.groups[0].candidates.find((item) => item.id === String(customerId));
  assert.equal(candidate.safeToDelete, true);

  await assert.rejects(
    purgeInactiveRecord({
      entityType: "customer",
      id: customerId,
      confirmKeyword: "SALAH",
      confirmTarget: "CUS-PURGE",
      actorUser: { id: 999, username: "admin" },
    }),
    (error) => error.errorCode === "INACTIVE_PURGE_CONFIRMATION_REQUIRED",
  );

  const result = await purgeInactiveRecord({
    entityType: "customer",
    id: customerId,
    confirmKeyword: "HAPUS PERMANEN",
    confirmTarget: "CUS-PURGE",
    actorUser: { id: 999, username: "admin" },
  });

  assert.equal(result.purged, true);
  assert.equal(result.auditSnapshotRetained, true);
  assert.ok(result.preRepairBackup.filename);
  assert.equal(await db.get("SELECT id FROM customers WHERE id = ?", [customerId]), undefined);

  const audit = await db.get(
    "SELECT * FROM audit_logs WHERE action = 'inactive_record_purge' AND entity_id = ? ORDER BY id DESC LIMIT 1",
    [String(customerId)],
  );
  assert.ok(audit);
  assert.match(audit.metadata_json, /Customer Purge/);
});

test("purge maintenance memblokir customer yang masih direferensikan transaksi", async () => {
  const db = await testDatabase.getDb();
  const insertResult = await db.run(
    `INSERT INTO customers (customer_code, name, status)
     VALUES ('CUS-REF', 'Customer Referensi', 'deleted')`
  );
  const customerId = insertResult.lastID;
  await db.run(
    `INSERT INTO sales (id, code, name, status, is_active, payload_json)
     VALUES ('SALE-REF', 'SALE-REF', 'Sale Referensi', 'completed', 1, ?)`,
    [JSON.stringify({ customerId, customerCode: "CUS-REF" })],
  );

  const preview = await listInactivePurgeCandidates({
    entityType: "customer",
    actorUser: { id: 999, username: "admin" },
  });
  const candidate = preview.groups[0].candidates.find((item) => item.id === String(customerId));
  assert.equal(candidate.safeToDelete, false);
  assert.ok(candidate.blockers.some((item) => item.table === "sales"));

  await assert.rejects(
    purgeInactiveRecord({
      entityType: "customer",
      id: customerId,
      confirmKeyword: "HAPUS PERMANEN",
      confirmTarget: "CUS-REF",
      actorUser: { id: 999, username: "admin" },
    }),
    (error) => error.errorCode === "INACTIVE_PURGE_REFERENCE_BLOCKED",
  );
  assert.ok(await db.get("SELECT id FROM customers WHERE id = ?", [customerId]));
});

test("purge mendeteksi nested JSON reference dan mapping legacy sebelum hard delete", async () => {
  const db = await testDatabase.getDb();
  const insertResult = await db.run(
    `INSERT INTO customers (customer_code, name, status)
     VALUES ('CUS-NESTED', 'Customer Nested', 'deleted')`,
  );
  const customerId = insertResult.lastID;
  await db.run(
    `INSERT INTO sales (id, code, name, status, is_active, payload_json)
     VALUES ('SALE-NESTED', 'SALE-NESTED', 'Sale Nested', 'Selesai', 1, ?)`,
    [JSON.stringify({ customer: { id: customerId, code: "CUS-NESTED" } })],
  );
  await db.run(
    `INSERT INTO migration_identity_map (module_key, legacy_source, legacy_id, sqlite_id, reference_code)
     VALUES ('customers', 'historical_import', 'legacy-customer', ?, 'CUS-NESTED')`,
    [String(customerId)],
  );

  const preview = await listInactivePurgeCandidates({
    entityType: "customer",
    actorUser: { id: 999, username: "admin" },
  });
  const candidate = preview.groups[0].candidates.find((item) => item.id === String(customerId));

  assert.equal(candidate.safeToDelete, false);
  assert.ok(candidate.blockers.some((item) => item.table === "sales"));
  assert.ok(candidate.blockers.some((item) => item.table === "migration_identity_map"));
});

test("purge user selalu diblokir untuk menjaga identitas histori audit", async () => {
  const db = await testDatabase.getDb();
  const result = await db.run(
    `INSERT INTO users (username, username_lower, display_name, password_hash, role, status)
     VALUES ('inactive-user', 'inactive-user', 'Inactive User', 'hash', 'user', 'inactive')`,
  );

  const preview = await listInactivePurgeCandidates({
    entityType: "user",
    actorUser: { id: 999, username: "admin" },
  });
  const candidate = preview.groups[0].candidates.find((item) => item.id === String(result.lastID));

  assert.equal(candidate.safeToDelete, false);
  assert.ok(candidate.blockers.some((item) => item.type === "protected_user_history"));
});
