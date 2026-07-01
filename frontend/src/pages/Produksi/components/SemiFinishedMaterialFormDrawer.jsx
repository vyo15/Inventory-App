import {
  Button,
  Card,
  Col,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import { PlusOutlined, StopOutlined } from "@ant-design/icons";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import {
  DEFAULT_SEMI_FINISHED_FORM,
  DEFAULT_SEMI_FINISHED_VARIANT,
  SEMI_FINISHED_CATEGORIES,
  formatSemiFinishedStockSummary,
} from "../../../constants/semiFinishedMaterialOptions";
import { formatHppUnitCurrencyId } from "../../../utils/formatters/currencyId";
import formatNumber, { parseIntegerIdInput } from "../../../utils/formatters/numberId";
import { buildFormValues, normalizeFormVariants } from "../helpers/semiFinishedMaterialsPageHelpers";

const SemiFinishedMaterialFormDrawer = ({
  calculatedTotals,
  canActivateVariantsForEditing,
  componentGroupSelectOptions,
  editingMaterial,
  flowerTypeSelectOptions,
  form,
  formVisible,
  handleSubmit,
  hasVariantModeSwitchLocked,
  hasVariantsValue,
  isEditingMaterial,
  isGuardedVariantStock,
  resetFormState,
  setFormVisible,
  stockEditHelpText,
  submitting,
  variantLabelValue,
}) => (
      <Drawer
        title={
          editingMaterial?.id
            ? "Edit Semi Finished Material"
            : "Tambah Semi Finished Material"
        }
        open={formVisible}
        onClose={() => {
          setFormVisible(false);
          resetFormState();
        }}
        width={860}
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
          initialValues={buildFormValues(DEFAULT_SEMI_FINISHED_FORM)}
        >
          <Divider orientation="left">Informasi Dasar</Divider>

          {/* =====================================================
          SECTION: Semi Finished internal code hidden from main UI — AKTIF
          Fungsi:
          - Menyembunyikan input kode utama Semi Finished dari form tambah/edit agar user fokus pada nama, kategori, varian, dan stok.

          Dipakai oleh:
          - Drawer form Semi Finished Materials dan semiFinishedMaterialsService sebagai pembuat kode internal.

          Alasan perubahan:
          - Kode SFP tetap dibuat otomatis oleh service, tetapi tidak perlu menjadi input atau preview utama di UI.

          Catatan cleanup:
          - Kode internal disimpan untuk relasi/audit teknis, tetapi tidak ditampilkan di UI operasional.

          Risiko:
          - Jangan menambahkan kembali input manual code karena dapat merusak immutability dan duplicate guard service.
          ===================================================== */}
          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item
                label="Nama Item"
                name="name"
                rules={[{ required: true, message: "Nama wajib diisi" }]}
              >
                <Input placeholder="Contoh: Kelopak Mawar Potong S" />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="Deskripsi" name="description">
                <Input.TextArea rows={2} placeholder="Deskripsi item..." />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Jenis Komponen"
                name="category"
                rules={[{ required: true, message: "Jenis komponen wajib dipilih" }]}
                tooltip="Dipakai oleh logic produksi dan perhitungan resep komponen."
              >
                <Select options={SEMI_FINISHED_CATEGORIES} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Jenis Bunga"
                name="flowerTypeId"
                tooltip="Opsional. Kosongkan untuk komponen umum/reusable seperti kawat tangkai yang dipakai lintas jenis bunga."
              >
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={flowerTypeSelectOptions}
                  placeholder="Umum / Reusable atau pilih jenis bunga"
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Kelompok Komponen"
                name="categoryId"
                tooltip="Opsional untuk pencarian dan laporan; tidak mengubah logic produksi."
              >
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={componentGroupSelectOptions}
                  placeholder="Pilih kelompok komponen"
                />
              </Form.Item>
            </Col>

          </Row>

          {/* IMS NOTE [GUARDED | behavior-preserving]: mode varian dikunci saat edit
              agar bucket stok produksi tidak berubah tanpa audit. */}
          <Form.Item
            label="Pakai Varian"
            name="hasVariants"
            valuePropName="checked"
            extra={isEditingMaterial
              ? canActivateVariantsForEditing
                ? 'Semi Product lama dengan stok 0 boleh mulai memakai varian. Semua varian baru tetap stok 0.'
                : 'Mode varian dikunci setelah item dibuat agar bucket stok produksi tidak berubah tanpa audit.'
              : undefined}
          >
            <Switch
              checkedChildren="Ya"
              unCheckedChildren="Tidak"
              disabled={hasVariantModeSwitchLocked}
              onChange={(checked) => {
                if (hasVariantModeSwitchLocked) return;
                if (checked) {
                  form.setFieldsValue({
                    variantLabel: form.getFieldValue('variantLabel') || 'Varian',
                    variants: normalizeFormVariants(form.getFieldValue('variants') || [], true),
                    currentStock: isEditingMaterial ? 0 : form.getFieldValue('currentStock'),
                    reservedStock: isEditingMaterial ? 0 : form.getFieldValue('reservedStock'),
                  });
                } else {
                  form.setFieldsValue({ variants: [], variantLabel: 'Varian' });
                }
              }}
            />
          </Form.Item>

          {hasVariantsValue ? (
            <Form.Item
              label="Label Varian"
              name="variantLabel"
              tooltip="Label ini hanya metadata tampilan. Contoh: Warna, Ukuran, Tipe, Motif, atau Spesifikasi."
            >
              <Input placeholder="Contoh: Warna" />
            </Form.Item>
          ) : null}

          <Divider orientation="left">{hasVariantsValue ? "Varian & Stok" : "Stok Master"}</Divider>

          <ImsNotice
            variant="info"
            compact
            className="ims-mb-16"
            title={isEditingMaterial
              ? canActivateVariantsForEditing
                ? 'Semi Product lama ini stoknya 0, jadi boleh mulai memakai varian. Stok tiap varian baru tetap 0 sampai diubah lewat Stock Adjustment/produksi/transaksi resmi.'
                : stockEditHelpText
              : hasVariantsValue
                ? "Gunakan 1 master item untuk 1 jenis komponen. Tambahkan nama varian sesuai label seperti Warna, Ukuran, Tipe, Motif, atau Spesifikasi. Total stok item dihitung otomatis dari semua varian."
                : "Item tanpa varian memakai stok awal langsung di master semi finished material."}
            description={isEditingMaterial && hasVariantsValue
              ? "Mengubah nama varian hanya mengganti label tampilan. Bucket stok/reference tetap dijaga melalui variantKey existing."
              : undefined}
          />

          {hasVariantsValue ? (
          <>
            {/* =====================================================
            SECTION: Semi Finished Variant Form Without Variant Min Stock — AKTIF
            Fungsi:
            - menampilkan varian sebagai bucket stok fisik sambil menjaga Min Stock Alert sebagai field master item.

            Dipakai oleh:
            - SemiFinishedMaterials.jsx create/edit drawer dan semiFinishedMaterialsService payload.

            Alasan perubahan:
            - `variants[].minStockAlert` adalah compatibility data historis; minimum stock Semi Finished tidak lagi diisi per varian.

            Catatan cleanup:
            - field data historis varian dapat diaudit pada batch maintenance terpisah.

            Risiko:
            - input min stock per varian yang diaktifkan lagi akan membuat status Perlu Dicek tidak konsisten dengan source master.
            ===================================================== */}
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item label="Min Stock Alert Master" name="minStockAlert">
                  <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.List name="variants">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: "100%" }} size={12}>
                {fields.map((field, index) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={`${variantLabelValue || 'Varian'} ${index + 1}`}
                    extra={
                      fields.length > 1 ? (
                        <Button
                          danger
                          size="small"
                          icon={<StopOutlined />}
                          disabled={fields.length === 1 || isGuardedVariantStock(field.name)}
                          onClick={() => remove(field.name)}
                        >
                          Arsipkan Varian
                        </Button>
                      ) : null
                    }
                  >
                    <Row gutter={16}>
                      {/* IMS NOTE [GUARDED | identity-safe]: hidden identity field
                          menjaga variantKey lama tetap terkirim saat nama varian diganti.
                          Hubungan flow: service memakai key ini untuk preserve bucket
                          stok/reference PO/Work Log. STATUS: AKTIF. */}
                      <Form.Item name={[field.name, "variantKey"]} hidden>
                        <Input />
                      </Form.Item>
                      <Col xs={24} md={8}>
                        <Form.Item
                          {...field}
                          label={`Nama ${variantLabelValue || 'Varian'}`}
                          name={[field.name, "color"]}
                          rules={[{ required: true, message: "Nama varian wajib diisi" }]}
                        >
                          <Input placeholder="Contoh: Merah, Ukuran S, Motif Polkadot" />
                        </Form.Item>
                      </Col>

                      <Form.Item {...field} name={[field.name, "sku"]} hidden>
                        <Input />
                      </Form.Item>

                      <Col xs={24} md={8}>
                        <Form.Item
                          {...field}
                          label="Status Varian"
                          name={[field.name, "isActive"]}
                          valuePropName="checked"
                        >
                          <Switch disabled={isGuardedVariantStock(field.name)} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={8}>
                        <Form.Item
                          {...field}
                          label="Current Stock"
                          name={[field.name, "currentStock"]}
                          extra={isEditingMaterial ? stockEditHelpText : undefined}
                        >
                          <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} disabled={isEditingMaterial} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={8}>
                        <Form.Item
                          {...field}
                          label="Reserved Stock"
                          name={[field.name, "reservedStock"]}
                          extra={isEditingMaterial ? 'Reserved stock dikunci karena memengaruhi available stock.' : undefined}
                        >
                          <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} disabled />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={8}>
                        <Form.Item
                          {...field}
                          label="Average Cost / Unit"
                          name={[field.name, "averageCostPerUnit"]}
                          extra={isEditingMaterial ? 'Average cost varian berasal dari produksi dan dikunci saat edit master.' : undefined}
                        >
                          <InputNumber
                            min={0}
                            step={1}
                            precision={0}
                            parser={parseIntegerIdInput}
                            style={{ width: "100%" }}
                            disabled={isEditingMaterial}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}

                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => add({ ...DEFAULT_SEMI_FINISHED_VARIANT })}
                  block
                >
                  Tambah Varian
                </Button>
              </Space>
            )}
          </Form.List>
          </>
          ) : (
            <Row gutter={16}>
              <Col xs={24} md={6}>
                <Form.Item label="Current Stock" name="currentStock" extra={isEditingMaterial ? stockEditHelpText : undefined}>
                  <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} disabled={isEditingMaterial} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="Reserved Stock" name="reservedStock" extra={isEditingMaterial ? 'Reserved stock dikunci karena memengaruhi available stock.' : undefined}>
                  <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} disabled={isEditingMaterial} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item label="Min Stock Alert" name="minStockAlert">
                  <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item
                  label="Average Cost / Unit"
                  name="averageCostPerUnit"
                  extra={isEditingMaterial ? 'Average cost berasal dari produksi dan dikunci saat edit master.' : undefined}
                >
                  <InputNumber
                    min={0}
                    step={1}
                    precision={0}
                    parser={parseIntegerIdInput}
                    style={{ width: "100%" }}
                    disabled={isEditingMaterial}
                  />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Divider orientation="left">Ringkasan Stok Master</Divider>

          {/* =====================================================
          SECTION: Semi Finished Master Stock Summary — AKTIF
          Fungsi:
          - menampilkan current/reserved/available total dari varian dan Min Stock Alert dari field master item.

          Dipakai oleh:
          - SemiFinishedMaterials.jsx form summary sebelum create/edit disimpan.

          Alasan perubahan:
          - ringkasan lama menyebut Min Stock Alert sebagai akumulasi varian, padahal rule final memakai master `minStockAlert`.

          Catatan cleanup:
          - belum ada.

          Risiko:
          - wording/perhitungan yang kembali ke total varian akan membingungkan validasi low stock Semi Finished.
          ===================================================== */}
          <div className="ims-readonly-panel">
            <div className="ims-readonly-panel-header">
              <div>
                <div className="ims-readonly-panel-title">
                  Ringkasan Stok Master
                </div>
                <div className="ims-readonly-panel-description">
                  {hasVariantsValue
                    ? "Current Stock, Reserved Stock, dan Available Stock adalah total varian. Min Stock Alert tetap satu angka master item."
                    : "Ringkasan di bawah ini adalah nilai stok master langsung karena item ini tidak memakai varian."}
                </div>
              </div>
              <Tag color={hasVariantsValue ? "purple" : "default"}>
                {hasVariantsValue ? "Stok Varian + Min Master" : "Master"}
              </Tag>
            </div>
          </div>

          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item label="Total Current Stock">
                <Input value={formatNumber(calculatedTotals.currentStock)} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Total Reserved Stock">
                <Input value={formatNumber(calculatedTotals.reservedStock)} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Total Available Stock">
                <Input value={formatNumber(calculatedTotals.availableStock)} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={6}>
              <Form.Item label="Min Stock Alert Master">
                <Input value={formatNumber(calculatedTotals.minStockAlert)} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Max Stock Target" name="maxStockTarget">
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Status Aktif"
                name="isActive"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Jumlah Varian Aktif">
                <Input
                  value={`${formatNumber(calculatedTotals.activeVariantCount)} dari ${formatNumber(calculatedTotals.variantCount)} varian`}
                  disabled
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Biaya Master</Divider>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                label="Reference Cost / Unit"
                name="referenceCostPerUnit"
              >
                <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item
                label="Last Production Cost / Unit"
                name="lastProductionCostPerUnit"
                extra={isEditingMaterial ? 'Nilai ini berasal dari production completion dan dikunci saat edit master.' : undefined}
              >
                <InputNumber
                  min={0}
                  step={1}
                  precision={0}
                  parser={parseIntegerIdInput}
                  style={{ width: "100%" }}
                  disabled={isEditingMaterial}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="Average Cost / Unit (Otomatis)">
                <Input value={formatHppUnitCurrencyId(calculatedTotals.averageCostPerUnit)} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item label="Ringkasan">
                <Card size="small">
                  <Space direction="vertical" size={0}>
                    <Typography.Text>
                      {formatSemiFinishedStockSummary(calculatedTotals)}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      Average Cost: {formatHppUnitCurrencyId(calculatedTotals.averageCostPerUnit)}
                    </Typography.Text>
                  </Space>
                </Card>
              </Form.Item>
            </Col>
          </Row>

        </Form>
      </Drawer>
);

export default SemiFinishedMaterialFormDrawer;
