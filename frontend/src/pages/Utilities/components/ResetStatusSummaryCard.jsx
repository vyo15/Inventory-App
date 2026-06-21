import { Card, Col, Input, Row, Space, Statistic, Tag } from "antd";
import { MAINTENANCE_DATA_TOOLS_AVAILABLE } from "../../../services/Maintenance/resetMaintenanceDataService";

const ResetStatusSummaryCard = ({
  actionNote,
  autoBugSummary,
  hppCostBaselineSummary,
  maintenanceActor,
  onActionNoteChange,
}) => (
  <Card title="Status Ringkas" size="small" extra={<Tag color="green">Actor: {maintenanceActor}</Tag>}>
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <Statistic title="Audit Otomatis" value={MAINTENANCE_DATA_TOOLS_AVAILABLE ? autoBugSummary.issueCount : "Belum tersedia"} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Repair Otomatis" value={MAINTENANCE_DATA_TOOLS_AVAILABLE ? autoBugSummary.safeRepairCount : "Belum tersedia"} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Baseline Modal/HPP" value={hppCostBaselineSummary?.available && hppCostBaselineSummary?.exists ? "Ada" : "Belum tersedia"} />
        </Col>
      </Row>
      <Input.TextArea
        value={actionNote}
        onChange={(event) => onActionNoteChange(event.target.value)}
        rows={2}
        allowClear
        placeholder="Catatan maintenance opsional untuk audit log, contoh: audit data setelah backup manual"
      />
    </Space>
  </Card>
);

export default ResetStatusSummaryCard;
