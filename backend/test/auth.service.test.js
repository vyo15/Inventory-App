const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("auth-service");
const authService = require("../src/modules/auth/auth.service");
const { getBootstrapCodeForConsole } = require("../src/modules/auth/authBootstrapGuard");

const ADMIN_PASSWORD = "Admin1234";

before(testDatabase.initialize);
beforeEach(testDatabase.reset);
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
