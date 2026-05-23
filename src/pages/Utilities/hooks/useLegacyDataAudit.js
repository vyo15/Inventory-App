import { useCallback, useState } from "react";
import { message } from "antd";
import { getLegacyDataMaintenanceAudit } from "../../../services/Maintenance/legacyDataMaintenanceService";

const LEGACY_DATA_AUDIT_LOG_PAYLOAD = {
  actionType: "legacy_data_audit",
  mode: "dry_run",
  modules: ["legacy_data", "cleanup_batch_3"],
  affectedCollections: [
    "productions",
    "production_orders",
    "production_work_logs",
    "inventory_logs",
    "sales",
    "returns",
    "stock_adjustments",
    "purchases",
    "incomes",
    "expenses",
  ],
  dryRun: true,
  status: "success",
  note: "Audit data lama hanya membaca data dan memberi rekomendasi reset/repair terarah.",
};

// -----------------------------------------------------------------------------
// IMS NOTE [AKTIF/BATCH 19E] — hook orchestration audit data lama.
// Fungsi blok: memindahkan state + handler Audit Data Lama dari halaman
// ResetMaintenanceData agar page tidak menumpuk orchestration audit read-only.
// Guard: dry-run only; hook ini tidak menjalankan reset, delete, repair,
// migration, stok, kas, payroll, HPP, atau mutasi transaksi.
// -----------------------------------------------------------------------------
const useLegacyDataAudit = ({ createPageMaintenanceLog } = {}) => {
  const [legacyDataAudit, setLegacyDataAudit] = useState(null);
  const [loadingLegacyDataAudit, setLoadingLegacyDataAudit] = useState(false);

  const handleLoadLegacyDataAudit = useCallback(async () => {
    try {
      setLoadingLegacyDataAudit(true);
      const result = await getLegacyDataMaintenanceAudit();
      setLegacyDataAudit(result);

      if (typeof createPageMaintenanceLog === "function") {
        await createPageMaintenanceLog({
          ...LEGACY_DATA_AUDIT_LOG_PAYLOAD,
          summary: result?.summary || {},
          affectedCount: result?.summary?.checkedRecords || 0,
        });
      }

      message.success("Dry run data lama selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan audit data lama.");
    } finally {
      setLoadingLegacyDataAudit(false);
    }
  }, [createPageMaintenanceLog]);

  return {
    legacyDataAudit,
    loadingLegacyDataAudit,
    handleLoadLegacyDataAudit,
  };
};

export default useLegacyDataAudit;
