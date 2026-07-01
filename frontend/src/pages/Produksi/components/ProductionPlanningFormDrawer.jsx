import {
  Button,
  Col,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
} from "antd";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import { parseIntegerIdInput } from "../../../utils/formatters/numberId";

const ProductionPlanningFormDrawer = ({
  PERIOD_OPTIONS,
  PRIORITY_OPTIONS,
  TARGET_TYPE_OPTIONS,
  editingPlan,
  form,
  formVisible,
  getDefaultPeriodRange,
  getTargetOptions,
  handleSubmit,
  referenceData,
  selectedTargetItem,
  setEditingPlan,
  setFormVisible,
  submitting,
  targetTypeValue,
  targetVariantOptions,
  toDatePickerValue,
}) => (
      <Drawer
        title={editingPlan ? "Edit Production Planning" : "Tambah Production Planning"}
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          setEditingPlan(null);
        }}
        width={720}
        extra={
          <Space>
            <Button onClick={() => setFormVisible(false)}>Batal</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              Simpan
            </Button>
          </Space>
        }
      >
        <ImsNotice
          variant="guard"
          compact
          className="ims-mb-16"
          title="Form ini tidak mengubah stok; progress dari Work Log completed."
        />

        {/* =====================================================
            ACTIVE - form planning.
            Fungsi:
            - menyimpan target produksi, periode, deadline, prioritas, dan varian target;
            - tidak menyimpan actual progress manual karena progress dihitung service.
        ===================================================== */}
        <Form form={form} layout="vertical">
          <Form.Item label="Judul Planning" name="title">
            <Input placeholder="Contoh: Target kelopak mawar merah minggu ini" />
          </Form.Item>

          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item label="Tipe Periode" name="periodType" rules={[{ required: true, message: "Tipe periode wajib dipilih" }]}>
                <Select
                  options={PERIOD_OPTIONS}
                  onChange={(value) => {
                    const range = getDefaultPeriodRange(value);
                    form.setFieldsValue({
                      periodStartDate: toDatePickerValue(range.start),
                      periodEndDate: toDatePickerValue(range.end),
                      dueDate: toDatePickerValue(range.end),
                    });
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Mulai Periode" name="periodStartDate" rules={[{ required: true, message: "Mulai periode wajib diisi" }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Akhir Periode" name="periodEndDate" rules={[{ required: true, message: "Akhir periode wajib diisi" }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Form.Item label="Deadline" name="dueDate" rules={[{ required: true, message: "Deadline wajib diisi" }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Target Type" name="targetType" rules={[{ required: true, message: "Target type wajib dipilih" }]}>
                <Select
                  options={TARGET_TYPE_OPTIONS}
                  onChange={() => {
                    form.setFieldsValue({
                      targetItemId: undefined,
                      targetVariantKey: undefined,
                    });
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Prioritas" name="priority">
                <Select options={PRIORITY_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Target Item" name="targetItemId" rules={[{ required: true, message: "Target item wajib dipilih" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Pilih produk / semi finished..."
              options={getTargetOptions({ targetType: targetTypeValue, referenceData })}
              onChange={() => {
                form.setFieldsValue({ targetVariantKey: undefined });
              }}
            />
          </Form.Item>

          {targetVariantOptions.length > 0 ? (
            <Form.Item
              label="Varian Target"
              name="targetVariantKey"
              rules={[{ required: true, message: "Varian target wajib dipilih" }]}
              tooltip="Progress mengikuti varian target."
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Pilih varian target..."
                options={targetVariantOptions}
              />
            </Form.Item>
          ) : null}

          <Form.Item label="Jumlah Target Produksi" name="targetQty" rules={[{ required: true, message: "Target qty wajib diisi" }]}>
            <InputNumber min={1} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} addonAfter={selectedTargetItem?.unit || "pcs"} />
          </Form.Item>

          <Form.Item label="Catatan" name="notes">
            <Input.TextArea rows={3} placeholder="Catatan rencana produksi..." />
          </Form.Item>
        </Form>
      </Drawer>
);

export default ProductionPlanningFormDrawer;
