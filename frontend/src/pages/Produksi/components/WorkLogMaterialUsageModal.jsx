import { Col, Form, Input, InputNumber, Modal, Row, Select } from "antd";
import { DEFAULT_WORK_LOG_MATERIAL_USAGE } from "../../../constants/productionWorkLogOptions";
import { parseIntegerIdInput } from "../../../utils/formatters/numberId";
import { buildVariantOptionsFromItem, inferHasVariants } from "../../../utils/variants/variantStockHelpers";

// IMS NOTE [AKTIF/UI-ONLY] - Modal pemakaian material Work Log dipisah dari page jumbo.
// Fungsi blok: hanya merender form line material usage dengan form instance dan handler dari parent.
// Hubungan flow: validasi, field name, builder payload, stok, HPP, payroll, dan service produksi tetap di parent/service existing.
const WorkLogMaterialUsageModal = ({
  open,
  editingIndex,
  form,
  materialOptionsResolver,
  onCancel,
  onOk,
}) => {
  const resolveMaterialOptions = (itemType) => materialOptionsResolver?.(itemType) || [];

  return (
    <Modal
      title={editingIndex !== null ? "Edit Material Usage" : "Tambah Material Usage"}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText="Simpan"
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={DEFAULT_WORK_LOG_MATERIAL_USAGE}
      >
        <Form.Item
          label="Item Type"
          name="itemType"
          rules={[{ required: true, message: "Item type wajib dipilih" }]}
        >
          <Select
            options={[
              { value: "raw_material", label: "Raw Material" },
              { value: "semi_finished_material", label: "Bahan Produksi" },
            ]}
          />
        </Form.Item>

        <Form.Item shouldUpdate noStyle>
          {({ getFieldValue, setFieldValue }) => {
            const itemType = getFieldValue("itemType");
            return (
              <Form.Item
                label="Item"
                name="itemId"
                rules={[{ required: true, message: "Item wajib dipilih" }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={resolveMaterialOptions(itemType)}
                  placeholder="Pilih item..."
                  onChange={() => {
                    setFieldValue("resolvedVariantKey", undefined);
                    setFieldValue("resolvedVariantLabel", "");
                  }}
                />
              </Form.Item>
            );
          }}
        </Form.Item>

        <Form.Item shouldUpdate noStyle>
          {({ getFieldValue, setFieldValue }) => {
            const itemType = getFieldValue("itemType");
            const itemId = getFieldValue("itemId");
            const selectedItem = resolveMaterialOptions(itemType).find((item) => item.value === itemId)?.raw;
            const hasVariants = inferHasVariants(selectedItem || {});
            const variantOptions = buildVariantOptionsFromItem(selectedItem || {});

            if (!hasVariants) return null;

            return (
              <Form.Item
                label="Varian Material"
                name="resolvedVariantKey"
                rules={[{ required: true, message: "Varian material wajib dipilih" }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={variantOptions}
                  placeholder="Pilih varian material..."
                  onChange={(value) => {
                    const selectedVariant = variantOptions.find((item) => item.value === value);
                    setFieldValue("resolvedVariantLabel", selectedVariant?.label || "");
                  }}
                />
              </Form.Item>
            );
          }}
        </Form.Item>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item label="Qty Batch" name="plannedQty">
              <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Actual Qty" name="actualQty">
              <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Unit" name="unit">
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Cost / Unit Snapshot" name="costPerUnitSnapshot">
          <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item label="Catatan" name="notes">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default WorkLogMaterialUsageModal;
