import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Input,
  List,
  Modal,
  Progress,
  Result,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Steps,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  CloudDownloadOutlined,
  CloudSyncOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  ExperimentOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
} from "@ant-design/icons";
import PageHeader from "../../components/Layout/Page/PageHeader";
import {
  cancelTestingSession,
  cloneTestingLabOperationalSource,
  completeTestingSession,
  createTestingBaseline,
  getTestingLabOperationalSourcePreview,
  getTestingLabStatus,
  getTestingResultExport,
  resetTestingSandbox,
  runTestingLabValidation,
  selectTestingBaseline,
  startTestingSession,
} from "../../services/System/testingLabService";
import "./TestingLab.css";

const { Paragraph, Text, Title } = Typography;

const formatDateTime = (value) => {
  if (!value) return "Belum ada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const downloadJson = (filename, payload) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const statusTag = (status) => {
  const normalized = String(status || "unknown").toLowerCase();
  if (["passed", "completed"].includes(normalized)) return <Tag color="green">Lulus</Tag>;
  if (normalized === "warning") return <Tag color="gold">Peringatan</Tag>;
  if (normalized === "failed") return <Tag color="red">Gagal</Tag>;
  if (normalized === "active") return <Tag color="blue">Aktif</Tag>;
  return <Tag>Belum diperiksa</Tag>;
};

