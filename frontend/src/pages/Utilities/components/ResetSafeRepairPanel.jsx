import { useState } from "react";
import { DeleteOutlined, FileSearchOutlined, ToolOutlined } from "@ant-design/icons";
import { Button, Card, Col, Input, Row, Space, Statistic, Tag, Typography } from "antd";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import { MAINTENANCE_DATA_TOOL_CAPABILITIES } from "../../../services/Maintenance/resetMaintenanceDataService";

const { Text } = Typography;
const ORPHAN_CLEANUP_CONFIRM_KEYWORD = "BERSIHKAN DATA STOK";

const getIssueColor = (issueType) => {
  if (issueType === "orphan") return "red";
  if (["missing", "stale"].includes(issueType)) return "orange";
  return "green";
};

const ResetSafeRepairPanel = ({
  loadingStockReadModelAudit,
  onLoadStockReadModelAudit,
  loadingStockReadModelRepair,
  onRepairStockReadModelAudit,
  loadingStockReadModelCleanup,
  onCleanupStockReadModelOrphans,
  stockReadModelAudit,
  stockReadModelSummary = {},
  stockReadModelRows = [],
  renderCompactText,
}) => {
  const [cleanupKeyword, setCleanupKeyword] = useState("");
  const repairCount = Number(stockReadModelSummary.executablePlanCount || 0);
  const orphanCount = Number(stockReadModelSummary.orphanCount || 0);
  const cleanupKeywordValid = cleanupKeyword.trim().toUpperCase() === ORPHAN_CLEANUP_CONFIRM_KEYWORD;

  const handleCleanup = async () => {
    const result = await onCleanupStockReadModelOrphans?.({ confirmKeyword: cleanupKeyword });
    if (result) setCleanupKeyword("");
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card
        title="Repair Data Turunan Stok"
        size="small"
        extra={<Tag color="blue">Guarded</Tag>}
      >
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <ImsNotice
            variant="guard"
            compact
            title="Hanya projection stock read model"
            description="Repair membangun ulang data turunan stok dari master Product, Raw Material, dan Semi Finished. Stok master, transaksi, inventory log, payroll, HPP, dan ledger tidak diubah. Sistem membuat backup pre-repair otomatis sebelum write."
          />

          <Row gutter={[12, 12]}>
            <Col xs={12} md={6}>
              <Statistic title="Master Source" value={stockReadModelSummary.sourceRecords || 0} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Missing" value={stockReadModelSummary.missingCount || 0} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Stale" value={stockReadModelSummary.staleCount || 0} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Orphan" value={orphanCount} />
            </Col>
          </Row>

          <Space wrap>
            <Button
              icon={<FileSearchOutlined />}
              loading={loadingStockReadModelAudit}
              disabled={!MAINTENANCE_DATA_TOOL_CAPABILITIES.stockReadModelAudit}
              onClick={() => onLoadStockReadModelAudit?.()}
            >
              Audit Data Turunan
            </Button>
            <Button
              type="primary"
              icon={<ToolOutlined />}
              loading={loadingStockReadModelRepair}
              disabled={!stockReadModelAudit || repairCount <= 0 || !MAINTENANCE_DATA_TOOL_CAPABILITIES.stockReadModelRebuild}
              onClick={() => onRepairStockReadModelAudit?.()}
            >
              Rebuild Missing/Stale ({repairCount})
            </Button>
          </Space>

          <DataTableView
            className="app-data-table"
            size="small"
            loading={loadingStockReadModelAudit}
            pagination={false}
            dataSource={stockReadModelRows.filter((row) => row.issueType !== "ok")}
            locale={{ emptyText: stockReadModelAudit ? "Data turunan stok sudah sinkron" : "Jalankan audit data turunan stok" }}
            columns={[
              {
                title: "Sumber",
                dataIndex: "sourceLabel",
                key: "sourceLabel",
                width: 160,
              },
              {
                title: "Item",
                dataIndex: "itemName",
                key: "itemName",
                render: (value) => renderCompactText(value, 240),
              },
              {
                title: "Jenis",
                dataIndex: "issueType",
                key: "issueType",
                width: 110,
                render: (value) => <Tag color={getIssueColor(value)}>{value || "unknown"}</Tag>,
              },
              {
                title: "Temuan",
                dataIndex: "issue",
                key: "issue",
                render: (value) => renderCompactText(value, 420),
              },
            ]}
            mobileCardConfig={{
              title: (record) => record.itemName || record.readModelId || "Data Turunan Stok",
              subtitle: (record) => record.sourceLabel || record.sourceCollection,
              tags: (record) => <Tag color={getIssueColor(record.issueType)}>{record.issueType || "unknown"}</Tag>,
              meta: [{ label: "Temuan", value: (record) => record.issue || "-" }],
            }}
            scroll={{ x: 820 }}
          />
        </Space>
      </Card>

      <Card title="Cleanup Orphan" size="small" extra={<Tag color="red">Konfirmasi eksplisit</Tag>}>
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          <ImsNotice
            variant="critical"
            compact
            title="Orphan adalah data turunan tanpa master aktif"
            description="Cleanup hanya menghapus row stock_read_models yang tidak memiliki master source aktif. Sistem melakukan audit ulang, membuat backup pre-repair, dan menjalankan delete dalam transaction guarded."
          />
          <Text>
            Ketik <Text code>{ORPHAN_CLEANUP_CONFIRM_KEYWORD}</Text> untuk membersihkan {orphanCount} orphan dari audit terakhir.
          </Text>
          <Input
            value={cleanupKeyword}
            onChange={(event) => setCleanupKeyword(event.target.value)}
            placeholder={ORPHAN_CLEANUP_CONFIRM_KEYWORD}
            disabled={!stockReadModelAudit || orphanCount <= 0}
          />
          <Button
            danger
            type="primary"
            icon={<DeleteOutlined />}
            loading={loadingStockReadModelCleanup}
            disabled={
              !stockReadModelAudit
              || orphanCount <= 0
              || !cleanupKeywordValid
              || !MAINTENANCE_DATA_TOOL_CAPABILITIES.stockReadModelOrphanCleanup
            }
            onClick={handleCleanup}
          >
            Bersihkan Orphan ({orphanCount})
          </Button>
        </Space>
      </Card>
    </Space>
  );
};

export default ResetSafeRepairPanel;
