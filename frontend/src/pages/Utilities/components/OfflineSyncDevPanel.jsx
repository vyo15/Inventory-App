// =====================================================
// SECTION: OfflineSyncDevPanel — LEGACY-COMPAT / CLEANUP CANDIDATE / NOT MAIN UI
// Fungsi:
// - panel lama untuk development/pilot offline sebelum OfflineDatabaseCenter menjadi UI utama.
// Status:
// - tidak dihapus agar patch lama/branch paralel tidak rusak.
// - jangan jadikan entry utama baru; pakai OfflineDatabaseCenter untuk QA RC.
// Cleanup:
// - hapus hanya setelah audit import/route/manual QA memastikan tidak ada usage aktif.
// =====================================================
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";

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
import {
  FIREBASE_MASTER_DATA_SYNC_CONFIRMATION,
  previewFirebaseMasterDataSync,
  syncPendingMasterDataToFirebase,
} from "../../../data/sync/firebaseMasterDataSyncService";
import {
  getSyncQueueSummary,
  listSyncQueueItems,
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

const COLLECTION_OPTIONS = [
  { label: "Categories", value: "categories" },
  { label: "Customers", value: "customers" },
];

const INITIAL_STATE = {
  foundation: null,
  repository: null,
  queueSummary: null,
  conflictSummary: null,
  syncPreview: null,
};

const statusColor = (status) => {
  if (status === "synced") return "green";
  if (status === "failed") return "red";
  if (status === "conflict") return "orange";
  if (status === "syncing") return "blue";
  return "default";
};

const OfflineSyncDevPanel = () => {
  const [state, setState] = useState(INITIAL_STATE);
  const [queueRows, setQueueRows] = useState([]);
  const [conflictRows, setConflictRows] = useState([]);
  const [selectedConflictId, setSelectedConflictId] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("categories");
  const [resolutionMode, setResolutionMode] = useState(CONFLICT_RESOLUTION_MODES.MARK_SKIPPED);
  const [loading, setLoading] = useState(false);
  const [modeForm] = Form.useForm();
  const [syncForm] = Form.useForm();
  const [resolveForm] = Form.useForm();
  const modeConfirmation = Form.useWatch("confirmation", modeForm) || "";
  const syncConfirmation = Form.useWatch("confirmation", syncForm) || "";
  const resolveConfirmation = Form.useWatch("confirmation", resolveForm) || "";

  const refreshPanel = useCallback(async () => {
    setLoading(true);
    try {
      const [foundation, repository, queueSummary, conflictSummary, queue, conflicts, syncPreview] =
        await Promise.all([
          getOfflineDatabaseFoundationStatus(),
          getRepositoryModeStatus(),
          getSyncQueueSummary(),
          getSyncConflictSummary(),
          listSyncQueueItems({ includeSynced: false }),
          listSyncConflicts({ unresolvedOnly: true }),
          previewFirebaseMasterDataSync({ collectionName: selectedCollection, limit: 25 }),
        ]);

      setState({ foundation, repository, queueSummary, conflictSummary, syncPreview });
      setQueueRows(queue.slice(0, 25));
      setConflictRows(conflicts.slice(0, 25));
    } catch (error) {
      console.error("Gagal refresh Offline Sync Dev Panel:", error);
      message.error(error?.message || "Gagal refresh panel offline sync.");
    } finally {
      setLoading(false);
    }
  }, [selectedCollection]);

  useEffect(() => {
    refreshPanel();
  }, [refreshPanel]);

  const handlePrepareFoundation = async () => {
    setLoading(true);
    try {
      await ensureLocalDbFoundationMeta();
      message.success("Local DB foundation siap.");
      await refreshPanel();
    } catch (error) {
      console.error("Gagal siapkan Local DB:", error);
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
        reason: values.reason,
      });
      message.success("Offline repository pilot aktif untuk dev.");
      modeForm.resetFields();
      await refreshPanel();
    } catch (error) {
      message.error(error?.message || "Gagal mengaktifkan offline repository pilot.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetMode = async () => {
    setLoading(true);
    try {
      await resetRepositoryModeToFirebasePrimary();
      message.success("Repository mode kembali ke firebase_primary.");
      await refreshPanel();
    } catch (error) {
      message.error(error?.message || "Gagal reset repository mode.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    const values = await syncForm.validateFields();
    setLoading(true);
    try {
      const result = await syncPendingMasterDataToFirebase({
        confirmation: values.confirmation,
        collectionName: selectedCollection,
        limit: 10,
      });
      message.success(`Manual sync selesai. Synced: ${result.synced}, conflict: ${result.conflict}, failed: ${result.failed}.`);
      syncForm.resetFields();
      await refreshPanel();
    } catch (error) {
      message.error(error?.message || "Manual Firebase sync gagal.");
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
      message.success("Conflict berhasil diproses.");
      resolveForm.resetFields();
      setSelectedConflictId("");
      await refreshPanel();
    } catch (error) {
      message.error(error?.message || "Resolve conflict gagal.");
    } finally {
      setLoading(false);
    }
  };

  const queueColumns = useMemo(
    () => [
      { title: "Collection", dataIndex: "collectionName", key: "collectionName", width: 120 },
      { title: "Operation", dataIndex: "operation", key: "operation", width: 100 },
      { title: "Document", dataIndex: "documentId", key: "documentId", ellipsis: true },
      {
        title: "Status",
        dataIndex: "syncStatus",
        key: "syncStatus",
        width: 100,
        render: (status) => <Tag color={statusColor(status)}>{status || "pending"}</Tag>,
      },
    ],
    []
  );

  const conflictColumns = useMemo(
    () => [
      { title: "Collection", dataIndex: "collectionName", key: "collectionName", width: 120 },
      { title: "Document", dataIndex: "documentId", key: "documentId", ellipsis: true },
      { title: "Type", dataIndex: "conflictType", key: "conflictType", width: 160 },
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
    ],
    []
  );

  const queuePending = state.queueSummary?.byStatus?.pending || 0;
  const conflictCount = state.conflictSummary?.unresolved || 0;
  const canEnableOfflinePilot = modeConfirmation === OFFLINE_REPOSITORY_PILOT_CONFIRMATION;
  const canRunManualSync = syncConfirmation === FIREBASE_MASTER_DATA_SYNC_CONFIRMATION;
  const canResolveConflict =
    resolveConfirmation === MASTER_DATA_CONFLICT_RESOLUTION_CONFIRMATION &&
    Boolean(selectedConflictId || resolveForm.getFieldValue("conflictId"));

  return (
    <Card title="Offline Sync Dev Panel" size="small">
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          message="Panel ini hanya guarded dev utility untuk pilot offline master data."
          description="Tidak ada auto-sync. Manual sync hanya categories/customers dan tetap butuh keyword. Supplier, stock, transaksi, production, payroll, HPP, dan reset destructive tetap diblokir."
        />

        <Space wrap>
          <Button loading={loading} onClick={handlePrepareFoundation}>Siapkan Local DB</Button>
          <Button loading={loading} onClick={refreshPanel}>Refresh Preview</Button>
          <Button danger loading={loading} onClick={handleResetMode}>Kembali ke Firebase Primary</Button>
          <Tag>Mode: {state.repository?.mode || "firebase_primary"}</Tag>
          <Tag color="blue">Queue pending: {queuePending}</Tag>
          <Tag color={conflictCount ? "orange" : "green"}>Conflict aktif: {conflictCount}</Tag>
        </Space>

        <Form form={modeForm} layout="vertical">
          <Form.Item label="Aktifkan offline repository pilot" name="confirmation" extra={`Ketik ${OFFLINE_REPOSITORY_PILOT_CONFIRMATION} untuk dev test.`}>
            <Input placeholder={OFFLINE_REPOSITORY_PILOT_CONFIRMATION} />
          </Form.Item>
          {modeConfirmation && !canEnableOfflinePilot ? (
            <Alert
              type="warning"
              showIcon
              message="Keyword belum tepat"
              description={`Gunakan keyword lengkap: ${OFFLINE_REPOSITORY_PILOT_CONFIRMATION}`}
            />
          ) : null}
          <Form.Item label="Alasan test" name="reason">
            <Input placeholder="Contoh: test categories offline pilot" />
          </Form.Item>
          <Button loading={loading} disabled={!canEnableOfflinePilot} onClick={handleEnableOfflinePilot}>Aktifkan Offline Pilot</Button>
        </Form>

        <Space wrap>
          <Typography.Text strong>Collection manual sync:</Typography.Text>
          <Select value={selectedCollection} options={COLLECTION_OPTIONS} onChange={setSelectedCollection} style={{ width: 180 }} />
          <Tag>Preview item: {state.syncPreview?.summary?.total || 0}</Tag>
        </Space>

        <Form form={syncForm} layout="vertical">
          <Form.Item label="Manual sync confirmation" name="confirmation" extra={`Ketik ${FIREBASE_MASTER_DATA_SYNC_CONFIRMATION}. Delete Firebase tetap tidak diaktifkan dari panel ini.`}>
            <Input placeholder={FIREBASE_MASTER_DATA_SYNC_CONFIRMATION} />
          </Form.Item>
          <Button type="primary" loading={loading} disabled={!canRunManualSync} onClick={handleManualSync}>Manual Sync Categories/Customers</Button>
        </Form>

        <Table
          size="small"
          rowKey="id"
          columns={queueColumns}
          dataSource={queueRows}
          pagination={{ pageSize: 5 }}
          scroll={{ x: 620 }}
        />

        <Table
          size="small"
          rowKey="id"
          columns={conflictColumns}
          dataSource={conflictRows}
          pagination={{ pageSize: 5 }}
          scroll={{ x: 620 }}
        />

        <Form form={resolveForm} layout="vertical">
          <Form.Item label="Conflict ID" name="conflictId" initialValue={selectedConflictId}>
            <Input value={selectedConflictId} onChange={(event) => setSelectedConflictId(event.target.value)} placeholder="Pilih conflict dari tabel atau paste ID" />
          </Form.Item>
          <Form.Item label="Resolution mode">
            <Select
              value={resolutionMode}
              onChange={setResolutionMode}
              options={[
                { label: "Mark skipped / manual review", value: CONFLICT_RESOLUTION_MODES.MARK_SKIPPED },
                { label: "Local wins", value: CONFLICT_RESOLUTION_MODES.LOCAL_WINS },
                { label: "Remote wins", value: CONFLICT_RESOLUTION_MODES.REMOTE_WINS },
              ]}
            />
          </Form.Item>
          <Form.Item label="Resolution note" name="resolutionNote">
            <Input.TextArea rows={2} placeholder="Catatan review conflict" />
          </Form.Item>
          <Form.Item label="Resolve confirmation" name="confirmation" extra={`Ketik ${MASTER_DATA_CONFLICT_RESOLUTION_CONFIRMATION}.`}>
            <Input placeholder={MASTER_DATA_CONFLICT_RESOLUTION_CONFIRMATION} />
          </Form.Item>
          <Button loading={loading} disabled={!canResolveConflict} onClick={handleResolveConflict}>Resolve Conflict</Button>
        </Form>
      </Space>
    </Card>
  );
};

export default OfflineSyncDevPanel;
