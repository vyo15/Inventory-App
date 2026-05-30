import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Steps,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
  theme,
} from "antd";
import {
  CloudDownloadOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  SafetyOutlined,
  SwapOutlined,
} from "@ant-design/icons";

import {
  ensureLocalDbFoundationMeta,
  getOfflineDatabaseFoundationStatus,
} from "../../../data/local/localDbMeta";
import { getImsLocalDb } from "../../../data/local/imsLocalDb";
import {
  LOCAL_DB_TABLES,
  LOCAL_SYNC_STATUSES,
} from "../../../data/local/localDbSchema";
import {
  OFFLINE_REPOSITORY_PILOT_CONFIRMATION,
  getRepositoryModeStatus,
  resetRepositoryModeToFirebasePrimary,
  setRepositoryModeForDevelopment,
} from "../../../data/repositories/repositoryModeService";
import {
  FIREBASE_MASTER_DATA_SYNC_CONFIRMATION,
  previewFirebaseMasterDataSync,
  syncPendingMasterDataToFirebase,
} from "../../../data/sync/firebaseMasterDataSyncService";
import {
  FIREBASE_TO_LOCAL_MASTER_DATA_SYNC_CONFIRMATION,
  getFirebaseToLocalSyncCollections,
  previewFirebaseToLocalMasterDataSync,
  syncFirebaseMasterDataToLocal,
} from "../../../data/sync/firebaseToLocalMasterDataSyncService";
import {
  getSyncQueueSummary,
} from "../../../data/sync/syncQueueService";
import {
  getSyncConflictSummary,
  listSyncConflicts,
} from "../../../data/sync/syncConflictService";
import {
  CONFLICT_RESOLUTION_MODES,
  MASTER_DATA_CONFLICT_RESOLUTION_CONFIRMATION,
  resolveMasterDataSyncConflict,
} from "../../../data/sync/syncConflictResolutionService";
import OfflineLocalDbBackupPanel from "./OfflineLocalDbBackupPanel";
import "./OfflineDatabaseCenter.css";

const { Text, Title } = Typography;

const LOCAL_DATA_OPTIONS = [
  { label: "Categories", value: LOCAL_DB_TABLES.CATEGORIES },
  { label: "Customers", value: LOCAL_DB_TABLES.CUSTOMERS },
];

const statusColor = (status) => {
  if (status === LOCAL_SYNC_STATUSES.SYNCED || status === "pulled") return "green";
  if (status === LOCAL_SYNC_STATUSES.FAILED || status === "skipped") return "red";
  if (status === LOCAL_SYNC_STATUSES.CONFLICT) return "orange";
  if (status === LOCAL_SYNC_STATUSES.SYNCING) return "blue";
  if (status === LOCAL_SYNC_STATUSES.PENDING) return "gold";
  return "default";
};

const isDirtyLocalStatus = (status) => [
  LOCAL_SYNC_STATUSES.PENDING,
  LOCAL_SYNC_STATUSES.FAILED,
  LOCAL_SYNC_STATUSES.CONFLICT,
  LOCAL_SYNC_STATUSES.SYNCING,
].includes(status);

const formatDate = (value) => {
  if (!value) return "-";
  if (typeof value?.toDate === "function") return value.toDate().toLocaleString("id-ID");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("id-ID");
};

const buildLocalDataRows = (rows = []) => rows.map((row) => ({
  ...row,
  key: row.id,
  displayName: row.name || row.customerName || row.categoryName || row.customerCode || row.code || row.id,
  displayCode: row.customerCode || row.code || row.id,
}));

