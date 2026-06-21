const assert = require("node:assert/strict");
const { test } = require("node:test");
const securityHeaders = require("../src/middlewares/securityHeaders");

test("security headers melindungi response API tanpa memblokir akses same-site LAN", () => {
  const headers = new Map();
  let continued = false;
  securityHeaders({}, {
    setHeader(name, value) {
      headers.set(name, value);
    },
  }, () => {
    continued = true;
  });

  assert.equal(continued, true);
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(headers.get("Cross-Origin-Resource-Policy"), "same-site");
  assert.match(headers.get("Content-Security-Policy"), /frame-ancestors 'none'/);
});
