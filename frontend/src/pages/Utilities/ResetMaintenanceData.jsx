import { Suspense, lazy, useState } from "react";
import { Card, Segmented, Tabs, Typography } from "antd";
import PageHeader from "../../components/Layout/Page/PageHeader";
import InfoPopoverButton from "../../components/Layout/Feedback/InfoPopoverButton";
import useResetMaintenanceAudits from "./hooks/useResetMaintenanceAudits";
import useResetMaintenanceRepairs from "./hooks/useResetMaintenanceRepairs";
import useMasterDataExport from "./hooks/useMasterDataExport";
import { renderCompactText } from "./utils/resetMaintenanceUiHelpers";
import OfflineDevPanelErrorBoundary from "./components/OfflineDevPanelErrorBoundary";
import ResetStatusSummaryCard from "./components/ResetStatusSummaryCard";
import "./ResetMaintenanceData.css";

const { Text } = Typography;

const ResetAutoDetectPanel = lazy(() => import("./components/ResetAutoDetectPanel"));
const ResetExportPanel = lazy(() => import("./components/ResetExportPanel"));
const ResetSafeRepairPanel = lazy(() => import("./components/ResetSafeRepairPanel"));
const OfflineDatabaseCenter = lazy(() => import("./components/OfflineDatabaseCenter"));
const MaintenanceChecklistPanel = lazy(() => import("./components/MaintenanceChecklistPanel"));
const MaintenanceHistoryPanel = lazy(() => import("./components/MaintenanceHistoryPanel"));
const MaintenanceInactiveDataPanel = lazy(() => import("./components/MaintenanceInactiveDataPanel"));

const ResetPanelRuntime = (
  <Card size="small" loading className="reset-maintenance-lazy-panel" />
);

const renderLazyResetPanel = (children) => (
  <Suspense fallback={ResetPanelRuntime}>{children}</Suspense>
);

const ResetMaintenanceData = () => {
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("overview");
  const [healthView, setHealthView] = useState("audit");
  const [adminToolView, setAdminToolView] = useState("export");

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
    hasStockReadModelAudit,
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

  const handleNavigate = (tabKey, viewKey) => {
    if (tabKey === "health-data" && viewKey) setHealthView(viewKey);
    if (tabKey === "admin-tools" && viewKey) setAdminToolView(viewKey);
    setActiveWorkspaceTab(tabKey);
  };

  const auditStatusLabel = autoBugSummary.hasAuditResult
    ? (autoBugSummary.issueCount ? `${autoBugSummary.issueCount} masalah` : "Sehat")
    : "Belum diperiksa";
  const repairStatusLabel = hasStockReadModelAudit
    ? (repairCandidateCount ? `${repairCandidateCount} kandidat` : "Tidak ada kandidat")
    : "Belum diperiksa";
  const orphanStatusLabel = hasStockReadModelAudit
    ? (orphanCount ? `${orphanCount} data turunan` : "Tidak ada")
    : "Belum diperiksa";

  const maintenanceInfoItems = [
    { label: "Urutan aman", value: "Backup → Audit → Perbaikan → Verifikasi" },
    { label: "Data operasional", value: "Dinonaktifkan agar histori tetap tersimpan." },
    { label: "Hapus permanen", value: "Hanya dari Data Nonaktif setelah backup dan pemeriksaan referensi." },
    { label: "Status audit", value: auditStatusLabel },
    { label: "Status perbaikan", value: repairStatusLabel },
    { label: "Data tanpa master", value: orphanStatusLabel },
  ];

  const healthPanel = (
    <div className="reset-maintenance-group-panel">
      <div className="reset-maintenance-group-heading">
        <div>
          <Text strong>Kesehatan Data</Text>
          <Text type="secondary">
            Audit hanya membaca data. Perbaikan dibatasi pada data turunan stok dan tetap memakai pengaman.
          </Text>
        </div>
        <Segmented
          block
          value={healthView}
          onChange={setHealthView}
          options={[
            { label: "Audit — Hanya baca", value: "audit" },
            { label: "Perbaikan — Dengan pengaman", value: "repair" },
          ]}
        />
      </div>

      {healthView === "audit" ? renderLazyResetPanel(
        <ResetAutoDetectPanel
          autoBugSummary={autoBugSummary}
          loadingDataQualityAudit={loadingDataQualityAudit}
          onLoadDataQualityAudit={handleLoadDataQualityAudit}
          dataQualityCategoryRows={dataQualityCategoryRows}
          renderCompactText={renderCompactText}
        />,
      ) : renderLazyResetPanel(
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
      )}
    </div>
  );

  const adminToolsPanel = (
    <div className="reset-maintenance-group-panel">
      <div className="reset-maintenance-group-heading">
        <div>
          <Text strong>Alat Admin</Text>
          <Text type="secondary">
            Export dan checklist mendukung verifikasi operasional tanpa mengubah business flow.
          </Text>
        </div>
        <Segmented
          block
          value={adminToolView}
          onChange={setAdminToolView}
          options={[
            { label: "Export Data Master", value: "export" },
            { label: "Checklist", value: "checklist" },
          ]}
        />
      </div>

      {adminToolView === "export" ? renderLazyResetPanel(
        <ResetExportPanel
          loadingMasterExportPreview={loadingMasterExportPreview}
          onLoadMasterExportPreview={handleLoadMasterExportPreview}
          loadingMasterExport={loadingMasterExport}
          onDownloadMasterExport={handleDownloadMasterExport}
          masterExportPreview={masterExportPreview}
          lastMasterExport={lastMasterExport}
        />,
      ) : renderLazyResetPanel(<MaintenanceChecklistPanel />)}
    </div>
  );

  const workspaceTabs = [
    {
      key: "overview",
      label: "Ringkasan",
      children: (
        <ResetStatusSummaryCard
          autoBugSummary={{
            ...autoBugSummary,
            safeRepairCount: repairCandidateCount || autoBugSummary.safeRepairCount,
          }}
          hasRepairAudit={hasStockReadModelAudit}
          onNavigate={handleNavigate}
        />
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
      key: "health-data",
      label: "Kesehatan Data",
      children: healthPanel,
    },
    {
      key: "inactive-data",
      label: "Data Nonaktif",
      children: (
        <OfflineDevPanelErrorBoundary>
          {renderLazyResetPanel(<MaintenanceInactiveDataPanel />)}
        </OfflineDevPanelErrorBoundary>
      ),
    },
    {
      key: "admin-tools",
      label: "Alat Admin",
      children: adminToolsPanel,
    },
    {
      key: "history",
      label: "Riwayat",
      children: renderLazyResetPanel(<MaintenanceHistoryPanel />),
    },
  ];

  return (
    <div className="page-container reset-maintenance-page">
      <div className="reset-maintenance-page-surface">
        <PageHeader
          className="reset-maintenance-page-header"
          title="Maintenance Center"
          subtitle="Pusat backup, audit, perbaikan data turunan, pengelolaan data nonaktif, dan riwayat sistem."
          extra={(
            <InfoPopoverButton
              label="Panduan & Status"
              title="Panduan Maintenance"
              description="Informasi ditampilkan saat dibutuhkan agar workspace tetap ringkas. Audit hanya membaca data; repair dan hapus permanen tetap memakai pengaman."
              items={maintenanceInfoItems}
            />
          )}
        />

        <div className="reset-maintenance-page-body">
          <div className="reset-maintenance-workspace">
            <Tabs
              className="reset-maintenance-tabs"
              size="small"
              animated={false}
              activeKey={activeWorkspaceTab}
              onChange={setActiveWorkspaceTab}
              items={workspaceTabs}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetMaintenanceData;
