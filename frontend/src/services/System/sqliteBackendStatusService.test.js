import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("sqliteBackendStatusService client identity", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("memakai browser ID persisten dan page-instance ID yang stabil dalam satu tab", async () => {
    window.sessionStorage.setItem("ims.sqlite.clientId", "legacy-client-id");
    const service = await import("./sqliteBackendStatusService.js");

    const first = service.getSqliteClientId();
    const second = service.getSqliteClientId();

    expect(first).toBe(second);
    expect(first).toMatch(/^browser-.+:page-.+$/);
    expect(first).not.toContain("legacy-client-id");
    expect(window.localStorage.getItem("ims.sqlite.browserId")).toBe(first.split(":")[0]);
    expect(window.sessionStorage.getItem("ims.sqlite.clientId")).toBeNull();
  });

  it("membuat page-instance ID baru saat konteks tab baru dibuat", async () => {
    const firstModule = await import("./sqliteBackendStatusService.js");
    const first = firstModule.getSqliteClientId();
    const browserId = first.split(":")[0];

    vi.resetModules();
    const secondModule = await import("./sqliteBackendStatusService.js");
    const second = secondModule.getSqliteClientId();

    expect(second.split(":")[0]).toBe(browserId);
    expect(second).not.toBe(first);
  });

  it("mempertahankan client ID selama tab aktif walau localStorage dibersihkan", async () => {
    const service = await import("./sqliteBackendStatusService.js");
    const first = service.getSqliteClientId();

    window.localStorage.clear();
    const second = service.getSqliteClientId();

    expect(second).toBe(first);
  });

  it("memakai volatile browser ID yang stabil bila localStorage tidak tersedia", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    const service = await import("./sqliteBackendStatusService.js");
    const first = service.getSqliteClientId();
    const second = service.getSqliteClientId();

    expect(first).toBe(second);
    expect(first).toMatch(/^browser-volatile-.+:page-.+$/);
  });

  it("fetchSqliteJson menyertakan X-IMS-Client-ID pada request mutation", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { saved: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const service = await import("./sqliteBackendStatusService.js");
    const clientId = service.getSqliteClientId();

    await service.fetchSqliteJson("/api/customers", {
      method: "POST",
      headers: { Authorization: "Bearer legacy" },
      body: JSON.stringify({ name: "Realtime" }),
    });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["X-IMS-Client-ID"]).toBe(clientId);
    expect(options.headers.Authorization).toBe("Bearer legacy");
    expect(options.credentials).toBe("include");
  });

  it("import backup direct-fetch tetap menyertakan X-IMS-Client-ID", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { imported: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const service = await import("./sqliteBackendStatusService.js");
    const clientId = service.getSqliteClientId();
    const file = new File(["backup"], "manual.imsbackup", {
      type: "application/octet-stream",
    });

    await service.importSqliteBackendBackup(file);

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["X-IMS-Client-ID"]).toBe(clientId);
    expect(options.headers["X-IMS-Backup-Filename"]).toBe(encodeURIComponent(file.name));
  });
});

it("download backup mempertahankan status, errorCode, details, dan payload", async () => {
  vi.spyOn(window, "fetch").mockResolvedValue(
    new Response(JSON.stringify({
      ok: false,
      message: "Backup tidak ditemukan",
      errorCode: "BACKUP_NOT_FOUND",
      details: { filename: "missing.imsbackup" },
    }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    }),
  );
  const service = await import("./sqliteBackendStatusService.js");

  await expect(service.downloadSqliteBackendBackup("missing.imsbackup")).rejects.toMatchObject({
    message: "Backup tidak ditemukan",
    status: 404,
    code: "BACKUP_NOT_FOUND",
    errorCode: "BACKUP_NOT_FOUND",
    details: { filename: "missing.imsbackup" },
  });
});

it("import backup raw request memakai error unavailable yang sama dengan request JSON", async () => {
  vi.spyOn(window, "fetch").mockRejectedValue(new TypeError("network down"));
  const service = await import("./sqliteBackendStatusService.js");
  const file = new File(["backup"], "manual.imsbackup", {
    type: "application/octet-stream",
  });

  await expect(service.importSqliteBackendBackup(file)).rejects.toMatchObject({
    status: 0,
    code: "SQLITE_BACKEND_UNAVAILABLE",
    errorCode: "SQLITE_BACKEND_UNAVAILABLE",
  });
});
