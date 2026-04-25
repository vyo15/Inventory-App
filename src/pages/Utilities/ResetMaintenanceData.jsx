import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Form,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  SaveOutlined,
  SyncOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  getProductionVariantMaintenanceAudit,
  repairProductionVariantMaintenance,
} from "../../services/Maintenance/productionVariantMaintenanceService";
import {
  getInventoryLogSchemaAudit,
  getInventoryStockMaintenanceAudit,
  repairInventoryLogSchema,
  repairInventoryStockMaintenance,
} from "../../services/Maintenance/inventoryMaintenanceService";
import {
  createMaintenanceLog,
  getLatestMaintenanceLogs,
} from "../../services/Maintenance/maintenanceLogService";
import { getLegacyDataMaintenanceAudit } from "../../services/Maintenance/legacyDataMaintenanceService";
import {
  DEFAULT_RESET_MODULES,
  RESET_MODE_OPTIONS,
  getResetPreview,
  runResetDataTest,
  saveCurrentStockAsTestingBaseline,
  syncAllStocks,
} from "../../services/Maintenance/resetMaintenanceDataService";

const { Title, Paragraph, Text } = Typography;

// -----------------------------------------------------------------------------
// Reset & Maintenance Data Page
// ACTIVE / FINAL:
// - Reset Data masih memakai service utility lama yang sudah ada.
// - Maintenance Data memakai service baru terpisah agar audit/repair tidak
//   bercampur dengan flow operasional produksi aktif.
// - Route final memakai /utilities/reset-maintenance-data. Route lama hanya redirect di AppRoutes agar bookmark lama tetap aman.
// -----------------------------------------------------------------------------

const RESET_MODE_LABELS = {
  transaction_only: "Reset Transaksi",
  reset_and_zero_stock: "Reset + Nolkan Semua Stok",
  reset_and_restore_baseline: "Reset + Baseline Testing",
};

const MAINTENANCE_CATEGORY_META = {
  ok: { label: "Sesuai", color: "green" },
  safe_repair: { label: "Aman Diperbaiki", color: "blue" },
  display_repair: { label: "Display/Snapshot", color: "purple" },
  manual: { label: "Butuh Reset/Manual", color: "red" },
  legacy: { label: "Legacy/Transisi", color: "orange" },
  scoped_reset: { label: "Aman Reset Scoped", color: "volcano" },
};

