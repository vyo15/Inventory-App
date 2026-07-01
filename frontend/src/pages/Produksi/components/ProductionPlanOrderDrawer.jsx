import {
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import EmptyStateBlock from "../../../components/Layout/Feedback/EmptyStateBlock";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import { formatQuantityId, parseIntegerIdInput } from "../../../utils/formatters/numberId";

const { Text } = Typography;

const ProductionPlanOrderDrawer = ({
  PRIORITY_OPTIONS,
  getMatchingBomOptions,
  handleCreatePo,
  poDrawerVisible,
  poForm,
  poSubmitting,
  referenceData,
  selectedPlanForPo,
  setPoDrawerVisible,
}) => (
      <Drawer
        title="Buat Production Order dari Planning"
        open={poDrawerVisible}
        onClose={() => setPoDrawerVisible(false)}
        width={640}
        extra={
          <Space>
            <Button onClick={() => setPoDrawerVisible(false)}>Batal</Button>
            <Button type="primary" loading={poSubmitting} onClick={handleCreatePo}>
              Buat PO
            </Button>
          </Space>
        }
      >
        {!selectedPlanForPo ? (
          <EmptyStateBlock compact description="Pilih planning lebih dulu" />
        ) : (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <ImsNotice
              variant="info"
              compact
              title="PO tetap memakai BOM; planning hanya referensi target."
            />

            <Card size="small">
              <Space direction="vertical" size={2}>
                <Text strong>{selectedPlanForPo.planCode} · {selectedPlanForPo.targetItemName}</Text>
                <Text type="secondary">
                  Sisa target {formatQuantityId(selectedPlanForPo.remainingQty)} {selectedPlanForPo.targetUnit || "pcs"}
                  {selectedPlanForPo.targetVariantLabel ? ` · Varian ${selectedPlanForPo.targetVariantLabel}` : ""}
                </Text>
              </Space>
            </Card>

            {/* =====================================================
                ACTIVE / GUARDED - form PO dari planning.
                Fungsi:
                - user memilih BOM dan qty batch secara eksplisit;
                - create PO tetap lewat service PO existing agar requirement BOM tidak dilewati.
            ===================================================== */}
            <Form form={poForm} layout="vertical">
              <Form.Item label="BOM" name="bomId" rules={[{ required: true, message: "BOM wajib dipilih" }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Pilih BOM untuk target planning..."
                  options={getMatchingBomOptions({ plan: selectedPlanForPo, referenceData })}
                  notFoundContent="Belum ada BOM aktif yang cocok dengan target planning ini."
                />
              </Form.Item>

              <Form.Item label="Qty Batch Produksi" name="orderQty" rules={[{ required: true, message: "Qty batch wajib diisi" }]}>
                <InputNumber min={1} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>

              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item label="Rencana Mulai" name="plannedStartDate">
                    <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Rencana Selesai" name="plannedEndDate">
                    <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Prioritas PO" name="priority">
                <Select options={PRIORITY_OPTIONS} />
              </Form.Item>

              <Form.Item label="Catatan PO" name="notes">
                <Input.TextArea rows={3} />
              </Form.Item>
            </Form>
          </Space>
        )}
      </Drawer>
);

export default ProductionPlanOrderDrawer;
