import { Col, Form, Input, InputNumber, Modal, Row, Select } from "antd";
import { DEFAULT_WORK_LOG_OUTPUT } from "../../../constants/productionWorkLogOptions";
import { parseIntegerIdInput } from "../../../utils/formatters/numberId";
import { buildVariantOptionsFromItem, inferHasVariants } from "../../../utils/variants/variantStockHelpers";

// IMS NOTE [AKTIF/UI-ONLY] - Modal output Work Log dipisah dari page jumbo.
// Fungsi blok: hanya merender form line output dengan reference data, form instance, dan handler dari parent.
// Hubungan flow: field name, validasi submit, builder payload, stok output, HPP, payroll, dan service produksi tidak diubah.
const WorkLogOutputModal = ({
  open,
  editingIndex,
  form,
  referenceData,
  onCancel,
  onOk,
}) => {
  const safeReferenceData = referenceData || {};

  const resolveOutputOptions = (outputType) =>
    outputType === "semi_finished_material"
      ? (safeReferenceData.semiFinishedMaterials || []).map((item) => ({
          value: item.id,
          label: item.name || "-",
          raw: item,
        }))
      : (safeReferenceData.products || []).map((item) => ({
          value: item.id,
          label: item.name || "-",
          raw: item,
        }));

  return (
    <Modal
      title={editingIndex !== null ? "Edit Output" : "Tambah Output"}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText="Simpan"
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={DEFAULT_WORK_LOG_OUTPUT}
      >
        <Form.Item
          label="Output Type"
          name="outputType"
          rules={[{ required: true, message: "Output type wajib dipilih" }]}
        >
          <Select
            options={[
              { value: "semi_finished_material", label: "Bahan Produksi" },
              { value: "product", label: "Produk Jadi" },
            ]}
          />
        </Form.Item>

        <Form.Item shouldUpdate noStyle>
          {({ getFieldValue, setFieldValue }) => {
            const outputType = getFieldValue("outputType");

            return (
              <Form.Item
                label="Output Item"
                name="outputIdRef"
                rules={[{ required: true, message: "Output item wajib dipilih" }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={resolveOutputOptions(outputType)}
                  placeholder="Pilih output item..."
                  onChange={() => {
                    setFieldValue("outputVariantKey", undefined);
                    setFieldValue("outputVariantLabel", "");
                  }}
                />
              </Form.Item>
            );
          }}
        </Form.Item>

        <Form.Item shouldUpdate noStyle>
          {({ getFieldValue, setFieldValue }) => {
            const outputType = getFieldValue("outputType");
            const outputIdRef = getFieldValue("outputIdRef");
            const selectedOutput = resolveOutputOptions(outputType).find((item) => item.value === outputIdRef)?.raw;
            const hasVariants = inferHasVariants(selectedOutput || {});
            const variantOptions = buildVariantOptionsFromItem(selectedOutput || {});

            if (!hasVariants) return null;

            return (
              <Form.Item
                label="Varian Output"
                name="outputVariantKey"
                rules={[{ required: true, message: "Varian output wajib dipilih" }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={variantOptions}
                  placeholder="Pilih varian output..."
                  onChange={(value) => {
                    const selectedVariant = variantOptions.find((item) => item.value === value);
                    setFieldValue("outputVariantLabel", selectedVariant?.label || "");
                  }}
                />
              </Form.Item>
            );
          }}
        </Form.Item>

        <Row gutter={12}>
          <Col span={24}>
            <Form.Item label="Good Qty" name="goodQty">
              <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="rejectQty" hidden><InputNumber /></Form.Item>
        <Form.Item name="reworkQty" hidden><InputNumber /></Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Cost / Unit" name="costPerUnit">
              <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Unit" name="unit">
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Catatan" name="notes">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default WorkLogOutputModal;
