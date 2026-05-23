import { useCallback, useState } from "react";
import { message } from "antd";
import {
  getProductionVariantMaintenanceAudit,
  repairProductionVariantMaintenance,
} from "../../../services/Maintenance/productionVariantMaintenanceService";

const PRODUCTION_MAINTENANCE_AUDIT_LOG_PAYLOAD = {
  actionType: "production_variant_audit",
  mode: "dry_run",
  modules: ["production"],
  affectedCollections: ["production_orders", "production_work_logs", "inventory_logs"],
  dryRun: true,
  status: "success",
};

const PRODUCTION_MAINTENANCE_REPAIR_LOG_PAYLOAD = {
  actionType: "production_variant_repair",
  mode: "repair",
  modules: ["production"],
  affectedCollections: ["production_orders", "production_work_logs", "inventory_logs"],
  dryRun: false,
  status: "success",
};

// -----------------------------------------------------------------------------
// IMS NOTE [AKTIF/BATCH 19G] — hook orchestration audit/repair maintenance produksi.
// Fungsi blok: memindahkan state + handler Audit/Repair Varian Produksi dari
// ResetMaintenanceData agar page tidak menumpuk orchestration maintenance.
// Guard: behavior-preserving; tetap memakai service existing, tidak mengubah
// logic repair produksi, stok, payroll, HPP, transaksi, atau reset destructive.
// -----------------------------------------------------------------------------
const useProductionMaintenance = ({ createPageMaintenanceLog, loadPreview } = {}) => {
  const [maintenanceAudit, setMaintenanceAudit] = useState(null);
  const [loadingMaintenanceAudit, setLoadingMaintenanceAudit] = useState(false);
  const [loadingMaintenanceRepair, setLoadingMaintenanceRepair] = useState(false);

  const handleLoadProductionMaintenanceAudit = useCallback(async () => {
    try {
      setLoadingMaintenanceAudit(true);
      const result = await getProductionVariantMaintenanceAudit();
      setMaintenanceAudit(result);

      if (typeof createPageMaintenanceLog === "function") {
        await createPageMaintenanceLog({
          ...PRODUCTION_MAINTENANCE_AUDIT_LOG_PAYLOAD,
          summary: result?.summary || {},
          affectedCount: result?.summary?.checkedRecords || 0,
        });
      }

      message.success("Dry run audit produksi selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan audit maintenance produksi.");
    } finally {
      setLoadingMaintenanceAudit(false);
    }
  }, [createPageMaintenanceLog]);

  const handleRepairProductionMaintenance = useCallback(async () => {
    try {
      setLoadingMaintenanceRepair(true);
      const result = await repairProductionVariantMaintenance();

      if (typeof createPageMaintenanceLog === "function") {
        await createPageMaintenanceLog({
          ...PRODUCTION_MAINTENANCE_REPAIR_LOG_PAYLOAD,
          summary: result?.summary || {},
          affectedCount: result?.updatedCount || 0,
        });
      }

      message.success(result?.message || "Repair varian produksi selesai.");
      const nextAudit = await getProductionVariantMaintenanceAudit();
      setMaintenanceAudit(nextAudit);

      if (typeof loadPreview === "function") {
        await loadPreview(false);
      }
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan repair varian produksi.");
    } finally {
      setLoadingMaintenanceRepair(false);
    }
  }, [createPageMaintenanceLog, loadPreview]);

  return {
    maintenanceAudit,
    loadingMaintenanceAudit,
    loadingMaintenanceRepair,
    handleLoadProductionMaintenanceAudit,
    handleRepairProductionMaintenance,
  };
};

export default useProductionMaintenance;
