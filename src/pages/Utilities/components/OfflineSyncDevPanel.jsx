import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CloudSyncOutlined,
  ExperimentOutlined,
  ReloadOutlined,
  SafetyOutlined,
} from "@ant-design/icons";

import {
  ensureLocalDbFoundationMeta,
  getOfflineDatabaseFoundationStatus,
} from "../../../data/local/localDbMeta";
import {
  OFFLINE_REPOSITORY_PILOT_CONFIRMATION,
  getRepositoryModeStatus,
  resetRepositoryModeToFirebasePrimary,
  setRepositoryModeForDevelopment,
} from "../../../data/repositories/repositoryModeService";
import { getSyncQueueSummary } from "../../../data/sync/syncQueueService";
import {
  MASTER_DATA_SYNC_CONFIRMATION,
  previewFirebaseMasterDataSync,
  syncPendingMasterDataToFirebase,
} from "../../../data/sync/firebaseMasterDataSyncService";
import {
  getSyncConflictSummary,
  listSyncConflicts,
} from "../../../data/sync/syncConflictService";
import {
  MASTER_DATA_CONFLICT_RESOLUTION_CONFIRMATION,
  MASTER_DATA_CONFLICT_RESOLUTIONS,
  resolveMasterDataSyncConflict,
} from "../../../data/sync/syncConflictResolutionService";

const { Text } = Typography;

const renderStatusTag = (status) => {
  const colorByStatus = {
    pending: "gold",
    syncing: "blue",
    synced: "green",
    failed: "red",
    conflict: "volcano",
  };

  return <Tag color={colorByStatus[status] || "default"}>{status || "unknown"}</Tag>;
};

