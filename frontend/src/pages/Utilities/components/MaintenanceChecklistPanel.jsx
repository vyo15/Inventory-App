import { useCallback, useEffect, useMemo, useState } from "react";
import {
  App as AntdApp,
  Button,
  Divider,
  Space,
  Tag,
  Timeline,
  Typography,
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
  getSqliteModuleRuntimeStatus,
} from "../../../services/System/sqliteBackendStatusService";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import StatusTag from "../../../components/Layout/Feedback/StatusTag";
import {
  formatDateTimeId,
  getDateAgeDays,
  isDateToday,
} from "../../../utils/formatters/dateId";
import {
  EXTERNAL_COPY_STORAGE_KEY,
  OTHER_USERS_PAUSED_STORAGE_KEY,
  RESTORE_UNDERSTOOD_STORAGE_KEY,
} from "../utils/maintenanceUiConstants";


const { Text } = Typography;


const formatDateTime = (value) => formatDateTimeId(value, { fallback: value || "-" });
const getAgeDays = getDateAgeDays;
const isToday = isDateToday;

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
  <div className="maintenance-checklist-item">
    <Space direction="vertical" size={6} style={{ width: "100%" }}>
      <Space size={8} wrap>
        <StatusTag icon={getStatusIcon(item.status)} color={getStatusColor(item.status)}>
          {item.statusLabel}
        </StatusTag>
        <Tag color={item.kind === "auto" ? "blue" : "default"}>{item.kind === "auto" ? "Otomatis" : "Manual"}</Tag>
      </Space>
      <Text strong>{item.title}</Text>
      <Text type="secondary">{item.description}</Text>
      {item.extra ? <Text type="secondary">{item.extra}</Text> : null}
      {item.action ? item.action : null}
    </Space>
  </div>
);

