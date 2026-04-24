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
  DEFAULT_RESET_MODULES,
  RESET_MODE_OPTIONS,
  getResetPreview,
  runResetDataTest,
  saveCurrentStockAsTestingBaseline,
  syncAllStocks,
} from "../../services/Utilities/resetTestDataService";

const { Title, Paragraph, Text } = Typography;

// -----------------------------------------------------------------------------
// Reset & Maintenance Data Page
// ACTIVE / TRANSISI:
// - Reset Data masih memakai service utility lama yang sudah ada.
// - Maintenance Data memakai service baru terpisah agar audit/repair tidak
//   bercampur dengan flow operasional produksi aktif.
// - Route lama tetap dipertahankan agar menu existing tidak rusak.
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
};

const ResetTestData = () => {
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
      message.success(result?.message || "Baseline stok saat ini berhasil disimpan.");
      await loadPreview(false);
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
      message.success(result?.message || "Sinkronisasi stok berhasil dijalankan.");
      await loadPreview(false);
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
      message.success(result?.message || "Reset data uji berhasil dijalankan.");
      setConfirmOpen(false);
      confirmForm.resetFields();
      await loadPreview(false);
      await handleLoadProductionMaintenanceAudit();
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
      key: item.key,
      moduleLabel: item.moduleLabel,
      name: item.label,
      count: item.count,
      action: item.action,
    }));
  }, [preview]);

  const maintenanceRows = useMemo(() => maintenanceAudit?.rows || [], [maintenanceAudit]);

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
              <Text>• Gunakan <Text strong>Reset Terarah Produksi</Text> jika data produksi lama terlalu rusak untuk direpair aman.</Text>
              <Text>• Gunakan <Text strong>Reset + Baseline Testing</Text> untuk uji berulang yang konsisten.</Text>
              <Text>• Jalankan <Text strong>Sinkronkan Stok</Text> hanya untuk merapikan field stok master, bukan untuk repair histori produksi completed.</Text>
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
                { title: "Koleksi", dataIndex: "name", key: "name" },
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
            description="Pastikan preview sudah sesuai. Reset ini benar-benar menghapus data pada modul yang dipilih. Gunakan Maintenance jika hanya ingin repair field turunan."
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

export default ResetTestData;
