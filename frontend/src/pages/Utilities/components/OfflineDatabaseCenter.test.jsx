import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DATA_COVERAGE_GROUPS,
  buildDataCoverageGroups,
  buildRestoreComparisonGroups,
  isRestorePlanReady,
} from "./restorePreviewHelpers";

const source = fs.readFileSync(
  path.resolve("src/pages/Utilities/components/OfflineDatabaseCenter.jsx"),
  "utf8",
);
const helperSource = fs.readFileSync(
  path.resolve("src/pages/Utilities/components/restorePreviewHelpers.js"),
  "utf8",
);
const presentationSource = fs.readFileSync(
  path.resolve("src/pages/Utilities/components/offlineDatabaseCenterPresentation.jsx"),
  "utf8",
);

const buildCompleteTableCounts = (overrides = {}) => Object.fromEntries([
  ...DATA_COVERAGE_GROUPS.flatMap((group) => group.tables.map(([table]) => [table, 0])),
  ...Object.entries(overrides),
]);

describe("OfflineDatabaseCenter restore account guard", () => {
  it("menolak readiness ketika backup valid teknis tetapi tidak aman untuk akun", () => {
    expect(isRestorePlanReady({
      restorePlan: { validForRestore: true, safeForRestore: false },
      selectedBackupFilename: "backup.imsbackup",
      restoreKeyword: "RESTORE DATABASE",
      restoreKeywordRequired: "RESTORE DATABASE",
    })).toBe(false);
  });

  it("mengizinkan restore hanya setelah preview teknis dan account guard sama-sama aman", () => {
    expect(isRestorePlanReady({
      restorePlan: { validForRestore: true, safeForRestore: true },
      selectedBackupFilename: "backup.imsbackup",
      restoreKeyword: "RESTORE DATABASE",
      restoreKeywordRequired: "RESTORE DATABASE",
    })).toBe(true);
  });

  it("menampilkan ringkasan akun, waktu backup asli, dan warning blocked yang konsisten", () => {
    expect(source).toContain('title="Akun dalam Backup"');
    expect(source).toContain('label="Administrator Aktif"');
    expect(source).toContain('message="Restore normal diblokir"');
    expect(source).toContain("Restore normal tidak dapat dijalankan");
    expect(source).not.toContain("Akan masuk Setup Administrator");
    expect(source).toContain('disabled={!restorePlan?.safeForRestore}');
    expect(helperSource).toContain("backup?.manifest?.createdAt");
  });

  it("mengelompokkan seluruh tabel data aktif termasuk data teknis", () => {
    const groups = buildDataCoverageGroups(buildCompleteTableCounts({
      products: 2,
      production_work_logs: 7,
      audit_logs: 3,
      schema_meta: 1,
    }));

    expect(groups.find((group) => group.key === "master_data")?.total).toBe(2);
    expect(groups.find((group) => group.key === "production")?.total).toBe(7);
    expect(groups.find((group) => group.key === "system_history")?.total).toBe(3);
    expect(groups.find((group) => group.key === "technical")?.total).toBe(1);
    expect(groups.flatMap((group) => group.rows)).toHaveLength(38);
  });

  it("membandingkan jumlah database aktif dan backup per kelompok", () => {
    const groups = buildRestoreComparisonGroups({
      currentTableCounts: buildCompleteTableCounts({ products: 5, sales: 10 }),
      backupTableCounts: buildCompleteTableCounts({ products: 4, sales: 12 }),
    });

    expect(groups.find((group) => group.key === "master_data")?.delta).toBe(-1);
    expect(groups.find((group) => group.key === "transactions")?.delta).toBe(2);
  });

  it("tidak menyamarkan status count yang belum tersedia sebagai nol", () => {
    const groups = buildDataCoverageGroups(null, { sourceAvailable: false });

    expect(groups.find((group) => group.key === "master_data")?.total).toBeNull();
    expect(groups.flatMap((group) => group.rows).every((row) => row.count === null)).toBe(true);
    expect(source).toContain("Frontend dan backend belum satu versi");
    expect(source).toContain("LIVE_STATUS_REFRESH_INTERVAL_MS");
  });

  it("menyederhanakan navigasi menjadi backup, restore, cakupan data, dan detail teknis", () => {
    expect(source).toContain('label: "Backup"');
    expect(source).toContain('label: "Restore"');
    expect(source).toContain('label: "Cakupan Data"');
    expect(source).toContain('label: "Detail Teknis"');
    expect(source).toContain("<Segmented");
    expect(source).toContain("activeCenterPanel");
    expect(source).not.toContain('className="offline-db-tabs"');
    expect(source).not.toContain('label: "Mode"');
  });

  it("memindahkan info teknis dan kebijakan ke popover agar daftar backup tetap ringkas", () => {
    expect(source).toContain("InfoPopoverButton");
    expect(source).toContain('label="Informasi"');
    expect(source).toContain('label="Kebijakan"');
    expect(presentationSource).toContain('title="Detail file backup"');
    expect(source).not.toContain("offline-db-status-strip-backup");
  });

  it("menampilkan status scheduler lifecycle aktual, bukan klaim kebijakan statis", () => {
    expect(source).toContain('label="Lifecycle Otomatis"');
    expect(source).toContain("backupLifecycle.schedulerActive");
    expect(source).toContain('label="Lifecycle Terakhir"');
    expect(source).toContain('label="Pemeriksaan Berikutnya"');
  });
  it("membedakan data aktif, nonaktif, logical-deleted, dan total tersimpan", () => {
    const statusCounts = {
      customers: { storedTotal: 2, active: 0, inactive: 0, deleted: 2, statusAware: true },
    };
    const groups = buildDataCoverageGroups(
      buildCompleteTableCounts({ customers: 2 }),
      { sourceAvailable: true, tableRecordStatusCounts: statusCounts },
    );
    const customer = groups.flatMap((group) => group.rows).find((row) => row.table === "customers");

    expect(customer).toMatchObject({
      count: 2,
      activeCount: 0,
      inactiveCount: 0,
      deletedCount: 2,
      storedTotal: 2,
      statusAware: true,
    });
    expect(presentationSource).toContain("Arsip histori");
    expect(presentationSource).toContain("tersimpan");
  });

  it("memakai pagination untuk daftar backup tanpa memotong diam-diam", () => {
    expect(source).toContain("BACKUP_PAGE_SIZE");
    expect(source).toContain("paginatedBackups");
    expect(source).toContain("offline-db-backup-pagination");
    expect(source).not.toContain("filteredBackups.slice(0, 50)");
  });

});
