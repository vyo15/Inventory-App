const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { once } = require("node:events");
const { after, before, test } = require("node:test");
const express = require("express");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const tokenRoles = new Map([
  [hashToken("admin-token"), "administrator"],
  [hashToken("user-token"), "user"],
]);

const fakeDb = {
  all: async () => [],
  get: async (sql, params = []) => {
    if (!String(sql).includes("FROM local_user_sessions")) return null;

    const role = tokenRoles.get(params[0]);
    if (!role) return null;

    return {
      session_id: `${role}-session`,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      user_id: role === "administrator" ? 1 : 2,
      username: role === "administrator" ? "admin" : "operator",
      username_lower: role === "administrator" ? "admin" : "operator",
      display_name: role === "administrator" ? "Administrator Test" : "Operator Test",
      role,
      status: "active",
    };
  },
};

const connectionPath = require.resolve("../src/db/connection");
require.cache[connectionPath] = {
  id: connectionPath,
  filename: connectionPath,
  loaded: true,
  exports: {
    getDb: async () => fakeDb,
  },
};

const financeRoutes = require("../src/modules/finance/finance.routes");
const productionRoutes = require("../src/modules/production/production.routes");
const reportsRoutes = require("../src/modules/reports/reports.routes");
const { errorHandler } = require("../src/middlewares/errorHandler");

let server;
let baseUrl;

const requestWithToken = (path, token) => fetch(`${baseUrl}${path}`, {
  headers: {
    authorization: `Bearer ${token}`,
  },
});

before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/finance", financeRoutes);
  app.use("/api/production", productionRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use(errorHandler);

  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (!server) return;

  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("role user ditolak membaca finance, report, dan payroll sensitif", async () => {
  const paths = [
    "/api/finance/incomes",
    "/api/finance/expenses",
    "/api/finance/ledger",
    "/api/reports",
    "/api/production/payrolls",
  ];

  for (const path of paths) {
    const response = await requestWithToken(path, "user-token");
    const payload = await response.json();

    assert.equal(response.status, 403, `${path} harus administrator-only`);
    assert.equal(payload.errorCode, "FORBIDDEN");
  }
});

test("role user tetap dapat membaca endpoint produksi operasional", async () => {
  const paths = [
    "/api/production/planning",
    "/api/production/orders",
    "/api/production/work-logs",
  ];

  for (const path of paths) {
    const response = await requestWithToken(path, "user-token");
    assert.equal(response.status, 200, `${path} harus tetap tersedia untuk operator harian`);
  }
});

test("administrator tetap dapat membaca endpoint sensitif", async () => {
  const paths = [
    "/api/finance/incomes",
    "/api/finance/expenses",
    "/api/finance/ledger",
    "/api/reports",
    "/api/production/payrolls",
  ];

  for (const path of paths) {
    const response = await requestWithToken(path, "admin-token");
    assert.equal(response.status, 200, `${path} harus tetap tersedia untuk administrator`);
  }
});
