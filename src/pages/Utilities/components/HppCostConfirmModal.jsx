import { ReloadOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Card, Col, Form, Input, Modal, Row, Space, Statistic, Tag, Typography } from "antd";

const { Text } = Typography;

const HppCostConfirmModal = ({
  hppConfirmForm,
  hppCostBaselineSummary,
  hppCostConfirmAction,
  hppCostConfirmKeyword,
  hppCostConfirmOpen,
  hppCostPreview,
  hppCostSelectedOption,
  loadingRestoreHppCostBaseline,
  loadingRunHppCostReset,
  onCancel,
  onConfirm,
}) => (
  <Modal
    open={hppCostConfirmOpen}
    title={hppCostConfirmAction === "restore" ? "Konfirmasi Restore Baseline Modal/HPP" : "Konfirmasi Reset Modal/HPP"}
    onCancel={onCancel}
    onOk={onConfirm}
    okText={hppCostConfirmAction === "restore" ? "Ya, Restore Baseline" : "Ya, Reset Modal/HPP"}
    cancelText="Batal"
    okButtonProps={{
      danger: true,
      loading: loadingRunHppCostReset || loadingRestoreHppCostBaseline,
      icon: hppCostConfirmAction === "restore" ? <ReloadOutlined /> : <WarningOutlined />,
    }}
  >
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <Alert
        type="error"
        showIcon
        icon={<WarningOutlined />}
        message={hppCostConfirmAction === "restore" ? "Restore akan menimpa field modal/HPP master" : "Reset akan menolkan field modal/HPP master"}
        description="Tidak menghapus transaksi, mengubah stok, membuat payroll/cash, atau memproses ulang Work Log."
      />

      <div>
        <Text strong>Mode:</Text>
        <div style={{ marginTop: 6 }}>
          <Tag color={hppCostConfirmAction === "restore" ? "blue" : "volcano"}>
            {hppCostConfirmAction === "restore" ? "Restore Baseline Modal/HPP" : hppCostPreview?.label || hppCostSelectedOption?.label}
          </Tag>
        </div>
      </div>

      <Row gutter={[12, 12]}>
        <Col xs={12}>
          <Card size="small">
            <Statistic
              title={hppCostConfirmAction === "restore" ? "Item Baseline" : "Dokumen Terdampak"}
              value={hppCostConfirmAction === "restore" ? hppCostBaselineSummary?.itemCount || 0 : hppCostPreview?.totalAffectedDocs || 0}
            />
          </Card>
        </Col>
        <Col xs={12}>
          <Card size="small">
            <Statistic
              title={hppCostConfirmAction === "restore" ? "Collection" : "Field/Varian"}
              value={hppCostConfirmAction === "restore" ? Object.keys(hppCostBaselineSummary?.collectionCounts || {}).length : hppCostPreview?.totalAffectedVariantRows || 0}
            />
          </Card>
        </Col>
      </Row>

      {hppCostConfirmAction === "reset" && (
        <div>
          <Text strong>Field terdampak:</Text>
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[...(hppCostPreview?.fieldsToReset || []), ...(hppCostPreview?.variantFieldsToReset || []).map((fieldName) => `variants.${fieldName}`)].map((fieldName) => (
              <Tag key={fieldName} color="orange">{fieldName}</Tag>
            ))}
          </div>
        </div>
      )}

      <Alert
        type="warning"
        showIcon
        message="Gunakan hanya untuk testing HPP"
        description="Tidak memperbaiki Work Log lama bernilai cost 0; ulangi flow testing untuk HPP baru."
      />

      <Form form={hppConfirmForm} layout="vertical">
        <Form.Item
          name="actionNote"
          label="Catatan percobaan"
          extra="Opsional. Jika diisi, catatan ini digabung ke field note audit tanpa menghapus note sistem."
        >
          <Input.TextArea rows={2} placeholder="Contoh: reset simulasi cost HPP setelah tes pembelian" allowClear />
        </Form.Item>
        <Form.Item
          name="confirmationText"
          label={`Ketik "${hppCostConfirmKeyword}" untuk konfirmasi terakhir`}
          rules={[{ required: true, message: `Ketik "${hppCostConfirmKeyword}" untuk melanjutkan.` }]}
          extra={`Aksi hanya berjalan jika keyword ${hppCostConfirmKeyword} benar.`}
        >
          <Input placeholder={`Ketik ${hppCostConfirmKeyword} di sini`} allowClear autoFocus />
        </Form.Item>
      </Form>
    </Space>
  </Modal>
);

export default HppCostConfirmModal;
