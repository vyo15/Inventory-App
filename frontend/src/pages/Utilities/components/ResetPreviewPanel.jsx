import React from "react";
import { Alert, Card, Col, Row, Space, Tag, Typography } from "antd";
import { LockOutlined, SafetyOutlined, WarningOutlined } from "@ant-design/icons";

const { Text } = Typography;

const ResetPreviewPanel = () => (
  <Card title="Legacy Reset Preview" size="small" extra={<Tag color="default">Read-only notice</Tag>}>
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message="Form reset lama tidak ditampilkan pada mode SQLite penuh"
        description="Endpoint reset SQLite destructive belum dibuat. Area ini dipertahankan sebagai catatan kompatibilitas agar admin memahami bahwa pemulihan data harus memakai Backup & Restore, bukan reset frontend lama."
      />
      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <Card size="small" className="reset-maintenance-status-card">
            <Space direction="vertical" size={8}>
              <Tag icon={<LockOutlined />} color="red">Destructive disabled</Tag>
              <Text type="secondary">Tidak ada tombol reset final yang aktif dari frontend legacy.</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" className="reset-maintenance-status-card">
            <Space direction="vertical" size={8}>
              <Tag icon={<SafetyOutlined />} color="green">Preview wajib</Tag>
              <Text type="secondary">Jika reset SQLite dibuat nanti, harus lewat backend preview dan audit log resmi.</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" className="reset-maintenance-status-card">
            <Space direction="vertical" size={8}>
              <Tag icon={<WarningOutlined />} color="orange">Approval terpisah</Tag>
              <Text type="secondary">Reset stock, finance, sales, purchase, production, payroll, dan HPP tetap guarded.</Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  </Card>
);

export default ResetPreviewPanel;
