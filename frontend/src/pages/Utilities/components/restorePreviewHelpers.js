export const BUSINESS_SUMMARY_FIELDS = Object.freeze([
  ["products", "Produk"],
  ["rawMaterials", "Bahan Baku"],
  ["semiFinishedMaterials", "Produk Setengah Jadi"],
  ["suppliers", "Supplier"],
  ["customers", "Customer"],
  ["purchases", "Pembelian"],
  ["sales", "Penjualan"],
  ["returns", "Retur"],
  ["productionOrders", "Order Produksi"],
  ["financeLedger", "Ledger"],
]);

export const DATA_COVERAGE_GROUPS = Object.freeze([
  {
    key: "master_data",
    label: "Master Data",
    description: "Data utama barang, relasi bisnis, kategori, dan aturan harga.",
    tables: Object.freeze([
      ["products", "Produk"],
      ["raw_materials", "Bahan Baku"],
      ["semi_finished_materials", "Produk Setengah Jadi"],
      ["categories", "Kategori"],
      ["suppliers", "Supplier"],
      ["customers", "Customer"],
      ["pricing_rules", "Aturan Harga"],
    ]),
  },
  {
    key: "supplier_catalog",
    label: "Katalog Supplier",
    description: "Penawaran restock dan histori perubahan katalog per supplier.",
    tables: Object.freeze([
      ["supplier_catalog_offers", "Penawaran Restock"],
      ["supplier_catalog_history", "Histori Katalog"],
    ]),
  },
  {
    key: "stock",
    label: "Stok",
    description: "Posisi stok, penyesuaian, dan histori mutasi persediaan.",
    tables: Object.freeze([
      ["stock_read_models", "Posisi Stok"],
      ["stock_adjustments", "Penyesuaian Stok"],
      ["inventory_logs", "Mutasi Stok"],
    ]),
  },
  {
    key: "transactions",
    label: "Transaksi",
    description: "Pembelian, penjualan, dan retur yang menjadi sumber pergerakan stok.",
    tables: Object.freeze([
      ["purchases", "Pembelian"],
      ["sales", "Penjualan"],
      ["returns", "Retur"],
    ]),
  },
  {
    key: "production",
    label: "Produksi",
    description: "Master proses, BOM, planning, order, work log, dan payroll produksi.",
    tables: Object.freeze([
      ["production_steps", "Tahap Produksi"],
      ["production_employees", "Pekerja Produksi"],
      ["production_profiles", "Template Produksi"],
      ["production_boms", "BOM Produksi"],
      ["production_planning", "Planning Produksi"],
      ["production_orders", "Order Produksi"],
      ["production_work_logs", "Work Log"],
      ["production_payrolls", "Payroll Produksi"],
    ]),
  },
  {
    key: "finance",
    label: "Keuangan",
    description: "Kas masuk, kas keluar, dan ledger keuangan resmi.",
    tables: Object.freeze([
      ["incomes", "Pemasukan"],
      ["expenses", "Pengeluaran"],
      ["money_movement_ledger", "Ledger"],
    ]),
  },
  {
    key: "system_history",
    label: "Sistem & Histori",
    description: "Akun lokal, audit, riwayat backup/restore, dan snapshot laporan.",
    tables: Object.freeze([
      ["users", "User"],
      ["audit_logs", "Log Audit"],
      ["backup_logs", "Riwayat Backup"],
      ["restore_logs", "Riwayat Restore"],
      ["report_snapshots", "Snapshot Laporan"],
    ]),
  },
  {
    key: "technical",
    label: "Data Teknis",
    description: "Metadata internal yang dibutuhkan agar aplikasi tetap konsisten setelah restore.",
    technical: true,
    tables: Object.freeze([
      ["schema_meta", "Metadata Schema"],
      ["app_settings", "Pengaturan Aplikasi"],
      ["module_migration_status", "Status Modul"],
      ["business_code_counters", "Counter Kode"],
      ["roles", "Role"],
      ["local_user_sessions", "Sesi Login Lokal"],
      ["migration_identity_map", "Peta Identitas Migrasi"],
    ]),
  },
]);

const normalizeTableCounts = (tableCounts = {}) => (
  tableCounts && typeof tableCounts === "object" ? tableCounts : {}
);

