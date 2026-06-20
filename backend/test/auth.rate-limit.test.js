const assert = require("node:assert/strict");
const { once } = require("node:events");
const test = require("node:test");
const express = require("express");
const { createLoginRateLimiter } = require("../src/middlewares/authRateLimit");

const startLoginServer = async () => {
  const app = express();
  app.use(express.json());
  app.post(
    "/login",
    createLoginRateLimiter({ windowMs: 60_000, limit: 5 }),
    (request, response) => {
      if (request.body?.password === "valid") {
        return response.status(200).json({ ok: true });
      }
      return response.status(401).json({ ok: false, errorCode: "INVALID_CREDENTIALS" });
    }
  );

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  return {
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
    url: `http://127.0.0.1:${address.port}/login`,
  };
};

const postLogin = (url, password) => fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "admin", password }),
});

test("login limiter memblokir percobaan gagal keenam dari IP yang sama", async (t) => {
  const server = await startLoginServer();
  t.after(server.close);

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await postLogin(server.url, "wrong");
    assert.equal(response.status, 401);
  }

  const blockedResponse = await postLogin(server.url, "wrong");
  const payload = await blockedResponse.json();

  assert.equal(blockedResponse.status, 429);
  assert.equal(payload.ok, false);
  assert.equal(payload.errorCode, "AUTH_RATE_LIMITED");
  assert.equal(typeof payload.details?.retryAfterSeconds, "number");
  assert.ok(Number(blockedResponse.headers.get("retry-after")) >= 1);
});

test("login berhasil tidak menghabiskan kuota kegagalan", async (t) => {
  const server = await startLoginServer();
  t.after(server.close);

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await postLogin(server.url, "valid");
    assert.equal(response.status, 200);
  }

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await postLogin(server.url, "wrong");
    assert.equal(response.status, 401);
  }

  const blockedResponse = await postLogin(server.url, "wrong");
  assert.equal(blockedResponse.status, 429);
});
