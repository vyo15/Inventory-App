import { beforeEach, describe, expect, it, vi } from "vitest";

describe("sqliteBackendStatusService client identity", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.resetModules();
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
});