const TestingLab = () => {
  const { message } = App.useApp();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [validation, setValidation] = useState(null);
  const [confirmMode, setConfirmMode] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [selectedBaseline, setSelectedBaseline] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [operationalPreview, setOperationalPreview] = useState(null);

  const loadStatus = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const nextStatus = await getTestingLabStatus();
      setStatus(nextStatus);
      setSelectedBaseline(nextStatus?.activeBaseline?.filename || "");
    } catch (error) {
      message.error(error?.message || "Status Lab Pengujian gagal dimuat.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const runAction = async (key, action, successMessage, { refresh = true } = {}) => {
    setBusyAction(key);
    try {
      const result = await action();
      if (successMessage) message.success(successMessage);
      if (refresh) await loadStatus({ quiet: true });
      return result;
    } catch (error) {
      message.error(error?.message || "Operasi Lab Pengujian gagal.");
      return null;
    } finally {
      setBusyAction("");
    }
  };

  const confirmKeyword = confirmMode === "baseline"
    ? status?.confirmKeywords?.createBaseline
    : confirmMode === "clone"
      ? status?.confirmKeywords?.cloneOperationalSource
      : status?.confirmKeywords?.resetSandbox;

  const handleConfirm = async () => {
    if (confirmText !== confirmKeyword) {
      message.warning(`Ketik persis: ${confirmKeyword}`);
      return;
    }
    const action = confirmMode === "baseline"
      ? () => createTestingBaseline(confirmText)
      : confirmMode === "clone"
        ? () => cloneTestingLabOperationalSource(confirmText)
        : () => resetTestingSandbox(confirmText);
    const successMessage = confirmMode === "baseline"
      ? "Baseline testing berhasil dibuat."
      : confirmMode === "clone"
        ? "Data operasional berhasil disalin menjadi baseline sandbox. Login ulang diperlukan."
        : "Sandbox berhasil dikembalikan ke baseline.";
    const result = await runAction(
      confirmMode,
      action,
      successMessage,
      { refresh: confirmMode !== "clone" },
    );
    if (result) {
      setConfirmMode("");
      setConfirmText("");
      setOperationalPreview(null);
      if (result.reloadRequired) window.setTimeout(() => window.location.reload(), 700);
    }
  };

  const openOperationalClonePreview = async () => {
    setBusyAction("clone-preview");
    try {
      const preview = await getTestingLabOperationalSourcePreview();
      setOperationalPreview(preview);
      setConfirmText("");
      setConfirmMode("clone");
    } catch (error) {
      message.error(error?.message || "Database operasional sumber gagal diperiksa.");
    } finally {
      setBusyAction("");
    }
  };

  const scenarios = status?.scenarios || [];
  const activeSession = status?.activeSession || null;
  const lastResult = status?.lastResult || null;
  const baselines = status?.baselines || [];
  const snapshot = status?.snapshot || {};

  const transactionTotal = useMemo(() => Object.values(snapshot.transactionCounts || {})
    .reduce((sum, value) => sum + Number(value || 0), 0), [snapshot.transactionCounts]);

  const validationColumns = [
    { title: "Pemeriksaan", dataIndex: "label", key: "label" },
    { title: "Status", dataIndex: "status", key: "status", width: 140, render: statusTag },
    { title: "Ringkasan", dataIndex: "summary", key: "summary" },
  ];

  if (loading) {
    return <div className="testing-lab-loading"><Spin size="large" /></div>;
  }

  if (!status) {
    return <Result status="error" title="Lab Pengujian gagal dimuat" extra={<Button onClick={() => loadStatus()}>Coba lagi</Button>} />;
  }

  return (
    <div className="testing-lab-page">
      <PageHeader
        title="Lab Pengujian"
        subtitle="Baseline → jalankan skenario melalui flow resmi → validasi → reset sandbox."
        extra={(
          <Button icon={<ReloadOutlined />} onClick={() => loadStatus()} loading={loading}>
            Refresh
          </Button>
        )}
      />

      {!status.guard?.available ? (
        <Result
          status="warning"
          icon={<SafetyCertificateOutlined />}
          title="Lab Pengujian dikunci"
          subTitle="Fitur testing hanya aktif pada database sandbox terpisah. Database operasional tidak disentuh."
          extra={(
            <Card size="small" className="testing-lab-guard-card">
              <List
                size="small"
                dataSource={status.guard?.blockers || []}
                renderItem={(item) => <List.Item>{item}</List.Item>}
              />
              <Paragraph code copyable>
                IMS_ENABLE_TESTING_LAB=true{"\n"}
                IMS_DATABASE_PURPOSE=sandbox{"\n"}
                IMS_SQLITE_DB_PATH=../data/ims-testing-sandbox.sqlite{"\n"}
                IMS_SQLITE_BACKUP_DIR=../backups/testing-sandbox{"\n"}
                IMS_LOG_DIR=../logs/testing-sandbox
              </Paragraph>
            </Card>
          )}
        />
      ) : (
        <>
          <Alert
            className="testing-lab-sandbox-alert"
            type="warning"
            showIcon
            message="MODE TESTING — BUKAN DATA TOKO ASLI"
            description={`Database aktif: ${status.guard.databaseFilename}. Backup sandbox: ${status.guard.backupDirectoryName}. Semua reset hanya mengembalikan sandbox ke baseline verified.`}
          />
          {(status.guard?.warnings || []).length > 0 && (
            <Alert
              className="testing-lab-sandbox-alert"
              type="info"
              showIcon
              message="Pemisahan runtime belum lengkap"
              description={(status.guard.warnings || []).join(" ")}
            />
          )}

          <Row gutter={[12, 12]} className="testing-lab-summary">
            <Col xs={24} sm={12} xl={6}>
              <Card size="small"><Statistic title="Lingkungan" value="Sandbox" prefix={<ExperimentOutlined />} /></Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card size="small"><Statistic title="Baseline aktif" value={status.activeBaseline ? "Siap" : "Belum ada"} prefix={<DatabaseOutlined />} /></Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card size="small"><Statistic title="Sesi testing" value={activeSession ? "Aktif" : "Tidak aktif"} prefix={<CloudSyncOutlined />} /></Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card size="small"><Statistic title="Record transaksi" value={transactionTotal} /></Card>
            </Col>
          </Row>

          <Card
            title="Baseline Sandbox"
            className="testing-lab-section"
            extra={status.activeBaseline?.validationStatus === "failed"
              ? <Tag color="red">Perlu perbaikan</Tag>
              : <Tag color={status.activeBaseline ? "green" : "gold"}>{status.activeBaseline ? "Verified" : "Belum siap"}</Tag>}
          >
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} lg={14}>
                <Descriptions size="small" column={1}>
                  <Descriptions.Item label="Baseline aktif">{status.activeBaseline?.filename || "Belum dipilih"}</Descriptions.Item>
                  <Descriptions.Item label="Dibuat">{formatDateTime(status.activeBaseline?.createdAt)}</Descriptions.Item>
                  <Descriptions.Item label="Database">{status.guard.databaseFilename}</Descriptions.Item>
                  <Descriptions.Item label="Folder backup">{status.guard.backupDirectoryName}</Descriptions.Item>
                  {status.activeBaseline?.sourceType === "operational_clone" && (
                    <Descriptions.Item label="Sumber baseline">
                      Salinan operasional · {status.activeBaseline?.source?.filename || "database operasional"}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Col>
              <Col xs={24} lg={10}>
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Select
                    value={selectedBaseline || undefined}
                    placeholder="Pilih baseline verified"
                    options={baselines.map((item) => ({ value: item.filename, label: item.filename }))}
                    onChange={setSelectedBaseline}
                    style={{ width: "100%" }}
                  />
                  <Space wrap>
                    <Button
                      onClick={() => runAction("select", () => selectTestingBaseline(selectedBaseline), "Baseline aktif diperbarui.")}
                      disabled={!selectedBaseline}
                      loading={busyAction === "select"}
                    >
                      Gunakan Baseline
                    </Button>
                    <Button
                      type="primary"
                      icon={<CloudDownloadOutlined />}
                      loading={busyAction === "clone-preview"}
                      disabled={Boolean(activeSession)}
                      onClick={openOperationalClonePreview}
                    >
                      Ambil Data Operasional
                    </Button>
                    <Button onClick={() => setConfirmMode("baseline")}>Buat dari Sandbox Saat Ini</Button>
                    <Button danger disabled={!status.activeBaseline} onClick={() => setConfirmMode("reset")}>Reset ke Baseline</Button>
                  </Space>
                </Space>
              </Col>
            </Row>
          </Card>

          <Card title="Kesiapan Data Uji" className="testing-lab-section">
            <Row gutter={[12, 12]}>
              {Object.entries(snapshot.masterReadiness || {}).map(([key, value]) => (
                <Col xs={12} md={8} xl={6} key={key}>
                  <div className="testing-lab-readiness-item">
                    <Text type="secondary">{key}</Text>
                    <Text strong>{value}</Text>
                  </div>
                </Col>
              ))}
            </Row>
            <Divider />
            <Text type="secondary">Data uji dibuat melalui menu operasional dan service existing. Lab tidak menyisipkan record langsung ke tabel.</Text>
          </Card>

          <Card title="Skenario Pengujian" className="testing-lab-section">
            {activeSession ? (
              <div className="testing-lab-active-session">
                <Space wrap>
                  {statusTag(activeSession.status)}
                  <Title level={4} style={{ margin: 0 }}>{activeSession.scenarioLabel}</Title>
                  <Text type="secondary">Mulai {formatDateTime(activeSession.startedAt)}</Text>
                </Space>
                <Steps
                  direction="vertical"
                  size="small"
                  current={0}
                  items={(activeSession.steps || []).map((title) => ({ title }))}
                />
                <Input.TextArea
                  rows={3}
                  value={sessionNotes}
                  onChange={(event) => setSessionNotes(event.target.value)}
                  placeholder="Catatan hasil manual, error, atau evidence..."
                />
                <Space wrap>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={busyAction === "complete"}
                    onClick={async () => {
                      const result = await runAction("complete", () => completeTestingSession(sessionNotes), "Sesi selesai dan validasi dijalankan.");
                      if (result) {
                        setValidation(result.validation);
                        setSessionNotes("");
                      }
                    }}
                  >
                    Selesaikan & Validasi
                  </Button>
                  <Button
                    danger
                    icon={<StopOutlined />}
                    loading={busyAction === "cancel"}
                    onClick={() => runAction("cancel", cancelTestingSession, "Sesi testing dibatalkan.")}
                  >
                    Batalkan Sesi
                  </Button>
                </Space>
              </div>
            ) : (
              <Row gutter={[12, 12]}>
                {scenarios.map((scenario) => (
                  <Col xs={24} lg={12} key={scenario.key}>
                    <Card size="small" className="testing-lab-scenario-card">
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Space wrap>
                          <Text strong>{scenario.label}</Text>
                          <Tag color={scenario.ready ? "green" : "gold"}>{scenario.ready ? "Siap" : "Master belum lengkap"}</Tag>
                        </Space>
                        <Text type="secondary">{scenario.description}</Text>
                        {!scenario.ready && (
                          <Text type="warning">Kurang: {scenario.missingRequirements.join(", ")}</Text>
                        )}
                        <Button
                          type="primary"
                          disabled={!scenario.ready || !status.activeBaseline || status.activeBaseline?.validationStatus === "failed"}
                          loading={busyAction === scenario.key}
                          onClick={() => runAction(scenario.key, () => startTestingSession(scenario.key), "Sesi testing dimulai.")}
                        >
                          Mulai Skenario
                        </Button>
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </Card>

          <Card
            title="Validasi & Hasil"
            className="testing-lab-section"
            extra={(
              <Space>
                <Button
                  onClick={async () => {
                    const result = await runAction("validate", runTestingLabValidation, "Validasi sandbox selesai.");
                    if (result) setValidation(result);
                  }}
                  loading={busyAction === "validate"}
                >
                  Jalankan Validasi
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  disabled={!lastResult}
                  onClick={async () => {
                    const payload = await runAction("export", getTestingResultExport, "");
                    if (payload) downloadJson(`ims-testing-result-${Date.now()}.json`, payload);
                  }}
                >
                  Export Hasil
                </Button>
              </Space>
            )}
          >
            {(validation || lastResult?.validation) ? (
              <>
                <Space wrap style={{ marginBottom: 12 }}>
                  <Text strong>Status keseluruhan</Text>
                  {statusTag((validation || lastResult?.validation)?.overallStatus)}
                  {lastResult && <Text type="secondary">Sesi terakhir: {lastResult.scenarioLabel}</Text>}
                </Space>
                <Table
                  size="small"
                  rowKey="key"
                  pagination={false}
                  columns={validationColumns}
                  dataSource={(validation || lastResult?.validation)?.checks || []}
                />
              </>
            ) : (
              <Empty description="Belum ada hasil validasi." />
            )}
          </Card>

          {lastResult?.diff && (
            <Card title="Diff Sesi Terakhir" className="testing-lab-section">
              <Row gutter={[12, 12]}>
                {Object.entries(lastResult.diff.transactionCounts || {}).map(([key, value]) => (
                  <Col xs={12} md={8} xl={6} key={key}>
                    <div className="testing-lab-readiness-item">
                      <Text type="secondary">{key}</Text>
                      <Text strong>{Number(value) >= 0 ? `+${value}` : value}</Text>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          )}

          <Card title="Riwayat Sesi" className="testing-lab-section">
            {(status.sessionHistory || []).length > 0 ? (
              <Table
                size="small"
                rowKey="id"
                pagination={{ pageSize: 8, hideOnSinglePage: true }}
                dataSource={status.sessionHistory || []}
                columns={[
                  {
                    title: "Waktu",
                    dataIndex: "createdAt",
                    key: "createdAt",
                    width: 180,
                    render: formatDateTime,
                  },
                  {
                    title: "Aktivitas",
                    dataIndex: "description",
                    key: "description",
                  },
                  {
                    title: "Pelaksana",
                    dataIndex: "actor",
                    key: "actor",
                    width: 160,
                  },
                ]}
              />
            ) : (
              <Empty description="Belum ada riwayat sesi testing." />
            )}
          </Card>
        </>
      )}

      <Modal
        open={Boolean(confirmMode)}
        title={confirmMode === "baseline"
          ? "Buat Baseline Testing"
          : confirmMode === "clone"
            ? "Ambil Data Operasional"
            : "Reset Sandbox ke Baseline"}
        okText={confirmMode === "baseline"
          ? "Buat Baseline"
          : confirmMode === "clone"
            ? "Salin ke Sandbox"
            : "Reset Sandbox"}
        okButtonProps={{ danger: confirmMode === "reset", loading: busyAction === confirmMode }}
        width={confirmMode === "clone" ? 720 : 520}
        onOk={handleConfirm}
        onCancel={() => {
          if (busyAction) return;
          setConfirmMode("");
          setConfirmText("");
          setOperationalPreview(null);
        }}
      >
        <Alert
          type={confirmMode === "reset" || confirmMode === "clone" ? "warning" : "info"}
          showIcon
          message={confirmMode === "reset"
            ? "Seluruh perubahan testing setelah baseline akan diganti. Backup pre-reset dibuat otomatis."
            : confirmMode === "clone"
              ? "Sandbox akan diganti oleh snapshot read-only database operasional. Database asli tidak ditulis, backup sandbox dibuat otomatis, dan seluruh session login hasil clone dicabut."
              : "Baseline menyimpan kondisi master, stok, modal/HPP, katalog, counter, user, dan konfigurasi sandbox saat ini."}
        />
        {confirmMode === "clone" && operationalPreview && (
          <>
            <Descriptions size="small" column={{ xs: 1, sm: 2 }} bordered style={{ marginTop: 16 }}>
              <Descriptions.Item label="Sumber">{operationalPreview.filename}</Descriptions.Item>
              <Descriptions.Item label="Terakhir diubah">{formatDateTime(operationalPreview.modifiedAt)}</Descriptions.Item>
              <Descriptions.Item label="Ukuran">{new Intl.NumberFormat("id-ID").format(Number(operationalPreview.sizeBytes || 0))} byte</Descriptions.Item>
              <Descriptions.Item label="Schema">{operationalPreview.schemaVersion}</Descriptions.Item>
              <Descriptions.Item label="Produk">{operationalPreview.businessSummary?.products || 0}</Descriptions.Item>
              <Descriptions.Item label="Bahan baku">{operationalPreview.businessSummary?.rawMaterials || 0}</Descriptions.Item>
              <Descriptions.Item label="Customer">{operationalPreview.businessSummary?.customers || 0}</Descriptions.Item>
              <Descriptions.Item label="Supplier">{operationalPreview.businessSummary?.suppliers || 0}</Descriptions.Item>
              <Descriptions.Item label="Penjualan">{operationalPreview.businessSummary?.sales || 0}</Descriptions.Item>
              <Descriptions.Item label="Pembelian">{operationalPreview.businessSummary?.purchases || 0}</Descriptions.Item>
            </Descriptions>
            <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
              Salinan ini membawa data internal operasional ke sandbox. Perubahan di Lab tidak dikirim kembali ke database asli. Setelah selesai, aplikasi akan meminta login ulang.
            </Paragraph>
          </>
        )}
        <Paragraph style={{ marginTop: 16 }}>Ketik <Text code>{confirmKeyword}</Text></Paragraph>
        <Input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} />
      </Modal>
    </div>
  );
};

export default TestingLab;
