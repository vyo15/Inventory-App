import { ReloadOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Form, Input, Modal, Space, Tag, Typography } from "antd";

const { Text } = Typography;

const ResetConfirmModal = ({
  confirmForm,
  confirmOpen,
  isFullTestingResetIntent,
  loadingRun,
  mode,
  onCancel,
  onConfirm,
  preview,
  resetConfirmKeyword,
  resetModeLabels,
  selectedModuleLabels,
}) => (
  <Modal
    open={confirmOpen}
    title={isFullTestingResetIntent ? "Konfirmasi Reset Semua Testing" : "Konfirmasi Reset Data"}
    onCancel={onCancel}
    onOk={onConfirm}
    okText="Ya, Jalankan Reset"
    cancelText="Batal"
    okButtonProps={{ danger: true, loading: loadingRun, icon: <ReloadOutlined /> }}
  >
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <Alert
        type="error"
        showIcon
        icon={<WarningOutlined />}
        message={isFullTestingResetIntent ? "Reset semua testing akan membersihkan data non-protected" : "Reset akan menghapus scope terpilih"}
        description={isFullTestingResetIntent
          ? "Aksi ini menghapus transaksi/log/planning/pricing, menolkan stok, dan menolkan modal/HPP allowlist. Protected master tidak dihapus."
          : "Pastikan preview sesuai. Reset tidak bisa dibatalkan dari halaman ini."}
      />

      <div>
        <Text strong>Mode aktif:</Text>
        <div style={{ marginTop: 6 }}>
          <Tag color="blue">{resetModeLabels[mode]}</Tag>
        </div>
      </div>

      <div>
        <Text strong>Modul dipilih:</Text>
        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {selectedModuleLabels.map((label) => (
            <Tag key={label} color="geekblue">{label}</Tag>
          ))}
        </div>
      </div>

      <div>
        <Text strong>Total data terdeteksi:</Text>
        <div style={{ marginTop: 4 }}>
          <Text>{preview?.totalRecords || 0} record</Text>
        </div>
      </div>

      {isFullTestingResetIntent && (
        <Alert
          type="warning"
          showIcon
          message="Termasuk stok dan modal/HPP"
          description={`Stok master/variant dinolkan. Field modal/HPP allowlist diproses untuk ${preview?.executionPlan?.hppCostOperations || 0} item master, digabung dengan update stok menjadi ${preview?.executionPlan?.mergedMasterUpdateOperations || 0} update master.`}
        />
      )}

      <Alert
        type="warning"
        showIcon
        message="Audit log dibuat sebelum reset berjalan"
        description="Jika audit log gagal, reset batal."
      />

      <Form form={confirmForm} layout="vertical">
        <Form.Item
          name="actionNote"
          label="Catatan percobaan"
          extra="Opsional. Jika diisi, catatan ini digabung ke field note audit tanpa menghapus note sistem."
        >
          <Input.TextArea rows={2} placeholder="Contoh: reset data trial PO/HPP tanggal hari ini" allowClear />
        </Form.Item>
        <Form.Item
          name="confirmationText"
          label={`Ketik "${resetConfirmKeyword}" untuk konfirmasi terakhir`}
          rules={[{ required: true, message: `Ketik "${resetConfirmKeyword}" untuk melanjutkan.` }]}
          extra={`Reset hanya berjalan jika kata ${resetConfirmKeyword} benar.`}
        >
          <Input placeholder={`Ketik ${resetConfirmKeyword} di sini`} allowClear autoFocus />
        </Form.Item>
      </Form>
    </Space>
  </Modal>
);

export default ResetConfirmModal;
