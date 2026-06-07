import React from "react";
import { Alert, Button, Card, Col, Row, Space, Tag, Typography } from "antd";
import { DatabaseOutlined, FileSearchOutlined, LockOutlined, SafetyOutlined } from "@ant-design/icons";

const { Text } = Typography;

const ResetDangerZonePanel = ({ loadingAutoDetect, onRunAllAudits }) => (
  <Card
    title="Reset Testing / Development"
    size="small"
    extra={<Tag color="red">Reset lama nonaktif</Tag>}
  >
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Alert
        type="warning"
        showIcon
        message="Reset testing lama dinonaktifkan pada mode database lokal"
        description="Pemulihan data utama sekarang wajib lewat Backup & Restore resmi. Reset penghapusan data belum tersedia dan tidak akan diaktifkan tanpa guard layanan lokal, preview, backup otomatis, keyword, serta audit log."
      />

      <Row gutter={[12, 12]}>
        <Col xs={24} md={12} xl={6}>
          <Card size="small" title="Status Reset Lama" className="reset-maintenance-status-card">
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Tag icon={<LockOutlined />} color="red">Nonaktif</Tag>
              <Text type="secondary">Service reset lama sudah nonaktif dan tidak menjalankan penghapusan data.</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card size="small" title="Recovery Utama" className="reset-maintenance-status-card">
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Tag icon={<DatabaseOutlined />} color="green">Backup & Restore</Tag>
              <Text type="secondary">Gunakan backup resmi .imsbak.zip, preview restore, dan keyword konfirmasi.</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card size="small" title="Data Tools" className="reset-maintenance-status-card">
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Tag icon={<SafetyOutlined />} color="blue">Pindah ke Data Tools</Tag>
              <Text type="secondary">Export master/checklist dipisah dari area reset agar aman untuk operasional.</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card size="small" title="Langkah Aman" className="reset-maintenance-status-card">
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Text type="secondary">Audit data terlebih dahulu sebelum repair atau restore.</Text>
              <Button block icon={<FileSearchOutlined />} loading={loadingAutoDetect} onClick={onRunAllAudits}>
                Jalankan Audit Data
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  </Card>
);

export default ResetDangerZonePanel;
