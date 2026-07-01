import { Col, Form, InputNumber, Modal, Row, Select } from "antd";
import { DEFAULT_BOM_STEP_LINE } from "../../../constants/productionBomOptions";
import { parseIntegerIdInput } from "../../../utils/formatters/numberId";

const ProductionBomStepModal = ({
  editingStepIndex,
  handleSaveStepLine,
  setEditingStepIndex,
  setStepModalVisible,
  stepForm,
  stepModalVisible,
  stepOptions,
}) => (
      <Modal
        title={
          editingStepIndex !== null ? "Edit Step Line" : "Tambah Step Line"
        }
        open={stepModalVisible}
        onCancel={() => {
          setStepModalVisible(false);
          setEditingStepIndex(null);
          stepForm.resetFields();
        }}
        onOk={handleSaveStepLine}
        okText="Simpan"
        width={720}
        destroyOnClose
      >
        <Form
          form={stepForm}
          layout="vertical"
          initialValues={DEFAULT_BOM_STEP_LINE}
        >
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item
                label="Step Produksi"
                name="stepId"
                rules={[{ required: true, message: "Step wajib dipilih" }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={stepOptions}
                  placeholder="Pilih step produksi..."
                  notFoundContent="Belum ada production step"
                />
              </Form.Item>
            </Col>

            <Col span={10}>
              <Form.Item
                label="Urutan Langkah"
                name="sequenceNo"
                tooltip="Terisi otomatis sesuai urutan penambahan step."
              >
                <InputNumber min={1} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

        </Form>
      </Modal>
);

export default ProductionBomStepModal;
