import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Space } from "antd";
import {
  DatabaseOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SafetyOutlined,
  StopOutlined,
} from "@ant-design/icons";
import PageSection from "../../../components/Layout/Page/PageSection";
import SummaryStatGrid from "../../../components/Layout/Display/SummaryStatGrid";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import {
  getSqliteBackendBackups,
  getSqliteBackendStatus,
} from "../../../services/System/sqliteBackendStatusService";
import { formatMaintenanceDate } from "../utils/resetMaintenanceUiHelpers";

const getLatestVerifiedBackup = (backups = []) => backups.find((backup) => (
  ["verified", "success"].includes(String(backup?.status || "").toLowerCase())
  && backup?.fileExists !== false
)) || null;

const ResetStatusSummaryCard = ({ autoBugSummary, hasRepairAudit = false, onNavigate }) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [status, setStatus] = useState(null);
  const [backups, setBackups] = useState([]);

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      const [statusResult, backupResult] = await Promise.all([
        getSqliteBackendStatus(),
        getSqliteBackendBackups(),
      ]);
      setStatus(statusResult?.data || statusResult || null);
      setBackups(backupResult?.data || []);
    } catch (error) {
      console.error("Gagal memuat ringkasan maintenance:", error);
      setErrorMessage(error?.message || "Ringkasan maintenance belum bisa dimuat dari layanan lokal.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const latestBackup = useMemo(
    () => getLatestVerifiedBackup(backups) || status?.latestBackup || null,
    [backups, status?.latestBackup],
  );
  const auditKnown = Boolean(autoBugSummary.hasAuditResult);
  const auditValue = auditKnown
    ? (autoBugSummary.issueCount ? `${autoBugSummary.issueCount} masalah` : "Sehat")
    : "Belum diperiksa";
  const repairKnown = Boolean(hasRepairAudit || autoBugSummary.safeRepairCount);
  const repairValue = repairKnown
    ? (autoBugSummary.safeRepairCount ? `${autoBugSummary.safeRepairCount} kandidat` : "Tidak ada")
    : "Belum diperiksa";

  const summaryItems = [
    {
      key: "service",
      title: "Layanan",
      value: status?.schemaVersion ? "Aktif" : "Perlu diperiksa",
      subtitle: status?.schemaVersion ? "Database lokal siap digunakan" : "Status layanan belum terbaca",
      accent: status?.schemaVersion ? "success" : "warning",
    },
    {
      key: "backup",
      title: "Backup Terakhir",
      value: latestBackup ? "Terverifikasi" : "Belum tersedia",
      subtitle: latestBackup ? formatMaintenanceDate(latestBackup.created_at || latestBackup.manifest?.createdAt) : "Buat backup sebelum maintenance",
      accent: latestBackup ? "success" : "warning",
    },
    {
      key: "audit",
      title: "Audit Data",
      value: auditValue,
      subtitle: auditKnown ? formatMaintenanceDate(autoBugSummary.auditedAt) : "Jalankan audit read-only",
      accent: !auditKnown ? "default" : autoBugSummary.issueCount ? "warning" : "success",
    },
    {
      key: "action",
      title: "Tindakan",
      value: repairValue,
      subtitle: repairKnown ? "Kandidat perbaikan data turunan" : "Periksa data turunan terlebih dahulu",
      accent: !repairKnown ? "default" : autoBugSummary.safeRepairCount ? "warning" : "success",
    },
  ];

  return (
    <PageSection
      className="reset-maintenance-summary-section"
      title="Ringkasan Operasional"
      subtitle="Status utama untuk menentukan langkah berikutnya. Detail teknis tetap tersedia di Backup & Restore."
      extra={(
        <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={loadSummary}>
          Refresh
        </Button>
      )}
    >
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        {errorMessage ? (
          <ImsNotice variant="guard" compact title="Ringkasan belum lengkap" description={errorMessage} />
        ) : null}

        <SummaryStatGrid
          variant="cards"
          className="reset-maintenance-summary-grid"
          gutter={[10, 10]}
          columns={{ xs: 24, sm: 12, lg: 6 }}
          items={summaryItems}
        />

        <div className="reset-maintenance-quick-actions">
          <Button size="small" icon={<DatabaseOutlined />} onClick={() => onNavigate?.("backup-restore")}>Backup & Restore</Button>
          <Button size="small" icon={<SafetyOutlined />} onClick={() => onNavigate?.("health-data", "audit")}>Jalankan Audit</Button>
          <Button size="small" icon={<StopOutlined />} onClick={() => onNavigate?.("inactive-data")}>Data Nonaktif</Button>
          <Button size="small" icon={<HistoryOutlined />} onClick={() => onNavigate?.("history")}>Lihat Riwayat</Button>
        </div>
      </Space>
    </PageSection>
  );
};

export default ResetStatusSummaryCard;
