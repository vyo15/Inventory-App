const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  getRequestContext,
  normalizeClientId,
  requestContextMiddleware,
} = require("../src/middlewares/requestContext");

const runMiddleware = ({ headerClientId = "", queryClientId = "" } = {}) => {
  let captured = null;
  const req = {
    method: "POST",
    path: "/api/customers",
    query: { clientId: queryClientId },
    get(name) {
      return String(name || "").toLowerCase() === "x-ims-client-id"
        ? headerClientId
        : "";
    },
  };

  requestContextMiddleware(req, {}, () => {
    captured = getRequestContext();
  });
  return captured;
};

test("request context memakai X-IMS-Client-ID dan menormalisasi nilainya", () => {
  const context = runMiddleware({
    headerClientId: " browser-abc:<page-123> !! ",
  });

  assert.equal(context.clientId, "browser-abc:page-123");
  assert.equal(context.method, "POST");
  assert.equal(context.path, "/api/customers");
  assert.ok(context.requestId);
});

test("query clientId tidak dapat menyamar sebagai origin request mutasi", () => {
  const context = runMiddleware({
    queryClientId: "spoofed-query-client",
  });

  assert.equal(context.clientId, "");
});

test("normalisasi client ID konsisten dan dibatasi 128 karakter", () => {
  const normalized = normalizeClientId(`client:${"a".repeat(200)}<>`);
  assert.equal(normalized.length, 128);
  assert.match(normalized, /^[a-zA-Z0-9._:-]+$/);
});
