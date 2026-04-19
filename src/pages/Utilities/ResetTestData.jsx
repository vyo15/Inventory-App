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
  DEFAULT_RESET_MODULES,
  RESET_MODE_OPTIONS,
  getResetPreview,
  runResetDataTest,
  saveCurrentStockAsTestingBaseline,
  syncAllStocks,
} from "../../services/Utilities/resetTestDataService";

const { Title, Paragraph, Text } = Typography;

// -----------------------------------------------------------------------------
// Reset Data Uji Page
// Tujuan UX halaman ini:
// 1. preview real count sebelum reset dijalankan
// 2. alur testing trial-error tetap cepat, tapi aman lewat popup konfirmasi
// 3. baseline + sinkronisasi stok tetap ada agar pengujian berulang lebih profesional
// -----------------------------------------------------------------------------

const RESET_MODE_LABELS = {
  transaction_only: "Reset Transaksi",
  reset_and_zero_stock: "Reset + Nolkan Semua Stok",
  reset_and_restore_baseline: "Reset + Baseline Testing",
};

const ResetTestData = () => {
  const [confirmForm] = Form.useForm();

  // ---------------------------------------------------------------------------
  // State utama halaman.
  // ---------------------------------------------------------------------------
  const [mode, setMode] = useState("transaction_only");
  const [selectedModules, setSelectedModules] = useState([...DEFAULT_RESET_MODULES]);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingRun, setLoadingRun] = useState(false);
  const [loadingBaseline, setLoadingBaseline] = useState(false);
  const [loadingSync, setLoadingSync] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const recommendationText = useMemo(() => {
    if (mode === "transaction_only") {
      return "Paling cepat untuk uji trial-error karena stok master aktif tetap dipertahankan.";
    }
    if (mode === "reset_and_zero_stock") {
      return "Cocok jika Anda ingin simulasi dari nol total, tapi lebih agresif karena stok ikut dibersihkan.";
    }
    return "Mode paling profesional untuk testing berulang: simpan baseline, lakukan tes, lalu restore ke baseline yang sama.";
  }, [mode]);

  return (
    <div className="page-container">
      <Card className="content-card">
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          <div>
            <Title level={2} style={{ marginBottom: 8 }}>
              Reset Data Uji
            </Title>
            <Paragraph style={{ marginBottom: 0 }}>
              Utilitas untuk trial-error testing yang lebih profesional: preview otomatis,
              reset transaksi real, baseline stok, dan sinkronisasi field stok.
            </Paragraph>
          </div>

          <Alert
            type="warning"
            showIcon
            message="Gunakan hanya untuk database testing"
            description="Fitur ini sekarang membaca data real Firestore. Jadi preview, reset transaksi, baseline stok, dan sinkronisasi stok benar-benar bekerja pada data uji Anda."
          />

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
              <Text>• Gunakan <Text strong>Reset + Baseline Testing</Text> untuk uji berulang yang konsisten.</Text>
              <Text>• Simpan baseline setelah master data dan stok awal sudah ideal.</Text>
              <Text>• Modul <Text strong>Produksi</Text> sekarang membersihkan <Text strong>Production Order</Text> dan <Text strong>Production Work Log</Text>.</Text>
              <Text>• Jalankan <Text strong>Sinkronkan Stok</Text> jika ada mismatch karena banyak uji start/complete produksi.</Text>
            </Space>
          </Card>

          <Card title="Preview Reset Real-Time" size="small">
            <Table
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
              locale={{ emptyText: "Tidak ada modul aktif atau belum ada data yang cocok untuk reset." }}
            />
          </Card>
        </Space>
      </Card>

      <Modal
        open={confirmOpen}
        title="Konfirmasi Reset Data Uji"
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
            description="Pastikan preview sudah sesuai. Reset ini benar-benar menghapus transaksi pada modul yang dipilih."
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
