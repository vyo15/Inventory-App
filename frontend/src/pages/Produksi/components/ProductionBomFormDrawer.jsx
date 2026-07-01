import {
  Button,
  Col,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import EditableLineSection from "../../../components/Produksi/shared/EditableLineSection";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import {
  BOM_MATERIAL_ITEM_TYPE_MAP,
  DEFAULT_PRODUCTION_BOM_FORM,
  PRODUCTION_BOM_TARGET_TYPES,
  calculateBomTotals,
} from "../../../constants/productionBomOptions";
import formatCurrency from "../../../utils/formatters/currencyId";
import formatNumber, { parseIntegerIdInput } from "../../../utils/formatters/numberId";
import {
  calculateBomStepLineCost,
  resolveBomCostSourceLabel,
} from "../../../utils/produksi/productionBomCostHelpers";

const buildBomLineActionColumn = ({ deleteTitle, onDelete, onEdit }) => ({
  title: "Aksi",
  width: 140,
  className: "app-table-action-column",
  render: (_, record, index) => (
    <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
      <Button className="ims-action-button" size="small" onClick={() => onEdit(index, record)}>
        Edit
      </Button>
      <Popconfirm
        title={deleteTitle}
        onConfirm={() => onDelete(index)}
        okText="Ya"
        cancelText="Batal"
      >
        <Button className="ims-action-button" size="small" danger icon={<DeleteOutlined />} />
      </Popconfirm>
    </Space>
  ),
});

const ProductionBomFormDrawer = ({
  editingBom,
  form,
  formErrorSummary,
  formVisible,
  getTargetOptions,
  handleRemoveMaterialLine,
  handleRemoveStepLine,
  handleSubmit,
  openMaterialModal,
  openStepModal,
  resetFormState,
  setFormVisible,
  submitting,
}) => (
      <Drawer
        title={editingBom?.id ? "Edit BOM Produksi" : "Tambah BOM Produksi"}
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          resetFormState();
        }}
        width={980}
        destroyOnClose
        extra={
          <Space>
            <Button
              onClick={() => {
                setFormVisible(false);
                resetFormState();
              }}
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
            ...DEFAULT_PRODUCTION_BOM_FORM,
            targetType: "product",
          }}
        >
          {formErrorSummary ? (
            <ImsNotice
              variant="critical"
              compact
              className="ims-mb-16"
              title={formErrorSummary}
            />
          ) : null}
          <Divider orientation="left">Informasi Dasar</Divider>

          {/* =====================================================
          SECTION: BOM internal code hidden from main UI — AKTIF
          Fungsi:
          - Menyembunyikan input kode BOM dari form tambah/edit agar user fokus pada target, komposisi bahan, step, dan formula BOM.

          Dipakai oleh:
          - Drawer form Production BOM dan productionBomsService sebagai pembuat kode internal.

          Alasan perubahan:
          - Kode BOM tetap dibuat otomatis oleh service, tetapi tidak perlu menjadi input utama di UI.

          Catatan cleanup:
          - Kode internal disimpan untuk relasi/audit teknis, tetapi tidak ditampilkan di UI operasional.

          Risiko:
          - Jangan menambahkan input manual code karena dapat membuat relasi BOM dan duplicate guard tidak konsisten.
          ===================================================== */}
          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item
                label="Nama BOM"
                name="name"
                rules={[{ required: true, message: "Nama BOM wajib diisi" }]}
              >
                <Input placeholder="Contoh: BOM Produksi Mawar Standar" />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Deskripsi" name="description">
                <Input.TextArea rows={2} placeholder="Deskripsi BOM..." />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Target BOM</Divider>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const targetType = getFieldValue("targetType") || "product";
              const targetOptions = getTargetOptions(targetType);

              return (
                <>
                  {targetType === "product" && targetOptions.length === 0 ? (
                    <ImsNotice
                      variant="guard"
                      compact
                      className="ims-mb-16"
                      title="Target product belum terbaca. Pastikan master Produk Jadi sudah ada dan halaman BOM sudah refresh."
                    />
                  ) : null}

                  {targetType === "semi_finished_material" &&
                  targetOptions.length === 0 ? (
                    <ImsNotice
                      variant="guard"
                      compact
                      className="ims-mb-16"
                      title="Target semi finished belum tersedia. Tambahkan Semi Finished Materials terlebih dahulu."
                    />
                  ) : null}

                  <Row gutter={16}>
                    <Col xs={24} md={8}>
                      <Form.Item
                        label="Target Type"
                        name="targetType"
                        rules={[
                          {
                            required: true,
                            message: "Target type wajib dipilih",
                          },
                        ]}
                      >
                        <Select
                          options={PRODUCTION_BOM_TARGET_TYPES}
                          onChange={() => {
                            form.setFieldsValue({
                              targetId: undefined,
                            });

                            const currentMaterialLines =
                              form.getFieldValue("materialLines") || [];

                            form.setFieldValue(
                              "materialLines",
                              currentMaterialLines.map((line) => ({
                                ...line,
                                itemType: line.itemType || "raw_material",
                              })),
                            );
                          }}
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={16}>
                      <Form.Item
                        label="Target Item"
                        name="targetId"
                        rules={[
                          {
                            required: true,
                            message: "Target item wajib dipilih",
                          },
                        ]}
                      >
                        <Select
                          key={`target-${targetType}-${targetOptions.length}`}
                          showSearch
                          optionFilterProp="label"
                          options={targetOptions}
                          placeholder="Pilih target BOM..."
                          notFoundContent="Tidak ada target yang bisa dipilih"
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Hasil per Produksi"
                        name="batchOutputQty"
                        tooltip="Isi jumlah output yang dihasilkan untuk 1 resep BOM ini. Contoh: 1 bunga, 10 tangkai, atau 20 potong komponen."
                      >
                        <InputNumber min={1} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Status Aktif"
                        name="isActive"
                        valuePropName="checked"
                        tooltip="Biarkan aktif kalau resep ini masih dipakai. Nonaktifkan hanya jika BOM lama sudah tidak digunakan."
                      >
                        <Switch />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              );
            }}
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const targetType = getFieldValue("targetType") || "product";
              const materialLines = getFieldValue("materialLines") || [];
              const stepLines = getFieldValue("stepLines") || [];
              const batchOutputQty = getFieldValue("batchOutputQty") || 1;

              const materialColumns = [
                {
                  title: "Item",
                  key: "item",
                  render: (_, record) => (
                    <div>
                      <div className="ims-cell-title">{record.itemName || "-"}</div>
                    </div>
                  ),
                },
                {
                  title: "Tipe",
                  dataIndex: "itemType",
                  width: 160,
                  render: (value) => <Tag>{BOM_MATERIAL_ITEM_TYPE_MAP[value] || "-"}</Tag>,
                },
                {
                  title: "Kebutuhan per Produksi",
                  key: "qty",
                  width: 220,
                  render: (_, record) => (
                    <Space direction="vertical" size={0}>
                      <Typography.Text>
                        {formatNumber(record.qtyPerBatch)} {record.unit || "pcs"}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        Estimasi biaya: {formatCurrency(record.totalCostSnapshot)}
                      </Typography.Text>
                      <Typography.Text type="secondary" className="ims-cell-meta">
                        Source: {resolveBomCostSourceLabel(record.costSourceSnapshot)}
                      </Typography.Text>
                    </Space>
                  ),
                },
                // Nested/subtable editor sengaja tetap non-sticky karena tidak punya masalah horizontal scroll nyata.
                buildBomLineActionColumn({
                  deleteTitle: "Keluarkan material dari BOM ini?",
                  onDelete: handleRemoveMaterialLine,
                  onEdit: openMaterialModal,
                }),
              ];

              const stepColumns = [
                {
                  title: "Urutan Langkah",
                  key: "step",
                  render: (_, record) => (
                    <div>
                      <div className="ims-cell-title">
                        Langkah {formatNumber(record.sequenceNo)} - {record.stepName || "-"}
                      </div>
                      {record.notes ? (
                        <div className="ims-cell-meta">{record.notes}</div>
                      ) : null}
                    </div>
                  ),
                },
                {
                  title: "Estimasi Upah",
                  key: "laborEstimate",
                  width: 190,
                  render: (_, record) => (
                    <Space direction="vertical" size={0}>
                      <Typography.Text>{formatCurrency(calculateBomStepLineCost(record, { batchOutputQty }))}</Typography.Text>
                      <Typography.Text type="secondary" className="ims-cell-meta">
                        {record.payrollMode === "per_qty" ? "Per Qty" : "Per Batch"}
                      </Typography.Text>
                    </Space>
                  ),
                },
                // Nested/subtable editor sengaja tetap non-sticky karena aksi masih langsung terlihat di dalam modal BOM.
                buildBomLineActionColumn({
                  deleteTitle: "Keluarkan tahap dari BOM ini?",
                  onDelete: handleRemoveStepLine,
                  onEdit: openStepModal,
                }),
              ];

              return (
                <>
                  <EditableLineSection
                    title="Komposisi Bahan"
                    description={
                      targetType === "product"
                        ? "Untuk produk jadi, pakai Semi Finished Materials sebagai komponen utama dan Raw Materials hanya untuk bahan assembly/consumable seperti lem tembak."
                        : "Untuk target semi finished, komposisi bahan boleh mengambil Raw Materials atau Semi Finished Materials sesuai kebutuhan proses."
                    }
                    addButtonText="Tambah Bahan"
                    onAdd={() => openMaterialModal()}
                    dataSource={materialLines}
                    columns={materialColumns}
                    emptyText="Belum ada material line"
                  />

                  <EditableLineSection
                    title="Tahapan Pekerjaan"
                    description="Satu resep/BOM mewakili satu perubahan stok, satu Work Log, dan satu aturan upah. Buat BOM terpisah untuk tahap produksi berikutnya."
                    alert={stepLines.length > 1 ? {
                      type: "warning",
                      message: "BOM lama ini memiliki lebih dari satu tahapan.",
                      description: "Pilih dan pertahankan satu tahapan yang benar sebelum menyimpan ulang BOM.",
                    } : undefined}
                    addButtonText="Pilih Tahapan Produksi"
                    onAdd={() => openStepModal()}
                    addButtonDisabled={stepLines.length >= 1}
                    dataSource={stepLines}
                    columns={stepColumns}
                    emptyText="Belum ada tahapan produksi"
                  />
                </>
              );
            }}
          </Form.Item>

          <Divider orientation="left">Biaya Estimasi</Divider>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const totals = calculateBomTotals(
                getFieldValue("materialLines") || [],
                getFieldValue("stepLines") || [],
                {
                  batchOutputQty: getFieldValue("batchOutputQty"),
                  overheadCostEstimate: getFieldValue("overheadCostEstimate"),
                },
              );

              return (
                <>
                  <Row gutter={16}>
                    <Col xs={24} md={6}>
                      <Form.Item label="Estimasi Material">
                        <Input value={formatCurrency(totals.materialCostEstimate)} disabled />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item label="Estimasi Upah Step">
                        <Input value={formatCurrency(totals.laborCostEstimate)} disabled />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item label="Overhead Manual" name="overheadCostEstimate">
                        <InputNumber
                          min={0}
                          step={1}
                          precision={0}
                          parser={parseIntegerIdInput}
                          style={{ width: "100%" }}
                        />
                      </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                      <Form.Item label="Total Estimasi">
                        <Input value={formatCurrency(totals.totalCostEstimate)} disabled />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Typography.Text type="secondary" className="ims-cell-meta">
                    Estimasi BOM memakai modal bahan dari master, tarif upah dari step, dan overhead manual sementara. HPP final tetap mengikuti Work Log dan payroll final.
                  </Typography.Text>
                </>
              );
            }}
          </Form.Item>

        </Form>
      </Drawer>
);

export default ProductionBomFormDrawer;
