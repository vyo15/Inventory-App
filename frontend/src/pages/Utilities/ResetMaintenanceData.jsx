import { Suspense, lazy, useMemo } from "react";
import { Card, Space, Tabs, Tag, Typography } from "antd";
import PageHeader from "../../components/Layout/Page/PageHeader";
import ImsNotice from "../../components/Layout/Feedback/ImsNotice";
import useAuth from "../../hooks/useAuth";
import useResetMaintenanceAudits from "./hooks/useResetMaintenanceAudits";
import useResetMaintenanceRepairs from "./hooks/useResetMaintenanceRepairs";
import useMasterDataExport from "./hooks/useMasterDataExport";
import {
  buildActorLabel,
  renderCompactText,
} from "./utils/resetMaintenanceUiHelpers";
import OfflineDevPanelErrorBoundary from "./components/OfflineDevPanelErrorBoundary";
import ResetStatusSummaryCard from "./components/ResetStatusSummaryCard";
import "./ResetMaintenanceData.css";

const { Text } = Typography;

const ResetAutoDetectPanel = lazy(() => import("./components/ResetAutoDetectPanel"));
const ResetExportPanel = lazy(() => import("./components/ResetExportPanel"));
const ResetSafeRepairPanel = lazy(() => import("./components/ResetSafeRepairPanel"));
const ResetUsageGuidePanel = lazy(() => import("./components/ResetUsageGuidePanel"));
const OfflineDatabaseCenter = lazy(() => import("./components/OfflineDatabaseCenter"));
const MaintenanceChecklistPanel = lazy(() => import("./components/MaintenanceChecklistPanel"));
const MaintenanceHistoryPanel = lazy(() => import("./components/MaintenanceHistoryPanel"));

const ResetPanelRuntime = (
  <Card size="small" loading className="reset-maintenance-lazy-panel" />
);

const renderLazyResetPanel = (children) => (
  <Suspense fallback={ResetPanelRuntime}>{children}</Suspense>
);

