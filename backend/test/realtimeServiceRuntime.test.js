const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { afterEach, test } = require("node:test");
const {
  REALTIME_MAX_CLIENTS_PER_USER,
  broadcastRealtimeEvent,
  flushQueuedDatabaseMutations,
  getRealtimeRuntimeStatus,
  queueDatabaseMutation,
  registerRealtimeClient,
  stopRealtimeService,
} = require("../src/modules/realtime/realtime.service");

const createRequest = ({
  clientId = "client-test",
  userId = 1,
  role = "administrator",
  expiresAt = new Date(Date.now() + 60_000).toISOString(),
  ipAddress = "127.0.0.1",
} = {}) => {
  const req = new EventEmitter();
  req.query = { clientId };
  req.ip = ipAddress;
  req.headers = {};
  req.get = (name) => req.headers[String(name || "").toLowerCase()] || "";
  req.localAuth = {
    expiresAt,
    user: {
      id: userId,
      username: `user-${userId}`,
      role,
    },
  };
  req.socket = {
    remoteAddress: ipAddress,
    setKeepAlive() {},
    setTimeout() {},
  };
  return req;
};

const createResponse = () => {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.headers = {};
  res.frames = [];
  res.ended = false;
  res.jsonPayload = null;
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
    res.ended = true;
    res.emit("close");
  };
  res.json = (payload) => {
    res.jsonPayload = payload;
    return res;
  };
  return res;
};

afterEach(() => {
  stopRealtimeService();
});

test("koneksi SSE ditutup ketika session mencapai expiresAt", async () => {
  const req = createRequest({
    expiresAt: new Date(Date.now() + 25).toISOString(),
  });
  const res = createResponse();

  registerRealtimeClient(req, res);
  assert.equal(getRealtimeRuntimeStatus().connectedClients, 1);
  assert.ok(res.frames.some((frame) => frame.includes("event: connected")));

  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.ok(res.frames.some((frame) => frame.includes("event: session_expired")));
  assert.equal(res.ended, true);
  assert.equal(getRealtimeRuntimeStatus().connectedClients, 0);
});

test("batas koneksi per user menolak tab tambahan dengan 429", () => {
  for (let index = 0; index < REALTIME_MAX_CLIENTS_PER_USER; index += 1) {
    const req = createRequest({ clientId: `client-${index}` });
    const res = createResponse();
    registerRealtimeClient(req, res);
    assert.equal(res.statusCode, 200);
  }

  const rejectedReq = createRequest({ clientId: "client-over-limit" });
  const rejectedRes = createResponse();
  registerRealtimeClient(rejectedReq, rejectedRes);

  assert.equal(rejectedRes.statusCode, 429);
  assert.equal(rejectedRes.jsonPayload?.code, "REALTIME_CONNECTION_LIMITED");
  assert.equal(getRealtimeRuntimeStatus().connectedClients, REALTIME_MAX_CLIENTS_PER_USER);
});
test("batch mutation campuran client dan system tidak menekan event ke client pengirim", () => {
  queueDatabaseMutation({ tables: ["products"], originClientId: "client-a" });
  queueDatabaseMutation({ tables: ["inventory_logs"] });

  const payload = flushQueuedDatabaseMutations();

  assert.equal(payload.originClientId, null);
  assert.deepEqual([...payload.tables].sort(), ["inventory_logs", "products"]);
});

test("event mutation tetap dikirim ke koneksi client pengirim", () => {
  const req = createRequest({ clientId: "client-origin" });
  const res = createResponse();
  registerRealtimeClient(req, res);

  broadcastRealtimeEvent({
    tables: ["customers"],
    originClientId: "client-origin",
  });

  assert.ok(res.frames.some((frame) => (
    frame.includes("event: data_changed")
    && frame.includes('"originClientId":"client-origin"')
    && frame.includes('"customers"')
  )));
});

test("SSE dan queue mutation memakai normalisasi client ID yang sama", () => {
  const req = createRequest({ clientId: " browser-a:<page-a> !! " });
  const res = createResponse();
  registerRealtimeClient(req, res);

  queueDatabaseMutation({
    tables: ["customers"],
    originClientId: " browser-a:<page-a> !! ",
  });
  const payload = flushQueuedDatabaseMutations();

  assert.equal(payload.originClientId, "browser-a:page-a");
  assert.ok(res.frames.some((frame) => (
    frame.includes("event: connected")
    && frame.includes('"clientId":"browser-a:page-a"')
  )));
  assert.ok(res.frames.some((frame) => (
    frame.includes("event: data_changed")
    && frame.includes('"originClientId":"browser-a:page-a"')
  )));
});
