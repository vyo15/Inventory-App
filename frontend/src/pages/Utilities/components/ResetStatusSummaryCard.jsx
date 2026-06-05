import { Card, Col, Input, Row, Space, Statistic, Tag } from "antd";

const ResetStatusSummaryCard = ({
  actionNote,
  autoBugSummary,
  hppCostBaselineSummary,
  maintenanceActor,
  onActionNoteChange,
  preview,
}) => (
  <Card title="Status Ringkas" size="small" extra={<Tag color="green">Actor: {maintenanceActor}</Tag>}>
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <Statistic title="Bug/Data Issue" value={autoBugSummary.issueCount} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Repair Aman" value={autoBugSummary.safeRepairCount} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Preview Reset" value={preview ? preview.totalRecords || 0 : "Belum"} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Baseline Modal/HPP" value={hppCostBaselineSummary?.exists ? "Ada" : "Belum"} />
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
