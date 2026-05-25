import { useCallback, useState } from "react";
import { message } from "antd";
import {
  getProductionVariantMaintenanceAudit,
  repairProductionVariantMaintenance,
} from "../../../services/Maintenance/productionVariantMaintenanceService";
import {
  getInventoryLogSchemaAudit,
  getInventoryStockMaintenanceAudit,
  repairInventoryLogSchema,
  repairInventoryStockMaintenance,
} from "../../../services/Maintenance/inventoryMaintenanceService";
import {
  getHppReconcileMaintenanceAudit,
  repairHppReconcileMaintenance,
} from "../../../services/Maintenance/hppReconcileMaintenanceService";
import {
  getMasterCodeMaintenanceAudit,
  repairMasterCodeMaintenance,
} from "../../../services/Maintenance/masterCodeMaintenanceService";
import {
  getPayrollSnapshotMaintenanceAudit,
  repairPayrollSnapshotMaintenance,
} from "../../../services/Maintenance/payrollMaintenanceService";
import {
  getTransactionVariantMaintenanceAudit,
  repairTransactionVariantMaintenance,
} from "../../../services/Maintenance/transactionVariantMaintenanceService";
import {
  getTransactionSideEffectRepairAudit,
  repairTransactionSideEffects,
} from "../../../services/Maintenance/transactionSideEffectRepairService";
import {
  backfillStockReadModelRestockMetadataMaintenance,
  deleteOrphanStockReadModelsMaintenance,
  getStockReadModelMaintenanceAudit,
  rebuildStockReadModelMaintenance,
} from "../../../services/Maintenance/stockReadModelMaintenanceService";
import { mergeAuditNote } from "../utils/resetMaintenanceUiHelpers";

const STOCK_READ_MODEL_ORPHAN_CLEANUP_CONFIRM_KEYWORD = "CLEANUP READ MODEL";

