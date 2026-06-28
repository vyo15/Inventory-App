import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = fs.readFileSync(path.resolve("src/pages/Utilities/ResetMaintenanceData.jsx"), "utf8");
const summarySource = fs.readFileSync(path.resolve("src/pages/Utilities/components/ResetStatusSummaryCard.jsx"), "utf8");
const repairPanelSource = fs.readFileSync(path.resolve("src/pages/Utilities/components/ResetSafeRepairPanel.jsx"), "utf8");
const repairHookSource = fs.readFileSync(path.resolve("src/pages/Utilities/hooks/useResetMaintenanceRepairs.js"), "utf8");
const auditHookSource = fs.readFileSync(path.resolve("src/pages/Utilities/hooks/useResetMaintenanceAudits.js"), "utf8");
const historySource = fs.readFileSync(path.resolve("src/pages/Utilities/components/MaintenanceHistoryPanel.jsx"), "utf8");
const checklistSource = fs.readFileSync(path.resolve("src/pages/Utilities/components/MaintenanceChecklistPanel.jsx"), "utf8");
const inactiveDataSource = fs.readFileSync(path.resolve("src/pages/Utilities/components/MaintenanceInactiveDataPanel.jsx"), "utf8");

const countWorkspaceTabs = (source) => [
  'key: "overview"',
  'key: "backup-restore"',
  'key: "health-data"',
  'key: "inactive-data"',
  'key: "admin-tools"',
  'key: "history"',
].filter((key) => source.includes(key)).length;

describe("Maintenance Center contract", () => {
  it("mengelompokkan workspace menjadi enam area tanpa menghapus flow aktif", () => {
    expect(countWorkspaceTabs(pageSource)).toBe(6);
    expect(pageSource).toContain('label: "Backup & Restore"');
    expect(pageSource).toContain('label: "Kesehatan Data"');
    expect(pageSource).toContain('label: "Data Nonaktif"');
    expect(pageSource).toContain('label: "Alat Admin"');
    expect(pageSource).toContain('label: "Riwayat"');
    expect(pageSource).toContain('label: "Audit — Hanya baca"');
    expect(pageSource).toContain('label: "Perbaikan — Dengan pengaman"');
    expect(pageSource).toContain('label: "Export Data Master"');
    expect(pageSource).toContain('label: "Checklist"');
    expect(pageSource).not.toContain("ResetDangerZonePanel");
    expect(pageSource).not.toContain("HppCostConfirmModal");
    expect(pageSource).not.toContain('label: "Reset Testing"');
  });

  it("status belum diperiksa tidak disamarkan menjadi angka nol", () => {
    expect(auditHookSource).toContain("hasAuditResult: Boolean(dataQualityAudit)");
    expect(repairHookSource).toContain("hasStockReadModelAudit: Boolean(stockReadModelAudit)");
    expect(pageSource).toContain('"Belum diperiksa"');
    expect(summarySource).toContain('"Belum diperiksa"');
    expect(pageSource).toContain("autoBugSummary.hasAuditResult");
    expect(pageSource).toContain("hasStockReadModelAudit");
  });

  it("ringkasan memprioritaskan status operasional dan quick action", () => {
    expect(summarySource).toContain("SummaryStatGrid");
    expect(summarySource).toContain('title: "Layanan"');
    expect(summarySource).toContain('title: "Backup Terakhir"');
    expect(summarySource).toContain('title: "Audit Data"');
    expect(summarySource).toContain('title: "Tindakan"');
    expect(summarySource).toContain('onNavigate?.("backup-restore")');
    expect(summarySource).not.toContain("Database Queue");
    expect(summarySource).not.toContain("Structured Logging");
  });

  it("menyembunyikan panduan dan status sekunder di popover agar workspace tetap compact", () => {
    expect(pageSource).toContain("InfoPopoverButton");
    expect(pageSource).toContain('label="Panduan & Status"');
    expect(pageSource).toContain('title="Panduan Maintenance"');
    expect(pageSource).not.toContain("reset-maintenance-status-strip");
    expect(pageSource).not.toContain("showGuide");
    expect(pageSource).not.toContain("<ImsNotice");
  });

  it("repair tetap dibatasi ke stock read model dengan keyword orphan", () => {
    expect(repairHookSource).toContain("rebuildStockReadModelMaintenance");
    expect(repairHookSource).toContain("deleteOrphanStockReadModelsMaintenance");
    expect(repairPanelSource).toContain("BERSIHKAN DATA STOK");
    expect(repairPanelSource).toContain("backup pre-repair");
    expect(repairHookSource).not.toContain("repairPayroll");
    expect(repairHookSource).not.toContain("repairTransaction");
  });

  it("riwayat memakai audit log resmi, filter, dan pagination", () => {
    expect(historySource).toContain("getSqliteAuditLogs");
    expect(historySource).toContain('module: "maintenance"');
    expect(historySource).toContain("filteredAuditLogs");
    expect(historySource).toContain("showSizeChanger: true");
    expect(historySource).not.toContain("sessionStorage");
    expect(historySource).not.toContain('color: "purple"');
  });

  it("checklist retensi mengikuti scheduler runtime yang benar-benar aktif", () => {
    expect(checklistSource).toContain("backupLifecycle.schedulerActive");
    expect(checklistSource).toContain("backupPolicy.autoRetention");
    expect(checklistSource).toContain("Scheduler lifecycle tidak aktif");
  });

  it("hard-delete hanya tersedia lewat Data Nonaktif dengan backup, dependency guard, dan audit snapshot", () => {
    expect(inactiveDataSource).toContain("HAPUS PERMANEN");
    expect(inactiveDataSource).toContain("safeToDelete");
    expect(inactiveDataSource).toContain("backup otomatis");
    expect(inactiveDataSource).toContain("snapshot audit");
    expect(inactiveDataSource).toContain('value: "safe"');
    expect(inactiveDataSource).toContain('value: "blocked"');
    expect(inactiveDataSource).toContain("Stok, transaksi, finance, produksi, payroll");
  });
});
