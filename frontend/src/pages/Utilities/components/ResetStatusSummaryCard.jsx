import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Descriptions, Row, Space, Statistic, Tag, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import {
  getSqliteBackendBackups,
  getSqliteBackendStatus,
  getSqliteRestoreLogs,
} from "../../../services/System/sqliteBackendStatusService";
import { formatMaintenanceDate } from "../utils/resetMaintenanceUiHelpers";

const { Text } = Typography;

const getLatestVerifiedBackup = (backups = []) => backups.find((backup) => (
  ["verified", "success"].includes(String(backup?.status || "").toLowerCase())
  && backup?.fileExists !== false
)) || null;

const ResetStatusSummaryCard = ({ autoBugSummary, maintenanceActor }) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [status, setStatus] = useState(null);
  const [backups, setBackups] = useState([]);
  const [restoreLogs, setRestoreLogs] = useState([]);

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      const [statusResult, backupResult, restoreResult] = await Promise.all([
        getSqliteBackendStatus(),
        getSqliteBackendBackups(),
        getSqliteRestoreLogs(),
      ]);
      setStatus(statusResult?.data || statusResult || null);
      setBackups(backupResult?.data || []);
      setRestoreLogs(restoreResult?.data || []);
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
  const latestRestore = restoreLogs[0] || null;

  return (
    <Card
      title="Ringkasan Operasional"
      size="small"
      loading={loading && !status}
      extra={(
        <Space wrap>
          <Tag color="green">Admin: {maintenanceActor}</Tag>
          <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={loadSummary}>
            Refresh
          </Button>
        </Space>
      )}
    >
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        {errorMessage ? (
          <ImsNotice variant="guard" compact title="Ringkasan belum lengkap" description={errorMessage} />
        ) : null}

        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}>
            <Statistic title="Database" value={status?.schemaVersion ? "Aktif" : "Perlu dicek"} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Schema" value={status?.schemaVersion || "-"} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Issue Audit" value={autoBugSummary.issueCount || 0} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Kandidat Repair" value={autoBugSummary.safeRepairCount || 0} />
          </Col>
        </Row>

        <Descriptions size="small" bordered column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label="Backup verified terakhir">
            {latestBackup?.filename || "Belum ada"}
          </Descriptions.Item>
          <Descriptions.Item label="Waktu backup">
            {formatMaintenanceDate(latestBackup?.created_at || latestBackup?.manifest?.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Restore terakhir">
            {latestRestore?.filename || "Belum ada"}
          </Descriptions.Item>
          <Descriptions.Item label="Waktu restore">
            {formatMaintenanceDate(latestRestore?.created_at)}
          </Descriptions.Item>
          <Descriptions.Item label="Database Queue">
            <Tag color={status?.databaseQueue?.active ? "orange" : "green"}>
              {status?.databaseQueue?.active ? "Sedang digunakan" : "Siap"}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Structured Logging">
            <Tag color={status?.logging?.structured ? "green" : "orange"}>
              {status?.logging?.structured ? "Aktif" : "Perlu dicek"}
            </Tag>
          </Descriptions.Item>
        </Descriptions>

        <Text type="secondary">
          Ringkasan ini hanya membaca status layanan, backup, restore, dan hasil audit terakhir di halaman. Tidak ada aksi destructive.
        </Text>
      </Space>
    </Card>
  );
};

export default ResetStatusSummaryCard;
