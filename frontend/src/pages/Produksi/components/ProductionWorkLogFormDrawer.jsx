import {
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import EditableLineSection from "../../../components/Produksi/shared/EditableLineSection";
import {
  DEFAULT_PRODUCTION_WORK_LOG_FORM,
  PRODUCTION_WORK_LOG_SOURCE_TYPES,
} from "../../../constants/productionWorkLogOptions";
import formatCurrency from "../../../utils/formatters/currencyId";
import formatNumber, { parseIntegerIdInput } from "../../../utils/formatters/numberId";
import { workLogUiClassNames } from "../helpers/productionWorkLogsPageHelpers";

const buildWorkLogLineActionColumn = ({ deleteTitle, isLocked, onDelete, onEdit }) => ({
  title: "Aksi",
  width: 140,
  className: "app-table-action-column",
  render: (_, record, index) => (
    <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
      <Button
        className="ims-action-button"
        size="small"
        disabled={isLocked}
        onClick={() => onEdit(index, record)}
      >
        Edit
      </Button>
      <Popconfirm
        title={deleteTitle}
        onConfirm={() => onDelete(index)}
        okText="Ya"
        cancelText="Batal"
        disabled={isLocked}
      >
        <Button
          className="ims-action-button"
          size="small"
          danger
          disabled={isLocked}
          icon={<DeleteOutlined />}
        />
      </Popconfirm>
    </Space>
  ),
});

const ProductionWorkLogFormDrawer = ({
  formState: { editingRecord, form, formVisible, submitting },
  referenceData: {
    employeeOptions,
    productionOrderOptions,
    referenceData,
    stepOptions,
  },
  selectionState: {
    monitoringPreview,
    selectedProductionProfile,
    targetIdValue,
    targetTypeValue,
  },
  actions: {
    closeFormDrawer,
    getProductionProfileOptions,
    getTargetOptions,
    handleApplyBomTemplate,
    handleApplyProductionOrderTemplate,
    handleRemoveMaterialUsage,
    handleRemoveOutput,
    handleSubmit,
    openMaterialModal,
    openOutputModal,
  },
}) => (
      <Drawer
        title={
          editingRecord?.id
            ? "Edit Work Log Produksi"
            : "Work Log dari Order Produksi"
        }
        open={formVisible}
        onClose={closeFormDrawer}
        width={980}
        destroyOnClose
        extra={
          <Space>
            <Button
              onClick={closeFormDrawer}
            >
              Batal
            </Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              Simpan
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            ...DEFAULT_PRODUCTION_WORK_LOG_FORM,
            workDate: dayjs(),
            sourceType: "production_order",
            status: "in_progress",
          }}
        >
          <Divider orientation="left">Informasi Dasar</Divider>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="No. Work Log"
                name="workNumber"
              >
                <Input placeholder="Otomatis: JOB-DDMMYYYY-001" disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Tanggal"
                name="workDate"
                rules={[{ required: true, message: "Tanggal wajib diisi" }]}
              >
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Sumber Work Log"
                name="sourceType"
                tooltip="Work Log baru dibuat dari order produksi. Manual/Planned hanya pembacaan arsip."
              >
                <Select options={PRODUCTION_WORK_LOG_SOURCE_TYPES} disabled />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const sourceType = getFieldValue("sourceType");

              return (
                <>
                  {sourceType === "production_order" ? (
                    <Card size="small" style={{ marginBottom: 16 }}>
                      <Row gutter={16}>
                        <Col xs={24} md={18}>
                          <Form.Item
                            label="No. Order Produksi"
                            name="productionOrderId"
                          >
                            <Select
                              showSearch
                              optionFilterProp="label"
                              options={productionOrderOptions}
                              placeholder="Pilih order produksi..."
                              disabled={Boolean(editingRecord?.id)}
                              onChange={(value) => {
                                if (value) {
                                  handleApplyProductionOrderTemplate(value);
                                }
                              }}
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={6}>
                          <Form.Item label=" ">
                            <Button
                              block
                              disabled={Boolean(editingRecord?.id)}
                              onClick={() => {
                                const orderId =
                                  form.getFieldValue("productionOrderId");
                                if (orderId) {
                                  handleApplyProductionOrderTemplate(orderId);
                                }
                              }}
                            >
                              Ambil Data PO
                            </Button>
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  ) : null}

                  {sourceType === "planned" ? (
                    <Card size="small" style={{ marginBottom: 16 }}>
                      <Row gutter={16}>
                        <Col xs={24} md={18}>
                          <Form.Item label="Resep Produksi" name="bomId">
                            <Select
                              showSearch
                              optionFilterProp="label"
                              options={(referenceData.boms || []).map(
                                (item) => ({
                                  value: item.id,
                                  label: item.name || "-",
                                }),
                              )}
                              placeholder="Pilih resep produksi..."
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={6}>
                          <Form.Item label=" ">
                            <Button
                              block
                              onClick={() => {
                                const bomId = form.getFieldValue("bomId");
                                if (bomId) {
                                  handleApplyBomTemplate(bomId);
                                }
                              }}
                            >
                              Ambil Data BOM
                            </Button>
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  ) : null}
                </>
              );
            }}
          </Form.Item>

          <Divider orientation="left">Target & Tahapan</Divider>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="Jenis Target"
                name="targetType"
                rules={[
                  { required: true, message: "Jenis target wajib dipilih" },
                ]}
              >
                <Select
                  options={[
                    { value: "semi_finished_material", label: "Bahan Produksi" },
                    { value: "product", label: "Produk Jadi" },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={16}>
              <Form.Item
                label="Target Produksi"
                name="targetId"
                rules={[
                  { required: true, message: "Target produksi wajib dipilih" },
                ]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={getTargetOptions(targetTypeValue)}
                  placeholder="Pilih target produksi..."
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={24}>
              <Form.Item label="Profil Produksi" name="productionProfileId">
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={getProductionProfileOptions(targetIdValue)}
                  placeholder="Pilih profil produksi untuk target ini..."
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={16}>
              <Form.Item
                label="Tahapan Produksi"
                name="stepId"
                rules={[{ required: true, message: "Tahapan wajib dipilih" }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={stepOptions}
                  placeholder="Pilih tahapan..."
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Sequence No" name="sequenceNo">
                <InputNumber min={1} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Qty & Operator</Divider>

          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item
                label="Qty Batch"
                name="plannedQty"
                rules={[{ required: true, message: "Planned qty wajib diisi" }]}
              >
                <InputNumber min={1} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Qty Input Dasar" name="baseInputQty">
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Sisa Daun Aktual" name="leftoverLeafQty">
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Sisa Kawat Aktual" name="leftoverStemQty">
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Good Qty" name="goodQty">
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Form.Item name="rejectQty" hidden><InputNumber /></Form.Item>
            <Form.Item name="reworkQty" hidden><InputNumber /></Form.Item>

            <Col xs={24}>
              <Form.Item label="Worker" name="workerIds">
                <Select
                  mode="multiple"
                  maxCount={1}
                  showSearch
                  optionFilterProp="label"
                  options={employeeOptions}
                  placeholder="Pilih 1 operator produksi..."
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Sisa Setara Bunga Kelopak" name="leftoverPetalFlowerEquivalent">
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {selectedProductionProfile ? (
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}><strong>Profil:</strong> {selectedProductionProfile.profileName || '-'}</Col>
                <Col xs={24} md={8}><strong>Teoritis Bunga:</strong> {formatNumber(monitoringPreview.theoreticalFlowerEquivalent || 0)}</Col>
                <Col xs={24} md={8}><strong>Miss %:</strong> {formatNumber(monitoringPreview.missPercent || 0)}%</Col>
                <Col xs={24} md={8}><strong>Miss Kelopak:</strong> {formatNumber(monitoringPreview.missPetalQty || 0)} pcs</Col>
                <Col xs={24} md={8}><strong>Miss Daun:</strong> {formatNumber(monitoringPreview.missLeafQty || 0)} pcs</Col>
                <Col xs={24} md={8}><strong>Miss Kawat:</strong> {formatNumber(monitoringPreview.missStemQty || 0)} pcs</Col>
              </Row>
            </Card>
          ) : null}

          <EditableLineSection
            title="Material Usages"
            description={editingRecord?.productionOrderId ? "Material dari PO terkunci agar pemakaian stok dan audit tidak berubah." : undefined}
            addButtonText="Tambah Material Usage"
            onAdd={() => openMaterialModal()}
            showAddButton={!editingRecord?.productionOrderId}
            dataSource={form.getFieldValue("materialUsages") || []}
            emptyText="Belum ada material usage"
            columns={[
              {
                title: "Item",
                key: "item",
                // =====================================================
                // AKTIF / GUARDED:
                // - metadata code/variant memakai class token global agar warna netral konsisten light/dark.
                // - hanya perubahan presentational; tidak mengubah payload work log, status, payroll, atau HPP.
                // =====================================================
                render: (_, record) => (
                  <div>
                    <div className={workLogUiClassNames.title}>{record.itemName || "-"}</div>
                    {record.resolvedVariantLabel ? (
                      <div className="ims-cell-meta">
                        Varian: {record.resolvedVariantLabel}
                      </div>
                    ) : null}
                  </div>
                ),
              },
              {
                title: "Qty",
                key: "qty",
                width: 180,
                render: (_, record) => (
                  <Space direction="vertical" size={0}>
                    <Typography.Text>
                      Plan: {formatNumber(record.plannedQty)}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      Actual: {formatNumber(record.actualQty)}
                    </Typography.Text>
                  </Space>
                ),
              },
              {
                title: "Total Cost",
                dataIndex: "totalCostSnapshot",
                width: 150,
                render: (value) => formatCurrency(value),
              },
              buildWorkLogLineActionColumn({
                deleteTitle: "Keluarkan pemakaian material dari form ini?",
                isLocked: Boolean(editingRecord?.productionOrderId),
                onDelete: handleRemoveMaterialUsage,
                onEdit: openMaterialModal,
              }),
            ]}
          />

          <EditableLineSection
            title="Outputs"
            description={editingRecord?.productionOrderId ? "Output dari PO terkunci. Isi Good Qty dari modal Selesaikan agar stok/HPP tetap konsisten." : undefined}
            addButtonText="Tambah Output"
            onAdd={() => openOutputModal()}
            showAddButton={!editingRecord?.productionOrderId}
            dataSource={form.getFieldValue("outputs") || []}
            emptyText="Belum ada output"
            columns={[
              {
                title: "Output",
                key: "output",
                render: (_, record) => (
                  <div>
                    <div className={workLogUiClassNames.title}>{record.outputName || "-"}</div>
                    <div className="ims-cell-meta">{record.outputCode || "-"}</div>
                    {record.outputVariantLabel ? (
                      <div className="ims-cell-meta">
                        Varian: {record.outputVariantLabel}
                      </div>
                    ) : null}
                  </div>
                ),
              },
              {
                title: "Qty",
                key: "qty",
                width: 180,
                render: (_, record) => (
                  <Typography.Text>
                    Good: {formatNumber(record.goodQty)}
                  </Typography.Text>
                ),
              },
              buildWorkLogLineActionColumn({
                deleteTitle: "Keluarkan output dari form ini?",
                isLocked: Boolean(editingRecord?.productionOrderId),
                onDelete: handleRemoveOutput,
                onEdit: openOutputModal,
              }),
            ]}
          />

          <Divider orientation="left">Biaya & Catatan</Divider>

          <Row gutter={16}>
            <Col xs={24} md={4}>
              <Form.Item
                label="Biaya Tenaga Kerja"
                name="laborCostActual"
                tooltip="Biaya tenaga kerja aktif dibaca dari Payroll Produksi; estimasi tahapan hanya info."
              >
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={4}>
              <Form.Item
                label="Biaya Overhead"
                name="overheadCostActual"
                tooltip="Overhead aktif berasal dari resep produksi untuk listrik/glue gun."
              >
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} disabled={Boolean(editingRecord?.productionOrderId)} />
              </Form.Item>
            </Col>

            <Form.Item name="scrapQty" hidden>
              <InputNumber />
            </Form.Item>

            <Col xs={24} md={16}>
              <Form.Item label="Catatan" name="notes">
                <Input.TextArea rows={2} placeholder="Catatan work log..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
);

export default ProductionWorkLogFormDrawer;
