const assert = require("node:assert/strict");
const test = require("node:test");
const { isTrustedOrigin } = require("../src/middlewares/corsOptions");

const createRequest = (hostname) => ({
  hostname,
  headers: { host: `${hostname}:3001` },
});

test("CORS mengizinkan frontend dengan hostname yang sama pada port berbeda", () => {
  const request = createRequest("192.168.1.20");
  assert.equal(isTrustedOrigin(request, "http://192.168.1.20:5173"), true);
  assert.equal(isTrustedOrigin(request, "http://192.168.1.99:5173"), false);
});

test("CORS memperlakukan localhost dan 127.0.0.1 sebagai loopback yang setara", () => {
  const request = createRequest("localhost");
  assert.equal(isTrustedOrigin(request, "http://127.0.0.1:5173"), true);
  assert.equal(isTrustedOrigin(request, "https://example.com"), false);
  assert.equal(isTrustedOrigin(request, "not-a-valid-origin"), false);
});

test("request tanpa Origin tetap diizinkan untuk health check lokal dan tooling", () => {
  assert.equal(isTrustedOrigin(createRequest("localhost"), ""), true);
});
