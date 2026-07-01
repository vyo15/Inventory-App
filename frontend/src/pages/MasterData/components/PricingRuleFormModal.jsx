import {
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Switch,
} from "antd";
import { formatNumberId, parseIntegerIdInput } from "../../../utils/formatters/numberId";

const { Option } = Select;

const PricingRuleFormModal = ({
  baseCostOptions,
  closeFormModal,
  form,
  handleSaveRule,
  includeMarketplaceBufferValue,
  isEditing,
  isModalVisible,
  saveLoading,
}) => (
      <Modal
        title={isEditing ? "Edit Pricing Rule" : "Tambah Pricing Rule"}
        open={isModalVisible}
        onCancel={closeFormModal}
        onOk={() => form.submit()}
        okText="Simpan"
        cancelText="Batal"
        confirmLoading={saveLoading}
        width={760}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSaveRule}>
          {/* SECTION: nama dan target rule */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Nama Rule"
                name="name"
                rules={[{ required: true, message: "Nama rule wajib diisi." }]}
              >
                <Input placeholder="Contoh: Rule Shopee Bahan Baku" />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Target Rule"
                name="targetType"
                rules={[
                  { required: true, message: "Target type wajib dipilih." },
                ]}
              >
                <Select
                  onChange={(value) => {
                    form.setFieldsValue({
                      baseCostSource:
                        value === "products"
                          ? "hppPerUnit"
                          : "averageActualUnitCost",
                    });
                  }}
                >
                  <Option value="raw_materials">Bahan Baku</Option>
                  <Option value="products">Produk Jadi</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* SECTION: status aktif */}
          <Form.Item
            label="Status Aktif"
            name="isActive"
            valuePropName="checked"
          >
            <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
          </Form.Item>

          {/* SECTION: sumber biaya dasar */}
          <Form.Item
            label="Sumber Biaya Dasar"
            name="baseCostSource"
            rules={[
              { required: true, message: "Sumber biaya dasar wajib dipilih." },
            ]}
          >
            <Select>
              {baseCostOptions.map((item) => (
                <Option key={item.value} value={item.value}>
                  {item.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* SECTION: margin */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Tipe Margin"
                name="marginType"
                rules={[
                  { required: true, message: "Tipe margin wajib dipilih." },
                ]}
              >
                <Select>
                  <Option value="percent">Persen</Option>
                  <Option value="nominal">Nominal</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Nilai Margin"
                name="marginValue"
                rules={[
                  { required: true, message: "Nilai margin wajib diisi." },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  step={1}
                  precision={0}
                  formatter={(value) => formatNumberId(value)}
                  parser={parseIntegerIdInput}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* SECTION: pengaturan buffer marketplace */}
          <Form.Item
            label="Gunakan Buffer Marketplace"
            name="includeMarketplaceBuffer"
            valuePropName="checked"
          >
            <Switch checkedChildren="Ya" unCheckedChildren="Tidak" />
          </Form.Item>

          {includeMarketplaceBufferValue && (
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Tipe Buffer Marketplace"
                  name="marketplaceBufferType"
                  rules={[
                    {
                      required: true,
                      message: "Tipe buffer marketplace wajib dipilih.",
                    },
                  ]}
                >
                  <Select>
                    <Option value="percent">Persen</Option>
                    <Option value="nominal">Nominal</Option>
                  </Select>
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label="Nilai Buffer Marketplace"
                  name="marketplaceBufferValue"
                  rules={[
                    {
                      required: true,
                      message: "Nilai buffer marketplace wajib diisi.",
                    },
                  ]}
                >
                  <InputNumber
                    style={{ width: "100%" }}
                    min={0}
                    step={1}
                    precision={0}
                    formatter={(value) => formatNumberId(value)}
                    parser={parseIntegerIdInput}
                  />
                </Form.Item>
              </Col>
            </Row>
          )}

          {/* SECTION: pengaturan pembulatan */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Tipe Pembulatan"
                name="roundingType"
                rules={[
                  { required: true, message: "Tipe pembulatan wajib dipilih." },
                ]}
              >
                <Select>
                  <Option value="up">Naik (Up)</Option>
                  <Option value="nearest">Terdekat (Nearest)</Option>
                  <Option value="down">Turun (Down)</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item
                label="Kelipatan Pembulatan"
                name="roundingUnit"
                rules={[
                  { required: true, message: "Kelipatan pembulatan wajib diisi." },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={1}
                  step={1}
                  precision={0}
                  formatter={(value) => formatNumberId(value)}
                  parser={parseIntegerIdInput}
                />
              </Form.Item>
            </Col>
          </Row>

        </Form>
      </Modal>
);

export default PricingRuleFormModal;
