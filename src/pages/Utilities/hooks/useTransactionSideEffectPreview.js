import { useCallback, useState } from "react";
import { message } from "antd";
import { getTransactionSideEffectRepairPreview } from "../../../services/Maintenance/dataQualityAuditService";

const SIDE_EFFECT_PREVIEW_LOG_PAYLOAD = {
  actionType: "transaction_side_effect_repair_preview",
  mode: "dry_run",
  modules: ["sales", "purchases", "returns", "finance", "inventory_logs"],
  affectedCollections: ["sales", "purchases", "returns", "incomes", "expenses", "inventory_logs"],
  dryRun: true,
  status: "success",
  note: "Preview repair side-effect transaksi hanya membaca Data Quality Audit dan menampilkan kandidat income/expense/inventory log. Tidak ada income, expense, inventory log, stok, kas, sales, purchase, atau return yang diubah.",
};

// -----------------------------------------------------------------------------
// IMS NOTE [AKTIF/BATCH 19A] — hook orchestration preview side-effect transaksi.
// Fungsi blok: memindahkan state + handler preview read-only dari halaman reset
// agar ResetMaintenanceData.jsx tidak menumpuk orchestration baru.
// Guard: dry-run only; hook ini tidak membuat incomes, expenses, inventory_logs,
// tidak mengubah stok/kas/transaksi, dan hanya menulis maintenance log metadata.
// -----------------------------------------------------------------------------
const useTransactionSideEffectPreview = ({ createPageMaintenanceLog } = {}) => {
  const [transactionSideEffectPreview, setTransactionSideEffectPreview] = useState(null);
  const [loadingTransactionSideEffectPreview, setLoadingTransactionSideEffectPreview] = useState(false);

  const handleLoadTransactionSideEffectPreview = useCallback(async () => {
    try {
      setLoadingTransactionSideEffectPreview(true);
      const result = await getTransactionSideEffectRepairPreview();
      setTransactionSideEffectPreview(result);

      if (typeof createPageMaintenanceLog === "function") {
        await createPageMaintenanceLog({
          ...SIDE_EFFECT_PREVIEW_LOG_PAYLOAD,
          summary: result?.summary || {},
          affectedCount: result?.summary?.checkedRecords || 0,
        });
      }

      message.success(result?.message || "Preview repair side-effect transaksi selesai. Tidak ada data yang diubah.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal membuat preview repair side-effect transaksi.");
    } finally {
      setLoadingTransactionSideEffectPreview(false);
    }
  }, [createPageMaintenanceLog]);

  return {
    transactionSideEffectPreview,
    loadingTransactionSideEffectPreview,
    handleLoadTransactionSideEffectPreview,
  };
};

export default useTransactionSideEffectPreview;
