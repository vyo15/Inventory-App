import { Col, Form, Input, InputNumber, Modal, Row, Select } from "antd";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import {
  DEFAULT_BOM_MATERIAL_LINE,
  PRODUCTION_BOM_MATERIAL_ITEM_TYPES,
} from "../../../constants/productionBomOptions";
import { parseIntegerIdInput } from "../../../utils/formatters/numberId";
import {
  hydrateBomMaterialLineWithLiveCost,
  resolveBomCostSourceLabel,
} from "../../../utils/produksi/productionBomCostHelpers";
import { inferHasVariants } from "../../../utils/variants/variantStockHelpers";

const ProductionBomMaterialModal = ({
  editingMaterialIndex,
  getCurrentTargetType,
  getMaterialItemOptions,
  handleSaveMaterialLine,
  materialForm,
  materialModalVisible,
  setEditingMaterialIndex,
  setMaterialModalVisible,
}) => (
      <Modal
        title={
          editingMaterialIndex !== null
            ? "Edit Material Line"
            : "Tambah Material Line"
        }
        open={materialModalVisible}
        onCancel={() => {
          setMaterialModalVisible(false);
          setEditingMaterialIndex(null);
          materialForm.resetFields();
        }}
        onOk={handleSaveMaterialLine}
        okText="Simpan"
        destroyOnClose
      >
        <Form
          form={materialForm}
          layout="vertical"
          initialValues={DEFAULT_BOM_MATERIAL_LINE}
        >
          <Form.Item shouldUpdate noStyle>
            {() => {
              const targetType = getCurrentTargetType();

              return (
                <Form.Item
                  label="Jenis Bahan"
                  name="itemType"
                  rules={[
                    { required: true, message: "Jenis bahan wajib dipilih" },
                  ]}
                  tooltip={
                    targetType === "product"
                      ? "Produk jadi boleh memakai Semi Finished untuk komponen, dan Raw Material untuk consumable assembly seperti lem tembak."
                      : undefined
                  }
                >
                  <Select
                    options={PRODUCTION_BOM_MATERIAL_ITEM_TYPES}
                    onChange={() => {
                      materialForm.setFieldsValue({
                        itemId: undefined,
                        unit: "pcs",
                        costPerUnitSnapshot: 0,
                        costSourceSnapshot: "",
                        materialHasVariants: false,
                        materialVariantStrategy: "none",
                        fixedVariantKey: "",
                        fixedVariantLabel: "",
                      });
                    }}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const targetType = getCurrentTargetType();
              const itemType =
                getFieldValue("itemType") ||
                (targetType === "product" ? "semi_finished_material" : "raw_material");

              const options = getMaterialItemOptions(targetType, itemType);

              return (
                <Form.Item
                  label="Item Bahan"
                  name="itemId"
                  rules={[
                    {
                      required: true,
                      message: "Item bahan wajib dipilih",
                    },
                  ]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={options}
                    placeholder="Pilih item bahan..."
                    notFoundContent="Tidak ada item bahan yang bisa dipilih"
                    onChange={(value) => {
                      const selected = options.find(
                        (item) => item.value === value,
                      )?.raw;

                      const materialHasVariants = inferHasVariants(selected || {});

                      const hydratedLine = hydrateBomMaterialLineWithLiveCost({
                        itemType: getFieldValue("itemType"),
                        item: selected || {},
                        line: {
                          ...materialForm.getFieldsValue(),
                          itemId: value,
                          itemType: getFieldValue("itemType"),
                        },
                      });

                      materialForm.setFieldsValue({
                        unit: hydratedLine.unit || "pcs",
                        costPerUnitSnapshot: Number(hydratedLine.costPerUnitSnapshot || 0),
                        costSourceSnapshot: hydratedLine.costSourceSnapshot || "",
                        materialHasVariants,
                        materialVariantStrategy: materialHasVariants ? "inherit" : "none",
                        fixedVariantKey: "",
                        fixedVariantLabel: "",
                      });
                    }}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const targetType = getCurrentTargetType();
              const itemType =
                getFieldValue("itemType") ||
                (targetType === "product" ? "semi_finished_material" : "raw_material");
              const options = getMaterialItemOptions(targetType, itemType);
              const selectedItem = options.find(
                (item) => item.value === getFieldValue("itemId"),
              )?.raw;
              const hasVariants = inferHasVariants(selectedItem || {});

              return (
                <>
                  <Form.Item name="materialHasVariants" hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item name="materialVariantStrategy" hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item name="fixedVariantKey" hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item name="fixedVariantLabel" hidden>
                    <Input />
                  </Form.Item>
                  <Form.Item name="costSourceSnapshot" hidden>
                    <Input />
                  </Form.Item>

                  <ImsNotice
                    variant="info"
                    compact
                    className="ims-mb-16"
                    title={
                      hasVariants
                        ? "Item bahan ini punya varian. Variant tidak dipilih di BOM dan akan otomatis mengikuti variant target saat Production Order dibuat."
                        : "Item bahan ini tidak memakai varian. Saat Production Order dibuat, stok akan dibaca dari master item."
                    }
                    description={`Estimasi biaya membaca ${resolveBomCostSourceLabel(getFieldValue("costSourceSnapshot"))}.`}
                  />
                </>
              );
            }}
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                label="Kebutuhan per Produksi"
                name="qtyPerBatch"
                tooltip="Isi jumlah bahan yang dibutuhkan untuk 1 kali produksi sesuai output BOM ini."
              >
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Satuan Bahan"
                name="unit"
                tooltip="Diambil otomatis dari master bahan yang dipilih."
              >
                <Input disabled />
              </Form.Item>
            </Col>
          </Row>

        </Form>
      </Modal>
);

export default ProductionBomMaterialModal;
