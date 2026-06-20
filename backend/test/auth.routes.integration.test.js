process.env.IMS_AUTH_BOOTSTRAP_CODE = "TESTSETUP1234";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const { after, before, beforeEach, test } = require("node:test");
const express = require("express");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("auth-routes");
const authRoutes = require("../src/modules/auth/auth.routes");
const authService = require("../src/modules/auth/auth.service");
const { errorHandler } = require("../src/middlewares/errorHandler");
const { getBootstrapCodeForConsole } = require("../src/modules/auth/authBootstrapGuard");

const ADMIN_PASSWORD = "Admin1234";
let server;
let baseUrl;

const startServer = async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use(errorHandler);

  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
};

const stopServer = () => new Promise((resolve, reject) => {
  if (!server) return resolve();
  return server.close((error) => (error ? reject(error) : resolve()));
});

const request = (path, options = {}) => fetch(`${baseUrl}${path}`, {
  ...options,
  headers: {
    "content-type": "application/json",
    ...(options.headers || {}),
  },
});

const bootstrapAdministrator = () => authService.bootstrapAdmin({
  bootstrapCode: getBootstrapCodeForConsole(),
  username: "admin",
  displayName: "Administrator Test",
  password: ADMIN_PASSWORD,
});

before(async () => {
  await testDatabase.initialize();
  await startServer();
});

beforeEach(testDatabase.reset);

after(async () => {
  await stopServer();
  await testDatabase.cleanup();
});

test("status bootstrap tidak membocorkan kode dan endpoint mewajibkan kode terminal", async () => {
  const statusResponse = await request("/api/auth/status");
  const statusPayload = await statusResponse.json();

  assert.equal(statusResponse.status, 200);
  assert.equal(statusResponse.headers.get("cache-control"), "no-store");
  assert.equal(statusPayload.data.bootstrapRequired, true);
  assert.equal(statusPayload.data.bootstrapCodeRequired, true);
  assert.equal("bootstrapCode" in statusPayload.data, false);
  assert.equal("bootstrapConfirmKeyword" in statusPayload.data, false);

  const rejectedResponse = await request("/api/auth/bootstrap-admin", {
    method: "POST",
    body: JSON.stringify({
      bootstrapCode: "WRONGCODE",
      username: "admin",
      displayName: "Administrator Test",
      password: ADMIN_PASSWORD,
    }),
  });
  const rejectedPayload = await rejectedResponse.json();

  assert.equal(rejectedResponse.status, 403);
  assert.equal(rejectedPayload.errorCode, "BOOTSTRAP_CODE_INVALID");

  const acceptedResponse = await request("/api/auth/bootstrap-admin", {
    method: "POST",
    body: JSON.stringify({
      bootstrapCode: getBootstrapCodeForConsole(),
      username: "admin",
      displayName: "Administrator Test",
      password: ADMIN_PASSWORD,
    }),
  });

  assert.equal(acceptedResponse.status, 201);
});

test("login route aktual menyimpan session di cookie HttpOnly tanpa mengirim token ke JSON", async () => {
  await bootstrapAdministrator();

  const loginResponse = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: ADMIN_PASSWORD }),
  });
  const payload = await loginResponse.json();
  const cookie = loginResponse.headers.get("set-cookie") || "";

  assert.equal(loginResponse.status, 200);
  assert.equal(loginResponse.headers.get("cache-control"), "no-store");
  assert.equal(payload.data.user.username, "admin");
  assert.equal("token" in payload.data, false);
  assert.match(cookie, /^ims_session=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\//i);

  const meResponse = await request("/api/auth/me", {
    headers: { cookie: cookie.split(";")[0] },
  });
  const mePayload = await meResponse.json();

  assert.equal(meResponse.status, 200);
  assert.equal(mePayload.data.user.username, "admin");
});

test("Bearer session lama dimigrasikan menjadi cookie oleh endpoint me", async () => {
  await bootstrapAdministrator();
  const legacySession = await authService.login({
    username: "admin",
    password: ADMIN_PASSWORD,
  });

  const meResponse = await request("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${legacySession.token}`,
      cookie: "ims_session=stale-cookie",
    },
  });
  const cookie = meResponse.headers.get("set-cookie") || "";

  assert.equal(meResponse.status, 200);
  assert.match(cookie, /^ims_session=/);
  assert.match(cookie, /HttpOnly/i);
});

test("logout menghapus cookie dan mencabut session aktif", async () => {
  await bootstrapAdministrator();
  const loginResponse = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: ADMIN_PASSWORD }),
  });
  const cookiePair = (loginResponse.headers.get("set-cookie") || "").split(";")[0];

  const logoutResponse = await request("/api/auth/logout", {
    method: "POST",
    headers: { cookie: cookiePair },
  });
  const clearedCookie = logoutResponse.headers.get("set-cookie") || "";

  assert.equal(logoutResponse.status, 200);
  assert.match(clearedCookie, /Max-Age=0/i);

  const meResponse = await request("/api/auth/me", {
    headers: { cookie: cookiePair },
  });
  const expiredCookie = meResponse.headers.get("set-cookie") || "";
  assert.equal(meResponse.status, 401);
  assert.match(expiredCookie, /Max-Age=0/i);
});

test("login route aktual memblokir percobaan gagal keenam", async () => {
  await bootstrapAdministrator();

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "Wrong123" }),
    });
    assert.equal(response.status, 401);
  }

  const blockedResponse = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: "Wrong123" }),
  });
  const blockedPayload = await blockedResponse.json();

  assert.equal(blockedResponse.status, 429);
  assert.equal(blockedPayload.errorCode, "AUTH_RATE_LIMITED");
});

test("Bearer legacy dapat dinonaktifkan tanpa memutus session cookie HttpOnly", async () => {
  await bootstrapAdministrator();
  const env = require("../src/config/env");
  const previousFlag = env.authAllowLegacyBearer;

  const legacySession = await authService.login({
    username: "admin",
    password: ADMIN_PASSWORD,
  });
  const cookieSession = await authService.login({
    username: "admin",
    password: ADMIN_PASSWORD,
  });
  const cookiePair = `ims_session=${encodeURIComponent(cookieSession.token)}`;

  env.authAllowLegacyBearer = false;
  try {
    const rejectedBearerResponse = await request("/api/auth/me", {
      headers: { Authorization: `Bearer ${legacySession.token}` },
    });
    assert.equal(rejectedBearerResponse.status, 401);

    const acceptedCookieResponse = await request("/api/auth/me", {
      headers: { cookie: cookiePair },
    });
    assert.equal(acceptedCookieResponse.status, 200);
  } finally {
    env.authAllowLegacyBearer = previousFlag;
  }
});
