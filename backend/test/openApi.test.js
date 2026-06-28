const assert = require("node:assert/strict");
const { test } = require("node:test");
const { buildOpenApiDocument } = require("../src/modules/openApi/openApi.service");

test("OpenAPI contract mendokumentasikan endpoint commit guarded dan cookie session", () => {
  const document = buildOpenApiDocument({ baseUrl: "http://127.0.0.1:3001" });
  assert.equal(document.openapi, "3.1.0");
  assert.equal(document.servers[0].url, "http://127.0.0.1:3001");
  assert.equal(document.components.securitySchemes.localSessionCookie.in, "cookie");
  assert.ok(document.components.schemas.ApiResponse.properties.ok);
  assert.ok(document.components.schemas.ApiResponse.properties.meta);
  assert.ok(document.components.schemas.ApiResponse.properties.details);
  assert.ok(document.paths["/api/transactions/purchases/commit"]);
  assert.ok(document.paths["/api/maintenance/restore-execute"]);
  assert.ok(document.paths["/api/production/orders/commit"]);
  assert.ok(document.paths["/api/maintenance/data-audit"]);
  assert.ok(document.paths["/api/maintenance/initial-setup-readiness"]);
  assert.ok(document.paths["/api/maintenance/stock-read-model-rebuild"]);
  assert.ok(document.paths["/api/realtime/events"]);
  assert.ok(document.paths["/api/realtime/status"]);
  assert.ok(document.paths["/api/maintenance/inactive-data"]);
  assert.ok(document.paths["/api/maintenance/inactive-data/purge"]);
  assert.ok(document.paths["/api/testing-lab/status"]);
  assert.ok(document.paths["/api/testing-lab/baseline"]);
  assert.ok(document.paths["/api/testing-lab/operational-source/preview"]);
  assert.ok(document.paths["/api/testing-lab/operational-source/clone"]);
  assert.ok(document.paths["/api/testing-lab/reset"]);
  assert.ok(document.paths["/api/testing-lab/sessions/complete"]);
  for (const path of [
    "/api/stock/adjustments/commit",
    "/api/transactions/purchases/commit",
    "/api/transactions/sales/commit",
    "/api/transactions/returns/commit",
    "/api/finance/cash-in/commit",
    "/api/finance/cash-out/commit",
    "/api/production/orders/commit",
  ]) {
    assert.ok(document.paths[path].post.responses[201], `${path} harus mendokumentasikan HTTP 201`);
    assert.equal(document.paths[path].post.responses[200], undefined);
  }
  assert.equal(document.paths["/api/finance/cash-in/commit"].post.responses[409].description, "Referensi manual duplikat");
});