const normalizeCountValue = ({ normalizedCounts, table, sourceAvailable, missingAsZero }) => {
  if (!sourceAvailable) return null;
  const hasTable = Object.prototype.hasOwnProperty.call(normalizedCounts, table);
  if (!hasTable && !missingAsZero) return null;
  const value = Number(hasTable ? normalizedCounts[table] : 0);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

export const buildDataCoverageGroups = (
  tableCounts = null,
  {
    sourceAvailable = Boolean(tableCounts),
    missingAsZero = false,
    tableRecordStatusCounts = null,
  } = {},
) => {
  const normalizedCounts = normalizeTableCounts(tableCounts);
  const normalizedStatusCounts = normalizeTableCounts(tableRecordStatusCounts);

  return DATA_COVERAGE_GROUPS.map((group) => {
    const rows = group.tables.map(([table, label]) => {
      const count = normalizeCountValue({ normalizedCounts, table, sourceAvailable, missingAsZero });
      const statusSummary = normalizedStatusCounts?.[table];
      const hasStatusSummary = Boolean(
        sourceAvailable
        && statusSummary
        && typeof statusSummary === "object"
        && Number.isFinite(Number(statusSummary.storedTotal)),
      );

      return {
        table,
        label,
        count,
        statusAware: hasStatusSummary ? statusSummary.statusAware === true : false,
        activeCount: hasStatusSummary ? Number(statusSummary.active || 0) : null,
        inactiveCount: hasStatusSummary ? Number(statusSummary.inactive || 0) : null,
        deletedCount: hasStatusSummary ? Number(statusSummary.deleted || 0) : null,
        storedTotal: hasStatusSummary ? Number(statusSummary.storedTotal || 0) : count,
      };
    });
    const complete = rows.every((row) => row.count !== null);

    return {
      ...group,
      rows,
      complete,
      total: complete ? rows.reduce((sum, row) => sum + row.count, 0) : null,
    };
  });
};

export const buildRestoreComparisonGroups = ({
  currentTableCounts = null,
  backupTableCounts = null,
  currentAvailable = Boolean(currentTableCounts),
  backupAvailable = Boolean(backupTableCounts),
} = {}) => {
  const currentGroups = buildDataCoverageGroups(currentTableCounts, {
    sourceAvailable: currentAvailable,
  });
  const backupGroups = buildDataCoverageGroups(backupTableCounts, {
    sourceAvailable: backupAvailable,
    missingAsZero: backupAvailable,
  });
  const backupByKey = new Map(backupGroups.map((group) => [group.key, group]));

  return currentGroups.map((currentGroup) => {
    const backupGroup = backupByKey.get(currentGroup.key);
    const backupRowsByTable = new Map((backupGroup?.rows || []).map((row) => [row.table, row]));
    const rows = currentGroup.rows.map((currentRow) => {
      const backupCount = backupRowsByTable.get(currentRow.table)?.count ?? null;
      const delta = currentRow.count !== null && backupCount !== null
        ? backupCount - currentRow.count
        : null;
      return {
        ...currentRow,
        currentCount: currentRow.count,
        backupCount,
        delta,
      };
    });
    const currentTotal = currentGroup.total;
    const backupTotal = backupGroup?.total ?? null;
    const delta = currentTotal !== null && backupTotal !== null
      ? backupTotal - currentTotal
      : null;

    return {
      ...currentGroup,
      complete: currentGroup.complete && backupGroup?.complete === true,
      currentTotal,
      backupTotal,
      delta,
      rows,
    };
  });
};

export const getBackupCreatedAt = (backup = {}) => (
  backup?.manifest?.createdAt || backup?.createdAt || backup?.created_at || ""
);

export const getBackupRegisteredAt = (backup = {}) => backup?.registeredAt || backup?.created_at || "";

export const getImportedSourceFilename = (filename = "") => {
  const match = String(filename).match(/^IMPORT-\d{8}T\d{6}Z-(.+)$/i);
  return match?.[1] || "";
};

export const isRestorePlanReady = ({
  restorePlan,
  selectedBackupFilename,
  restoreKeyword,
  restoreKeywordRequired,
} = {}) => Boolean(
  restorePlan?.validForRestore
  && restorePlan?.safeForRestore
  && selectedBackupFilename
  && String(restoreKeyword || "").trim() === restoreKeywordRequired
);