const compactText = (value = "", maxLength = 48) => {
  const text = String(value || "-");
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

const OfflineSyncDevPanel = () => {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [modeConfirmation, setModeConfirmation] = useState("");
  const [syncConfirmation, setSyncConfirmation] = useState("");
  const [foundationStatus, setFoundationStatus] = useState(null);
  const [repositoryMode, setRepositoryMode] = useState(null);
  const [queueSummary, setQueueSummary] = useState(null);
  const [syncPreview, setSyncPreview] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [conflictSummary, setConflictSummary] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [selectedConflictId, setSelectedConflictId] = useState("");
  const [conflictResolution, setConflictResolution] = useState(
    MASTER_DATA_CONFLICT_RESOLUTIONS.MARK_SKIPPED
  );
  const [conflictResolutionConfirmation, setConflictResolutionConfirmation] = useState("");
  const [conflictResolutionNote, setConflictResolutionNote] = useState("");
  const [resolvingConflict, setResolvingConflict] = useState(false);

  const loadPanelData = useCallback(async (showSuccessMessage = false) => {
    try {
      setLoading(true);
      const [foundation, mode, queue, preview, conflictInfo, conflictRows] = await Promise.all([
        getOfflineDatabaseFoundationStatus(),
        getRepositoryModeStatus(),
        getSyncQueueSummary(),
        previewFirebaseMasterDataSync(),
        getSyncConflictSummary(),
        listSyncConflicts({ unresolvedOnly: true }),
      ]);

      setFoundationStatus(foundation);
      setRepositoryMode(mode);
      setQueueSummary(queue);
      setSyncPreview(preview);
      setConflictSummary(conflictInfo);
      setConflicts(conflictRows);
      if (selectedConflictId && !conflictRows.some((row) => row.id === selectedConflictId)) {
        setSelectedConflictId("");
      }

      if (showSuccessMessage) {
        message.success("Preview offline sync berhasil dimuat.");
      }
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal memuat panel offline sync.");
    } finally {
      setLoading(false);
    }
  }, [selectedConflictId]);

  const handleEnsureFoundation = useCallback(async () => {
    try {
      setLoading(true);
      const status = await ensureLocalDbFoundationMeta();
      setFoundationStatus(status);
      message.success("Foundation local DB siap.");
      await loadPanelData(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menyiapkan foundation local DB.");
    } finally {
      setLoading(false);
    }
  }, [loadPanelData]);

  const handleEnableOfflinePilot = useCallback(async () => {
    try {
      setLoading(true);
      await setRepositoryModeForDevelopment("offline_local", {
        confirmation: modeConfirmation,
        reason: "Testing offline repository pilot dari Reset Maintenance dev panel.",
      });
      message.success("Mode offline repository pilot aktif untuk testing developer.");
      await loadPanelData(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal mengaktifkan offline repository pilot.");
    } finally {
      setLoading(false);
    }
  }, [loadPanelData, modeConfirmation]);

  const handleResetMode = useCallback(async () => {
    try {
      setLoading(true);
      await resetRepositoryModeToFirebasePrimary();
      setModeConfirmation("");
      message.success("Mode repository dikembalikan ke Firebase primary.");
      await loadPanelData(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal reset mode repository.");
    } finally {
      setLoading(false);
    }
  }, [loadPanelData]);

  const handleManualSync = useCallback(async () => {
    try {
      setSyncing(true);
      const result = await syncPendingMasterDataToFirebase({
        confirmation: syncConfirmation,
        limit: 25,
        allowDeletes: false,
      });
      setSyncResult(result);
      message.success(`Manual sync selesai. Sukses: ${result.synced || 0}, konflik: ${result.conflict || 0}, gagal: ${result.failed || 0}.`);
      await loadPanelData(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Manual sync gagal dijalankan.");
    } finally {
      setSyncing(false);
    }
  }, [loadPanelData, syncConfirmation]);


  const handleResolveConflict = useCallback(async () => {
    if (!selectedConflictId) {
      message.warning("Pilih konflik yang akan di-resolve terlebih dahulu.");
      return;
    }

    try {
      setResolvingConflict(true);
      await resolveMasterDataSyncConflict(selectedConflictId, {
        resolution: conflictResolution,
        confirmation: conflictResolutionConfirmation,
        note: conflictResolutionNote,
        actorLabel: "Reset Maintenance Offline Sync Dev Panel",
      });
      message.success("Konflik sync berhasil diproses.");
      setSelectedConflictId("");
      setConflictResolutionConfirmation("");
      setConflictResolutionNote("");
      await loadPanelData(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal resolve konflik sync.");
    } finally {
      setResolvingConflict(false);
    }
  }, [
    conflictResolution,
    conflictResolutionConfirmation,
    conflictResolutionNote,
    loadPanelData,
    selectedConflictId,
  ]);

  const previewRows = useMemo(() => syncPreview?.rows || [], [syncPreview]);
  const conflictRows = useMemo(() => conflicts || [], [conflicts]);

  return (
    <Card
      title="Offline Sync Dev Panel"
      size="small"
      extra={<Tag color="blue">Dev Guarded</Tag>}
    >
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          message="Panel ini hanya untuk pilot offline master data rendah risiko."
          description="Firebase tetap source utama. Panel ini tidak auto-sync, tidak menyentuh stock, purchase, sales, finance, production, payroll, HPP, atau reset destructive. Supplier sync ke Firebase masih diblokir."
        />

        <Space wrap>
          <Button icon={<SafetyOutlined />} loading={loading} onClick={handleEnsureFoundation}>
            Siapkan Local DB
          </Button>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadPanelData(true)}>
            Refresh Preview
          </Button>
        </Space>

        <Row gutter={[8, 8]}>
          <Col xs={12} md={6}>
            <Statistic title="Local DB Ready" value={foundationStatus?.ready ? "Ya" : "-"} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Mode Repository" value={repositoryMode?.mode || "firebase_primary"} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Queue Pending" value={queueSummary?.byStatus?.pending || 0} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Konflik Aktif" value={conflictSummary?.unresolved || 0} />
          </Col>
        </Row>

        <Card size="small" title="Mode repository pilot" extra={<Tag color="gold">Manual</Tag>}>
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <Text type="secondary">
              Untuk testing offline repository, ketik keyword konfirmasi. Jangan dipakai untuk transaksi aktif.
            </Text>
            <Input
              value={modeConfirmation}
              onChange={(event) => setModeConfirmation(event.target.value)}
              placeholder={OFFLINE_REPOSITORY_PILOT_CONFIRMATION}
              allowClear
            />
            <Space wrap>
              <Button
                icon={<ExperimentOutlined />}
                loading={loading}
                onClick={handleEnableOfflinePilot}
              >
                Aktifkan Offline Pilot
              </Button>
              <Button loading={loading} onClick={handleResetMode}>
                Kembali ke Firebase Primary
              </Button>
            </Space>
          </Space>
        </Card>

        <Card size="small" title="Preview manual sync" extra={<Tag color="purple">Categories / Customers</Tag>}>
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <Row gutter={[8, 8]}>
              <Col xs={8}>
                <Statistic title="Queue" value={syncPreview?.summary?.total || 0} />
              </Col>
              <Col xs={8}>
                <Statistic title="Bisa Sync" value={syncPreview?.summary?.syncable || 0} />
              </Col>
              <Col xs={8}>
                <Statistic title="Diblokir" value={syncPreview?.summary?.blocked || 0} />
              </Col>
            </Row>

            <Table
              className="app-data-table"
              size="small"
              rowKey="queueId"
              pagination={{ pageSize: 5, hideOnSinglePage: true }}
              dataSource={previewRows}
              columns={[
                {
                  title: "Collection",
                  dataIndex: "collectionName",
                  key: "collectionName",
                  width: 120,
                },
                {
                  title: "Operasi",
                  dataIndex: "operation",
                  key: "operation",
                  width: 90,
                  render: (value) => <Tag>{value}</Tag>,
                },
                {
                  title: "Status",
                  dataIndex: "syncStatus",
                  key: "syncStatus",
                  width: 100,
                  render: renderStatusTag,
                },
                {
                  title: "Dokumen",
                  dataIndex: "documentId",
                  key: "documentId",
                  render: (value) => compactText(value, 34),
                },
                {
                  title: "Guard",
                  dataIndex: "blockedReason",
                  key: "blockedReason",
                  render: (value, record) => (
                    record.canSync ? <Tag color="green">Siap</Tag> : <Text type="danger">{compactText(value, 70)}</Text>
                  ),
                },
              ]}
              scroll={{ x: 760 }}
            />

            <Alert
              type="warning"
              showIcon
              message="Manual sync butuh keyword dan tidak mengizinkan delete Firebase."
              description={`Ketik "${MASTER_DATA_SYNC_CONFIRMATION}" untuk menjalankan sync. Delete queue akan ditolak karena destructive.`}
            />
            <Input
              value={syncConfirmation}
              onChange={(event) => setSyncConfirmation(event.target.value)}
              placeholder={MASTER_DATA_SYNC_CONFIRMATION}
              allowClear
            />
            <Button
              danger
              icon={<CloudSyncOutlined />}
              loading={syncing}
              disabled={!previewRows.length}
              onClick={handleManualSync}
            >
              Sync Manual ke Firebase
            </Button>

            {syncResult && (
              <Alert
                type={syncResult.failed || syncResult.conflict ? "warning" : "success"}
                showIcon
                message={`Hasil sync: ${syncResult.synced || 0} sukses, ${syncResult.conflict || 0} konflik, ${syncResult.failed || 0} gagal.`}
                description="Lihat ulang preview setelah sync. Item konflik masuk sync_conflicts lokal dan tidak dioverwrite otomatis."
              />
            )}
          </Space>
        </Card>

        {Boolean(conflictRows.length) && (
          <>
            <Divider style={{ margin: "4px 0" }} />
            <Card size="small" title="Konflik sync belum selesai" extra={<Tag color="volcano">Manual review</Tag>}>
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                <Table
                  className="app-data-table"
                  size="small"
                  rowKey="id"
                  pagination={{ pageSize: 5, hideOnSinglePage: true }}
                  dataSource={conflictRows}
                  columns={[
                    { title: "Collection", dataIndex: "collectionName", key: "collectionName", width: 120 },
                    { title: "Dokumen", dataIndex: "documentId", key: "documentId", render: (value) => compactText(value, 34) },
                    { title: "Jenis", dataIndex: "conflictType", key: "conflictType", render: (value) => <Tag color="volcano">{value}</Tag> },
                    { title: "Pesan", dataIndex: "message", key: "message", render: (value) => compactText(value, 90) },
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
                  ]}
                  scroll={{ x: 860 }}
                />

                <Alert
                  type="warning"
                  showIcon
                  message="Resolve conflict tetap guarded. Gunakan local_wins/remote_wins hanya setelah membandingkan data."
                  description={`Keyword wajib: ${MASTER_DATA_CONFLICT_RESOLUTION_CONFIRMATION}. Delete conflict hanya boleh mark_skipped.`}
                />

                <Row gutter={[8, 8]}>
                  <Col xs={24} md={8}>
                    <Input value={selectedConflictId} placeholder="Conflict ID terpilih" readOnly />
                  </Col>
                  <Col xs={24} md={8}>
                    <Select
                      value={conflictResolution}
                      onChange={setConflictResolution}
                      style={{ width: "100%" }}
                      options={Object.values(MASTER_DATA_CONFLICT_RESOLUTIONS).map((value) => ({
                        label: value,
                        value,
                      }))}
                    />
                  </Col>
                  <Col xs={24} md={8}>
                    <Input
                      value={conflictResolutionConfirmation}
                      onChange={(event) => setConflictResolutionConfirmation(event.target.value)}
                      placeholder={MASTER_DATA_CONFLICT_RESOLUTION_CONFIRMATION}
                      allowClear
                    />
                  </Col>
                </Row>
                <Input.TextArea
                  value={conflictResolutionNote}
                  onChange={(event) => setConflictResolutionNote(event.target.value)}
                  placeholder="Catatan review konflik sebelum resolve"
                  autoSize={{ minRows: 2, maxRows: 4 }}
                />
                <Button
                  danger
                  loading={resolvingConflict}
                  disabled={!selectedConflictId}
                  onClick={handleResolveConflict}
                >
                  Resolve Konflik Terpilih
                </Button>
              </Space>
            </Card>
          </>
        )}
      </Space>
    </Card>
  );
};

export default OfflineSyncDevPanel;
