import {
  Alert,
  Card,
  Col,
  Collapse,
  Descriptions,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  DatabaseOutlined,
  SafetyOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import StatusTag from "../../../components/Layout/Feedback/StatusTag";
import InfoPopoverButton from "../../../components/Layout/Feedback/InfoPopoverButton";
import SqliteBackendStatusPanel from "./SqliteBackendStatusPanel";
import {
  LIVE_STATUS_REFRESH_INTERVAL_MS,
  buildCoverageCollapseItems,
  formatDateTime,
  formatNumber,
  getRuntimeScopeLabel,
  getRuntimeStatusLabel,
  renderCoverageSummary,
} from "./offlineDatabaseCenterPresentation";

const { Text } = Typography;

export const DatabaseCoveragePanel = ({
  coverageComplete,
  coverageTotal,
  currentCoverageGroups,
  databaseConsistency,
  lastStatusUpdatedAt,
  statusError,
}) => (
  <Space direction="vertical" size={12} style={{ width: "100%" }}>
    <div className="offline-db-panel-heading">
      <div>
        <Text strong>Cakupan data backup</Text>
        <br />
        <Text type="secondary">Ringkasan record dari database SQLite aktif.</Text>
      </div>
      <InfoPopoverButton
        label="Cara membaca"
        title="Cakupan data backup"
        description="File backup resmi membawa seluruh tabel, termasuk histori dan metadata teknis yang dibutuhkan saat restore."
        items={[
          { label: "Pembaruan", value: `Setiap ${Math.round(LIVE_STATUS_REFRESH_INTERVAL_MS / 1000)} detik saat halaman terlihat` },
          { label: "Angka aktif", value: "Record yang masih dipakai operasional" },
          { label: "Arsip histori", value: "Record nonaktif atau dihapus-logis yang tetap disimpan" },
          { label: "Total", value: "Seluruh record yang tersimpan dalam database" },
        ]}
      />
    </div>

    {statusError?.code === "SQLITE_STATUS_CONTRACT_MISMATCH" ? (
      <Alert
        type="warning"
        showIcon
        message="Frontend dan backend belum satu versi"
        description="Angka nol tidak ditampilkan karena status belum dapat dipercaya. Hentikan layanan dengan Ctrl+C, lalu jalankan kembali npm run dev dari folder project dan klik Refresh."
      />
    ) : statusError ? (
      <Alert
        type="warning"
        showIcon
        message="Pembaruan realtime sementara gagal"
        description="Angka terakhir yang valid tetap dipertahankan. Pastikan layanan lokal aktif, lalu klik Refresh."
      />
    ) : databaseConsistency?.healthy === false ? (
      <Alert
        type="error"
        showIcon
        message="Struktur database perlu diperiksa"
        description={`Ditemukan ${databaseConsistency.missingTables?.length || 0} tabel hilang dan ${databaseConsistency.invalidCountTables?.length || 0} jumlah tabel tidak valid. Jangan jalankan restore atau reset sebelum audit selesai.`}
      />
    ) : coverageComplete ? (
      <ImsNotice
        variant="status"
        compact
        title="Ringkasan database sinkron"
        description={`Terakhir diperbarui ${formatDateTime(lastStatusUpdatedAt)} dari satu database SQLite aktif.`}
      />
    ) : (
      <Alert
        type="warning"
        showIcon
        message="Ringkasan data belum tersedia"
        description="Sistem tidak menganggap data yang belum terbaca sebagai 0. Klik Refresh atau restart layanan lokal untuk memuat status database terbaru."
      />
    )}

    {renderCoverageSummary(currentCoverageGroups)}

    <div className="offline-db-compact-section">
      <div className="offline-db-section-heading">
        <div>
          <Text strong>Detail seluruh data</Text>
          <br />
          <Text type="secondary">
            Data berstatus aktif, nonaktif, dan dihapus-logis dibedakan. Total tersimpan tetap mencakup histori yang dipertahankan.
          </Text>
        </div>
        <Tag color={coverageComplete ? "blue" : "default"}>
          {coverageComplete ? `${formatNumber(coverageTotal)} record` : "Belum tersedia"}
        </Tag>
      </div>
      <Collapse
        size="small"
        className="offline-db-coverage-collapse"
        items={buildCoverageCollapseItems(currentCoverageGroups)}
      />
    </div>
  </Space>
);

export const DatabaseRuntimePanel = ({ moduleRuntimeModules, moduleRuntimeSummary }) => (
  <Space direction="vertical" size={16} style={{ width: "100%" }}>
    <ImsNotice
      variant="status"
      compact
      title="Status layanan modul"
      description="Semua modul utama berjalan melalui layanan database lokal. Restore tetap memakai guard konfirmasi."
    />

    <Row gutter={[12, 12]}>
      <Col xs={12} md={6}>
        <Card size="small" className="offline-db-status-card">
          <Statistic title="Database Aktif" value={formatNumber(moduleRuntimeSummary.sqlite_active)} prefix={<CheckCircleOutlined />} />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card size="small" className="offline-db-status-card">
          <Statistic title="Siap Dipakai" value={formatNumber(moduleRuntimeSummary.runtime_ready || 0)} prefix={<DatabaseOutlined />} />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card size="small" className="offline-db-status-card">
          <Statistic title="Guarded" value={formatNumber(moduleRuntimeSummary.guarded)} prefix={<SafetyOutlined />} />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card size="small" className="offline-db-status-card">
          <Statistic title="Total Modul" value={formatNumber(moduleRuntimeSummary.total)} prefix={<SwapOutlined />} />
        </Card>
      </Col>
    </Row>

    <Row gutter={[12, 12]}>
      {moduleRuntimeModules.map((item) => {
        const statusColor = item.status === "sqlite_active"
          ? "green"
          : item.status === "guarded"
            ? "red"
            : item.status === "archived_inactive"
              ? "orange"
              : "blue";

        return (
          <Col xs={24} md={12} xl={8} key={item.module_key}>
            <Card size="small" className="offline-db-status-card offline-db-module-card">
              <Space direction="vertical" size={6} style={{ width: "100%" }}>
                <Space wrap size={6}>
                  <Text strong>{item.label}</Text>
                  <Tag color={statusColor}>{getRuntimeStatusLabel(item.status)}</Tag>
                </Space>
                <Text type="secondary">Area: {getRuntimeScopeLabel(item.scope)}</Text>
                <Text type="secondary">{item.notes || "-"}</Text>
              </Space>
            </Card>
          </Col>
        );
      })}
    </Row>
  </Space>
);

export const DatabaseTechnicalPanel = ({
  backupLifecycle,
  databaseConsistency,
  isOnline,
  loading,
  moduleRuntimeModules,
  moduleRuntimeSummary,
  onRefresh,
  statusContractReady,
  statusData,
}) => (
  <Space direction="vertical" size={12} style={{ width: "100%" }}>
    <SqliteBackendStatusPanel
      statusData={statusData}
      isOnline={isOnline}
      loading={loading}
      onRefresh={onRefresh}
    />

    <ImsNotice
      variant="info"
      compact
      title="Satu database logis, beberapa file runtime"
      description="Saat layanan aktif, SQLite mode WAL dapat menampilkan file .sqlite, .sqlite-wal, dan .sqlite-shm. Ketiganya adalah satu database yang sama. Hentikan layanan secara normal dan jangan menghapus file WAL/SHM secara manual."
    />

    <Collapse
      size="small"
      className="offline-db-coverage-collapse"
      items={[
        {
          key: "technical",
          label: "Detail teknis database & backup",
          children: (
            <Descriptions size="small" bordered column={{ xs: 1, lg: 2 }}>
              <Descriptions.Item label="Status Layanan">
                <Tag color={isOnline ? "green" : "orange"}>{isOnline ? "Aktif" : "Belum tersambung"}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Schema DB">{statusData.schemaVersion || "-"}</Descriptions.Item>
              <Descriptions.Item label="Kontrak Status">
                {statusContractReady ? `v${statusData.maintenanceStatusContractVersion}` : "Belum cocok"}
              </Descriptions.Item>
              <Descriptions.Item label="Status Dihasilkan">
                {statusData.statusGeneratedAt ? formatDateTime(statusData.statusGeneratedAt) : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Backend Dimulai">
                {statusData.backendStartedAt ? formatDateTime(statusData.backendStartedAt) : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Konsistensi Database">
                <Tag color={databaseConsistency?.healthy ? "green" : "orange"}>
                  {databaseConsistency?.healthy ? "Sinkron" : "Perlu diperiksa"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Realtime Antarperangkat">
                <Tag color={statusData.realtime?.enabled ? "green" : "orange"}>
                  {statusData.realtime?.enabled ? "SSE aktif" : "Fallback refresh"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Client Tersambung">{formatNumber(statusData.realtime?.connectedClients || 0)}</Descriptions.Item>
              <Descriptions.Item label="Revision Data">{formatNumber(statusData.realtime?.revision || 0)}</Descriptions.Item>
              <Descriptions.Item label="Event Terakhir">
                {statusData.realtime?.lastEvent?.occurredAt
                  ? formatDateTime(statusData.realtime.lastEvent.occurredAt)
                  : "Belum ada perubahan"}
              </Descriptions.Item>
              <Descriptions.Item label="Proteksi Restore"><Tag color="orange">Restore aman dengan keyword</Tag></Descriptions.Item>
              <Descriptions.Item label="Format Backup"><Tag color="blue">Backup IMS satu file terverifikasi</Tag></Descriptions.Item>
              <Descriptions.Item label="Lifecycle Otomatis">
                <Tag color={backupLifecycle.schedulerActive ? "green" : "red"}>
                  {backupLifecycle.schedulerActive ? "Aktif" : "Tidak aktif"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Interval Pemeriksaan">
                {backupLifecycle.intervalMs
                  ? `${formatNumber(Math.round(Number(backupLifecycle.intervalMs) / 60000))} menit`
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Lifecycle Terakhir">
                {backupLifecycle.lastCompletedAt ? formatDateTime(backupLifecycle.lastCompletedAt) : "Belum pernah"}
              </Descriptions.Item>
              <Descriptions.Item label="Pemeriksaan Berikutnya">
                {backupLifecycle.nextRunAt ? formatDateTime(backupLifecycle.nextRunAt) : "Tidak dijadwalkan"}
              </Descriptions.Item>
              {backupLifecycle.lastError ? (
                <Descriptions.Item label="Error Lifecycle Terakhir" span={{ xs: 1, lg: 2 }}>
                  <Text type="danger">{backupLifecycle.lastError}</Text>
                </Descriptions.Item>
              ) : null}
              <Descriptions.Item label="Lokasi Database" span={{ xs: 1, lg: 2 }}>
                <Text copyable ellipsis style={{ maxWidth: "100%" }}>{statusData.dbPath || "-"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Lokasi Backup" span={{ xs: 1, lg: 2 }}>
                <Text copyable ellipsis style={{ maxWidth: "100%" }}>{statusData.backupDir || "-"}</Text>
              </Descriptions.Item>
            </Descriptions>
          ),
        },
        {
          key: "runtime",
          label: `Status ${formatNumber(moduleRuntimeSummary.total)} modul aplikasi`,
          children: (
            <DatabaseRuntimePanel
              moduleRuntimeModules={moduleRuntimeModules}
              moduleRuntimeSummary={moduleRuntimeSummary}
            />
          ),
        },
      ]}
    />
  </Space>
);

export const RestorePreviewPanel = ({ restoreComparisonGroups, restorePlan }) => {
  if (!restorePlan) {
    return (
      <Text type="secondary">
        Pilih backup lalu klik Preview Restore untuk validasi checksum, integrity check, dan ringkasan data.
      </Text>
    );
  }

  return (
    <div className="offline-db-restore-preview">
      <Descriptions size="small" bordered column={{ xs: 1, md: 2 }}>
        <Descriptions.Item label="Jenis Preview"><Tag color="blue">Read-only</Tag></Descriptions.Item>
        <Descriptions.Item label="Database Aktif"><StatusTag tone="success">Belum diubah</StatusTag></Descriptions.Item>
        <Descriptions.Item label="Validasi File">
          <Tag color={restorePlan.validForRestore ? "green" : "red"}>{restorePlan.validForRestore ? "Valid" : "Tidak valid"}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Guard Akun">
          <Tag color={restorePlan.safeForRestore ? "green" : "red"}>{restorePlan.safeForRestore ? "Aman" : "Diblokir"}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Integrity">{restorePlan.validation?.integrityCheck || restorePlan.manifest?.integrityCheck || "-"}</Descriptions.Item>
        <Descriptions.Item label="Status Akun Setelah Restore">
          {restorePlan.accountSummary
            ? (restorePlan.safeForRestore
              ? "Dapat login dengan akun administrator dari backup"
              : "Restore diblokir — pilih backup dengan administrator aktif")
            : "Belum dapat diperiksa"}
        </Descriptions.Item>
      </Descriptions>

      {restorePlan.accountSummary ? (
        <Descriptions title="Akun dalam Backup" size="small" bordered column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label="Total User">{formatNumber(restorePlan.accountSummary.totalUsers)}</Descriptions.Item>
          <Descriptions.Item label="User Aktif">{formatNumber(restorePlan.accountSummary.activeUsers)}</Descriptions.Item>
          <Descriptions.Item label="Total Administrator">{formatNumber(restorePlan.accountSummary.administratorUsers)}</Descriptions.Item>
          <Descriptions.Item label="Administrator Aktif">
            <Tag color={restorePlan.accountSummary.activeAdministrators > 0 ? "green" : "red"}>
              {formatNumber(restorePlan.accountSummary.activeAdministrators)}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      ) : null}

      {restorePlan.validation?.tables ? (
        <div className="offline-db-compact-section offline-db-restore-comparison-section">
          <div className="offline-db-section-heading">
            <div>
              <Text strong>Perbandingan database saat ini dan isi backup</Text>
              <br />
              <Text type="secondary">
                Nilai negatif berarti record tersebut akan berkurang setelah full restore. Jumlah mencakup histori yang masih tersimpan.
              </Text>
            </div>
          </div>
          {renderCoverageSummary(restoreComparisonGroups, { comparison: true })}
          <Collapse
            size="small"
            className="offline-db-coverage-collapse"
            items={buildCoverageCollapseItems(restoreComparisonGroups, { comparison: true })}
          />
        </div>
      ) : null}

      {restorePlan.validationError ? (
        <Alert type="error" showIcon message="Backup tidak lolos validasi" description={restorePlan.validationError} />
      ) : !restorePlan.safeForRestore ? (
        <Alert
          type="error"
          showIcon
          message="Restore normal diblokir"
          description="Backup tidak memiliki administrator aktif. Restore normal tidak dapat dijalankan; pilih backup lain yang memiliki administrator aktif."
        />
      ) : (
        <ImsNotice
          variant="info"
          compact
          title="Preview aman dan tidak mengubah data."
          description={(restorePlan.blockedActions || []).join(" ")}
        />
      )}

      {restorePlan.restoreSafety?.likelyEmptyDatabase ? (
        <Alert
          type="warning"
          showIcon
          message="Backup tampak seperti database awal atau kosong"
          description="Jumlah akun dan data operasional utama di backup ini bernilai nol."
        />
      ) : null}
    </div>
  );
};