const ResetMaintenanceData = () => {
  const { authUser, profile } = useAuth();
  const maintenanceActor = useMemo(
    () => buildActorLabel({ profile, authUser }),
    [authUser, profile],
  );

  const {
    loadingMasterExportPreview,
    loadingMasterExport,
    masterExportPreview,
    lastMasterExport,
    handleLoadMasterExportPreview,
    handleDownloadMasterExport,
  } = useMasterDataExport();

  const {
    loadingDataQualityAudit,
    handleLoadDataQualityAudit,
    dataQualityCategoryRows,
    autoBugSummary,
  } = useResetMaintenanceAudits();

  const {
    stockReadModelAudit,
    loadingStockReadModelAudit,
    loadingStockReadModelRepair,
    loadingStockReadModelCleanup,
    handleLoadStockReadModelAudit,
    handleRepairStockReadModelAudit,
    handleCleanupStockReadModelOrphans,
  } = useResetMaintenanceRepairs();

  const stockReadModelSummary = stockReadModelAudit?.summary || {};
  const repairCandidateCount = Number(stockReadModelSummary.executablePlanCount || 0);
  const orphanCount = Number(stockReadModelSummary.orphanCount || 0);

  const workspaceTabs = [
    {
      key: "overview",
      label: "Ringkasan",
      children: (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <ResetStatusSummaryCard
            autoBugSummary={{
              ...autoBugSummary,
              safeRepairCount: repairCandidateCount || autoBugSummary.safeRepairCount,
            }}
            maintenanceActor={maintenanceActor}
          />
          {renderLazyResetPanel(<ResetUsageGuidePanel />)}
        </Space>
      ),
    },
    {
      key: "backup-restore",
      label: "Backup & Restore",
      children: (
        <OfflineDevPanelErrorBoundary>
          {renderLazyResetPanel(<OfflineDatabaseCenter />)}
        </OfflineDevPanelErrorBoundary>
      ),
    },
    {
      key: "audit-health",
      label: `Audit & Health${autoBugSummary.issueCount ? ` (${autoBugSummary.issueCount})` : ""}`,
      children: renderLazyResetPanel(
        <ResetAutoDetectPanel
          autoBugSummary={autoBugSummary}
          loadingDataQualityAudit={loadingDataQualityAudit}
          onLoadDataQualityAudit={handleLoadDataQualityAudit}
          dataQualityCategoryRows={dataQualityCategoryRows}
          renderCompactText={renderCompactText}
        />,
      ),
    },
    {
      key: "derived-data-repair",
      label: `Repair Data Turunan${repairCandidateCount + orphanCount ? ` (${repairCandidateCount + orphanCount})` : ""}`,
      children: renderLazyResetPanel(
        <ResetSafeRepairPanel
          loadingStockReadModelAudit={loadingStockReadModelAudit}
          onLoadStockReadModelAudit={handleLoadStockReadModelAudit}
          loadingStockReadModelRepair={loadingStockReadModelRepair}
          onRepairStockReadModelAudit={handleRepairStockReadModelAudit}
          loadingStockReadModelCleanup={loadingStockReadModelCleanup}
          onCleanupStockReadModelOrphans={handleCleanupStockReadModelOrphans}
          stockReadModelAudit={stockReadModelAudit}
          stockReadModelSummary={stockReadModelSummary}
          stockReadModelRows={stockReadModelAudit?.rows || []}
          renderCompactText={renderCompactText}
        />,
      ),
    },
    {
      key: "master-export",
      label: "Export Data Master",
      children: renderLazyResetPanel(
        <ResetExportPanel
          loadingMasterExportPreview={loadingMasterExportPreview}
          onLoadMasterExportPreview={handleLoadMasterExportPreview}
          loadingMasterExport={loadingMasterExport}
          onDownloadMasterExport={handleDownloadMasterExport}
          masterExportPreview={masterExportPreview}
          lastMasterExport={lastMasterExport}
        />,
      ),
    },
    {
      key: "checklist",
      label: "Checklist",
      children: renderLazyResetPanel(<MaintenanceChecklistPanel />),
    },
    {
      key: "history",
      label: "Riwayat",
      children: renderLazyResetPanel(<MaintenanceHistoryPanel />),
    },
  ];

  return (
    <div className="page-container">
      <Card className="content-card">
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          <PageHeader
            title="Maintenance Center"
            subtitle="Backup, restore, pemeriksaan kesehatan data, repair projection stok, export master, checklist, dan riwayat resmi."
          />

          <ImsNotice
            variant="guidance"
            kicker="Operational guidance"
            title="Gunakan urutan Backup → Audit → Repair → Verifikasi"
            description="Menu ini tidak menyediakan reset data operasional atau generator dummy. Testing transaksi harus dilakukan pada database sandbox terpisah, bukan database aktif."
            sideLayout="inline"
            sideItems={[
              { label: "Backup", value: "Guarded", tone: "success" },
              { label: "Audit", value: "Read-only", tone: "success" },
              { label: "Repair", value: "Projection stok", tone: "warning" },
            ]}
          />

          <div className="reset-maintenance-workspace reset-maintenance-workspace-flat">
            <div className="reset-maintenance-toolbar">
              <div className="reset-maintenance-toolbar-main">
                <Space size={8} wrap>
                  <Text strong>Maintenance Workspace</Text>
                  <Tag color="blue">Administrator</Tag>
                </Space>
                <Text type="secondary">
                  Aksi write dibatasi ke backup/restore guarded dan repair data turunan stok dengan backup otomatis.
                </Text>
              </div>
              <Space size={8} wrap className="reset-maintenance-toolbar-status">
                <Tag color={autoBugSummary.issueCount ? "orange" : "green"}>Issue: {autoBugSummary.issueCount || 0}</Tag>
                <Tag color={repairCandidateCount ? "blue" : "default"}>Rebuild: {repairCandidateCount}</Tag>
                <Tag color={orphanCount ? "red" : "default"}>Orphan: {orphanCount}</Tag>
              </Space>
            </div>

            <Tabs
              className="reset-maintenance-tabs"
              defaultActiveKey="overview"
              items={workspaceTabs}
            />
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default ResetMaintenanceData;
