const assert = require("node:assert/strict");
const { EventEmitter, once } = require("node:events");
const { after, afterEach, before, beforeEach, test } = require("node:test");
const express = require("express");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("realtime-origin-propagation");

const { runInTransaction } = require("../src/db/connection");
const { requestContextMiddleware } = require("../src/middlewares/requestContext");
const { errorHandler } = require("../src/middlewares/errorHandler");
const {
  flushQueuedDatabaseMutations,
  registerRealtimeClient,
  stopRealtimeService,
} = require("../src/modules/realtime/realtime.service");

let server;
let baseUrl;

const createSseRequest = ({ clientId = "browser-test:page-test" } = {}) => {
  const req = new EventEmitter();
  req.query = { clientId };
  req.ip = "127.0.0.1";
  req.headers = {};
  req.get = (name) => req.headers[String(name || "").toLowerCase()] || "";
  req.localAuth = {
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    user: {
      id: 1,
      username: "admin",
      role: "administrator",
    },
  };
  req.socket = {
    remoteAddress: "127.0.0.1",
    setKeepAlive() {},
    setTimeout() {},
  };
  return req;
};

const createSseResponse = () => {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.headers = {};
  res.frames = [];
  res.ended = false;
  res.status = (statusCode) => {
    res.statusCode = statusCode;
    return res;
  };
  res.setHeader = (name, value) => {
    res.headers[String(name).toLowerCase()] = value;
  };
  res.flushHeaders = () => {};
  res.write = (frame) => {
    res.frames.push(String(frame));
    return true;
  };
  res.end = () => {
    if (res.ended) return;
    res.ended = true;
    res.emit("close");
  };
  res.json = (payload) => {
    res.jsonPayload = payload;
    return res;
  };
  return res;
};

const parseLastDataChangedPayload = (frames = []) => {
  const frame = [...frames].reverse().find((item) => item.includes("event: data_changed"));
  if (!frame) return null;
  const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));
  return dataLine ? JSON.parse(dataLine.slice("data: ".length)) : null;
};

const settleRealtime = async () => {
  await new Promise((resolve) => setTimeout(resolve, 80));
  flushQueuedDatabaseMutations();
};

before(async () => {
  await testDatabase.initialize();

  const app = express();
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.post("/mutate/:code", async (req, res, next) => {
    try {
      await runInTransaction(async (db) => {
        await db.run(
          "INSERT INTO customers (customer_code, name, status) VALUES (?, ?, 'active')",
          [req.params.code, req.body?.name || "Realtime Origin"],
        );
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });
  app.use(errorHandler);

  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  stopRealtimeService();
  await testDatabase.reset();
});

afterEach(() => {
  stopRealtimeService();
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => (
      error ? reject(error) : resolve()
    )));
  }
  await testDatabase.cleanup();
});

test("header mutasi mengalir dari HTTP request ke originClientId event SSE", async () => {
  const clientId = "browser-origin:page-origin";
  const sseReq = createSseRequest({ clientId });
  const sseRes = createSseResponse();
  registerRealtimeClient(sseReq, sseRes);

  const response = await fetch(`${baseUrl}/mutate/CUS-ORIGIN-1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-IMS-Client-ID": clientId,
    },
    body: JSON.stringify({ name: "Origin Header" }),
  });
  assert.equal(response.status, 200);

  await settleRealtime();
  const payload = parseLastDataChangedPayload(sseRes.frames);

  assert.equal(payload?.originClientId, clientId);
  assert.ok(payload?.tables.includes("customers"));
});

test("query clientId tanpa header tidak menandai mutation sebagai origin client", async () => {
  const sseReq = createSseRequest({ clientId: "spoofed-query-client" });
  const sseRes = createSseResponse();
  registerRealtimeClient(sseReq, sseRes);

  const response = await fetch(
    `${baseUrl}/mutate/CUS-ORIGIN-2?clientId=spoofed-query-client`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Origin Query" }),
    },
  );
  assert.equal(response.status, 200);

  await settleRealtime();
  const payload = parseLastDataChangedPayload(sseRes.frames);

  assert.equal(payload?.originClientId, null);
  assert.ok(payload?.tables.includes("customers"));
});
