import { EyeOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { Button, Card, Checkbox, Col, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Typography } from "antd";

const { Text } = Typography;

const ResetPreviewPanel = ({
  mode,
  onModeChange,
  resetModeLabels,
  resetModeOptions,
  selectedModules,
  onSelectedModulesChange,
  moduleOptions,
  preview,
  previewRows,
  loadingPreview,
  onLoadPreview,
  loadingBaseline,
  onSaveBaseline,
  onOpenResetConfirmation,
  resetBlockedReason,
  renderCompactText,
}) => (
  <Card title="Reset & Baseline" size="small" extra={<Tag color="red">Destructive guarded</Tag>}>
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <Text strong>Mode Reset</Text>
          <Select
            value={mode}
            onChange={onModeChange}
            options={resetModeOptions.map((item) => ({ value: item.value, label: item.label }))}
            style={{ width: "100%", marginTop: 8 }}
          />
        </Col>
        <Col xs={24} md={16}>
          <Text strong>Modul</Text>
          <Checkbox.Group
            value={selectedModules}
            onChange={onSelectedModulesChange}
            options={moduleOptions}
            style={{ display: "grid", gap: 8, marginTop: 8 }}
          />
        </Col>
      </Row>
      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><Statistic title="Mode" value={resetModeLabels[mode] || mode} /></Col>
        <Col xs={12} md={6}><Statistic title="Target Hapus" value={preview?.totalRecords || 0} /></Col>
        <Col xs={12} md={6}><Statistic title="Operasi" value={preview?.executionPlan?.totalWriteOperations || 0} /></Col>
        <Col xs={12} md={6}><Statistic title="Modul" value={selectedModules.length} /></Col>
      </Row>
      <Space wrap>
        <Button icon={<EyeOutlined />} loading={loadingPreview} onClick={onLoadPreview}>Preview Reset</Button>
        <Popconfirm
          title="Simpan baseline stok saat ini?"
          description="Baseline dipakai untuk reset testing berulang. Data baseline lama akan diganti oleh snapshot saat ini."
          okText="Ya, simpan"
          cancelText="Batal"
          onConfirm={onSaveBaseline}
        >
          <Button icon={<SaveOutlined />} loading={loadingBaseline}>Simpan Baseline Stok</Button>
        </Popconfirm>
        <Button danger type="primary" icon={<ReloadOutlined />} onClick={onOpenResetConfirmation} disabled={Boolean(resetBlockedReason) || loadingPreview}>
          Konfirmasi RESET
        </Button>
        {resetBlockedReason && <Tag color="red">{resetBlockedReason}</Tag>}
      </Space>
      {preview && (
        <Table
          className="app-data-table"
          size="small"
          pagination={false}
          dataSource={previewRows}
          columns={[
            { title: "Modul", dataIndex: "moduleLabel", key: "moduleLabel", width: 170, render: (value) => renderCompactText(value, 150) },
            { title: "Target", dataIndex: "name", key: "name", width: 220, render: (value) => renderCompactText(value, 200) },
            { title: "Jumlah", dataIndex: "count", key: "count", width: 90 },
            { title: "Status", dataIndex: "status", key: "status", width: 120, render: (value) => <Tag color={value === "delete" ? "red" : "green"}>{value === "delete" ? "Dihapus" : "Dilindungi"}</Tag> },
            { title: "Aksi", dataIndex: "action", key: "action", render: (value) => renderCompactText(value, 300) },
          ]}
          scroll={{ x: 900 }}
        />
      )}
    </Space>
  </Card>
);

export default ResetPreviewPanel;
