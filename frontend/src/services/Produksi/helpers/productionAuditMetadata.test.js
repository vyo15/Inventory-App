import { describe, expect, it, vi } from "vitest";
import { getCurrentIsoTimestamp, getProductionActorName } from "./productionAuditMetadata";

describe("productionAuditMetadata", () => {
  it("memakai urutan actor yang konsisten", () => {
    expect(getProductionActorName({ email: "mail@example.com", displayName: "Display" })).toBe("mail@example.com");
    expect(getProductionActorName({ displayName: "Display", username: "vio" })).toBe("Display");
    expect(getProductionActorName({ username: "vio", uid: "uid-1" })).toBe("vio");
    expect(getProductionActorName({ uid: "uid-1" })).toBe("uid-1");
    expect(getProductionActorName()).toBe("system");
  });

  it("menghasilkan timestamp ISO", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T10:00:00.000Z"));
    expect(getCurrentIsoTimestamp()).toBe("2026-07-02T10:00:00.000Z");
    vi.useRealTimers();
  });
});
