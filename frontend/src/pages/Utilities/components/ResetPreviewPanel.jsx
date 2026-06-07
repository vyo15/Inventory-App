import React from "react";
import { Alert, Card, Col, Row, Space, Tag, Typography } from "antd";
import { LockOutlined, SafetyOutlined, WarningOutlined } from "@ant-design/icons";

const { Text } = Typography;

const ResetPreviewPanel = () => (
  <Card title="Info Reset Lama" size="small" extra={<Tag color="default">Info saja</Tag>}>
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message="Form reset lama tidak ditampilkan pada mode database lokal"
        description="Reset destructive belum dibuat. Area ini dipertahankan sebagai catatan agar admin memahami bahwa pemulihan data harus memakai Backup & Restore, bukan reset lama."
      />
      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <Card size="small" className="reset-maintenance-status-card">
            <Space direction="vertical" size={8}>
              <Tag icon={<LockOutlined />} color="red">Reset final nonaktif</Tag>
              <Text type="secondary">Tidak ada tombol reset final yang aktif dari tampilan lama.</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card size="small" className="reset-maintenance-status-card">
            <Space direction="vertical" size={8}>
              <Tag icon={<SafetyOutlined />} color="green">Preview wajib</Tag>
              <Text type="secondary">Jika reset dibuat nanti, harus lewat preview layanan lokal dan audit log resmi.</Text>
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