const MaintenanceChecklistPanel = () => {
  const { message: appMessage } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [backups, setBackups] = useState([]);
  const [moduleRuntimeStatus, setModuleRuntimeStatus] = useState(null);
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
      const [nextStatus, nextBackups, nextModuleRuntimeStatus] = await Promise.all([
        getSqliteBackendStatus(),
        getSqliteBackendBackups(),
        getSqliteModuleRuntimeStatus(),
      ]);
      setStatus(nextStatus);
      setBackups(nextBackups?.data || []);
      setModuleRuntimeStatus(nextModuleRuntimeStatus);
      if (showSuccess) appMessage.success("Checklist maintenance berhasil diperbarui.");
    } catch (error) {
      console.error("Gagal memuat checklist maintenance:", error);
      appMessage.error(error?.message || "Checklist maintenance belum bisa dimuat dari layanan database lokal.");
      setStatus(null);
      setBackups([]);
      setModuleRuntimeStatus(null);
    } finally {
      setLoading(false);
    }
  }, [appMessage]);

  useEffect(() => {
    loadChecklist();
  }, [loadChecklist]);

  const markManual = useCallback((storageKey, setter, successMessage) => {
    const now = new Date().toISOString();
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey, now);
    setter(now);
    appMessage.success(successMessage);
  }, [appMessage]);

  const statusData = useMemo(() => status?.data || {}, [status]);
  const backupPolicy = useMemo(() => statusData.backupPolicy || {}, [statusData.backupPolicy]);
  const backupLifecycle = useMemo(() => statusData.backupLifecycle || {}, [statusData.backupLifecycle]);
  const latestBackup = backups[0] || statusData.latestBackup || null;
  const latestVerifiedBackup = backups.find(isVerifiedBackup) || (isVerifiedBackup(latestBackup) ? latestBackup : null);
  const verifiedBackupToday = backups.find((backup) => isToday(backup.created_at) && isVerifiedBackup(backup));
  const dailyBackupToday = backups.find((backup) => backup.backupType === "daily" && isToday(backup.created_at) && isVerifiedBackup(backup));
  const externalCopyAgeDays = externalCopyConfirmedAt ? getAgeDays(externalCopyConfirmedAt) : null;
  const otherUsersPausedAgeDays = otherUsersPausedAt ? getAgeDays(otherUsersPausedAt) : null;
  const restoreUnderstoodAgeDays = restoreUnderstoodAt ? getAgeDays(restoreUnderstoodAt) : null;
  const moduleRuntimeSummary = moduleRuntimeStatus?.data?.summary || {};
  const moduleRuntimeTotal = Number(moduleRuntimeSummary.total || 0);
  const moduleRuntimeKnown = moduleRuntimeTotal > 0;
  const moduleRuntimeReady = Number(moduleRuntimeSummary.runtime_ready ?? (Number(moduleRuntimeSummary.sqlite_active || 0) + Number(moduleRuntimeSummary.guarded || 0)));
  const moduleRuntimeNotReady = Number(moduleRuntimeSummary.not_ready || 0);

  const autoItems = useMemo(() => [
    {
      key: "local-service-active",
      kind: "auto",
      status: statusData.dbPath ? "done" : "failed",
      statusLabel: statusData.dbPath ? "Sesuai" : "Belum sesuai",
      title: "Layanan lokal aktif",
      description: "Status dibaca dari layanan maintenance aplikasi.",
      extra: statusData.dbPath ? `Versi DB ${statusData.schemaVersion || "unknown"}` : "Status database lokal belum terbaca.",
    },
    {
      key: "backup-format",
      kind: "auto",
      status: statusData.backupFormat && backupPolicy.verifyChecksum && backupPolicy.verifyIntegrityCheck ? "done" : "pending",
      statusLabel: statusData.backupFormat && backupPolicy.verifyChecksum && backupPolicy.verifyIntegrityCheck ? "Sesuai" : "Perlu cek",
      title: "Format backup resmi aktif",
      description: "Backup memakai satu file .imsbackup self-contained dengan manifest, checksum, dan integrity check internal.",
      extra: statusData.backupFormat || "Format backup belum terbaca dari layanan lokal.",
    },
    {
      key: "backup-today",
      kind: "auto",
      status: verifiedBackupToday ? "done" : "pending",
      statusLabel: verifiedBackupToday ? "Sesuai" : "Perlu backup",
      title: "Backup verified hari ini tersedia",
      description: "Checklist otomatis terisi jika ada backup hari ini yang file-nya ada dan statusnya verified/success.",
      extra: verifiedBackupToday ? verifiedBackupToday.filename : "Buat backup manual atau tunggu pemeriksaan siklus backup otomatis berikutnya.",
    },
    {
      key: "daily-backup",
      kind: "auto",
      status: dailyBackupToday ? "done" : "pending",
      statusLabel: dailyBackupToday ? "Sesuai" : "Menunggu auto daily",
      title: "Auto backup harian hari ini tersedia",
      description: "Auto daily diperiksa saat layanan start dan berkala selama layanan hidup, tanpa membuat backup dobel pada hari yang sama.",
      extra: dailyBackupToday ? formatDateTime(dailyBackupToday.created_at) : "Belum ada backup type daily yang verified hari ini.",
    },
    {
      key: "backup-retention-policy",
      kind: "auto",
      status: backupPolicy.autoDaily
        && backupPolicy.autoMonthlyPromotion
        && backupPolicy.autoRetention
        && Number(backupPolicy.dailyRetentionDays) === 60
        && Number(backupPolicy.monthlyRetentionCount) === 12
        && backupPolicy.manualAutoDelete === false
        ? "done"
        : "pending",
      statusLabel: backupPolicy.autoDaily
        && backupPolicy.autoMonthlyPromotion
        && backupPolicy.autoRetention
        && Number(backupPolicy.dailyRetentionDays) === 60
        && Number(backupPolicy.monthlyRetentionCount) === 12
        && backupPolicy.manualAutoDelete === false
        ? "Sesuai"
        : "Perlu cek",
      title: "Retensi daily, monthly, dan manual aktif",
      description: "Daily disimpan 60 hari, monthly maksimal 12 bulan, dan manual tidak dihapus otomatis.",
      extra: backupLifecycle.schedulerActive
        ? `Scheduler aktif. Pemeriksaan berikutnya: ${formatDateTime(backupLifecycle.nextRunAt)}.`
        : "Scheduler lifecycle tidak aktif; auto monthly dan retensi belum berjalan.",
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
      key: "legacy-bearer-retired",
      kind: "auto",
      status: statusData.authCompatibility?.legacyBearerEnabled === false ? "done" : "pending",
      statusLabel: statusData.authCompatibility?.legacyBearerEnabled === false ? "Sesuai" : "Masa transisi",
      title: "Compatibility Bearer lama sudah dinonaktifkan",
      description: "Cookie HttpOnly menjadi jalur session utama. Bearer lama baru boleh dimatikan setelah seluruh perangkat login ulang dan dikonfirmasi manual.",
      extra: statusData.authCompatibility?.legacyBearerEnabled === false
        ? "Bearer lama sudah ditolak backend; session cookie tetap aktif."
        : (() => {
          const evidence = statusData.authCompatibility?.migrationEvidence || {};
          const latest = evidence.latestMigrationAt ? formatDateTime(evidence.latestMigrationAt) : "belum tercatat";
          return `Migrasi terdeteksi: ${Number(evidence.totalMigrations || 0)} kali; 7 hari terakhir: ${Number(evidence.recentMigrations7d || 0)}; terakhir: ${latest}. Tetap konfirmasi semua laptop/HP sebelum mematikan flag.`;
        })(),
    },
    {
      key: "database-queue",
      kind: "auto",
      status: statusData.databaseQueue && Number(statusData.databaseQueue.queued || 0) <= 5 ? "done" : "pending",
      statusLabel: statusData.databaseQueue && Number(statusData.databaseQueue.queued || 0) <= 5 ? "Sesuai" : "Perlu cek",
      title: "Antrean database terpantau",
      description: "Semua read/write SQLite memakai coordinator FIFO; status ini menampilkan antrean dan operasi lambat tanpa membuka payload bisnis.",
      extra: statusData.databaseQueue
        ? `Antre ${Number(statusData.databaseQueue.queued || 0)} • maksimum ${Number(statusData.databaseQueue.maxQueueDepth || 0)} • slow wait ${Number(statusData.databaseQueue.slowWaitCount || 0)} • slow operation ${Number(statusData.databaseQueue.slowOperationCount || 0)}`
        : "Telemetry antrean database belum terbaca.",
    },
    {
      key: "structured-logging",
      kind: "auto",
      status: statusData.logging?.structured ? "done" : "pending",
      statusLabel: statusData.logging?.structured ? "Sesuai" : "Perlu cek",
      title: "Structured logging dan retention aktif",
      description: "Request, error, dan operasi database lambat dicatat sebagai JSON tanpa payload transaksi.",
      extra: statusData.logging?.structured
        ? `File log ${statusData.logging.fileLoggingEnabled ? "aktif" : "nonaktif"} • retensi ${Number(statusData.logging.retentionDays || 0)} hari`
        : "Status logger belum terbaca.",
    },
    {
      key: "module-runtime-known",
      kind: "auto",
      status: moduleRuntimeKnown && moduleRuntimeNotReady === 0 && moduleRuntimeReady === moduleRuntimeTotal ? "done" : "pending",
      statusLabel: moduleRuntimeKnown && moduleRuntimeNotReady === 0 && moduleRuntimeReady === moduleRuntimeTotal ? "Sesuai" : "Perlu cek",
      title: "Status modul aplikasi terbaca",
      description: "Checklist otomatis dari status modul aplikasi yang dinormalisasi layanan lokal.",
      extra: moduleRuntimeKnown ? `${moduleRuntimeReady}/${moduleRuntimeTotal} modul siap` : "Status modul aplikasi belum terbaca.",
    },
  ], [backupLifecycle, backupPolicy, dailyBackupToday, latestVerifiedBackup, moduleRuntimeKnown, moduleRuntimeTotal, moduleRuntimeNotReady, moduleRuntimeReady, statusData, verifiedBackupToday]);

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
      description: "Restore akan mengganti database aktif. Keyword konfirmasi tetap wajib di tab Backup & Restore.",
      extra: restoreUnderstoodAt ? `Terakhir: ${formatDateTime(restoreUnderstoodAt)}` : "Belum dikonfirmasi untuk hari ini.",
      action: (
        <Button size="small" danger onClick={() => markManual(RESTORE_UNDERSTOOD_STORAGE_KEY, setRestoreUnderstoodAt, "Pemahaman dampak restore ditandai.")}>Saya paham dampak restore</Button>
      ),
    },
  ], [externalCopyAgeDays, externalCopyConfirmedAt, markManual, otherUsersPausedAgeDays, otherUsersPausedAt, restoreUnderstoodAgeDays, restoreUnderstoodAt]);

  const autoDoneCount = autoItems.filter((item) => item.status === "done").length;
  const manualDoneCount = manualItems.filter((item) => item.status === "done").length;
  const criticalIssues = autoItems.filter((item) => item.status === "failed").length;
  const summaryItems = [
    { key: "auto", label: "Otomatis Sesuai", value: `${autoDoneCount} / ${autoItems.length}`, icon: <SafetyOutlined /> },
    { key: "manual", label: "Manual Selesai", value: `${manualDoneCount} / ${manualItems.length}`, icon: <CheckCircleOutlined /> },
    { key: "backup", label: "Backup Verified", value: backups.filter(isVerifiedBackup).length, icon: <HddOutlined /> },
    { key: "critical", label: "Issue Kritis", value: criticalIssues, icon: <CloseCircleOutlined /> },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <ImsNotice
        variant={criticalIssues ? "critical" : autoDoneCount === autoItems.length ? "status" : "guidance"}
        compact
        title={criticalIssues ? "Ada checklist backup/maintenance yang belum aman" : "Checklist otomatis membaca kondisi database saat ini"}
        description="Item auto akan terisi sendiri jika layanan lokal, backup, manifest, checksum, restore guard, dan status modul sudah sesuai. Item manual tetap perlu konfirmasi user karena tidak bisa dibuktikan sistem."
      />

      <div className="maintenance-checklist-summary-grid">
        {summaryItems.map((item) => (
          <div key={item.key} className="maintenance-checklist-summary-item">
            <Text type="secondary">{item.label}</Text>
            <Text strong><Space size={6}>{item.icon}<span>{item.value}</span></Space></Text>
          </div>
        ))}
      </div>

      <div className="maintenance-checklist-section">
        <div className="maintenance-checklist-section-heading">
          <Text strong>Checklist Auto</Text>
          <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={() => loadChecklist({ showSuccess: true })}>Refresh</Button>
        </div>
        <div className="maintenance-checklist-grid">
          {autoItems.map((item) => (
            <div key={item.key}>
              <ChecklistItemCard item={item} />
            </div>
          ))}
        </div>
      </div>

      <div className="maintenance-checklist-section">
        <div className="maintenance-checklist-section-heading">
          <Text strong>Checklist Manual</Text>
        </div>
        <div className="maintenance-checklist-grid">
          {manualItems.map((item) => (
            <div key={item.key}>
              <ChecklistItemCard item={item} />
            </div>
          ))}
        </div>
      </div>

      <div className="maintenance-checklist-section">
        <Text strong>Urutan Aman Saat Restore / Maintenance Besar</Text>
        <Timeline
          items={[
            { color: latestVerifiedBackup ? "green" : "red", children: "Pastikan ada backup verified terbaru." },
            { color: externalCopyAgeDays !== null && externalCopyAgeDays <= 7 ? "green" : "orange", children: "Copy backup verified ke flashdisk/harddisk eksternal." },
            { color: otherUsersPausedAgeDays !== null && otherUsersPausedAgeDays <= 1 ? "green" : "orange", children: "Pastikan user lain tidak sedang input data." },
            { color: "blue", children: "Buka tab Backup & Restore, pilih backup, lalu Preview Restore." },
            { color: restoreUnderstoodAgeDays !== null && restoreUnderstoodAgeDays <= 1 ? "green" : "orange", children: "Pahami dampak restore, lalu ketik keyword konfirmasi hanya jika benar-benar diperlukan." },
          ]}
        />
      </div>

      <Divider style={{ margin: 0 }} />
      <Text type="secondary">
        Catatan: checklist manual disimpan di browser/perangkat yang dipakai. Checklist ini bukan pengganti backup verified, audit log, dan keyword destructive.
      </Text>
    </Space>
  );
};

export default MaintenanceChecklistPanel;
