import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Row,
  Space,
  Statistic,
  Tag,
  Timeline,
  Typography,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  HddOutlined,
  ReloadOutlined,
  SafetyOutlined,
} from "@ant-design/icons";

import {
  getSqliteBackendBackups,
  getSqliteBackendStatus,
  getSqliteMigrationStatus,
} from "../../../services/System/sqliteBackendStatusService";

const { Text } = Typography;

const EXTERNAL_COPY_STORAGE_KEY = "ims.sqlite.externalBackupCopyConfirmedAt";
const OTHER_USERS_PAUSED_STORAGE_KEY = "ims.maintenance.otherUsersPausedConfirmedAt";
const RESTORE_UNDERSTOOD_STORAGE_KEY = "ims.maintenance.restoreImpactUnderstoodAt";

const formatDateTime = (value) => {
  if (!value) return "-";
  const normalized = String(value).includes("T") ? String(value) : `${String(value).replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const parseDate = (value) => {
  if (!value) return null;
  const normalized = String(value).includes("T") ? String(value) : `${String(value).replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getAgeDays = (value) => {
  const date = parseDate(value);
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
};

const isToday = (value) => {
  const date = parseDate(value);
  if (!date) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
};

const isVerifiedBackup = (backup) => {
  if (!backup || backup.fileExists === false) return false;
  const manifest = backup.manifest || {};
  const statusOk = ["verified", "success"].includes(String(backup.status || "").toLowerCase());
  const integrityOk = !manifest.integrityCheck || String(manifest.integrityCheck).toLowerCase() === "ok";
  return statusOk && integrityOk;
};

const getStatusIcon = (status) => {
  if (status === "done") return <CheckCircleOutlined />;
  if (status === "failed") return <CloseCircleOutlined />;
  return <ClockCircleOutlined />;
};

const getStatusColor = (status) => {
  if (status === "done") return "green";
  if (status === "failed") return "red";
  return "orange";
};

const ChecklistItemCard = ({ item }) => (
  <Card size="small" className="maintenance-checklist-item">
    <Space direction="vertical" size={6} style={{ width: "100%" }}>
      <Space size={8} wrap>
        <Tag icon={getStatusIcon(item.status)} color={getStatusColor(item.status)}>
          {item.statusLabel}
        </Tag>
        <Tag color={item.kind === "auto" ? "blue" : "purple"}>{item.kind === "auto" ? "Auto" : "Manual"}</Tag>
      </Space>
      <Text strong>{item.title}</Text>
      <Text type="secondary">{item.description}</Text>
      {item.extra ? <Text type="secondary">{item.extra}</Text> : null}
      {item.action ? item.action : null}
    </Space>
  </Card>
);

const MaintenanceChecklistPanel = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [backups, setBackups] = useState([]);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [externalCopyConfirmedAt, setExternalCopyConfirmedAt] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(EXTERNAL_COPY_STORAGE_KEY) || "";
  });
  const [otherUsersPausedAt, setOtherUsersPausedAt] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(OTHER_USERS_PAUSED_STORAGE_KEY) || "";
  });
  const [restoreUnderstoodAt, setRestoreUnderstoodAt] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(RESTORE_UNDERSTOOD_STORAGE_KEY) || "";
  });

  const loadChecklist = useCallback(async ({ showSuccess = false } = {}) => {
    setLoading(true);
    try {
      const [nextStatus, nextBackups, nextMigrationStatus] = await Promise.all([
        getSqliteBackendStatus(),
        getSqliteBackendBackups(),
        getSqliteMigrationStatus(),
      ]);
      setStatus(nextStatus);
      setBackups(nextBackups?.data || []);
      setMigrationStatus(nextMigrationStatus);
      if (showSuccess) message.success("Checklist maintenance berhasil diperbarui.");
    } catch (error) {
      console.error("Gagal memuat checklist maintenance:", error);
      message.error(error?.message || "Checklist maintenance belum bisa dimuat dari backend SQLite.");
      setStatus(null);
      setBackups([]);
      setMigrationStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChecklist();
  }, [loadChecklist]);

  const markManual = (storageKey, setter, successMessage) => {
    const now = new Date().toISOString();
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey, now);
    setter(now);
    message.success(successMessage);
  };

  const statusData = useMemo(() => status?.data || {}, [status]);
  const backupPolicy = useMemo(() => statusData.backupPolicy || {}, [statusData.backupPolicy]);
  const latestBackup = backups[0] || statusData.latestBackup || null;
  const latestVerifiedBackup = backups.find(isVerifiedBackup) || (isVerifiedBackup(latestBackup) ? latestBackup : null);
  const verifiedBackupToday = backups.find((backup) => isToday(backup.created_at) && isVerifiedBackup(backup));
  const dailyBackupToday = backups.find((backup) => backup.backupType === "daily" && isToday(backup.created_at) && isVerifiedBackup(backup));
  const externalCopyAgeDays = externalCopyConfirmedAt ? getAgeDays(externalCopyConfirmedAt) : null;
  const otherUsersPausedAgeDays = otherUsersPausedAt ? getAgeDays(otherUsersPausedAt) : null;
  const restoreUnderstoodAgeDays = restoreUnderstoodAt ? getAgeDays(restoreUnderstoodAt) : null;
  const migrationSummary = migrationStatus?.data?.summary || {};
  const migrationTotal = Number(migrationSummary.total || 0);
  const migrationKnown = migrationTotal > 0;
  const sqliteActiveOrGuarded = Number(migrationSummary.sqlite_active || 0) + Number(migrationSummary.guarded || 0);

  const autoItems = useMemo(() => [
    {
      key: "backend-active",
      kind: "auto",
      status: statusData.dbPath ? "done" : "failed",
      statusLabel: statusData.dbPath ? "Sesuai" : "Belum sesuai",
      title: "Backend SQLite aktif",
      description: "Status dibaca dari endpoint maintenance backend.",
      extra: statusData.dbPath ? `Schema v${statusData.schemaVersion || "unknown"}` : "Backend/status SQLite belum terbaca.",
    },
    {
      key: "backup-format",
      kind: "auto",
      status: statusData.backupFormat && backupPolicy.verifyChecksum && backupPolicy.verifyIntegrityCheck ? "done" : "pending",
      statusLabel: statusData.backupFormat && backupPolicy.verifyChecksum && backupPolicy.verifyIntegrityCheck ? "Sesuai" : "Perlu cek",
      title: "Format backup resmi aktif",
      description: "Backup memakai paket .imsbak.zip dengan manifest, checksum, dan integrity check.",
      extra: statusData.backupFormat || "Format backup belum terbaca dari backend.",
    },
    {
      key: "backup-today",
      kind: "auto",
      status: verifiedBackupToday ? "done" : "pending",
      statusLabel: verifiedBackupToday ? "Sesuai" : "Perlu backup",
      title: "Backup verified hari ini tersedia",
      description: "Checklist otomatis terisi jika ada backup hari ini yang file-nya ada dan statusnya verified/success.",
      extra: verifiedBackupToday ? verifiedBackupToday.filename : "Buat backup manual atau restart backend agar auto daily berjalan.",
    },
    {
      key: "daily-backup",
      kind: "auto",
      status: dailyBackupToday ? "done" : "pending",
      statusLabel: dailyBackupToday ? "Sesuai" : "Menunggu auto daily",
      title: "Auto backup harian hari ini tersedia",
      description: "Auto daily dibuat saat backend start dan tidak dibuat dobel pada hari yang sama.",
      extra: dailyBackupToday ? formatDateTime(dailyBackupToday.created_at) : "Belum ada backup type daily yang verified hari ini.",
    },
    {
      key: "latest-backup-verified",
      kind: "auto",
      status: latestVerifiedBackup ? "done" : "failed",
      statusLabel: latestVerifiedBackup ? "Sesuai" : "Belum aman",
      title: "Backup terakhir valid untuk pemulihan",
      description: "Sistem mengecek status, keberadaan file, dan integrity dari manifest backup.",
      extra: latestVerifiedBackup ? `${latestVerifiedBackup.filename} • ${formatDateTime(latestVerifiedBackup.created_at)}` : "Belum ada backup verified yang bisa dipakai.",
    },
    {
      key: "restore-guarded",
      kind: "auto",
      status: statusData.restoreMode === "guarded_confirm_keyword" && statusData.restoreConfirmKeyword ? "done" : "pending",
      statusLabel: statusData.restoreMode === "guarded_confirm_keyword" && statusData.restoreConfirmKeyword ? "Sesuai" : "Perlu cek",
      title: "Restore guarded aktif",
      description: "Restore wajib lewat preview dan keyword, bukan copy database manual.",
      extra: statusData.restoreConfirmKeyword ? `Keyword: ${statusData.restoreConfirmKeyword}` : "Keyword restore belum terbaca.",
    },
    {
      key: "migration-known",
      kind: "auto",
      status: migrationKnown && sqliteActiveOrGuarded === migrationTotal ? "done" : "pending",
      statusLabel: migrationKnown && sqliteActiveOrGuarded === migrationTotal ? "Sesuai" : "Perlu cek",
      title: "Status modul SQLite terbaca",
      description: "Checklist otomatis dari tabel module_migration_status.",
      extra: migrationKnown ? `${sqliteActiveOrGuarded}/${migrationTotal} modul aktif/guarded` : "Status migrasi modul belum terbaca.",
    },
  ], [backupPolicy.verifyChecksum, backupPolicy.verifyIntegrityCheck, dailyBackupToday, latestVerifiedBackup, migrationKnown, migrationTotal, sqliteActiveOrGuarded, statusData, verifiedBackupToday]);

  const manualItems = useMemo(() => [
    {
      key: "external-copy",
      kind: "manual",
      status: externalCopyAgeDays !== null && externalCopyAgeDays <= 7 ? "done" : "pending",
      statusLabel: externalCopyAgeDays !== null && externalCopyAgeDays <= 7 ? "Sudah" : "Perlu konfirmasi",
      title: "Backup sudah dicopy ke flashdisk/harddisk eksternal",
      description: "Sistem tidak bisa membuktikan copy manual ke media eksternal, jadi tetap perlu tombol konfirmasi user.",
      extra: externalCopyConfirmedAt ? `Terakhir: ${formatDateTime(externalCopyConfirmedAt)}` : "Belum pernah dikonfirmasi.",
      action: (
        <Button size="small" onClick={() => markManual(EXTERNAL_COPY_STORAGE_KEY, setExternalCopyConfirmedAt, "Copy backup eksternal ditandai selesai.")}>Saya sudah copy backup eksternal</Button>
      ),
    },
    {
      key: "other-users-paused",
      kind: "manual",
      status: otherUsersPausedAgeDays !== null && otherUsersPausedAgeDays <= 1 ? "done" : "pending",
      statusLabel: otherUsersPausedAgeDays !== null && otherUsersPausedAgeDays <= 1 ? "Sudah" : "Perlu konfirmasi",
      title: "User lain sudah berhenti input sebelum restore/maintenance besar",
      description: "Sebelum restore/reset/import besar, pastikan HP/laptop lain tidak sedang input transaksi.",
      extra: otherUsersPausedAt ? `Terakhir: ${formatDateTime(otherUsersPausedAt)}` : "Belum dikonfirmasi untuk hari ini.",
      action: (
        <Button size="small" onClick={() => markManual(OTHER_USERS_PAUSED_STORAGE_KEY, setOtherUsersPausedAt, "Konfirmasi user lain berhenti input ditandai.")}>User lain sudah berhenti input</Button>
      ),
    },
    {
      key: "restore-understood",
      kind: "manual",
      status: restoreUnderstoodAgeDays !== null && restoreUnderstoodAgeDays <= 1 ? "done" : "pending",
      statusLabel: restoreUnderstoodAgeDays !== null && restoreUnderstoodAgeDays <= 1 ? "Sudah" : "Perlu konfirmasi",
      title: "Dampak restore sudah dipahami",
      description: "Restore akan mengganti database aktif. Keyword RESTORE SQLITE tetap wajib di tab Backup & Restore.",
      extra: restoreUnderstoodAt ? `Terakhir: ${formatDateTime(restoreUnderstoodAt)}` : "Belum dikonfirmasi untuk hari ini.",
      action: (
        <Button size="small" danger onClick={() => markManual(RESTORE_UNDERSTOOD_STORAGE_KEY, setRestoreUnderstoodAt, "Pemahaman dampak restore ditandai.")}>Saya paham dampak restore</Button>
      ),
    },
  ], [externalCopyAgeDays, externalCopyConfirmedAt, otherUsersPausedAgeDays, otherUsersPausedAt, restoreUnderstoodAgeDays, restoreUnderstoodAt]);

  const autoDoneCount = autoItems.filter((item) => item.status === "done").length;
  const manualDoneCount = manualItems.filter((item) => item.status === "done").length;
  const criticalIssues = autoItems.filter((item) => item.status === "failed").length;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Alert
        type={criticalIssues ? "error" : autoDoneCount === autoItems.length ? "success" : "warning"}
        showIcon
        message={criticalIssues ? "Ada checklist backup/maintenance yang belum aman" : "Checklist otomatis membaca kondisi SQLite saat ini"}
        description="Item auto akan terisi sendiri jika backend, backup, manifest, checksum, restore guard, dan status modul sudah sesuai. Item manual tetap perlu konfirmasi user karena tidak bisa dibuktikan sistem."
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Auto Sesuai" value={autoDoneCount} suffix={`/ ${autoItems.length}`} prefix={<SafetyOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Manual Selesai" value={manualDoneCount} suffix={`/ ${manualItems.length}`} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Backup Verified" value={backups.filter(isVerifiedBackup).length} prefix={<HddOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Issue Kritis" value={criticalIssues} prefix={<CloseCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title="Checklist Auto"
        extra={<Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={() => loadChecklist({ showSuccess: true })}>Refresh</Button>}
      >
        <Row gutter={[12, 12]}>
          {autoItems.map((item) => (
            <Col xs={24} md={12} xl={8} key={item.key}>
              <ChecklistItemCard item={item} />
            </Col>
          ))}
        </Row>
      </Card>

      <Card size="small" title="Checklist Manual">
        <Row gutter={[12, 12]}>
          {manualItems.map((item) => (
            <Col xs={24} md={12} xl={8} key={item.key}>
              <ChecklistItemCard item={item} />
            </Col>
          ))}
        </Row>
      </Card>

      <Card size="small" title="Urutan Aman Saat Restore / Maintenance Besar">
        <Timeline
          items={[
            { color: latestVerifiedBackup ? "green" : "red", children: "Pastikan ada backup verified terbaru." },
            { color: externalCopyAgeDays !== null && externalCopyAgeDays <= 7 ? "green" : "orange", children: "Copy backup verified ke flashdisk/harddisk eksternal." },
            { color: otherUsersPausedAgeDays !== null && otherUsersPausedAgeDays <= 1 ? "green" : "orange", children: "Pastikan user lain tidak sedang input data." },
            { color: "blue", children: "Buka tab Backup & Restore, pilih backup, lalu Preview Restore." },
            { color: restoreUnderstoodAgeDays !== null && restoreUnderstoodAgeDays <= 1 ? "green" : "orange", children: "Pahami dampak restore, lalu ketik keyword RESTORE SQLITE hanya jika benar-benar diperlukan." },
          ]}
        />
      </Card>

      <Divider style={{ margin: 0 }} />
      <Text type="secondary">
        Catatan: checklist manual disimpan di browser/perangkat yang dipakai. Checklist ini bukan pengganti backup verified, audit log, dan keyword destructive.
      </Text>
    </Space>
  );
};

export default MaintenanceChecklistPanel;
