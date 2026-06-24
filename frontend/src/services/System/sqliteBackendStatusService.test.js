import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSqliteRestorePlan, executeSqliteRestore, getSqliteAuditLogs } from "./sqliteBackendStatusService";

const jsonResponse = (data) => new Response(JSON.stringify({ ok: true, data }), {
  status: 200,
  headers: { "content-type": "application/json" },
});

beforeEach(() => {
  window.localStorage.clear();
});

describe("sqliteBackendStatusService guarded restore", () => {
  it("restore plan selalu memakai preview endpoint dengan cookie credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ mode: "preview_only" }));
    vi.stubGlobal("fetch", fetchMock);

    await createSqliteRestorePlan({ filename: "backup.imsbackup" });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/maintenance/restore-plan"),
      expect.objectContaining({ credentials: "include", method: "POST" }),
    );
  });


  it("riwayat maintenance membaca audit log resmi dengan filter module dan limit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await getSqliteAuditLogs({ module: "maintenance", limit: 25 });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/audit-logs?module=maintenance&limit=25"),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("restore execute mengirim keyword melalui endpoint guarded", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ restored: true }));
    vi.stubGlobal("fetch", fetchMock);

    await executeSqliteRestore({ filename: "backup.imsbackup", confirmKeyword: "RESTORE IMS" });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/maintenance/restore-execute");
    expect(options.credentials).toBe("include");
    expect(JSON.parse(options.body)).toEqual({ filename: "backup.imsbackup", confirmKeyword: "RESTORE IMS" });
  });
});
