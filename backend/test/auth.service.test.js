const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("auth-service");
const authService = require("../src/modules/auth/auth.service");
const { getBootstrapCodeForConsole } = require("../src/modules/auth/authBootstrapGuard");

const ADMIN_PASSWORD = "Admin1234";

before(testDatabase.initialize);
beforeEach(async () => {
  await testDatabase.reset();
  const db = await testDatabase.getDb();
  await db.run("DELETE FROM app_settings WHERE key LIKE 'user_avatar:%'");
});
after(testDatabase.cleanup);

const bootstrapAdministrator = () => authService.bootstrapAdmin({
  bootstrapCode: getBootstrapCodeForConsole(),
  username: "admin",
  displayName: "Administrator Test",
  password: ADMIN_PASSWORD,
});

test("bootstrap admin dan login membuat session serta audit log", async () => {
  const user = await bootstrapAdministrator();
  const result = await authService.login(
    { username: "ADMIN", password: ADMIN_PASSWORD },
    { userAgent: "node-test", ipAddress: "127.0.0.1" }
  );
  const db = await testDatabase.getDb();
  const session = await db.get("SELECT * FROM local_user_sessions WHERE user_id = ?", [user.id]);
  const loginAudit = await db.get(
    "SELECT * FROM audit_logs WHERE module = 'auth' AND action = 'login' AND entity_id = ?",
    [String(user.id)]
  );

  assert.equal(user.role, "administrator");
  assert.match(result.token, /^[a-f0-9]{64}$/);
  assert.equal(result.user.username, "admin");
  assert.equal(session.user_agent, "node-test");
  assert.equal(session.ip_address, "127.0.0.1");
  assert.ok(loginAudit);
});

test("login menolak password salah dan user nonaktif", async () => {
  await bootstrapAdministrator();

  await assert.rejects(
    authService.login({ username: "admin", password: "Wrong123" }),
    (error) => error.code === "INVALID_CREDENTIALS" && error.statusCode === 401
  );

  await authService.createUser({
    username: "operator",
    displayName: "Operator Test",
    password: "Operator123",
    role: "user",
    status: "inactive",
  }, { username: "admin" });

  await assert.rejects(
    authService.login({ username: "operator", password: "Operator123" }),
    (error) => error.code === "USER_INACTIVE" && error.statusCode === 403
  );
});

test("administrator aktif terakhir tidak dapat diturunkan role-nya", async () => {
  const administrator = await bootstrapAdministrator();

  await assert.rejects(
    authService.updateUser(
      administrator.id,
      { role: "user", status: "active" },
      { id: 999, username: "security-reviewer" }
    ),
    (error) => error.code === "LAST_ADMIN_GUARD"
  );

  const db = await testDatabase.getDb();
  const storedUser = await db.get("SELECT role, status FROM users WHERE id = ?", [administrator.id]);
  assert.deepEqual(storedUser, { role: "administrator", status: "active" });
});

test("delete user compatibility hanya menonaktifkan akun dan mempertahankan histori", async () => {
  const administrator = await bootstrapAdministrator();
  const user = await authService.createUser({
    username: "operator-soft-delete",
    displayName: "Operator Soft Delete",
    password: "Operator123",
    role: "user",
    status: "active",
  }, administrator);

  const result = await authService.deleteUser(user.id, administrator);
  assert.equal(result.softDeleted, true);
  assert.equal(result.deleted, false);

  const db = await testDatabase.getDb();
  const storedUser = await db.get("SELECT username, status FROM users WHERE id = ?", [user.id]);
  const audit = await db.get(
    "SELECT action FROM audit_logs WHERE module = 'auth' AND entity_id = ? ORDER BY id DESC LIMIT 1",
    [String(user.id)],
  );
  assert.deepEqual(storedUser, { username: "operator-soft-delete", status: "inactive" });
  assert.equal(audit.action, "user_deactivate");
});


test("foto user tersimpan tanpa schema baru, ikut list, dapat dihapus, dan payload invalid ditolak", async () => {
  const administrator = await bootstrapAdministrator();
  const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const avatarDataUrl = `data:image/png;base64,${pngBytes.toString("base64")}`;

  const user = await authService.createUser({
    username: "operator-avatar",
    displayName: "Operator Avatar",
    password: "Operator123",
    role: "user",
    status: "active",
    avatarDataUrl,
  }, administrator);

  assert.equal(user.avatarDataUrl, avatarDataUrl);

  const listedUser = (await authService.listUsers()).find((item) => item.id === user.id);
  assert.equal(listedUser.avatarDataUrl, avatarDataUrl);
  assert.equal((await authService.getUserProfile(user.id)).avatarDataUrl, avatarDataUrl);

  const loginResult = await authService.login({
    username: "operator-avatar",
    password: "Operator123",
  });
  assert.equal(loginResult.user.avatarDataUrl, avatarDataUrl);

  const db = await testDatabase.getDb();
  const setting = await db.get("SELECT value FROM app_settings WHERE key = ?", [`user_avatar:${user.id}`]);
  assert.equal(setting.value, avatarDataUrl);

  const updated = await authService.updateUser(user.id, { avatarDataUrl: null }, administrator);
  assert.equal(updated.avatarDataUrl, null);
  assert.equal(
    await db.get("SELECT value FROM app_settings WHERE key = ?", [`user_avatar:${user.id}`]),
    undefined,
  );

  await assert.rejects(
    authService.updateUser(user.id, {
      avatarDataUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    }, administrator),
    (error) => error.code === "USER_AVATAR_INVALID",
  );

  const oversized = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc((200 * 1024) + 1),
  ]);
  await assert.rejects(
    authService.updateUser(user.id, {
      avatarDataUrl: `data:image/png;base64,${oversized.toString("base64")}`,
    }, administrator),
    (error) => error.code === "USER_AVATAR_TOO_LARGE",
  );
});
