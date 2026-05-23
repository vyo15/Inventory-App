import { Col, Form, Input, InputNumber, Modal, Row, Select } from "antd";
import { parseIntegerIdInput } from "../../../utils/formatters/numberId";

// IMS NOTE [AKTIF/UI-ONLY] - Modal complete Work Log dipisah dari page jumbo.
// Fungsi blok: hanya merender konfirmasi input hasil produksi dan operator memakai form/handler lama dari parent.
// Hubungan flow: completeProductionWorkLog, auto payroll, posting stok, HPP, audit, dan reload data tetap berada di parent/service existing.
const WorkLogCompleteModal = ({
  open,
  form,
  employeeOptions,
  estimateInfo,
  onCancel,
  onOk,
}) => (
  <Modal
    title="Selesaikan Work Log Produksi"
    open={open}
    onCancel={onCancel}
    onOk={onOk}
    okText="Selesaikan"
    destroyOnClose
  >
    {/* Aktif dipakai: konteks estimasi output ditampilkan kembali sebelum input hasil produksi. */}
    {estimateInfo}

    <Form form={form} layout="vertical">
      <Row gutter={12}>
        <Col span={24}>
          <Form.Item
            label="Good Qty"
            name="goodQty"
            rules={[{ required: true, message: "Good qty wajib diisi" }]}
          >
            <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        label="Operator Produksi"
        name="workerIds"
        rules={[
          {
            required: true,
            type: "array",
            min: 1,
            message: "Operator Produksi wajib dipilih agar payroll otomatis bisa dibuat",
          },
        ]}
      >
        <Select
          mode="multiple"
          optionFilterProp="label"
          options={employeeOptions}
          placeholder="Pilih operator yang mengerjakan work log ini..."
        />
      </Form.Item>

      <Form.Item label="Catatan Penyelesaian" name="notes">
        <Input.TextArea
          rows={3}
          placeholder="Catatan hasil produksi, miss, atau kendala proses..."
        />
      </Form.Item>
    </Form>
  </Modal>
);

export default WorkLogCompleteModal;
