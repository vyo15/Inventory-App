import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  App as AntdApp,
  Button,
  Input,
  Pagination,
  Segmented,
  Select,
  Space,
  Tag,
  Upload,
  Typography,
} from "antd";
import {
  DownloadOutlined,
  ExclamationCircleOutlined,
  HddOutlined,
  ReloadOutlined,
  SafetyOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import {
  createSqliteBackendBackup,
  createSqliteRestorePlan,
  downloadSqliteBackendBackup,
  executeSqliteRestore,
  getSqliteBackendBackups,
  getSqliteBackendStatus,
  getSqliteModuleRuntimeStatus,
  importSqliteBackendBackup,
  MAINTENANCE_STATUS_CONTRACT_VERSION,
} from "../../../services/System/sqliteBackendStatusService";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import InfoPopoverButton from "../../../components/Layout/Feedback/InfoPopoverButton";
import {
  buildDataCoverageGroups,
  buildRestoreComparisonGroups,
  getBackupCreatedAt,
  isRestorePlanReady,
} from "./restorePreviewHelpers";
import { getBackupTypeLabel } from "../utils/backupUiFormatters";
import { EXTERNAL_COPY_STORAGE_KEY } from "../utils/maintenanceUiConstants";
import {
  BACKUP_PAGE_SIZE,
  IMS_BACKUP_ACCEPT,
  LIVE_STATUS_REFRESH_INTERVAL_MS,
  formatBytes,
  formatDateTime,
  getAgeDays,
  getBackupStatusTone,
  getBackupStorageClass,
  isBackupInPeriod,
  renderSelectedBackupSummary,
} from "./offlineDatabaseCenterPresentation";
import {
  DatabaseCoveragePanel,
  DatabaseTechnicalPanel,
  RestorePreviewPanel,
} from "./OfflineDatabaseCenterPanels";
import "./OfflineDatabaseCenter.css";

const { Text } = Typography;

// =====================================================
// SECTION: OfflineDatabaseCenter — AKTIF / DATABASE CENTER
// Fungsi:
// - Menggantikan UI penyimpanan browser lama dengan pusat kontrol database lokal.
// - Tidak menjalankan sinkronisasi lama, conflict resolver, atau backup penyimpanan browser.
// - Modul guarded stock/purchase/sales/finance/production tetap tidak dimutasi offline.
// =====================================================
const OfflineDatabaseCenter = () => {
  const { message: appMessage, modal } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupImportLoading, setBackupImportLoading] = useState(false);
  const [downloadingBackupFilename, setDownloadingBackupFilename] = useState("");
  const [restorePlanLoading, setRestorePlanLoading] = useState(false);
  const [restoreExecuteLoading, setRestoreExecuteLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [lastStatusUpdatedAt, setLastStatusUpdatedAt] = useState("");
  const [moduleRuntimeStatus, setModuleRuntimeStatus] = useState(null);
  const [restorePlan, setRestorePlan] = useState(null);
  const [backups, setBackups] = useState([]);
  const [selectedBackupFilename, setSelectedBackupFilename] = useState("");
  const [backupTypeFilter, setBackupTypeFilter] = useState("all");
  const [backupPeriodFilter, setBackupPeriodFilter] = useState("all");
  const [backupPage, setBackupPage] = useState(1);
  const [activeCenterPanel, setActiveCenterPanel] = useState("backup");
  const [restoreKeyword, setRestoreKeyword] = useState("");
  const [selectedImportBackupFile, setSelectedImportBackupFile] = useState(null);
  const [externalCopyConfirmedAt, setExternalCopyConfirmedAt] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(EXTERNAL_COPY_STORAGE_KEY) || "";
  });
  const liveStatusRefreshRef = useRef(false);

  const statusData = status?.data || {};
  const backupLifecycle = statusData.backupLifecycle || {};
  const moduleRuntimeData = moduleRuntimeStatus?.data || {};
  const moduleRuntimeModules = moduleRuntimeData.modules || [];
  const moduleRuntimeSummary = moduleRuntimeData.summary || {};
  const isOnline = Boolean(status?.ok);
  const statusContractReady = Number(statusData.maintenanceStatusContractVersion || 0)
    >= MAINTENANCE_STATUS_CONTRACT_VERSION
    && statusData.capabilities?.tableCounts === true
    && statusData.capabilities?.tableRecordStatusCounts === true
    && statusData.capabilities?.realtimeEvents === true
    && statusData.capabilities?.sqliteOnlyRuntime === true;
  const currentTableCounts = statusContractReady ? statusData.tableCounts : null;
  const currentTableRecordStatusCounts = statusContractReady
    ? statusData.tableRecordStatusCounts
    : null;
  const backupTableCounts = restorePlan?.validation?.tables || null;
  const currentCoverageGroups = buildDataCoverageGroups(currentTableCounts, {
    sourceAvailable: statusContractReady,
    tableRecordStatusCounts: currentTableRecordStatusCounts,
  });
  const restoreComparisonGroups = buildRestoreComparisonGroups({
    currentTableCounts,
    backupTableCounts,
    currentAvailable: statusContractReady,
    backupAvailable: Boolean(backupTableCounts),
  });
  const coverageComplete = statusContractReady
    && currentCoverageGroups.every((group) => group.complete);
  const coverageTotal = coverageComplete
    ? currentCoverageGroups.reduce((sum, group) => sum + group.total, 0)
    : null;
  const databaseConsistency = statusData.databaseConsistency || null;
  const latestBackup = backups[0] || statusData.latestBackup || null;
  const filteredBackups = useMemo(() => backups.filter((backup) => {
    const matchesType = backupTypeFilter === "all" || getBackupStorageClass(backup) === backupTypeFilter;
    return matchesType && isBackupInPeriod(backup, backupPeriodFilter);
  }), [backupPeriodFilter, backupTypeFilter, backups]);
  const backupPageCount = Math.max(1, Math.ceil(filteredBackups.length / BACKUP_PAGE_SIZE));
  const paginatedBackups = filteredBackups.slice(
    (backupPage - 1) * BACKUP_PAGE_SIZE,
    backupPage * BACKUP_PAGE_SIZE,
  );
  const backupVisibleStart = filteredBackups.length ? (backupPage - 1) * BACKUP_PAGE_SIZE + 1 : 0;
  const backupVisibleEnd = Math.min(backupPage * BACKUP_PAGE_SIZE, filteredBackups.length);
  const backupTone = getBackupStatusTone(latestBackup);
  const selectedBackup = backups.find((backup) => backup.filename === selectedBackupFilename) || latestBackup;
  const restoreKeywordRequired = statusData.restoreConfirmKeyword || restorePlan?.requiredConfirmKeyword || "RESTORE DATABASE";
  const restoreReady = isRestorePlanReady({
    restorePlan,
    selectedBackupFilename,
    restoreKeyword,
    restoreKeywordRequired,
  });
  const externalCopyAgeDays = externalCopyConfirmedAt ? getAgeDays(externalCopyConfirmedAt) : null;

  useEffect(() => {
    setBackupPage(1);
  }, [backupPeriodFilter, backupTypeFilter]);

  useEffect(() => {
    if (backupPage > backupPageCount) setBackupPage(backupPageCount);
  }, [backupPage, backupPageCount]);

  const applyLiveStatus = useCallback((nextStatus) => {
    setStatus(nextStatus);
    setStatusError(null);
    setLastStatusUpdatedAt(nextStatus?.data?.statusGeneratedAt || new Date().toISOString());
  }, []);

  const refreshLiveStatus = useCallback(async ({ notifyOnError = false } = {}) => {
    if (liveStatusRefreshRef.current) return;
    liveStatusRefreshRef.current = true;
    try {
      applyLiveStatus(await getSqliteBackendStatus());
    } catch (error) {
      console.error("Gagal memperbarui status database realtime:", error);
      setStatusError(error);
      if (error?.code === "SQLITE_STATUS_CONTRACT_MISMATCH") setStatus(null);
      if (notifyOnError) appMessage.error(error?.message || "Status database belum bisa diperbarui.");
    } finally {
      liveStatusRefreshRef.current = false;
    }
  }, [appMessage, applyLiveStatus]);

  const loadCenterData = useCallback(async ({ showSuccess = false } = {}) => {
    setLoading(true);
    try {
      const [statusResult, backupsResult, runtimeResult] = await Promise.allSettled([
        getSqliteBackendStatus(),
        getSqliteBackendBackups(),
        getSqliteModuleRuntimeStatus(),
      ]);
      let successfulRequestCount = 0;

      if (statusResult.status === "fulfilled") {
        applyLiveStatus(statusResult.value);
        successfulRequestCount += 1;
      } else {
        const error = statusResult.reason;
        console.error("Gagal memuat status database:", error);
        setStatusError(error);
        if (error?.code === "SQLITE_STATUS_CONTRACT_MISMATCH") setStatus(null);
      }

      if (backupsResult.status === "fulfilled") {
        const backupRows = backupsResult.value?.data || [];
        setBackups(backupRows);
        setSelectedBackupFilename((previous) => previous || backupRows[0]?.filename || "");
        successfulRequestCount += 1;
      } else {
        console.error("Gagal memuat daftar backup:", backupsResult.reason);
      }

      if (runtimeResult.status === "fulfilled") {
        setModuleRuntimeStatus(runtimeResult.value);
        successfulRequestCount += 1;
      } else {
        console.error("Gagal memuat status modul:", runtimeResult.reason);
      }

      if (successfulRequestCount === 0) {
        throw statusResult.reason || backupsResult.reason || runtimeResult.reason;
      }

      if (showSuccess) {
        if (statusResult.status === "fulfilled") appMessage.success("Status Database Center diperbarui.");
        else appMessage.warning(statusResult.reason?.message || "Data pendukung dimuat, tetapi status database belum tersedia.");
      }
    } catch (error) {
      console.error("Gagal memuat Database Center:", error);
      appMessage.error(error?.message || "Layanan database belum bisa diakses.");
    } finally {
      setLoading(false);
    }
  }, [appMessage, applyLiveStatus]);

  useEffect(() => {
    loadCenterData();
  }, [loadCenterData]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void refreshLiveStatus();
    };
    const timer = window.setInterval(refreshWhenVisible, LIVE_STATUS_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshLiveStatus]);

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const result = await createSqliteBackendBackup({ backupType: "manual" });
      appMessage.success(result?.message || "Backup database berhasil dibuat dan diverifikasi.");
      await loadCenterData();
    } catch (error) {
      appMessage.error(error?.message || "Backup database gagal.");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleMarkExternalCopy = () => {
    const now = new Date().toISOString();
    if (typeof window !== "undefined") window.localStorage.setItem(EXTERNAL_COPY_STORAGE_KEY, now);
    setExternalCopyConfirmedAt(now);
    appMessage.success("Checklist copy backup eksternal ditandai selesai untuk minggu ini.");
  };

  const handleDownloadBackup = async (backup) => {
    if (!backup?.filename) return;
    setDownloadingBackupFilename(backup.filename);
    try {
      const { blob, filename } = await downloadSqliteBackendBackup(backup.filename);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename || backup.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      appMessage.success("File Backup IMS siap disimpan.");
    } catch (error) {
      appMessage.error(error?.message || "Download backup gagal.");
    } finally {
      setDownloadingBackupFilename("");
    }
  };

  const handleImportBackup = async () => {
    if (!selectedImportBackupFile) {
      appMessage.warning("Pilih file backup .imsbackup terlebih dahulu.");
      return;
    }

    setBackupImportLoading(true);
    try {
      const result = await importSqliteBackendBackup(selectedImportBackupFile);
      const importedFilename = result?.data?.filename || "";
      appMessage.success(result?.message || "File Backup IMS berhasil diimport dan diverifikasi.");
      setSelectedImportBackupFile(null);
      setRestorePlan(null);
      setRestoreKeyword("");
      await loadCenterData();
      if (importedFilename) setSelectedBackupFilename(importedFilename);
    } catch (error) {
      appMessage.error(error?.message || "Import File Backup IMS gagal.");
    } finally {
      setBackupImportLoading(false);
    }
  };

  const handleCreateRestorePlan = async () => {
    setRestorePlanLoading(true);
    try {
      const filename = selectedBackupFilename || selectedBackup?.filename || "";
      const result = await createSqliteRestorePlan(filename ? { filename } : {});
      const nextRestorePlan = result?.data || null;
      setRestorePlan(nextRestorePlan);
      if (nextRestorePlan?.validForRestore && !nextRestorePlan?.safeForRestore) {
        appMessage.warning("Backup valid secara teknis, tetapi restore diblokir karena tidak memiliki administrator aktif.");
      } else {
        appMessage.success(result?.message || "Restore preview berhasil dibuat.");
      }
      await loadCenterData();
    } catch (error) {
      appMessage.error(error?.message || "Restore preview gagal dibuat.");
    } finally {
      setRestorePlanLoading(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!restoreReady) {
      const message = restorePlan?.validForRestore && !restorePlan?.safeForRestore
        ? "Restore diblokir karena backup tidak memiliki administrator aktif."
        : "Pilih backup, buat preview aman, lalu ketik keyword konfirmasi dengan benar.";
      appMessage.warning(message);
      return;
    }

    modal.confirm({
      title: "Jalankan restore database?",
      icon: <ExclamationCircleOutlined />,
      content: (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Text>Database aktif akan diganti oleh backup yang dipilih.</Text>
          <Text strong>{selectedBackupFilename}</Text>
          <Text type="secondary">Sistem akan membuat backup pre-restore otomatis sebelum overwrite.</Text>
        </Space>
      ),
      okText: "Restore Sekarang",
      okButtonProps: { danger: true },
      cancelText: "Batal",
      onOk: async () => {
        setRestoreExecuteLoading(true);
        try {
          const result = await executeSqliteRestore({
            filename: selectedBackupFilename,
            confirmKeyword: restoreKeyword,
          });
          appMessage.success(result?.message || "Restore database berhasil dijalankan. Refresh aplikasi bila diperlukan.");
          setRestoreKeyword("");
          setRestorePlan(null);
          await loadCenterData();
        } catch (error) {
          appMessage.error(error?.message || "Restore database gagal dijalankan.");
        } finally {
          setRestoreExecuteLoading(false);
        }
      },
    });
  };

  const coverageTab = (
    <DatabaseCoveragePanel
      coverageComplete={coverageComplete}
      coverageTotal={coverageTotal}
      currentCoverageGroups={currentCoverageGroups}
      databaseConsistency={databaseConsistency}
      lastStatusUpdatedAt={lastStatusUpdatedAt}
      statusError={statusError}
    />
  );

  const backupTab = (
    <Space direction="vertical" size={10} style={{ width: "100%" }}>
      <div className="offline-db-compact-section">
        <div className="offline-db-section-heading">
          <div>
            <Text strong>Backup terbaru</Text>
            <br />
            <Text type="secondary">File terverifikasi yang paling baru tersedia.</Text>
          </div>
          <Space size={6} wrap>
            <Tag color={externalCopyAgeDays !== null && externalCopyAgeDays <= 7 ? "green" : "orange"}>
              {externalCopyConfirmedAt ? "Salinan eksternal tercatat" : "Belum disalin eksternal"}
            </Tag>
            <InfoPopoverButton
              label="Kebijakan"
              title="Kebijakan penyimpanan backup"
              description="Backup lokal tetap berada di laptop server. Simpan salinan terbaru ke media eksternal secara berkala."
              items={[
                { label: "Format", value: "Satu file .imsbackup" },
                { label: "Harian", value: "Disimpan 60 hari" },
                { label: "Bulanan", value: "Disimpan 12 bulan" },
                { label: "Manual", value: "Tidak dihapus otomatis" },
                { label: "Salinan terakhir", value: externalCopyConfirmedAt ? formatDateTime(externalCopyConfirmedAt) : "Belum ditandai" },
              ]}
            />
          </Space>
        </div>
        {latestBackup ? renderSelectedBackupSummary(latestBackup) : (
          <ImsNotice variant="guard" compact title="Belum ada backup database." />
        )}
        <div className="offline-db-backup-copy-action">
          <Text type="secondary">Tandai setelah file terbaru benar-benar disalin ke flashdisk atau harddisk eksternal.</Text>
          <Button size="small" onClick={handleMarkExternalCopy}>Tandai sudah disalin</Button>
        </div>
      </div>

      <div className="offline-db-compact-section">
        <div className="offline-db-section-heading">
          <div>
            <Text strong>Daftar backup</Text>
            <br />
            <Text type="secondary">{filteredBackups.length} backup sesuai filter · menampilkan {backupVisibleStart}-{backupVisibleEnd}</Text>
          </div>
          <Space wrap size={8}>
            <Select
              size="small"
              value={backupTypeFilter}
              onChange={setBackupTypeFilter}
              style={{ minWidth: 140 }}
              options={[
                { value: "all", label: "Semua jenis" },
                { value: "daily", label: "Harian" },
                { value: "monthly", label: "Bulanan" },
                { value: "manual", label: "Manual" },
              ]}
            />
            <Select
              size="small"
              value={backupPeriodFilter}
              onChange={setBackupPeriodFilter}
              style={{ minWidth: 150 }}
              options={[
                { value: "all", label: "Semua periode" },
                { value: "today", label: "Hari ini" },
                { value: "this-week", label: "Minggu ini" },
                { value: "this-month", label: "Bulan ini" },
                { value: "last-month", label: "Bulan lalu" },
              ]}
            />
          </Space>
        </div>
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          {paginatedBackups.map((backup) => (
            <div className="offline-db-backup-list-item" key={backup.id || backup.filename}>
              <div className="offline-db-backup-list-main">
                <Space wrap size={6}>
                  <Text strong>{getBackupTypeLabel(backup.backupType)}</Text>
                  <Tag color={backup.status === "verified" || backup.status === "success" ? "green" : "orange"}>
                    {backup.status === "verified" || backup.status === "success" ? "Terverifikasi" : "Perlu diperiksa"}
                  </Tag>
                </Space>
                <Text type="secondary">{formatDateTime(backup.created_at)} · {formatBytes(backup.size_bytes || backup.sizeBytes)}</Text>
              </div>
              <Space size={6}>
                <InfoPopoverButton
                  label="Info"
                  title="Detail backup"
                  items={[
                    { label: "Nama file", value: backup.filename || "-" },
                    { label: "Schema", value: backup.manifest?.schemaVersion || "-" },
                    { label: "Jenis simpan", value: getBackupStorageClass(backup) },
                  ]}
                />
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  loading={downloadingBackupFilename === backup.filename}
                  onClick={() => handleDownloadBackup(backup)}
                  aria-label={`Download ${backup.filename}`}
                />
              </Space>
            </div>
          ))}
        </Space>
        {!filteredBackups.length ? (
          <ImsNotice
            variant="guard"
            compact
            title={backups.length ? "Tidak ada backup yang cocok dengan filter." : "Belum ada backup database."}
          />
        ) : (
          <Pagination
            className="offline-db-backup-pagination"
            current={backupPage}
            pageSize={BACKUP_PAGE_SIZE}
            total={filteredBackups.length}
            showSizeChanger={false}
            hideOnSinglePage
            onChange={setBackupPage}
          />
        )}
      </div>
    </Space>
  );

  const statusTechnicalTab = (
    <DatabaseTechnicalPanel
      backupLifecycle={backupLifecycle}
      databaseConsistency={databaseConsistency}
      isOnline={isOnline}
      loading={loading}
      moduleRuntimeModules={moduleRuntimeModules}
      moduleRuntimeSummary={moduleRuntimeSummary}
      onRefresh={() => loadCenterData({ showSuccess: true })}
      statusContractReady={statusContractReady}
      statusData={statusData}
    />
  );

  const restoreTab = (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <div className="offline-db-restore-step">
        <div className="offline-db-step-marker">1</div>
        <div className="offline-db-step-content">
          <div className="offline-db-section-heading">
            <Text strong>Import File Backup IMS</Text>
            <Text type="secondary">Opsional jika backup berasal dari flashdisk/komputer lama.</Text>
          </div>
          <Text type="secondary">
            Import hanya mendaftarkan dan memvalidasi file. Data belum berubah sampai tombol Restore Database dijalankan.
          </Text>
          <Space wrap className="offline-db-step-actions">
            <Upload
              accept={IMS_BACKUP_ACCEPT}
              maxCount={1}
              beforeUpload={(file) => {
                setSelectedImportBackupFile(file);
                return false;
              }}
              onRemove={() => setSelectedImportBackupFile(null)}
              fileList={selectedImportBackupFile ? [selectedImportBackupFile] : []}
            >
              <Button icon={<UploadOutlined />}>Pilih File Backup IMS</Button>
            </Upload>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={backupImportLoading}
              disabled={!selectedImportBackupFile}
              onClick={handleImportBackup}
            >
              Import & Validasi
            </Button>
          </Space>
        </div>
      </div>

      <div className="offline-db-restore-step">
        <div className="offline-db-step-marker">2</div>
        <div className="offline-db-step-content">
          <div className="offline-db-section-heading">
            <Text strong>Pilih backup & preview</Text>
            <Button type="primary" icon={<SafetyOutlined />} loading={restorePlanLoading} onClick={handleCreateRestorePlan} disabled={!backups.length}>
              Preview Restore
            </Button>
          </div>
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <Select
              showSearch
              style={{ width: "100%" }}
              placeholder="Pilih backup resmi"
              value={selectedBackupFilename || undefined}
              onChange={(value) => {
                setSelectedBackupFilename(value);
                setRestorePlan(null);
                setRestoreKeyword("");
              }}
              options={backups.map((backup) => ({
                value: backup.filename,
                label: `${getBackupTypeLabel(backup.backupType)} - ${formatDateTime(getBackupCreatedAt(backup))} - ${backup.status || "unknown"}`,
              }))}
            />
            {renderSelectedBackupSummary(selectedBackup)}

            <RestorePreviewPanel
              restoreComparisonGroups={restoreComparisonGroups}
              restorePlan={restorePlan}
            />
          </Space>
        </div>
      </div>

      <div className="offline-db-restore-step offline-db-restore-step-danger">
        <div className="offline-db-step-marker">3</div>
        <div className="offline-db-step-content">
          <ImsNotice
            variant="critical"
            compact
            title="Restore akan mengganti database aktif."
            description="Gunakan hanya jika yakin. Sistem akan membuat backup pre-restore otomatis sebelum overwrite. Setelah berhasil, refresh aplikasi dan login ulang bila perlu."
          />
          <Text>Ketik keyword konfirmasi:</Text>
          <Input
            value={restoreKeyword}
            onChange={(event) => setRestoreKeyword(event.target.value)}
            placeholder={restoreKeywordRequired}
            disabled={!restorePlan?.safeForRestore}
          />
          <Button danger type="primary" loading={restoreExecuteLoading} disabled={!restoreReady} onClick={handleExecuteRestore}>
            Restore Database
          </Button>
        </div>
      </div>
    </Space>
  );


  const centerPanels = {
    backup: backupTab,
    restore: restoreTab,
    coverage: coverageTab,
    status: statusTechnicalTab,
  };

  return (
    <div className="offline-db-center">
      <div className="offline-db-center-controls">
        <Segmented
          block
          size="small"
          value={activeCenterPanel}
          onChange={setActiveCenterPanel}
          options={[
            { label: "Backup", value: "backup" },
            { label: "Restore", value: "restore" },
            { label: "Cakupan Data", value: "coverage" },
            { label: "Detail Teknis", value: "status" },
          ]}
        />
        <Space size={6} wrap className="offline-db-center-actions">
          <InfoPopoverButton
            label="Informasi"
            title="Status Backup & Restore"
            description="Informasi status dan kebijakan ditampilkan saat dibutuhkan agar workspace tetap bersih."
            items={[
              { label: "Backup", value: backupTone.text },
              { label: "Database", value: statusContractReady && !statusError ? "Sinkron" : "Perlu diperiksa" },
              { label: "Realtime", value: statusData.realtime?.enabled ? "SSE aktif" : "Fallback refresh" },
              { label: "Diperbarui", value: lastStatusUpdatedAt ? formatDateTime(lastStatusUpdatedAt) : "Belum tersedia" },
            ]}
          />
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => loadCenterData({ showSuccess: true })}
            aria-label="Refresh Backup & Restore"
          />
          {activeCenterPanel === "backup" ? (
            <Button size="small" type="primary" icon={<HddOutlined />} loading={backupLoading} onClick={handleBackup}>
              Buat Backup
            </Button>
          ) : null}
        </Space>
      </div>

      <div className="offline-db-center-content">
        {centerPanels[activeCenterPanel] || backupTab}
      </div>
    </div>
  );
};

export default OfflineDatabaseCenter;
