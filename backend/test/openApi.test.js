const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildOpenApiDocument } = require("../src/modules/openApi/openApi.service");

test("OpenAPI contract mendokumentasikan endpoint commit guarded dan cookie session", () => {
  const document = buildOpenApiDocument({ baseUrl: "http://127.0.0.1:3001" });
  assert.equal(document.openapi, "3.1.0");
  assert.equal(document.servers[0].url, "http://127.0.0.1:3001");
  assert.equal(document.components.securitySchemes.localSessionCookie.in, "cookie");
  assert.ok(document.components.schemas.ApiResponse.properties.ok);
  assert.ok(document.paths["/api/transactions/purchases/commit"]);
  assert.ok(document.paths["/api/maintenance/restore-execute"]);
  assert.ok(document.paths["/api/production/orders/commit"]);
  assert.ok(document.paths["/api/maintenance/data-audit"]);
  assert.ok(document.paths["/api/maintenance/initial-setup-readiness"]);
  assert.ok(document.paths["/api/maintenance/stock-read-model-rebuild"]);
  assert.equal(document.paths["/api/finance/cash-in/commit"].post.responses[409].description, "Referensi manual duplikat");
});