const ResetMaintenanceData = () => {
  const [confirmForm] = Form.useForm();

  // ---------------------------------------------------------------------------
  // State reset data.
  // Bagian ini tetap kompatibel dengan utility reset lama, tetapi judul UI
  // dirapikan agar user membedakan reset destructive vs maintenance non-delete.
  // ---------------------------------------------------------------------------
  const [mode, setMode] = useState("transaction_only");
  const [selectedModules, setSelectedModules] = useState([...DEFAULT_RESET_MODULES]);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingRun, setLoadingRun] = useState(false);
  const [loadingBaseline, setLoadingBaseline] = useState(false);
  const [loadingSync, setLoadingSync] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // State maintenance produksi.
  // ACTIVE / FINAL tahap awal: fokus produksi varian lama.
  // Service maintenance hanya audit/repair field turunan, tidak posting stok ulang.
  // ---------------------------------------------------------------------------
  const [maintenanceAudit, setMaintenanceAudit] = useState(null);
  const [loadingMaintenanceAudit, setLoadingMaintenanceAudit] = useState(false);
  const [loadingMaintenanceRepair, setLoadingMaintenanceRepair] = useState(false);

  // ---------------------------------------------------------------------------
  // State maintenance stok umum dan schema inventory log.
  // ACTIVE / FINAL FOUNDATION: dry run tidak mengubah data, sedangkan repair
  // hanya menyentuh field turunan/display yang aman tanpa posting stok ulang.
  // ---------------------------------------------------------------------------
  const [stockAudit, setStockAudit] = useState(null);
  const [logSchemaAudit, setLogSchemaAudit] = useState(null);
  const [legacyDataAudit, setLegacyDataAudit] = useState(null);
  const [loadingStockAudit, setLoadingStockAudit] = useState(false);
  const [loadingStockRepair, setLoadingStockRepair] = useState(false);
  const [loadingLogSchemaAudit, setLoadingLogSchemaAudit] = useState(false);
  const [loadingLogSchemaRepair, setLoadingLogSchemaRepair] = useState(false);
  const [loadingLegacyDataAudit, setLoadingLegacyDataAudit] = useState(false);

  // ---------------------------------------------------------------------------
  // State audit trail maintenance/reset.
  // Log ini hanya mencatat metadata aksi admin, bukan sumber mutasi operasional.
  // ---------------------------------------------------------------------------
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [loadingMaintenanceLogs, setLoadingMaintenanceLogs] = useState(false);

  const moduleOptions = useMemo(
    () => [
      { label: "Penjualan", value: "sales" },
      { label: "Pembelian", value: "purchases" },
      { label: "Retur", value: "returns" },
      { label: "Produksi", value: "production" },
      { label: "Kas & Biaya", value: "cash_and_expenses" },
      { label: "Penyesuaian & Log Stok", value: "stock_adjustment_and_logs" },
      { label: "Pricing Log", value: "pricing_logs" },
    ],
    [],
  );

  const selectedModuleLabels = useMemo(() => {
    const labelMap = new Map(moduleOptions.map((item) => [item.value, item.label]));
    return selectedModules.map((value) => labelMap.get(value) || value);
  }, [moduleOptions, selectedModules]);

  const loadMaintenanceLogs = useCallback(async () => {
    try {
      setLoadingMaintenanceLogs(true);
      const result = await getLatestMaintenanceLogs(20);
      setMaintenanceLogs(result);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMaintenanceLogs(false);
    }
  }, []);

  useEffect(() => {
    loadMaintenanceLogs();
  }, [loadMaintenanceLogs]);

  // ---------------------------------------------------------------------------
  // Helper preview dipisah agar bisa dipakai oleh tombol manual dan auto-refresh.
  // ---------------------------------------------------------------------------
  const loadPreview = useCallback(async (showSuccessMessage = false) => {
    try {
      setLoadingPreview(true);
      const result = await getResetPreview({
        resetMode: mode,
        modules: selectedModules,
      });
      setPreview(result);
      if (showSuccessMessage) {
        message.success("Preview reset berhasil dimuat.");
      }
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal memuat preview reset.");
    } finally {
      setLoadingPreview(false);
    }
  }, [mode, selectedModules]);

  // ---------------------------------------------------------------------------
  // Auto-preview membuat halaman reset terasa hidup dan cocok untuk trial-error.
  // User tidak wajib klik preview terus setiap kali mengganti mode atau modul.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    loadPreview(false);
  }, [loadPreview]);

  const handleSaveBaseline = async () => {
    try {
      setLoadingBaseline(true);
      const result = await saveCurrentStockAsTestingBaseline();
      await createMaintenanceLog({
        actionType: "save_stock_baseline",
        mode: "baseline",
        modules: ["inventory"],
        summary: { itemCount: result?.itemCount || 0 },
        affectedCollections: ["testing_baselines"],
        affectedCount: result?.itemCount || 0,
        dryRun: false,
      });
      message.success(result?.message || "Baseline stok saat ini berhasil disimpan.");
      await loadPreview(false);
      await loadMaintenanceLogs();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menyimpan baseline stok.");
    } finally {
      setLoadingBaseline(false);
    }
  };

  const handleSyncStocks = async () => {
    try {
      setLoadingSync(true);
      const result = await syncAllStocks();
      await createMaintenanceLog({
        actionType: "sync_all_stocks",
        mode: "repair",
        modules: ["inventory"],
        summary: { syncedCount: result?.syncedCount || 0 },
        affectedCollections: ["raw_materials", "semi_finished_materials", "products"],
        affectedCount: result?.syncedCount || 0,
        dryRun: false,
        note: "Sync stok umum hanya menyamakan field turunan, bukan posting stok ulang.",
      });
      message.success(result?.message || "Sinkronisasi stok berhasil dijalankan.");
      await loadPreview(false);
      await loadMaintenanceLogs();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal sinkronisasi stok.");
    } finally {
      setLoadingSync(false);
    }
  };

  const handleLoadProductionMaintenanceAudit = async () => {
    try {
      setLoadingMaintenanceAudit(true);
      const result = await getProductionVariantMaintenanceAudit();
      setMaintenanceAudit(result);
      await createMaintenanceLog({
        actionType: "production_variant_audit",
        mode: "dry_run",
        modules: ["production"],
        summary: result?.summary || {},
        affectedCollections: ["production_orders", "production_work_logs", "inventory_logs"],
        affectedCount: result?.summary?.checkedRecords || 0,
        dryRun: true,
      });
      await loadMaintenanceLogs();
      message.success("Dry run audit produksi selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan audit maintenance produksi.");
    } finally {
      setLoadingMaintenanceAudit(false);
    }
  };

  const handleRepairProductionMaintenance = async () => {
    try {
      setLoadingMaintenanceRepair(true);
      const result = await repairProductionVariantMaintenance();
      await createMaintenanceLog({
        actionType: "production_variant_repair",
        mode: "repair",
        modules: ["production"],
        summary: result?.summary || {},
        affectedCollections: ["production_orders", "production_work_logs", "inventory_logs"],
        affectedCount: result?.updatedCount || 0,
        dryRun: false,
      });
      message.success(result?.message || "Repair varian produksi selesai.");
      const nextAudit = await getProductionVariantMaintenanceAudit();
      setMaintenanceAudit(nextAudit);
      await loadPreview(false);
      await loadMaintenanceLogs();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan repair varian produksi.");
    } finally {
      setLoadingMaintenanceRepair(false);
    }
  };

  const handleLoadStockAudit = async () => {
    try {
      setLoadingStockAudit(true);
      const result = await getInventoryStockMaintenanceAudit();
      setStockAudit(result);
      await createMaintenanceLog({
        actionType: "inventory_stock_audit",
        mode: "dry_run",
        modules: ["inventory"],
        summary: result?.summary || {},
        affectedCollections: ["raw_materials", "semi_finished_materials", "products"],
        affectedCount: result?.summary?.checkedRecords || 0,
        dryRun: true,
      });
      await loadMaintenanceLogs();
      message.success("Dry run stok umum selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan audit stok umum.");
    } finally {
      setLoadingStockAudit(false);
    }
  };

  const handleRepairStockAudit = async () => {
    try {
      setLoadingStockRepair(true);
      const result = await repairInventoryStockMaintenance();
      await createMaintenanceLog({
        actionType: "inventory_stock_repair",
        mode: "repair",
        modules: ["inventory"],
        summary: result?.summary || {},
        affectedCollections: ["raw_materials", "semi_finished_materials", "products"],
        affectedCount: result?.updatedCount || 0,
        dryRun: false,
      });
      message.success(result?.message || "Repair stok umum selesai.");
      const nextAudit = await getInventoryStockMaintenanceAudit();
      setStockAudit(nextAudit);
      await loadPreview(false);
      await loadMaintenanceLogs();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan repair stok umum.");
    } finally {
      setLoadingStockRepair(false);
    }
  };

  const handleLoadLogSchemaAudit = async () => {
    try {
      setLoadingLogSchemaAudit(true);
      const result = await getInventoryLogSchemaAudit();
      setLogSchemaAudit(result);
      await createMaintenanceLog({
        actionType: "inventory_log_schema_audit",
        mode: "dry_run",
        modules: ["inventory_logs"],
        summary: result?.summary || {},
        affectedCollections: ["inventory_logs"],
        affectedCount: result?.summary?.checkedRecords || 0,
        dryRun: true,
      });
      await loadMaintenanceLogs();
      message.success("Dry run schema inventory log selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan audit schema inventory log.");
    } finally {
      setLoadingLogSchemaAudit(false);
    }
  };

  const handleRepairLogSchema = async () => {
    try {
      setLoadingLogSchemaRepair(true);
      const result = await repairInventoryLogSchema();
      await createMaintenanceLog({
        actionType: "inventory_log_schema_repair",
        mode: "repair",
        modules: ["inventory_logs"],
        summary: result?.summary || {},
        affectedCollections: ["inventory_logs"],
        affectedCount: result?.updatedCount || 0,
        dryRun: false,
      });
      message.success(result?.message || "Repair schema inventory log selesai.");
      const nextAudit = await getInventoryLogSchemaAudit();
      setLogSchemaAudit(nextAudit);
      await loadMaintenanceLogs();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan repair schema inventory log.");
    } finally {
      setLoadingLogSchemaRepair(false);
    }
  };

  const handleLoadLegacyDataAudit = async () => {
    try {
      setLoadingLegacyDataAudit(true);
      const result = await getLegacyDataMaintenanceAudit();
      setLegacyDataAudit(result);
      await createMaintenanceLog({
        actionType: "legacy_data_audit",
        mode: "dry_run",
        modules: ["legacy_data", "cleanup_batch_3"],
        summary: result?.summary || {},
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
        affectedCount: result?.summary?.checkedRecords || 0,
        dryRun: true,
        note: "Batch 3 legacy data audit hanya membaca data dan memberi rekomendasi reset/repair scoped.",
      });
      await loadMaintenanceLogs();
      message.success("Dry run data legacy selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan audit data legacy.");
    } finally {
      setLoadingLegacyDataAudit(false);
    }
  };

  const prepareVariantTransactionReset = () => {
    // -------------------------------------------------------------------------
    // Batch 3 helper: hanya menyiapkan reset scoped transaksi varian lama.
    // Eksekusi tetap wajib lewat preview + konfirmasi RESET agar data final tidak
    // terhapus diam-diam.
    // -------------------------------------------------------------------------
    setMode("transaction_only");
    setSelectedModules(["sales", "purchases", "returns", "stock_adjustment_and_logs"]);
    message.info("Reset scoped transaksi varian disiapkan. Review preview lalu ketik RESET jika sudah yakin.");
  };

  const prepareProductionReset = async () => {
    // -------------------------------------------------------------------------
    // Reset terarah tidak langsung menghapus data.
    // Tombol ini hanya menyiapkan modul Produksi di area Reset Data, sehingga
    // user tetap wajib review preview dan mengetik RESET di dialog destructive.
    // -------------------------------------------------------------------------
    setMode("transaction_only");
    setSelectedModules(["production"]);
    message.info("Reset terarah Produksi disiapkan. Cek preview lalu jalankan konfirmasi RESET jika sudah yakin.");
  };

  const openResetConfirmation = async () => {
    if (!selectedModules.length) {
      message.warning("Pilih minimal 1 modul sebelum reset dijalankan.");
      return;
    }

    confirmForm.setFieldsValue({ confirmationText: "" });
    setConfirmOpen(true);
  };

  const handleRunReset = async () => {
    try {
      const values = await confirmForm.validateFields();
      if ((values.confirmationText || "").trim().toUpperCase() !== "RESET") {
        message.error('Ketik "RESET" untuk konfirmasi.');
        return;
      }

      setLoadingRun(true);
      const result = await runResetDataTest({
        resetMode: mode,
        modules: selectedModules,
      });
      await createMaintenanceLog({
        actionType: "reset_data",
        mode,
        modules: selectedModules,
        summary: { totalDeletedRecords: result?.totalDeletedRecords || 0, stockResult: result?.stockResult || {} },
        affectedCollections: (result?.deletedCollections || []).map((item) => item.label || item.key),
        affectedCount: result?.totalDeletedRecords || 0,
        dryRun: false,
        note: "Reset destructive dijalankan setelah preview dan konfirmasi RESET.",
      });
      message.success(result?.message || "Reset data berhasil dijalankan.");
      setConfirmOpen(false);
      confirmForm.resetFields();
      await loadPreview(false);
      await handleLoadProductionMaintenanceAudit();
      await loadMaintenanceLogs();
    } catch (error) {
      console.error(error);
      if (error?.errorFields) return;
      message.error(error?.message || "Gagal menjalankan reset data uji.");
    } finally {
      setLoadingRun(false);
    }
  };

  const previewRows = useMemo(() => {
    if (!preview?.collections) return [];
    return preview.collections.map((item) => ({
      key: item.targetKey || item.key,
      moduleLabel: item.moduleLabel,
      name: item.scopeLabel ? `${item.label} (${item.scopeLabel})` : item.label,
      count: item.count,
      action: item.action,
    }));
  }, [preview]);

  const maintenanceRows = useMemo(() => maintenanceAudit?.rows || [], [maintenanceAudit]);
  const stockMaintenanceRows = useMemo(() => stockAudit?.rows || [], [stockAudit]);
  const logSchemaRows = useMemo(() => logSchemaAudit?.rows || [], [logSchemaAudit]);
  const legacyDataRows = useMemo(() => legacyDataAudit?.rows || [], [legacyDataAudit]);
  const stockSummary = stockAudit?.summary || {};
  const logSchemaSummary = logSchemaAudit?.summary || {};
  const legacyDataSummary = legacyDataAudit?.summary || {};

  const recommendationText = useMemo(() => {
    if (mode === "transaction_only") {
      return "Paling cepat untuk uji trial-error karena stok master aktif tetap dipertahankan.";
    }
    if (mode === "reset_and_zero_stock") {
      return "Cocok jika Anda ingin simulasi dari nol total, tapi lebih agresif karena stok ikut dibersihkan.";
    }
    return "Mode paling profesional untuk testing berulang: simpan baseline, lakukan tes, lalu restore ke baseline yang sama.";
  }, [mode]);

  const maintenanceSummary = maintenanceAudit?.summary || {};

  return (
    <div className="page-container">
      <Card className="content-card">
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          <div>
            <Title level={2} style={{ marginBottom: 8 }}>
              Reset & Maintenance Data
            </Title>
            <Paragraph style={{ marginBottom: 0 }}>
              Pusat utilitas untuk audit, repair aman, reset terarah, baseline stok, dan sinkronisasi data testing.
            </Paragraph>
          </div>

          <Alert
            type="warning"
            showIcon
            message="Pisahkan Maintenance dan Reset"
            description="Maintenance tidak menghapus data dan tidak posting stok ulang. Reset bersifat destructive dan tetap wajib melalui preview serta konfirmasi RESET."
          />

          <Card
            title="Maintenance / Sinkronisasi Data Produksi"
            size="small"
            extra={<Tag color="purple">Tahap awal: Produksi</Tag>}
          >
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Alert
                type="info"
                showIcon
                message="Dry run dulu sebelum repair"
                description="Audit membaca BOM, Production Order, Work Log, output, dan inventory log produksi. Repair aman hanya melengkapi field turunan/snapshot/display yang jelas, tanpa mengurangi/menambah stok, kas, payroll, atau HPP."
              />

              <Row gutter={[12, 12]}>
                <Col xs={24} md={8}>
                  <Button
                    block
                    icon={<EyeOutlined />}
                    onClick={handleLoadProductionMaintenanceAudit}
                    loading={loadingMaintenanceAudit}
                  >
                    Cek Data Produksi
                  </Button>
                </Col>
                <Col xs={24} md={8}>
                  <Popconfirm
                    title="Jalankan repair aman?"
                    description="Repair hanya mengubah field turunan/snapshot/display. Stok, kas, payroll, dan HPP tidak diposting ulang."
                    okText="Ya, Repair Aman"
                    cancelText="Batal"
                    onConfirm={handleRepairProductionMaintenance}
                  >
                    <Button
                      block
                      type="primary"
                      icon={<SyncOutlined />}
                      loading={loadingMaintenanceRepair}
                    >
                      Repair Aman
                    </Button>
                  </Popconfirm>
                </Col>
                <Col xs={24} md={8}>
                  <Button block danger icon={<DeleteOutlined />} onClick={prepareProductionReset}>
                    Siapkan Reset Terarah Produksi
                  </Button>
                </Col>
              </Row>

              <Row gutter={[12, 12]}>
                <Col xs={12} md={4}>
                  <Card size="small">
                    <Statistic title="Data Dicek" value={maintenanceSummary.checkedRecords || 0} />
                  </Card>
                </Col>
                <Col xs={12} md={5}>
                  <Card size="small">
                    <Statistic title="Aman Repair" value={maintenanceSummary.safeRepairCount || 0} />
                  </Card>
                </Col>
                <Col xs={12} md={5}>
                  <Card size="small">
                    <Statistic title="Display Repair" value={maintenanceSummary.displayRepairCount || 0} />
                  </Card>
                </Col>
                <Col xs={12} md={5}>
                  <Card size="small">
                    <Statistic title="Reset/Manual" value={maintenanceSummary.resetManualCount || 0} />
                  </Card>
                </Col>
                <Col xs={12} md={5}>
                  <Card size="small">
                    <Statistic title="Plan Eksekusi" value={maintenanceSummary.executablePlanCount || 0} />
                  </Card>
                </Col>
              </Row>

              <Table
                className="app-data-table"
                size="small"
                loading={loadingMaintenanceAudit || loadingMaintenanceRepair}
                dataSource={maintenanceRows}
                pagination={{ pageSize: 8, showSizeChanger: false }}
                columns={[
                  { title: "Area", dataIndex: "scope", key: "scope", width: 150 },
                  { title: "Kode/Type", dataIndex: "code", key: "code", width: 160 },
                  { title: "Status", dataIndex: "status", key: "status", width: 120 },
                  {
                    title: "Kategori",
                    dataIndex: "category",
                    key: "category",
                    width: 170,
                    render: (value) => {
                      const meta = MAINTENANCE_CATEGORY_META[value] || MAINTENANCE_CATEGORY_META.ok;
                      return <Tag color={meta.color}>{meta.label}</Tag>;
                    },
                  },
                  { title: "Masalah", dataIndex: "issue", key: "issue", width: 260, render: (value) => value || "-" },
                  { title: "Rekomendasi", dataIndex: "recommendation", key: "recommendation", width: 360 },
                ]}
                scroll={{ x: 1240 }}
                locale={{ emptyText: "Klik Cek Data Produksi untuk menjalankan dry run audit." }}
              />
            </Space>
          </Card>

          <Card
            title="Maintenance / Sinkronisasi Stok Umum"
            size="small"
            extra={<Tag color="cyan">Dry Run Stok</Tag>}
          >
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Alert
                type="info"
                showIcon
                message="Cek konsistensi stok sebelum sync"
                description="Dry run membandingkan currentStock, stock, reservedStock, availableStock, dan total variants. Repair aman hanya merapikan field turunan stok, tidak membuat inventory log dan tidak posting stok ulang."
              />

              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <Button block icon={<EyeOutlined />} onClick={handleLoadStockAudit} loading={loadingStockAudit}>
                    Cek Stok Umum
                  </Button>
                </Col>
                <Col xs={24} md={12}>
                  <Popconfirm
                    title="Repair sinkronisasi stok?"
                    description="Repair hanya menyamakan field turunan stok dan variant. Tidak ada mutasi stok baru."
                    okText="Ya, Repair Stok"
                    cancelText="Batal"
                    onConfirm={handleRepairStockAudit}
                  >
                    <Button block type="primary" icon={<SyncOutlined />} loading={loadingStockRepair}>
                      Repair Sinkron Stok
                    </Button>
                  </Popconfirm>
                </Col>
              </Row>

              <Row gutter={[12, 12]}>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Dicek" value={stockSummary.checkedRecords || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="OK" value={stockSummary.okCount || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Aman Repair" value={stockSummary.safeRepairCount || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Plan" value={stockSummary.executablePlanCount || 0} /></Card></Col>
              </Row>

              <Table
                className="app-data-table"
                size="small"
                loading={loadingStockAudit || loadingStockRepair}
                dataSource={stockMaintenanceRows}
                pagination={{ pageSize: 6, showSizeChanger: false }}
                columns={[
                  { title: "Collection", dataIndex: "collectionName", key: "collectionName", width: 180 },
                  { title: "Item", dataIndex: "itemName", key: "itemName", width: 220 },
                  { title: "Variant", dataIndex: "hasVariants", key: "hasVariants", width: 100, render: (value) => value ? <Tag color="blue">Variant</Tag> : <Tag>Master</Tag> },
                  { title: "Kategori", dataIndex: "category", key: "category", width: 150, render: (value) => value === "safe_repair" ? <Tag color="blue">Aman Repair</Tag> : <Tag color="green">OK</Tag> },
                  { title: "Masalah", dataIndex: "issue", key: "issue", width: 360, render: (value) => value || "-" },
                  { title: "Rekomendasi", dataIndex: "recommendation", key: "recommendation", width: 360 },
                ]}
                scroll={{ x: 1370 }}
                locale={{ emptyText: "Klik Cek Stok Umum untuk menjalankan dry run stok." }}
              />
            </Space>
          </Card>

          <Card
            title="Maintenance / Repair Schema Inventory Log"
            size="small"
            extra={<Tag color="gold">Display Repair</Tag>}
          >
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Alert
                type="info"
                showIcon
                message="Repair schema log lama tanpa mengubah qty"
                description="Dry run mencari log lama yang masih memakai materialVariantId/materialVariantName atau belum punya variantKey/variantLabel/stockSourceType final. Repair hanya melengkapi field display/schema."
              />

              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <Button block icon={<EyeOutlined />} onClick={handleLoadLogSchemaAudit} loading={loadingLogSchemaAudit}>
                    Cek Schema Inventory Log
                  </Button>
                </Col>
                <Col xs={24} md={12}>
                  <Popconfirm
                    title="Repair schema inventory log?"
                    description="Repair hanya melengkapi field variantKey/variantLabel/stockSourceType. Qty dan stok tidak berubah."
                    okText="Ya, Repair Schema"
                    cancelText="Batal"
                    onConfirm={handleRepairLogSchema}
                  >
                    <Button block type="primary" icon={<SyncOutlined />} loading={loadingLogSchemaRepair}>
                      Repair Schema Log
                    </Button>
                  </Popconfirm>
                </Col>
              </Row>

              <Row gutter={[12, 12]}>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Dicek" value={logSchemaSummary.checkedRecords || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="OK" value={logSchemaSummary.okCount || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Display Repair" value={logSchemaSummary.displayRepairCount || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Plan" value={logSchemaSummary.executablePlanCount || 0} /></Card></Col>
              </Row>

              <Table
                className="app-data-table"
                size="small"
                loading={loadingLogSchemaAudit || loadingLogSchemaRepair}
                dataSource={logSchemaRows}
                pagination={{ pageSize: 6, showSizeChanger: false }}
                columns={[
                  { title: "Type", dataIndex: "type", key: "type", width: 170 },
                  { title: "Item", dataIndex: "itemName", key: "itemName", width: 220 },
                  { title: "Kategori", dataIndex: "category", key: "category", width: 160, render: (value) => value === "display_repair" ? <Tag color="purple">Display Repair</Tag> : <Tag color="green">OK</Tag> },
                  { title: "Masalah", dataIndex: "issue", key: "issue", width: 320 },
                  { title: "Rekomendasi", dataIndex: "recommendation", key: "recommendation", width: 360 },
                ]}
                scroll={{ x: 1230 }}
                locale={{ emptyText: "Klik Cek Schema Inventory Log untuk menjalankan dry run schema." }}
              />
            </Space>
          </Card>


          <Card
            title="Maintenance / Audit Data Legacy Batch 3"
            size="small"
            extra={<Tag color="volcano">Cleanup Data Legacy</Tag>}
          >
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Alert
                type="warning"
                showIcon
                message="Dry run legacy sebelum cleanup code berikutnya"
                description="Audit ini memetakan productions legacy, orphan inventory log, transaksi lama tanpa variant snapshot, dan income/expense tanpa source reference. Audit tidak mengubah data; reset scoped tetap harus lewat preview dan konfirmasi RESET."
              />

              <Row gutter={[12, 12]}>
                <Col xs={24} md={8}>
                  <Button block icon={<EyeOutlined />} onClick={handleLoadLegacyDataAudit} loading={loadingLegacyDataAudit}>
                    Cek Data Legacy
                  </Button>
                </Col>
                <Col xs={24} md={8}>
                  <Button block danger icon={<DeleteOutlined />} onClick={prepareProductionReset}>
                    Siapkan Reset Produksi + Log
                  </Button>
                </Col>
                <Col xs={24} md={8}>
                  <Button block danger icon={<DeleteOutlined />} onClick={prepareVariantTransactionReset}>
                    Siapkan Reset Transaksi Varian
                  </Button>
                </Col>
              </Row>

              <Row gutter={[12, 12]}>
                <Col xs={12} md={4}><Card size="small"><Statistic title="Dicek" value={legacyDataSummary.checkedRecords || 0} /></Card></Col>
                <Col xs={12} md={4}><Card size="small"><Statistic title="OK" value={legacyDataSummary.okCount || 0} /></Card></Col>
                <Col xs={12} md={4}><Card size="small"><Statistic title="Repair" value={legacyDataSummary.safeRepairCount || 0} /></Card></Col>
                <Col xs={12} md={4}><Card size="small"><Statistic title="Display" value={legacyDataSummary.displayRepairCount || 0} /></Card></Col>
                <Col xs={12} md={4}><Card size="small"><Statistic title="Reset Scoped" value={legacyDataSummary.scopedResetCount || 0} /></Card></Col>
                <Col xs={12} md={4}><Card size="small"><Statistic title="Manual" value={legacyDataSummary.manualReviewCount || 0} /></Card></Col>
              </Row>

              <Table
                className="app-data-table"
                size="small"
                loading={loadingLegacyDataAudit}
                dataSource={legacyDataRows}
                pagination={{ pageSize: 8, showSizeChanger: false }}
                columns={[
                  { title: "Area", dataIndex: "scope", key: "scope", width: 170 },
                  { title: "Kode/Ref", dataIndex: "code", key: "code", width: 180 },
                  { title: "Status", dataIndex: "status", key: "status", width: 140 },
                  {
                    title: "Kategori",
                    dataIndex: "category",
                    key: "category",
                    width: 170,
                    render: (value) => {
                      const meta = MAINTENANCE_CATEGORY_META[value] || MAINTENANCE_CATEGORY_META.ok;
                      return <Tag color={meta.color}>{meta.label}</Tag>;
                    },
                  },
                  { title: "Masalah", dataIndex: "issue", key: "issue", width: 360 },
                  { title: "Rekomendasi", dataIndex: "recommendation", key: "recommendation", width: 420 },
                  { title: "Scope Reset", dataIndex: "resetScope", key: "resetScope", width: 180, render: (value) => value ? <Tag>{value}</Tag> : "-" },
                ]}
                scroll={{ x: 1450 }}
                locale={{ emptyText: "Klik Cek Data Legacy untuk memetakan data lama/orphan sebelum cleanup berikutnya." }}
              />
            </Space>
          </Card>



          <Divider orientation="left">Reset Data</Divider>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={14}>
              <Card title="Mode Reset" size="small">
                <Radio.Group
                  value={mode}
                  onChange={(event) => setMode(event.target.value)}
                  style={{ width: "100%" }}
                >
                  <Space direction="vertical" size={16} style={{ width: "100%" }}>
                    {RESET_MODE_OPTIONS.map((item) => (
                      <div key={item.value}>
                        <Radio value={item.value}>{item.label}</Radio>
                        <div style={{ marginLeft: 24, marginTop: 4 }}>
                          <Text type="secondary">{item.description}</Text>
                        </div>
                      </div>
                    ))}
                  </Space>
                </Radio.Group>

                <Divider />
                <Alert
                  type="info"
                  showIcon
                  message={RESET_MODE_LABELS[mode]}
                  description={recommendationText}
                />
              </Card>
            </Col>

            <Col xs={24} md={10}>
              <Card title="Modul yang Akan Diproses" size="small">
                <Checkbox.Group
                  value={selectedModules}
                  onChange={setSelectedModules}
                  style={{ width: "100%" }}
                >
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    {moduleOptions.map((item) => (
                      <Checkbox key={item.value} value={item.value}>
                        {item.label}
                      </Checkbox>
                    ))}
                  </Space>
                </Checkbox.Group>
              </Card>
            </Col>
          </Row>

          <Row gutter={[12, 12]}>
            <Col xs={24} md={6}>
              <Button
                block
                icon={<EyeOutlined />}
                onClick={() => loadPreview(true)}
                loading={loadingPreview}
              >
                Refresh Preview
              </Button>
            </Col>
            <Col xs={24} md={6}>
              <Button
                block
                icon={<SaveOutlined />}
                onClick={handleSaveBaseline}
                loading={loadingBaseline}
              >
                Simpan Baseline
              </Button>
            </Col>
            <Col xs={24} md={6}>
              <Button
                block
                icon={<SyncOutlined />}
                onClick={handleSyncStocks}
                loading={loadingSync}
              >
                Sinkronkan Stok
              </Button>
            </Col>
            <Col xs={24} md={6}>
              <Button
                block
                type="primary"
                danger
                icon={<DeleteOutlined />}
                onClick={openResetConfirmation}
                loading={loadingRun}
                disabled={!selectedModules.length}
              >
                Reset Sekarang
              </Button>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={6}>
              <Card size="small">
                <Statistic title="Mode Aktif" value={RESET_MODE_LABELS[mode]} valueStyle={{ fontSize: 20 }} />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card size="small">
                <Statistic title="Modul Dipilih" value={selectedModules.length} />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card size="small">
                <Statistic title="Data Terdeteksi" value={preview?.totalRecords || 0} />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card size="small">
                <Statistic
                  title="Baseline"
                  value={preview?.baselineSummary?.label || "Belum dicek"}
                  valueStyle={{ fontSize: 20 }}
                />
              </Card>
            </Col>
          </Row>

          <Card
            title="Saran Pemakaian untuk Trial-Error"
            size="small"
            extra={<Tag color="blue">Testing Flow</Tag>}
          >
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Text>• Gunakan <Text strong>Maintenance / Sinkronisasi Data</Text> dulu jika masalahnya hanya field varian lama/stale.</Text>
              <Text>• Gunakan <Text strong>Reset Terarah Produksi</Text> jika data produksi lama terlalu rusak untuk direpair aman. Reset produksi sekarang ikut membersihkan inventory log produksi secara scoped.</Text>
              <Text>• Gunakan <Text strong>Reset + Baseline Testing</Text> untuk uji berulang yang konsisten.</Text>
              <Text>• Jalankan <Text strong>Cek Stok Umum</Text> sebelum Sinkronkan Stok agar mismatch stok bisa direview dulu.</Text>
              <Text>• Reset Sales/Purchases memakai scope income/expense terkait agar tidak membersihkan kas lintas modul secara diam-diam.</Text>
              <Text>• Gunakan <Text strong>Cek Data Legacy</Text> sebelum cleanup file/logic berikutnya agar orphan log dan transaksi lama punya status jelas.</Text>
            </Space>
          </Card>

          <Card title="Preview Reset Real-Time" size="small">
            {/* -----------------------------------------------------------------
                Tabel preview utility ikut memakai class baseline global.
                Catatan:
                - kolom "Aksi Reset" di sini bersifat informasional, bukan action column utama per row
                - utility page ini masih transisi di level page shell, tetapi tabel preview sudah dimigrasikan
                Status: transisi sementara / aman dibersihkan lagi saat utility page ikut dinormalisasi penuh
            ----------------------------------------------------------------- */}
            <Table
              className="app-data-table"
              size="small"
              loading={loadingPreview}
              pagination={false}
              dataSource={previewRows}
              columns={[
                { title: "Modul", dataIndex: "moduleLabel", key: "moduleLabel", width: 170 },
                { title: "Koleksi / Scope", dataIndex: "name", key: "name" },
                { title: "Jumlah Data", dataIndex: "count", key: "count", width: 140 },
                {
                  title: "Aksi Reset",
                  dataIndex: "action",
                  key: "action",
                  width: 260,
                  render: (value) => <Tag>{value}</Tag>,
                },
              ]}
              scroll={{ x: 820 }}
              locale={{ emptyText: "Tidak ada modul aktif atau belum ada data yang cocok untuk reset." }}
            />
          </Card>

          <Card title="Riwayat Maintenance & Reset" size="small" extra={<Tag color="green">Audit Trail</Tag>}>
            {/* -----------------------------------------------------------------
                ACTIVE / FINAL FOUNDATION: maintenance log menampilkan metadata aksi
                dry run/repair/reset agar admin tidak perlu membuka Firestore manual.
                Log ini bukan sumber mutasi stok/kas, hanya catatan audit.
            ----------------------------------------------------------------- */}
            <Table
              className="app-data-table"
              size="small"
              loading={loadingMaintenanceLogs}
              pagination={{ pageSize: 6, showSizeChanger: false }}
              dataSource={maintenanceLogs.map((item) => ({ ...item, key: item.id }))}
              columns={[
                { title: "Aksi", dataIndex: "actionType", key: "actionType", width: 210 },
                { title: "Mode", dataIndex: "mode", key: "mode", width: 130, render: (value, record) => <Tag color={record.dryRun ? "blue" : "orange"}>{value}</Tag> },
                { title: "Modul", dataIndex: "modules", key: "modules", width: 220, render: (values) => Array.isArray(values) && values.length ? values.join(", ") : "-" },
                { title: "Terdampak", dataIndex: "affectedCount", key: "affectedCount", width: 120 },
                { title: "Status", dataIndex: "status", key: "status", width: 120, render: (value) => <Tag color={value === "success" ? "green" : "red"}>{value || "-"}</Tag> },
                { title: "Catatan", dataIndex: "note", key: "note", width: 360, render: (value) => value || "-" },
              ]}
              scroll={{ x: 1160 }}
              locale={{ emptyText: "Belum ada riwayat maintenance/reset." }}
            />
          </Card>

        </Space>
      </Card>

      <Modal
        open={confirmOpen}
        title="Konfirmasi Reset Data"
        onCancel={() => {
          if (loadingRun) return;
          setConfirmOpen(false);
          confirmForm.resetFields();
        }}
        onOk={handleRunReset}
        okText="Ya, Jalankan Reset"
        cancelText="Batal"
        okButtonProps={{ danger: true, loading: loadingRun, icon: <ReloadOutlined /> }}
      >
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Alert
            type="error"
            showIcon
            icon={<WarningOutlined />}
            message="Reset akan dijalankan pada data testing"
            description="Pastikan preview sudah sesuai. Reset ini benar-benar menghapus data pada modul/scope yang dipilih. Gunakan Maintenance jika hanya ingin repair field turunan."
          />

          <div>
            <Text strong>Mode aktif:</Text>
            <div style={{ marginTop: 6 }}>
              <Tag color="blue">{RESET_MODE_LABELS[mode]}</Tag>
            </div>
          </div>

          <div>
            <Text strong>Modul dipilih:</Text>
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {selectedModuleLabels.map((label) => (
                <Tag key={label} color="geekblue">{label}</Tag>
              ))}
            </div>
          </div>

          <div>
            <Text strong>Total data terdeteksi:</Text>
            <div style={{ marginTop: 4 }}>
              <Text>{preview?.totalRecords || 0} record</Text>
            </div>
          </div>

          <Form form={confirmForm} layout="vertical">
            <Form.Item
              name="confirmationText"
              label='Ketik "RESET" untuk konfirmasi terakhir'
              rules={[{ required: true, message: 'Ketik "RESET" untuk melanjutkan.' }]}
              extra="Popup dipakai agar halaman utama tetap bersih, tapi tetap aman sebelum eksekusi reset."
            >
              <Input placeholder="Ketik RESET di sini" allowClear autoFocus />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </div>
  );
};

export default ResetMaintenanceData;