const OfflineDatabaseCenter = () => {
  const { token } = theme.useToken();
  const [modeForm] = Form.useForm();
  const [pullForm] = Form.useForm();
  const [pushForm] = Form.useForm();
  const [resolveForm] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [foundation, setFoundation] = useState(null);
  const [repository, setRepository] = useState(null);
  const [queueSummary, setQueueSummary] = useState(null);
  const [conflictSummary, setConflictSummary] = useState(null);
  const [conflictRows, setConflictRows] = useState([]);
  const [pullCollection, setPullCollection] = useState(LOCAL_DB_TABLES.CATEGORIES);
  const [pushCollection, setPushCollection] = useState(LOCAL_DB_TABLES.CATEGORIES);
  const [localCollection, setLocalCollection] = useState(LOCAL_DB_TABLES.CATEGORIES);
  const [pullPreview, setPullPreview] = useState(null);
  const [pushPreview, setPushPreview] = useState(null);
  const [localRows, setLocalRows] = useState([]);
  const [selectedConflictId, setSelectedConflictId] = useState("");
  const [resolutionMode, setResolutionMode] = useState(CONFLICT_RESOLUTION_MODES.MARK_SKIPPED);

  const modeConfirmation = Form.useWatch("confirmation", modeForm) || "";
  const pullConfirmation = Form.useWatch("confirmation", pullForm) || "";
  const pushConfirmation = Form.useWatch("confirmation", pushForm) || "";
  const resolveConfirmation = Form.useWatch("confirmation", resolveForm) || "";

  const isOfflineMode = repository?.isOfflineLocal;
  const queuePending = queueSummary?.byStatus?.pending || 0;
  const conflictCount = conflictSummary?.unresolved || 0;
  const canEnableOfflinePilot = modeConfirmation === OFFLINE_REPOSITORY_PILOT_CONFIRMATION;
  const canPullFirebaseToLocal = pullConfirmation === FIREBASE_TO_LOCAL_MASTER_DATA_SYNC_CONFIRMATION;
  const canPushLocalToFirebase = pushConfirmation === FIREBASE_MASTER_DATA_SYNC_CONFIRMATION;
  const canResolveConflict =
    resolveConfirmation === MASTER_DATA_CONFLICT_RESOLUTION_CONFIRMATION &&
    Boolean(selectedConflictId || resolveForm.getFieldValue("conflictId"));

  const loadLocalRows = useCallback(async (collectionName = localCollection) => {
    const db = getImsLocalDb();
    const rows = await db.table(collectionName).toArray();
    setLocalRows(buildLocalDataRows(rows.filter((row) => !row?._deleted)));
  }, [localCollection]);

  const refreshOverview = useCallback(async ({ showSuccess = false } = {}) => {
    setLoading(true);
    try {
      const [foundationStatus, repositoryStatus, nextQueueSummary, nextConflictSummary, conflicts] =
        await Promise.all([
          getOfflineDatabaseFoundationStatus(),
          getRepositoryModeStatus(),
          getSyncQueueSummary(),
          getSyncConflictSummary(),
          listSyncConflicts({ unresolvedOnly: true }),
        ]);

      setFoundation(foundationStatus);
      setRepository(repositoryStatus);
      setQueueSummary(nextQueueSummary);
      setConflictSummary(nextConflictSummary);
      setConflictRows(conflicts.slice(0, 25));
      await loadLocalRows(localCollection);
      if (showSuccess) message.success("Status offline database diperbarui.");
    } catch (error) {
      console.error("Gagal refresh Offline Database Center:", error);
      message.error(error?.message || "Gagal refresh Offline Database Center.");
    } finally {
      setLoading(false);
    }
  }, [loadLocalRows, localCollection]);

  useEffect(() => {
    refreshOverview();
  }, [refreshOverview]);

  const handlePrepareFoundation = async () => {
    setLoading(true);
    try {
      await ensureLocalDbFoundationMeta();
      message.success("Local DB siap dipakai.");
      await refreshOverview();
    } catch (error) {
      message.error(error?.message || "Gagal siapkan Local DB.");
    } finally {
      setLoading(false);
    }
  };

  const handleEnableOfflinePilot = async () => {
    const values = await modeForm.validateFields();
    setLoading(true);
    try {
      await setRepositoryModeForDevelopment("offline_local", {
        confirmation: values.confirmation,
        reason: values.reason || "Aktivasi offline pilot dari Offline Database Center.",
      });
      modeForm.resetFields();
      message.success("Offline Mode aktif. Categories/Customers sekarang membaca IndexedDB local.");
      await refreshOverview();
    } catch (error) {
      message.error(error?.message || "Gagal mengaktifkan Offline Mode.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetToFirebase = async () => {
    setLoading(true);
    try {
      await resetRepositoryModeToFirebasePrimary();
      message.success("Kembali ke Firebase Mode.");
      await refreshOverview();
    } catch (error) {
      message.error(error?.message || "Gagal kembali ke Firebase Mode.");
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewPull = async () => {
    setLoading(true);
    try {
      const preview = await previewFirebaseToLocalMasterDataSync({ collectionName: pullCollection, limit: 100 });
      setPullPreview(preview);
      message.success("Preview Firebase → Offline berhasil dimuat.");
    } catch (error) {
      message.error(error?.message || "Gagal preview Firebase → Offline.");
    } finally {
      setLoading(false);
    }
  };

  const handlePullFirebaseToLocal = async () => {
    const values = await pullForm.validateFields();
    setLoading(true);
    try {
      const result = await syncFirebaseMasterDataToLocal({
        collectionName: pullCollection,
        confirmation: values.confirmation,
        limit: 250,
      });
      setPullPreview({
        mode: "firebase_to_local_result",
        collectionName: pullCollection,
        rows: result.rows,
        summary: result.summary,
      });
      pullForm.resetFields(["confirmation"]);
      message.success(`Firebase → Offline selesai. Pulled: ${result.pulled}, skipped: ${result.skipped}.`);
      await refreshOverview();
    } catch (error) {
      message.error(error?.message || "Sync Firebase → Offline gagal.");
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewPush = async () => {
    setLoading(true);
    try {
      const preview = await previewFirebaseMasterDataSync({ collectionName: pushCollection, limit: 100 });
      setPushPreview(preview);
      message.success("Preview Offline → Firebase berhasil dimuat.");
    } catch (error) {
      message.error(error?.message || "Gagal preview Offline → Firebase.");
    } finally {
      setLoading(false);
    }
  };

  const handlePushLocalToFirebase = async () => {
    const values = await pushForm.validateFields();
    setLoading(true);
    try {
      const result = await syncPendingMasterDataToFirebase({
        collectionName: pushCollection,
        confirmation: values.confirmation,
        limit: 25,
      });
      message.success(`Offline → Firebase selesai. Synced: ${result.synced}, conflict: ${result.conflict}, failed: ${result.failed}.`);
      pushForm.resetFields(["confirmation"]);
      await handlePreviewPush();
      await refreshOverview();
    } catch (error) {
      message.error(error?.message || "Sync Offline → Firebase gagal.");
    } finally {
      setLoading(false);
    }
  };

  const handleResolveConflict = async () => {
    const values = await resolveForm.validateFields();
    setLoading(true);
    try {
      await resolveMasterDataSyncConflict({
        conflictId: selectedConflictId || values.conflictId,
        resolutionMode,
        confirmation: values.confirmation,
        resolutionNote: values.resolutionNote,
      });
      resolveForm.resetFields();
      setSelectedConflictId("");
      message.success("Conflict berhasil diproses.");
      await refreshOverview();
    } catch (error) {
      message.error(error?.message || "Resolve conflict gagal.");
    } finally {
      setLoading(false);
    }
  };

  const handleLocalCollectionChange = async (collectionName) => {
    setLocalCollection(collectionName);
    await loadLocalRows(collectionName);
  };

  const currentModeLabel = isOfflineMode ? "Offline Mode" : "Firebase Mode";
  const currentModeDescription = isOfflineMode
    ? "Categories dan Customers membaca/menulis dari IndexedDB browser ini. Sync ke Firebase tetap manual."
    : "Categories dan Customers membaca/menulis langsung ke Firebase. Local DB hanya dipakai saat pilot diaktifkan.";

  const pullRows = pullPreview?.rows || [];
  const pushRows = pushPreview?.rows || [];

  const pullColumns = useMemo(() => [
    { title: "Data", dataIndex: "displayName", key: "displayName", ellipsis: true },
    { title: "ID", dataIndex: "documentId", key: "documentId", ellipsis: true, responsive: ["md"] },
    {
      title: "Aksi",
      dataIndex: "action",
      key: "action",
      width: 150,
      render: (value) => <Tag color={value?.includes("skip") ? "orange" : "blue"}>{value || "-"}</Tag>,
    },
    {
      title: "Status",
      key: "status",
      width: 110,
      render: (_, row) => <Tag color={row.canPull || row.status === "pulled" ? "green" : "orange"}>{row.status || (row.canPull ? "siap" : "skip")}</Tag>,
    },
    { title: "Catatan", dataIndex: "blockedReason", key: "blockedReason", ellipsis: true },
  ], []);

  const pushColumns = useMemo(() => [
    { title: "Collection", dataIndex: "collectionName", key: "collectionName", width: 120 },
    { title: "Operation", dataIndex: "operation", key: "operation", width: 110 },
    { title: "Document", dataIndex: "documentId", key: "documentId", ellipsis: true },
    {
      title: "Status",
      dataIndex: "syncStatus",
      key: "syncStatus",
      width: 110,
      render: (status, row) => <Tag color={row.canSync ? "green" : "orange"}>{status || (row.canSync ? "siap" : "blocked")}</Tag>,
    },
    { title: "Catatan", dataIndex: "blockedReason", key: "blockedReason", ellipsis: true },
  ], []);

  const localColumns = useMemo(() => [
    { title: "Nama", dataIndex: "displayName", key: "displayName", ellipsis: true },
    { title: "Kode/ID", dataIndex: "displayCode", key: "displayCode", ellipsis: true, responsive: ["md"] },
    {
      title: "Sync",
      dataIndex: "syncStatus",
      key: "syncStatus",
      width: 110,
      render: (status) => <Tag color={statusColor(status)}>{status || "remote"}</Tag>,
    },
    {
      title: "Update",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 180,
      responsive: ["lg"],
      render: formatDate,
    },
  ], []);

  const conflictColumns = useMemo(() => [
    { title: "Collection", dataIndex: "collectionName", key: "collectionName", width: 120 },
    { title: "Document", dataIndex: "documentId", key: "documentId", ellipsis: true },
    { title: "Tipe", dataIndex: "conflictType", key: "conflictType", width: 170 },
    {
      title: "Aksi",
      key: "action",
      width: 90,
      render: (_, record) => (
        <Button size="small" onClick={() => setSelectedConflictId(record.id)}>
          Pilih
        </Button>
      ),
    },
  ], []);

  const statusTab = (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Alert
        type={isOfflineMode ? "warning" : "info"}
        showIcon
        message={currentModeLabel}
        description={currentModeDescription}
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <Card size="small" className="offline-db-status-card">
            <Statistic title="Mode Aktif" value={isOfflineMode ? "Offline" : "Firebase"} prefix={<DatabaseOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="offline-db-status-card">
            <Statistic title="Local DB" value={foundation?.ready ? "Siap" : "Belum"} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="offline-db-status-card">
            <Statistic title="Queue Pending" value={queuePending} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="offline-db-status-card">
            <Statistic title="Konflik" value={conflictCount} />
          </Card>
        </Col>
      </Row>

      <Card size="small" className="offline-db-action-card">
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Title level={5} style={{ margin: 0 }}>Urutan pakai yang aman</Title>
          <Steps
            size="small"
            current={isOfflineMode ? 2 : 0}
            items={[
              { title: "Siapkan DB", description: "Buat IndexedDB local" },
              { title: "Ambil Firebase", description: "Isi local agar tidak kosong" },
              { title: "Offline Mode", description: "Edit Categories/Customers" },
              { title: "Upload", description: "Sync perubahan ke Firebase" },
            ]}
          />
          <Space wrap>
            <Button icon={<DatabaseOutlined />} loading={loading} onClick={handlePrepareFoundation}>
              Siapkan Local DB
            </Button>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => refreshOverview({ showSuccess: true })}>
              Refresh Status
            </Button>
            <Button danger loading={loading} onClick={handleResetToFirebase}>
              Kembali ke Firebase Mode
            </Button>
          </Space>
        </Space>
      </Card>

      <Card size="small" title="Aktifkan Offline Mode" className="offline-db-action-card">
        <Form form={modeForm} layout="vertical">
          <Form.Item
            label="Keyword aktivasi"
            name="confirmation"
            extra={`Ketik lengkap: ${OFFLINE_REPOSITORY_PILOT_CONFIRMATION}`}
          >
            <Input placeholder={OFFLINE_REPOSITORY_PILOT_CONFIRMATION} />
          </Form.Item>
          {modeConfirmation && !canEnableOfflinePilot ? (
            <Alert
              type="warning"
              showIcon
              message="Keyword belum lengkap"
              description="Offline Mode sengaja dibuat guarded agar tidak aktif tanpa sadar."
              style={{ marginBottom: 12 }}
            />
          ) : null}
          <Form.Item label="Catatan" name="reason">
            <Input placeholder="Contoh: test data offline Categories/Customers" />
          </Form.Item>
          <Button type="primary" loading={loading} disabled={!canEnableOfflinePilot} onClick={handleEnableOfflinePilot}>
            Aktifkan Offline Mode
          </Button>
        </Form>
      </Card>
    </Space>
  );

  const syncTab = (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message="Sinkronisasi dibuat dua arah dan tetap manual."
        description="Firebase → Offline dipakai supaya Categories/Customers tidak kosong saat Offline Mode. Offline → Firebase dipakai untuk upload perubahan local. Saat ini hanya categories/customers."
      />
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card
            size="small"
            title="1. Firebase → Offline"
            extra={<CloudDownloadOutlined />}
            className="offline-db-action-card"
          >
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Text type="secondary">Ambil data Firebase ke IndexedDB browser ini. Ini tidak membuat queue upload.</Text>
              <Select value={pullCollection} options={getFirebaseToLocalSyncCollections()} onChange={setPullCollection} style={{ width: "100%" }} />
              <Space wrap>
                <Button loading={loading} onClick={handlePreviewPull}>Preview Firebase → Offline</Button>
              </Space>
              <Form form={pullForm} layout="vertical">
                <Form.Item label="Keyword pull" name="confirmation" extra={FIREBASE_TO_LOCAL_MASTER_DATA_SYNC_CONFIRMATION}>
                  <Input placeholder={FIREBASE_TO_LOCAL_MASTER_DATA_SYNC_CONFIRMATION} />
                </Form.Item>
                <Button type="primary" icon={<CloudDownloadOutlined />} loading={loading} disabled={!canPullFirebaseToLocal} onClick={handlePullFirebaseToLocal}>
                  Sync Firebase → Offline
                </Button>
              </Form>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            size="small"
            title="2. Offline → Firebase"
            extra={<CloudUploadOutlined />}
            className="offline-db-action-card"
          >
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Text type="secondary">Upload perubahan local pending ke Firebase. Delete Firebase tetap diblokir dari panel ini.</Text>
              <Select value={pushCollection} options={LOCAL_DATA_OPTIONS} onChange={setPushCollection} style={{ width: "100%" }} />
              <Space wrap>
                <Button loading={loading} onClick={handlePreviewPush}>Preview Offline → Firebase</Button>
                <Tag color="gold">Pending: {queuePending}</Tag>
              </Space>
              <Form form={pushForm} layout="vertical">
                <Form.Item label="Keyword push" name="confirmation" extra={FIREBASE_MASTER_DATA_SYNC_CONFIRMATION}>
                  <Input placeholder={FIREBASE_MASTER_DATA_SYNC_CONFIRMATION} />
                </Form.Item>
                <Button type="primary" icon={<CloudUploadOutlined />} loading={loading} disabled={!canPushLocalToFirebase} onClick={handlePushLocalToFirebase}>
                  Sync Offline → Firebase
                </Button>
              </Form>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card size="small" title="Preview sinkronisasi" className="offline-db-action-card">
        <Tabs
          size="small"
          items={[
            {
              key: "pull-preview",
              label: `Firebase → Offline (${pullPreview?.summary?.total || 0})`,
              children: pullRows.length ? (
                <Table size="small" rowKey={(row) => `${row.collectionName}-${row.documentId}-${row.action}`} columns={pullColumns} dataSource={pullRows} pagination={{ pageSize: 8 }} scroll={{ x: 760 }} />
              ) : <Empty description="Belum ada preview Firebase → Offline" />,
            },
            {
              key: "push-preview",
              label: `Offline → Firebase (${pushPreview?.summary?.total || 0})`,
              children: pushRows.length ? (
                <Table size="small" rowKey="queueId" columns={pushColumns} dataSource={pushRows} pagination={{ pageSize: 8 }} scroll={{ x: 760 }} />
              ) : <Empty description="Belum ada preview Offline → Firebase" />,
            },
          ]}
        />
      </Card>
    </Space>
  );

  const backupTab = (
    <OfflineLocalDbBackupPanel />
  );

  const conflictTab = (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Alert
        type={conflictCount ? "warning" : "success"}
        showIcon
        message={conflictCount ? "Ada conflict yang perlu dipilih dan diselesaikan" : "Belum ada conflict aktif"}
        description="Default paling aman adalah Lewati / manual review. Pakai Local atau Firebase hanya jika sudah yakin data mana yang benar."
      />
      <Table
        size="small"
        rowKey="id"
        columns={conflictColumns}
        dataSource={conflictRows}
        pagination={{ pageSize: 8 }}
        scroll={{ x: 720 }}
      />
      <Card size="small" title="Resolve conflict terpilih" className="offline-db-action-card">
        <Form form={resolveForm} layout="vertical">
          <Form.Item label="Conflict ID" name="conflictId" initialValue={selectedConflictId}>
            <Input value={selectedConflictId} onChange={(event) => setSelectedConflictId(event.target.value)} placeholder="Pilih conflict dari tabel" />
          </Form.Item>
          <Form.Item label="Pilihan resolusi">
            <Select
              value={resolutionMode}
              onChange={setResolutionMode}
              options={[
                { label: "Lewati / review manual", value: CONFLICT_RESOLUTION_MODES.MARK_SKIPPED },
                { label: "Pakai Local", value: CONFLICT_RESOLUTION_MODES.LOCAL_WINS },
                { label: "Pakai Firebase", value: CONFLICT_RESOLUTION_MODES.REMOTE_WINS },
              ]}
            />
          </Form.Item>
          <Form.Item label="Catatan" name="resolutionNote">
            <Input.TextArea rows={2} placeholder="Kenapa memilih resolusi ini?" />
          </Form.Item>
          <Form.Item label="Keyword resolve" name="confirmation" extra={MASTER_DATA_CONFLICT_RESOLUTION_CONFIRMATION}>
            <Input placeholder={MASTER_DATA_CONFLICT_RESOLUTION_CONFIRMATION} />
          </Form.Item>
          <Button icon={<SafetyOutlined />} loading={loading} disabled={!canResolveConflict} onClick={handleResolveConflict}>
            Resolve Conflict
          </Button>
        </Form>
      </Card>
    </Space>
  );

  const localDataTab = (
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message="Data Local adalah isi IndexedDB browser ini."
        description="Pilih satu jenis data agar tabel tidak panjang. Data ini per device/per browser dan tidak otomatis muncul di PC lain sebelum sync/backup."
      />
      <Space wrap>
        <Select value={localCollection} options={LOCAL_DATA_OPTIONS} onChange={handleLocalCollectionChange} style={{ width: 220 }} />
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadLocalRows(localCollection)}>
          Refresh Data Local
        </Button>
        <Tag color="blue">Total: {localRows.length}</Tag>
        <Tag color={localRows.some((row) => isDirtyLocalStatus(row.syncStatus)) ? "gold" : "green"}>
          {localRows.some((row) => isDirtyLocalStatus(row.syncStatus)) ? "Ada perubahan pending" : "Tidak ada perubahan pending"}
        </Tag>
      </Space>
      <Table
        size="small"
        rowKey="key"
        columns={localColumns}
        dataSource={localRows}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 720 }}
      />
    </Space>
  );

  const tabs = [
    { key: "status", label: "Status", children: statusTab },
    { key: "sync", label: "Sinkronisasi", children: syncTab },
    { key: "backup", label: "Backup & Restore", children: backupTab },
    { key: "conflict", label: `Konflik${conflictCount ? ` (${conflictCount})` : ""}`, children: conflictTab },
    { key: "local-data", label: "Data Local", children: localDataTab },
  ];

  return (
    <Card
      size="small"
      className="offline-db-center"
      title={(
        <Space size={10}>
          <SwapOutlined />
          <span>Offline Database Center</span>
          <Tag color={isOfflineMode ? "gold" : "blue"}>{repository?.mode || "firebase_primary"}</Tag>
        </Space>
      )}
      extra={(
        <Space size={8} wrap>
          <Tag color={foundation?.ready ? "green" : "orange"}>Local DB: {foundation?.ready ? "siap" : "belum siap"}</Tag>
          <Tag color={queuePending ? "gold" : "green"}>Queue: {queuePending}</Tag>
          <Tag color={conflictCount ? "orange" : "green"}>Conflict: {conflictCount}</Tag>
        </Space>
      )}
      styles={{
        header: {
          background: token.colorBgContainer,
          borderBottomColor: token.colorBorderSecondary,
        },
      }}
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <div className="offline-db-hero" style={{ background: token.colorBgElevated, borderColor: token.colorBorderSecondary }}>
          <div>
            <Text type="secondary">Mode offline pilot</Text>
            <Title level={4} style={{ margin: "2px 0 4px" }}>Kerja offline tanpa kehilangan arah data</Title>
            <Text type="secondary">
              Ambil dulu data Firebase ke Local, aktifkan Offline Mode, lalu upload perubahan local secara manual saat sudah siap.
            </Text>
          </div>
          <Space direction="vertical" size={4} align="end">
            <Tag color={isOfflineMode ? "gold" : "blue"}>{currentModeLabel}</Tag>
            <Text type="secondary">Scope: Categories & Customers</Text>
          </Space>
        </div>
        <Tabs className="offline-db-tabs" items={tabs} />
      </Space>
    </Card>
  );
};

export default OfflineDatabaseCenter;
