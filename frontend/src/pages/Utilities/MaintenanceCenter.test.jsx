import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = fs.readFileSync(path.resolve("src/pages/Utilities/ResetMaintenanceData.jsx"), "utf8");
const repairPanelSource = fs.readFileSync(path.resolve("src/pages/Utilities/components/ResetSafeRepairPanel.jsx"), "utf8");
const repairHookSource = fs.readFileSync(path.resolve("src/pages/Utilities/hooks/useResetMaintenanceRepairs.js"), "utf8");
const historySource = fs.readFileSync(path.resolve("src/pages/Utilities/components/MaintenanceHistoryPanel.jsx"), "utf8");

describe("Maintenance Center contract", () => {
  it("hanya menampilkan flow maintenance aktif", () => {
    expect(pageSource).toContain('label: "Backup & Restore"');
    expect(pageSource).toContain('label: `Audit & Health');
    expect(pageSource).toContain('label: `Repair Data Turunan');
    expect(pageSource).toContain('label: "Export Data Master"');
    expect(pageSource).not.toContain("ResetDangerZonePanel");
    expect(pageSource).not.toContain("HppCostConfirmModal");
    expect(pageSource).not.toContain('label: "Reset Testing"');
  });

  it("repair tetap dibatasi ke stock read model dengan keyword orphan", () => {
    expect(repairHookSource).toContain("rebuildStockReadModelMaintenance");
    expect(repairHookSource).toContain("deleteOrphanStockReadModelsMaintenance");
    expect(repairPanelSource).toContain("BERSIHKAN DATA STOK");
    expect(repairPanelSource).toContain("backup pre-repair");
    expect(repairHookSource).not.toContain("repairPayroll");
    expect(repairHookSource).not.toContain("repairTransaction");
  });

  it("riwayat memakai audit log backend resmi", () => {
    expect(historySource).toContain("getSqliteAuditLogs");
    expect(historySource).toContain('module: "maintenance"');
    expect(historySource).not.toContain("sessionStorage");
  });
});