const useResetMaintenanceRepairs = ({
  createPageMaintenanceLog,
  loadPreview,
  firebaseUser,
  profile,
  maintenanceActor,
  setMasterCodeAudit,
  setMaintenanceAudit,
  setStockAudit,
  setLogSchemaAudit,
  setHppReconcileAudit,
  setPayrollAudit,
  setTransactionVariantAudit,
  setTransactionSideEffectAudit,
  setStockReadModelAudit,
}) => {
  // ---------------------------------------------------------------------------
  // IMS NOTE [AKTIF] — orchestration repair aman Reset Maintenance.
  // Hook ini hanya memindahkan handler UI repair dari page jumbo. Logic write,
  // preflight, dan batas aman tetap berada di service maintenance masing-masing.
  // ---------------------------------------------------------------------------
  const [loadingMasterCodeRepair, setLoadingMasterCodeRepair] = useState(false);
  const [loadingMaintenanceRepair, setLoadingMaintenanceRepair] = useState(false);
  const [loadingStockRepair, setLoadingStockRepair] = useState(false);
  const [loadingLogSchemaRepair, setLoadingLogSchemaRepair] = useState(false);
  const [loadingHppReconcileRepair, setLoadingHppReconcileRepair] = useState(false);
  const [loadingPayrollRepair, setLoadingPayrollRepair] = useState(false);
  const [loadingTransactionVariantRepair, setLoadingTransactionVariantRepair] = useState(false);
  const [loadingTransactionSideEffectRepair, setLoadingTransactionSideEffectRepair] = useState(false);
  const [loadingStockReadModelAudit, setLoadingStockReadModelAudit] = useState(false);
  const [loadingStockReadModelRepair, setLoadingStockReadModelRepair] = useState(false);
  const [loadingStockReadModelRestockBackfill, setLoadingStockReadModelRestockBackfill] = useState(false);
  const [loadingStockReadModelCleanup, setLoadingStockReadModelCleanup] = useState(false);

  const handleLoadStockReadModelAudit = useCallback(async () => {
    try {
      setLoadingStockReadModelAudit(true);
      const result = await getStockReadModelMaintenanceAudit();
      setStockReadModelAudit(result);
      message.success("Audit stock read model selesai dimuat.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal memuat audit stock read model.");
    } finally {
      setLoadingStockReadModelAudit(false);
    }
  }, [setStockReadModelAudit]);

  const handleRepairStockReadModelAudit = useCallback(async () => {
    try {
      setLoadingStockReadModelRepair(true);
      const result = await rebuildStockReadModelMaintenance();
      await createPageMaintenanceLog({
        actionType: "stock_read_model_rebuild",
        mode: "repair",
        modules: ["inventory", "read_model"],
        summary: result?.summary || {},
        resultBuckets: {
          repaired: result?.updatedCount || 0,
          manualReview: result?.skippedOrphanCount || 0,
        },
        affectedCollections: result?.affectedCollections || ["stock_item_read_models"],
        affectedCount: result?.updatedCount || 0,
        dryRun: false,
        status: "success",
        note: "Rebuild stock read model hanya menulis collection turunan stock_item_read_models. Tidak mengubah master stock, inventory log, transaksi, produksi, HPP, payroll, atau finance.",
      });
      message.success(result?.message || "Rebuild stock read model selesai.");
      const nextAudit = await getStockReadModelMaintenanceAudit();
      setStockReadModelAudit(nextAudit);
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan rebuild stock read model.");
    } finally {
      setLoadingStockReadModelRepair(false);
    }
  }, [createPageMaintenanceLog, loadPreview, setStockReadModelAudit]);

  const handleBackfillStockReadModelRestockMetadata = useCallback(async () => {
    try {
      setLoadingStockReadModelRestockBackfill(true);
      const result = await backfillStockReadModelRestockMetadataMaintenance();
      await createPageMaintenanceLog({
        actionType: "stock_read_model_restock_metadata_backfill",
        mode: "repair",
        modules: ["inventory", "read_model", "purchases"],
        summary: result?.summary || {},
        resultBuckets: { updated: result?.updatedCount || 0 },
        affectedCollections: result?.affectedCollections || ["stock_item_read_models"],
        affectedCount: result?.updatedCount || 0,
        dryRun: false,
        status: "success",
        note: "Backfill metadata restock hanya menulis field projection purchase terakhir di stock_item_read_models. Tidak mengubah purchases, master stock, inventory log, transaksi, produksi, HPP, payroll, atau finance.",
      });
      message.success(result?.message || "Backfill metadata restock read model selesai.");
      const nextAudit = await getStockReadModelMaintenanceAudit();
      setStockReadModelAudit(nextAudit);
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan backfill metadata restock read model.");
    } finally {
      setLoadingStockReadModelRestockBackfill(false);
    }
  }, [createPageMaintenanceLog, loadPreview, setStockReadModelAudit]);

  const handleCleanupStockReadModelOrphans = useCallback(async ({ confirmKeyword = "" } = {}) => {
    if (String(confirmKeyword || "").trim() !== STOCK_READ_MODEL_ORPHAN_CLEANUP_CONFIRM_KEYWORD) {
      message.error(`Ketik ${STOCK_READ_MODEL_ORPHAN_CLEANUP_CONFIRM_KEYWORD} untuk cleanup orphan read model.`);
      return;
    }

    try {
      setLoadingStockReadModelCleanup(true);
      const result = await deleteOrphanStockReadModelsMaintenance({ confirmKeyword });
      await createPageMaintenanceLog({
        actionType: "stock_read_model_orphan_cleanup",
        mode: "repair",
        modules: ["inventory", "read_model"],
        summary: result?.summary || {},
        resultBuckets: { deleted: result?.deletedCount || 0 },
        affectedCollections: result?.affectedCollections || ["stock_item_read_models"],
        affectedCount: result?.deletedCount || 0,
        dryRun: false,
        status: "success",
        note: "Cleanup orphan stock read model hanya menghapus dokumen turunan stock_item_read_models yang tidak punya master source pada audit terbaru. Tidak mengubah master stock, inventory log, transaksi, produksi, HPP, payroll, atau finance.",
      });
      message.success(result?.message || "Cleanup orphan stock read model selesai.");
      const nextAudit = await getStockReadModelMaintenanceAudit();
      setStockReadModelAudit(nextAudit);
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan cleanup orphan stock read model.");
    } finally {
      setLoadingStockReadModelCleanup(false);
    }
  }, [createPageMaintenanceLog, loadPreview, setStockReadModelAudit]);

  const handleRepairMasterCodeAudit = useCallback(async () => {
    try {
      setLoadingMasterCodeRepair(true);
      const result = await repairMasterCodeMaintenance();
      await createPageMaintenanceLog({
        actionType: "master_code_repair",
        mode: "repair",
        modules: ["master_data", "production_setup"],
        summary: result?.summary || {},
        affectedCollections: result?.affectedCollections || [],
        affectedCount: result?.updatedCount || 0,
        dryRun: false,
        status: "success",
        note: "Normalisasi kode master tidak rename document ID dan tidak menyentuh transaksi/history.",
      });
      message.success(result?.message || "Normalisasi kode master selesai.");
      const nextAudit = await getMasterCodeMaintenanceAudit();
      setMasterCodeAudit(nextAudit);
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan normalisasi kode master.");
    } finally {
      setLoadingMasterCodeRepair(false);
    }
  }, [createPageMaintenanceLog, loadPreview, setMasterCodeAudit]);

  const handleRepairProductionMaintenance = useCallback(async () => {
    try {
      setLoadingMaintenanceRepair(true);
      const result = await repairProductionVariantMaintenance();
      await createPageMaintenanceLog({
        actionType: "production_variant_repair",
        mode: "repair",
        modules: ["production"],
        summary: result?.summary || {},
        affectedCollections: ["production_orders", "production_work_logs", "inventory_logs"],
        affectedCount: result?.updatedCount || 0,
        dryRun: false,
        status: "success",
      });
      message.success(result?.message || "Repair varian produksi selesai.");
      const nextAudit = await getProductionVariantMaintenanceAudit();
      setMaintenanceAudit(nextAudit);
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan repair varian produksi.");
    } finally {
      setLoadingMaintenanceRepair(false);
    }
  }, [createPageMaintenanceLog, loadPreview, setMaintenanceAudit]);

  const handleRepairStockAudit = useCallback(async () => {
    try {
      setLoadingStockRepair(true);
      const result = await repairInventoryStockMaintenance();
      await createPageMaintenanceLog({
        actionType: "inventory_stock_repair",
        mode: "repair",
        modules: ["inventory"],
        summary: result?.summary || {},
        affectedCollections: ["raw_materials", "semi_finished_materials", "products"],
        affectedCount: result?.updatedCount || 0,
        dryRun: false,
        status: "success",
      });
      message.success(result?.message || "Repair stok umum selesai.");
      const nextAudit = await getInventoryStockMaintenanceAudit();
      setStockAudit(nextAudit);
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan repair stok umum.");
    } finally {
      setLoadingStockRepair(false);
    }
  }, [createPageMaintenanceLog, loadPreview, setStockAudit]);

  const handleRepairLogSchema = useCallback(async () => {
    try {
      setLoadingLogSchemaRepair(true);
      const result = await repairInventoryLogSchema();
      await createPageMaintenanceLog({
        actionType: "inventory_log_schema_repair",
        mode: "repair",
        modules: ["inventory_logs"],
        summary: result?.summary || {},
        affectedCollections: ["inventory_logs"],
        affectedCount: result?.updatedCount || 0,
        dryRun: false,
        status: "success",
      });
      message.success(result?.message || "Repair schema inventory log selesai.");
      const nextAudit = await getInventoryLogSchemaAudit();
      setLogSchemaAudit(nextAudit);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan repair schema inventory log.");
    } finally {
      setLoadingLogSchemaRepair(false);
    }
  }, [createPageMaintenanceLog, setLogSchemaAudit]);

  const handleRepairHppReconcileAudit = useCallback(async () => {
    try {
      setLoadingHppReconcileRepair(true);
      const result = await repairHppReconcileMaintenance(firebaseUser || profile || maintenanceActor);
      await createPageMaintenanceLog({
        actionType: "hpp_output_reconcile_repair",
        mode: "repair",
        modules: ["production", "hpp"],
        summary: result?.summary || {},
        resultBuckets: {
          repaired: result?.updatedCount || 0,
          skipped: result?.skippedCount || 0,
          errors: result?.errorCount || 0,
        },
        affectedCollections: ["production_work_logs", "products", "semi_finished_materials"],
        affectedCount: result?.updatedCount || 0,
        dryRun: false,
        status: result?.errorCount ? "partial_success" : "success",
        note: "Repair HPP output hanya menjalankan reconcile cost snapshot/master HPP. Tidak menambah qty stok, tidak membuat inventory log, tidak membuat transaksi finance, dan tidak mengubah status Work Log/Payroll.",
      });
      if (result?.errorCount) {
        message.warning(result?.message || "Repair HPP output selesai dengan sebagian error.");
      } else {
        message.success(result?.message || "Repair HPP output selesai.");
      }
      const nextAudit = await getHppReconcileMaintenanceAudit();
      setHppReconcileAudit(nextAudit);
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan repair HPP output.");
    } finally {
      setLoadingHppReconcileRepair(false);
    }
  }, [createPageMaintenanceLog, firebaseUser, loadPreview, maintenanceActor, profile, setHppReconcileAudit]);

  const handleRepairPayrollAudit = useCallback(async () => {
    try {
      setLoadingPayrollRepair(true);
      const result = await repairPayrollSnapshotMaintenance();
      await createPageMaintenanceLog({
        actionType: "payroll_snapshot_repair",
        mode: "repair",
        modules: ["production", "production_payroll_only"],
        summary: result?.summary || {},
        resultBuckets: {
          repaired: result?.updatedCount || 0,
          skipped: result?.skippedCount || 0,
        },
        affectedCollections: ["production_work_logs"],
        affectedCount: result?.updatedCount || 0,
        dryRun: false,
        status: "success",
        note: "Repair payroll/work log stale snapshot hanya berjalan bila master Step jelas dan belum ada history payroll yang mengunci.",
      });
      message.success(result?.message || "Repair snapshot payroll selesai.");
      const nextAudit = await getPayrollSnapshotMaintenanceAudit();
      setPayrollAudit(nextAudit);
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan repair payroll snapshot.");
    } finally {
      setLoadingPayrollRepair(false);
    }
  }, [createPageMaintenanceLog, loadPreview, setPayrollAudit]);

  const handleRepairTransactionVariantAudit = useCallback(async () => {
    try {
      setLoadingTransactionVariantRepair(true);
      const result = await repairTransactionVariantMaintenance();
      await createPageMaintenanceLog({
        actionType: "transaction_variant_repair",
        mode: "repair",
        modules: ["sales", "purchases", "returns", "stock_adjustment_and_logs"],
        summary: result?.summary || {},
        resultBuckets: { repaired: result?.updatedCount || 0 },
        affectedCollections: ["sales", "returns", "purchases", "stock_adjustments"],
        affectedCount: result?.updatedCount || 0,
        dryRun: false,
        status: "success",
        note: "Repair variant lintas modul hanya mengisi snapshot/field turunan yang asal data lamanya jelas; qty dan kas tidak berubah.",
      });
      message.success(result?.message || "Repair variant lintas modul selesai.");
      const nextAudit = await getTransactionVariantMaintenanceAudit();
      setTransactionVariantAudit(nextAudit);
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan repair variant lintas modul.");
    } finally {
      setLoadingTransactionVariantRepair(false);
    }
  }, [createPageMaintenanceLog, loadPreview, setTransactionVariantAudit]);

  const handleRepairTransactionSideEffects = useCallback(async ({ actionNote = "" } = {}) => {
    try {
      setLoadingTransactionSideEffectRepair(true);
      const result = await repairTransactionSideEffects();
      await createPageMaintenanceLog({
        actionType: "transaction_side_effect_repair",
        mode: "repair",
        modules: ["sales", "purchases", "returns", "finance", "inventory_logs"],
        summary: result?.summary || {},
        resultBuckets: {
          repaired: result?.createdCount || result?.updatedCount || 0,
          skipped: result?.skippedCount || 0,
        },
        affectedCollections: result?.affectedCollections || ["incomes", "expenses", "inventory_logs"],
        affectedCount: result?.createdCount || result?.updatedCount || 0,
        dryRun: false,
        status: "success",
        note: mergeAuditNote(
          "Repair side-effect transaksi hanya membuat income/expense/inventory log yang hilang dari flow aktif. Tidak mengubah stok master, tidak menghapus data lama, dan tidak mengubah transaksi utama.",
          actionNote,
        ),
      });
      message.success(result?.message || "Repair side-effect transaksi selesai.");
      const nextAudit = await getTransactionSideEffectRepairAudit();
      setTransactionSideEffectAudit(nextAudit);
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan repair side-effect transaksi.");
      throw error;
    } finally {
      setLoadingTransactionSideEffectRepair(false);
    }
  }, [createPageMaintenanceLog, loadPreview, setTransactionSideEffectAudit]);

  return {
    loadingMasterCodeRepair,
    loadingMaintenanceRepair,
    loadingStockRepair,
    loadingLogSchemaRepair,
    loadingHppReconcileRepair,
    loadingPayrollRepair,
    loadingTransactionVariantRepair,
    loadingTransactionSideEffectRepair,
    loadingStockReadModelAudit,
    loadingStockReadModelRepair,
    loadingStockReadModelRestockBackfill,
    loadingStockReadModelCleanup,
    handleRepairMasterCodeAudit,
    handleRepairProductionMaintenance,
    handleRepairStockAudit,
    handleRepairLogSchema,
    handleRepairHppReconcileAudit,
    handleRepairPayrollAudit,
    handleRepairTransactionVariantAudit,
    handleRepairTransactionSideEffects,
    handleLoadStockReadModelAudit,
    handleRepairStockReadModelAudit,
    handleBackfillStockReadModelRestockMetadata,
    handleCleanupStockReadModelOrphans,
  };
};

export default useResetMaintenanceRepairs;
