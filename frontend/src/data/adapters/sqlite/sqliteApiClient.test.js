import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("sqliteApiClient origin identity", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requestSqliteApi meneruskan client ID yang sama dengan koneksi realtime", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { saved: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const statusService = await import("../../../services/System/sqliteBackendStatusService.js");
    const { requestSqliteApi } = await import("./sqliteApiClient.js");
    const clientId = statusService.getSqliteClientId();

    await requestSqliteApi("/api/transactions/sales/commit", {
      method: "POST",
      body: JSON.stringify({ status: "Selesai" }),
    });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["X-IMS-Client-ID"]).toBe(clientId);
    expect(options.credentials).toBe("include");
  });
});
