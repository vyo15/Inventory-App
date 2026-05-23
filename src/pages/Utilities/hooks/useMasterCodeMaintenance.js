import { useCallback, useMemo, useState } from "react";
import { message } from "antd";
import {
  getMasterCodeMaintenanceAudit,
  repairMasterCodeMaintenance,
} from "../../../services/Maintenance/masterCodeMaintenanceService";

const MASTER_CODE_AUDIT_LOG_PAYLOAD = {
  actionType: "master_code_audit",
  mode: "dry_run",
  modules: ["master_data", "production_setup"],
  dryRun: true,
  status: "success",
  note: "Audit kode master hanya membaca format kode Product/Raw/Semi/BOM/Step/Supplier.",
};

const MASTER_CODE_REPAIR_LOG_PAYLOAD = {
  actionType: "master_code_repair",
  mode: "repair",
  modules: ["master_data", "production_setup"],
  dryRun: false,
  status: "success",
  note: "Normalisasi kode master tidak rename document ID dan tidak menyentuh transaksi/history.",
};

// -----------------------------------------------------------------------------
// IMS NOTE [AKTIF/BATCH 19C] — hook orchestration audit/repair kode master.
// Fungsi blok: memindahkan state + handler Audit Kode Master dan Normalisasi
// Kode dari halaman ResetMaintenanceData agar page tidak menumpuk orchestration UI.
// Guard: hanya memakai service maintenance existing; repair tidak rename document ID,
// tidak menyentuh transaksi/history, dan tetap reload preview reset setelah sukses.
// -----------------------------------------------------------------------------
const useMasterCodeMaintenance = ({ createPageMaintenanceLog, loadPreview } = {}) => {
  const [masterCodeAudit, setMasterCodeAudit] = useState(null);
  const [loadingMasterCodeAudit, setLoadingMasterCodeAudit] = useState(false);
  const [loadingMasterCodeRepair, setLoadingMasterCodeRepair] = useState(false);

  const masterCodeRows = useMemo(() => masterCodeAudit?.rows || [], [masterCodeAudit]);
  const masterCodeSummary = masterCodeAudit?.summary || {};

  const handleLoadMasterCodeAudit = useCallback(async () => {
    try {
      setLoadingMasterCodeAudit(true);
      const result = await getMasterCodeMaintenanceAudit();
      setMasterCodeAudit(result);

      if (typeof createPageMaintenanceLog === "function") {
        await createPageMaintenanceLog({
          ...MASTER_CODE_AUDIT_LOG_PAYLOAD,
          summary: result?.summary || {},
          affectedCollections: result?.affectedCollections || [],
          affectedCount: result?.summary?.checkedRecords || 0,
        });
      }

      message.success("Dry run kode master selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan audit kode master.");
    } finally {
      setLoadingMasterCodeAudit(false);
    }
  }, [createPageMaintenanceLog]);

  const handleRepairMasterCodeAudit = useCallback(async () => {
    try {
      setLoadingMasterCodeRepair(true);
      const result = await repairMasterCodeMaintenance();

      if (typeof createPageMaintenanceLog === "function") {
        await createPageMaintenanceLog({
          ...MASTER_CODE_REPAIR_LOG_PAYLOAD,
          summary: result?.summary || {},
          affectedCollections: result?.affectedCollections || [],
          affectedCount: result?.updatedCount || 0,
        });
      }

      message.success(result?.message || "Normalisasi kode master selesai.");
      const nextAudit = await getMasterCodeMaintenanceAudit();
      setMasterCodeAudit(nextAudit);

      if (typeof loadPreview === "function") {
        await loadPreview(false);
      }
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan normalisasi kode master.");
    } finally {
      setLoadingMasterCodeRepair(false);
    }
  }, [createPageMaintenanceLog, loadPreview]);

  return {
    masterCodeAudit,
    loadingMasterCodeAudit,
    loadingMasterCodeRepair,
    masterCodeRows,
    masterCodeSummary,
    handleLoadMasterCodeAudit,
    handleRepairMasterCodeAudit,
  };
};

export default useMasterCodeMaintenance;
