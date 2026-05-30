import React, { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import { DownloadOutlined, InboxOutlined } from "@ant-design/icons";

import {
  createLocalDbBackupFilename,
  exportLocalDbBackup,
  LOCAL_DB_BACKUP_RESTORE_CONFIRMATION,
  previewLocalDbBackupRestore,
  restoreLocalDbBackupWithGuard,
} from "../../../data/local/localDbBackupService";
import { parseLocalDbBackupJson } from "../../../data/local/localDbBackupValidator";
import { getOfflineDatabaseFoundationStatus } from "../../../data/local/localDbMeta";
import { LOCAL_DB_BACKUP_TABLE_ALLOWLIST } from "../../../data/local/localDbSchema";

const { Dragger } = Upload;

const downloadJson = (payload, filename) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const toTableRows = (recordCounts = {}) =>
  LOCAL_DB_BACKUP_TABLE_ALLOWLIST.map((tableName) => ({
    tableName,
    count: recordCounts?.[tableName] || 0,
  }));

const OfflineLocalDbBackupPanel = () => {
  const [loading, setLoading] = useState(false);
  const [foundation, setFoundation] = useState(null);
  const [backupPayload, setBackupPayload] = useState(null);
  const [preview, setPreview] = useState(null);
  const [restoreResult, setRestoreResult] = useState(null);
  const [form] = Form.useForm();

  const tableRows = useMemo(
    () => toTableRows(preview?.summary?.recordCounts || backupPayload?.recordCounts || {}),
    [backupPayload, preview]
  );

  const refreshFoundation = async () => {
    const status = await getOfflineDatabaseFoundationStatus();
    setFoundation(status);
    return status;
  };

  const handleExportBackup = async () => {
    setLoading(true);
    try {
      const backup = await exportLocalDbBackup();
      setBackupPayload(backup);
      setPreview(previewLocalDbBackupRestore(backup));
      setRestoreResult(null);
      await refreshFoundation();
      downloadJson(backup, createLocalDbBackupFilename());
      message.success("Backup Local DB berhasil dibuat dan diunduh.");
    } catch (error) {
      console.error("Gagal export Local DB backup:", error);
      message.error(error?.message || "Gagal export Local DB backup.");
    } finally {
      setLoading(false);
    }
  };

  const handleBeforeUpload = (file) => {
    setLoading(true);
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const { payload, error } = parseLocalDbBackupJson(String(reader.result || ""));
        if (error || !payload) {
          throw error || new Error("File backup tidak bisa dibaca sebagai JSON.");
        }

        const nextPreview = previewLocalDbBackupRestore(payload);
        setBackupPayload(payload);
        setPreview(nextPreview);
        setRestoreResult(null);

        if (nextPreview.canRestore) {
          message.success("Backup valid. Silakan review preview sebelum restore.");
        } else {
          message.warning("Backup terbaca, tetapi belum valid untuk restore.");
        }
      } catch (error) {
        setBackupPayload(null);
        setPreview({
          canRestore: false,
          valid: false,
          errors: [error?.message || "File backup tidak valid."],
          warnings: [],
          summary: null,
        });
        message.error(error?.message || "File backup tidak valid.");
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setLoading(false);
      message.error("Gagal membaca file backup.");
    };

    reader.readAsText(file);
    return false;
  };

  const handleRestore = async () => {
    if (!backupPayload || !preview?.canRestore) {
      message.warning("Import dan preview backup valid terlebih dahulu.");
      return;
    }

    const values = await form.validateFields();
    setLoading(true);
    try {
      const result = await restoreLocalDbBackupWithGuard(backupPayload, {
        confirmation: values.confirmation,
        clearExisting: values.clearExisting !== false,
      });
      setRestoreResult(result);
      await refreshFoundation();
      form.resetFields(["confirmation"]);
      message.success("Restore Local DB selesai.");
    } catch (error) {
      message.error(error?.message || "Restore Local DB gagal.");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: "Table", dataIndex: "tableName", key: "tableName" },
    { title: "Record", dataIndex: "count", key: "count", width: 120 },
  ];

  return (
    <Card title="Local DB Backup / Restore Guard" size="small">
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <Alert
          type="warning"
          showIcon
          message="Backup/restore ini hanya untuk IndexedDB local foundation."
          description="Restore tidak menyentuh Firebase, stock, purchase, sales, production, payroll, HPP, atau reset destructive. Review preview dan gunakan keyword guard sebelum restore."
        />

        <Space wrap>
          <Button icon={<DownloadOutlined />} loading={loading} onClick={handleExportBackup}>
            Export Local DB Backup
          </Button>
          <Button loading={loading} onClick={refreshFoundation}>Refresh Status</Button>
          <Tag color={foundation?.ready ? "green" : "orange"}>
            Local DB: {foundation?.ready ? "ready" : "belum dicek"}
          </Tag>
          {foundation?.lastBackupExportedAt ? <Tag>Last export: {foundation.lastBackupExportedAt}</Tag> : null}
          {foundation?.lastBackupImportedAt ? <Tag>Last restore: {foundation.lastBackupImportedAt}</Tag> : null}
        </Space>

        <Dragger
          accept="application/json,.json"
          beforeUpload={handleBeforeUpload}
          maxCount={1}
          showUploadList={false}
          disabled={loading}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">Klik atau drag file backup JSON untuk preview restore</p>
          <p className="ant-upload-hint">File harus berasal dari export Local DB IMS Bunga Flanel dan lolos allowlist table foundation.</p>
        </Dragger>

        {preview ? (
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <Space wrap>
              <Tag color={preview.canRestore ? "green" : "red"}>
                {preview.canRestore ? "Preview valid" : "Preview tidak valid"}
              </Tag>
              <Tag>App: {preview.summary?.app || "-"}</Tag>
              <Tag>Type: {preview.summary?.type || "-"}</Tag>
              <Tag>Schema: {preview.summary?.schemaVersion ?? "-"}</Tag>
            </Space>

            {preview.errors?.length ? (
              <Alert type="error" showIcon message="Backup tidak valid" description={preview.errors.join(" • ")} />
            ) : null}
            {preview.warnings?.length ? (
              <Alert type="warning" showIcon message="Warning backup" description={preview.warnings.join(" • ")} />
            ) : null}

            <Table
              size="small"
              rowKey="tableName"
              columns={columns}
              dataSource={tableRows}
              pagination={false}
            />
          </Space>
        ) : null}

        <Form form={form} layout="vertical" initialValues={{ clearExisting: true }}>
          <Form.Item
            name="clearExisting"
            valuePropName="checked"
            extra="Mode aman default: table local foundation dikosongkan dulu lalu diisi dari backup valid."
          >
            <Checkbox>Clear existing local table sebelum restore</Checkbox>
          </Form.Item>
          <Form.Item
            label="Restore confirmation"
            name="confirmation"
            extra={`Ketik ${LOCAL_DB_BACKUP_RESTORE_CONFIRMATION} untuk restore local DB.`}
          >
            <Input placeholder={LOCAL_DB_BACKUP_RESTORE_CONFIRMATION} />
          </Form.Item>
          <Button danger loading={loading} disabled={!preview?.canRestore} onClick={handleRestore}>
            Restore Local DB dari Preview
          </Button>
        </Form>

        {restoreResult ? (
          <Alert
            type="success"
            showIcon
            message="Restore selesai"
            description={
              <Typography.Text>
                Restored table: {(restoreResult.tableNames || []).join(", ") || "-"}
              </Typography.Text>
            }
          />
        ) : null}
      </Space>
    </Card>
  );
};

export default OfflineLocalDbBackupPanel;
