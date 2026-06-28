import { useCallback, useState } from "react";
import { showActionError, showActionInfo, showActionSuccess } from "../../../utils/feedback/actionResultFeedback";
import {
  deleteOrphanStockReadModelsMaintenance,
  getStockReadModelMaintenanceAudit,
  rebuildStockReadModelMaintenance,
} from "../../../services/Maintenance/stockReadModelMaintenanceService";

const useResetMaintenanceRepairs = () => {
  const [stockReadModelAudit, setStockReadModelAudit] = useState(null);
  const [loadingStockReadModelAudit, setLoadingStockReadModelAudit] = useState(false);
  const [loadingStockReadModelRepair, setLoadingStockReadModelRepair] = useState(false);
  const [loadingStockReadModelCleanup, setLoadingStockReadModelCleanup] = useState(false);

  const handleLoadStockReadModelAudit = useCallback(async ({ showSuccessMessage = true } = {}) => {
    try {
      setLoadingStockReadModelAudit(true);
      const result = await getStockReadModelMaintenanceAudit();
      setStockReadModelAudit(result);
      if (showSuccessMessage) {
        showActionSuccess("Audit data turunan stok selesai. Tidak ada data yang diubah.");
      }
      return result;
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal menjalankan audit data turunan stok.");
      return null;
    } finally {
      setLoadingStockReadModelAudit(false);
    }
  }, []);

  const handleRepairStockReadModelAudit = useCallback(async () => {
    const repairCount = Number(stockReadModelAudit?.summary?.executablePlanCount || 0);
    if (!stockReadModelAudit) {
      showActionInfo("Jalankan audit data turunan stok sebelum repair.");
      return null;
    }
    if (repairCount <= 0) {
      showActionInfo("Tidak ada data turunan stok missing/stale yang perlu direbuild.");
      return null;
    }

    try {
      setLoadingStockReadModelRepair(true);
      const result = await rebuildStockReadModelMaintenance();
      showActionSuccess(result?.message || "Data turunan stok berhasil direbuild.");
      await handleLoadStockReadModelAudit({ showSuccessMessage: false });
      return result;
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal merebuild data turunan stok.");
      return null;
    } finally {
      setLoadingStockReadModelRepair(false);
    }
  }, [handleLoadStockReadModelAudit, stockReadModelAudit]);

  const handleCleanupStockReadModelOrphans = useCallback(async ({ confirmKeyword = "" } = {}) => {
    const orphanCount = Number(stockReadModelAudit?.summary?.orphanCount || 0);
    if (!stockReadModelAudit) {
      showActionInfo("Jalankan audit data turunan stok sebelum cleanup.");
      return null;
    }
    if (orphanCount <= 0) {
      showActionInfo("Tidak ada data turunan stok yatim yang perlu dibersihkan.");
      return null;
    }

    try {
      setLoadingStockReadModelCleanup(true);
      const result = await deleteOrphanStockReadModelsMaintenance({ confirmKeyword });
      showActionSuccess(result?.message || "Data turunan stok yatim berhasil dibersihkan.");
      await handleLoadStockReadModelAudit({ showSuccessMessage: false });
      return result;
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal membersihkan data turunan stok yatim.");
      return null;
    } finally {
      setLoadingStockReadModelCleanup(false);
    }
  }, [handleLoadStockReadModelAudit, stockReadModelAudit]);

  return {
    stockReadModelAudit,
    hasStockReadModelAudit: Boolean(stockReadModelAudit),
    loadingStockReadModelAudit,
    loadingStockReadModelRepair,
    loadingStockReadModelCleanup,
    handleLoadStockReadModelAudit,
    handleRepairStockReadModelAudit,
    handleCleanupStockReadModelOrphans,
  };
};

export default useResetMaintenanceRepairs;
