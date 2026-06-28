import { describe, expect, it } from "vitest";
import { getBackupTypeLabel } from "./backupUiFormatters";

describe("backupUiFormatters", () => {
  it("menjaga label backup canonical lintas panel maintenance", () => {
    expect(getBackupTypeLabel("pre-repair")).toBe("Sebelum Repair");
    expect(getBackupTypeLabel("compatibility")).toBe("Arsip Kompatibilitas");
    expect(getBackupTypeLabel("archived")).toBe("Arsip");
    expect(getBackupTypeLabel("future-type")).toBe("future-type");
  });
});
