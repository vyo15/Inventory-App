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
} from "antd";
import { PlusOutlined, StopOutlined } from "@ant-design/icons";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import ResponsiveFormSection from "../../../components/Layout/Mobile/ResponsiveFormSection";
import PricingModeSwitch from "../../../components/Pricing/PricingModeSwitch";
import StatusTag from "../../../components/Layout/Feedback/StatusTag";
import { formatNumberId } from "../../../utils/formatters/numberId";
import {
  DEFAULT_RAW_MATERIAL_VARIANT,
  ensureAtLeastOneRawMaterialVariant,
} from "../../../utils/variants/rawMaterialVariantHelpers";
import { RAW_MATERIAL_DEFAULT_FORM } from "../../../services/MasterData/rawMaterialsService";
import { buildFormValues, integerParser, unitOptions } from "../helpers/rawMaterialsPageHelpers";

const { Option } = Select;

const RawMaterialFormDrawer = ({
  formState: { form, formVisible, submitting },
  entityState: { editingRecord, isEditingMaterial },
  optionData: { categorySelectOptions, pricingRules },
  variantState: {
    canActivateVariantsForEditing,
    hasVariantModeSwitchLocked,
    hasVariantsValue,
    isGuardedVariantStock,
    variantLabelValue,
    variantStats,
  },
  pricingState: { pricingModeValue, pricingPreviewWarning },
  stockState: { stockEditHelpText },
  actions: { closeFormDrawer, handleSubmit, setPricingPreviewWarning },
}) => (
      <Drawer
        title={editingRecord ? 'Edit Bahan Baku' : 'Tambah Bahan Baku'}
        open={formVisible}
        onClose={closeFormDrawer}
        width={860}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={closeFormDrawer}>Batal</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              Simpan
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={buildFormValues(RAW_MATERIAL_DEFAULT_FORM)}>
          <ResponsiveFormSection
            title="Data Bahan Baku"
            subtitle="Atur identitas, struktur stok, modal, harga, dan varian. Sumber restock dikelola dari katalog Supplier."
          >
            <Divider orientation="left">Informasi Bahan</Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="name"
                  label="Nama Bahan Baku"
                  rules={[{ required: true, message: 'Nama bahan baku wajib diisi.' }]}
                >
                  <Input placeholder="Contoh: Kain Flanel" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="categoryId"
                  label="Kelompok Bahan"
                  rules={[{ required: true, message: 'Kelompok bahan wajib dipilih.' }]}
                  tooltip="Kelompok bahan, bukan satuan beli atau warna varian."
                >
                  <Select
                    placeholder="Pilih kelompok bahan"
                    options={categorySelectOptions}
                    notFoundContent="Tambahkan Kelompok Bahan dari menu Kategori & Kelompok."
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="stockUnit"
                  label="Satuan Stok"
                  rules={[{ required: true, message: 'Satuan stok wajib dipilih.' }]}
                >
                  <Select placeholder="Pilih satuan">
                    {unitOptions.map((unit) => (
                      <Option key={unit} value={unit}>{unit}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="hasVariants"
                  label="Pakai Varian"
                  valuePropName="checked"
                  extra={isEditingMaterial
                    ? canActivateVariantsForEditing
                      ? 'Bahan lama dengan stok 0 boleh mulai memakai varian. Stok varian baru tetap 0.'
                      : 'Mode varian dikunci setelah bahan dibuat agar identitas stok tetap aman.'
                    : 'Aktifkan untuk warna, ukuran, atau tipe yang stoknya perlu dipantau terpisah.'}
                >
                  <Switch
                    checkedChildren="Ya"
                    unCheckedChildren="Tidak"
                    disabled={hasVariantModeSwitchLocked}
                    onChange={(checked) => {
                      if (hasVariantModeSwitchLocked) return;
                      if (checked) {
                        form.setFieldsValue({
                          stock: 0,
                          minStock: 0,
                          variantLabel: form.getFieldValue('variantLabel') || 'Varian',
                          variants: ensureAtLeastOneRawMaterialVariant(form.getFieldValue('variants') || []),
                        });
                      } else {
                        form.setFieldsValue({ variants: [], variantLabel: 'Varian' });
                      }
                    }}
                  />
                </Form.Item>
              </Col>
            </Row>

            {hasVariantsValue ? (
              <Form.Item name="variantLabel" label="Label Varian" tooltip="Contoh: Warna, Ukuran, atau Tipe.">
                <Input placeholder="Contoh: Warna" />
              </Form.Item>
            ) : null}

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="specifications" label="Spesifikasi" tooltip="Opsional. Contoh: ketebalan, lebar, merek, atau kualitas.">
                  <Input.TextArea rows={3} placeholder="Tulis spesifikasi bahan" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="notes" label="Catatan Internal" tooltip="Opsional dan hanya untuk kebutuhan operasional.">
                  <Input.TextArea rows={3} placeholder="Tulis catatan bahan" />
                </Form.Item>
              </Col>
            </Row>

            <ImsNotice
              variant="info"
              compact
              className="ims-mb-16"
              title="Supplier tidak dikunci di master bahan. Atur banyak toko dan link melalui Katalog Supplier setelah bahan tersimpan."
            />

            <Divider orientation="left">Struktur Stok</Divider>
            {!hasVariantsValue ? (
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="stock"
                    label={isEditingMaterial ? 'Stok Saat Ini' : 'Stok Awal'}
                    extra={isEditingMaterial ? stockEditHelpText : 'Isi hanya jika sudah ada stok saat master dibuat.'}
                  >
                    <InputNumber
                      disabled={isEditingMaterial}
                      style={{ width: '100%' }}
                      min={0}
                      precision={0}
                      formatter={(value) => formatNumberId(value)}
                      parser={integerParser}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="minStock"
                    label="Minimum Stok"
                    rules={[{ required: true, message: 'Minimum stok wajib diisi.' }]}
                    tooltip="Batas peringatan restock untuk bahan tanpa varian."
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      precision={0}
                      formatter={(value) => formatNumberId(value)}
                      parser={integerParser}
                    />
                  </Form.Item>
                </Col>
              </Row>
            ) : (
              <ImsNotice
                variant="info"
                compact
                className="ims-mb-16"
                title="Stok awal dan minimum stok diatur pada masing-masing varian."
              />
            )}

            <Divider orientation="left">Modal dan Harga</Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="averageActualUnitCost"
                  label={isEditingMaterial ? 'Modal Aktual Rata-rata / Satuan' : 'Modal Stok Awal / Satuan'}
                  extra={isEditingMaterial
                    ? 'Dihitung otomatis dari Pembelian dan tidak dapat diubah dari master.'
                    : 'Wajib diisi jika stok awal atau stok varian awal lebih dari 0.'}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    precision={0}
                    formatter={(value) => formatNumberId(value)}
                    parser={integerParser}
                    disabled={isEditingMaterial}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="restockReferencePrice"
                  label="Harga Acuan Restock / Satuan"
                  rules={[{ required: true, message: 'Harga acuan restock wajib diisi.' }]}
                  tooltip="Fallback internal; harga aktual tetap diverifikasi saat Pembelian."
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    precision={0}
                    formatter={(value) => formatNumberId(value)}
                    parser={integerParser}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="pricingMode" hidden><Input type="hidden" /></Form.Item>
            <PricingModeSwitch
              value={pricingModeValue || 'manual'}
              extra={pricingModeValue === 'rule'
                ? 'Pricing Rule aktif: harga dihitung dari modal aktual rata-rata atau harga acuan restock.'
                : 'Manual: harga jual bahan diisi langsung.'}
              onChange={(nextMode) => {
                form.setFieldsValue({ pricingMode: nextMode });
                if (nextMode !== 'rule') {
                  form.setFieldsValue({ pricingRuleId: null });
                  setPricingPreviewWarning('');
                }
              }}
            />

            {pricingPreviewWarning ? (
              <ImsNotice variant="guard" compact className="ims-mb-16" title={pricingPreviewWarning} />
            ) : null}

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="pricingRuleId"
                  label="Pricing Rule"
                  rules={[{ required: pricingModeValue === 'rule', message: 'Pricing rule wajib dipilih untuk mode rule.' }]}
                >
                  <Select allowClear disabled={pricingModeValue !== 'rule'} placeholder="Pilih pricing rule">
                    {(pricingRules || []).map((rule) => (
                      <Option key={rule.id} value={rule.id}>
                        {rule.name}{rule?.isActive ? '' : ' (Nonaktif)'}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="sellingPrice"
                  label="Harga Jual / Satuan"
                  rules={[{ required: true, message: 'Harga jual wajib diisi.' }]}
                  tooltip="Tetap tersedia karena Bahan Baku saat ini dapat dipilih pada flow Penjualan."
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    precision={0}
                    formatter={(value) => formatNumberId(value)}
                    parser={integerParser}
                  />
                </Form.Item>
              </Col>
            </Row>

          {/* -----------------------------------------------------------------
              Section varian bahan baku.
              Saat aktif, stok tampil per varian dengan layout lebih rapat.
          ----------------------------------------------------------------- */}
          {hasVariantsValue ? (
            <>
              <Divider orientation="left">Varian Bahan</Divider>
              <ImsNotice
                variant="info"
                compact
                className="ims-mb-16"
                title={isEditingMaterial
                  ? canActivateVariantsForEditing
                    ? 'Bahan lama ini stoknya 0, jadi boleh mulai memakai varian. Stok tiap varian baru tetap 0 sampai diubah lewat Purchase/Stock Adjustment/transaksi resmi.'
                    : stockEditHelpText
                  : `Gunakan varian untuk ${variantLabelValue || 'turunan bahan'} seperti warna, ukuran, atau spesifikasi lain. Pada tahap ini varian hanya menyimpan identitas dan stok awal.`}
              />

              <Form.List name="variants">
                {(fields, { remove }) => (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {fields.map((field, index) => (
                      <Card
                        key={field.key}
                        size="small"
                        title={`${variantLabelValue || 'Varian'} ${index + 1}`}
                        extra={
                          <Button
                            danger
                            type="text"
                            icon={<StopOutlined />}
                            disabled={fields.length === 1 || isGuardedVariantStock(field.name)}
                            onClick={() => remove(field.name)}
                          >
                            Arsipkan Varian
                          </Button>
                        }
                      >
                        <Row gutter={12}>
                          {/* IMS NOTE [GUARDED | identity-safe]: hidden identity field menjaga variantKey existing tetap terkirim saat nama varian diganti. Hubungan flow: variantKey adalah identitas stok varian/reference transaksi. STATUS: AKTIF. */}
                          <Form.Item name={[field.name, 'variantKey']} hidden>
                            <Input />
                          </Form.Item>
                          <Col xs={24} md={8}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'name']}
                              label={`Nama ${variantLabelValue || 'Varian'}`}
                              rules={[{ required: true, message: 'Nama varian wajib diisi.' }]}
                            >
                              <Input
                                placeholder={variantLabelValue ? `Contoh: ${variantLabelValue} Merah` : 'Contoh: Merah'}
                              />
                            </Form.Item>
                          </Col>
                          <Form.Item {...field} name={[field.name, 'sku']} hidden>
                            <Input />
                          </Form.Item>
                          <Col xs={24} md={5}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'currentStock']}
                              label={isEditingMaterial ? 'Stok Saat Ini' : 'Stok Awal'}
                              extra={isEditingMaterial ? stockEditHelpText : undefined}
                            >
                              <InputNumber
                                disabled={isEditingMaterial}
                                style={{ width: '100%' }}
                                min={0}
                                precision={0}
                                formatter={(value) => formatNumberId(value)}
                                parser={integerParser}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={6}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'minStockAlert']}
                              label="Minimum Stok"
                              rules={[{ required: true, message: 'Minimum stok varian wajib diisi.' }]}
                            >
                              <InputNumber
                                style={{ width: '100%' }}
                                min={0}
                                precision={0}
                                formatter={(value) => formatNumberId(value)}
                                parser={integerParser}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={5}>
                            <Form.Item {...field} name={[field.name, 'isActive']} label="Aktif" valuePropName="checked">
                              <Switch
                                checkedChildren="Aktif"
                                unCheckedChildren="Nonaktif"
                                disabled={isGuardedVariantStock(field.name)}
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    ))}

                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        const current = form.getFieldValue('variants') || [];
                        form.setFieldsValue({
                          variants: [...current, { ...DEFAULT_RAW_MATERIAL_VARIANT }],
                        });
                      }}
                      block
                    >
                      Tambah Varian
                    </Button>
                  </Space>
                )}
              </Form.List>

              {/* IMS NOTE [AKTIF/GUARDED] - Ringkasan varian pasif.
                  Fungsi blok: menampilkan jumlah varian dan total stok form sebagai panel read-only, bukan Alert.
                  Hubungan flow: hanya mengganti tampilan summary; guard stok master, variantKey, pricing, conversion, dan service update tetap tidak berubah.
                  Alasan logic: ringkasan varian adalah snapshot pasif agar user membaca struktur varian tanpa merasa ada warning.
                  Status: AKTIF untuk UI master Raw Material, GUARDED terhadap business rule stok dan varian. */}
              <div className="ims-readonly-panel" style={{ marginTop: 16 }}>
                <div className="ims-readonly-panel-header">
                  <div>
                    <div className="ims-readonly-panel-title">
                      {isEditingMaterial ? 'Ringkasan Varian Read-only' : 'Ringkasan Varian'}
                    </div>
                    <div className="ims-readonly-panel-description">
                      Summary ini hanya membaca isi form. Perubahan stok fisik setelah create tetap lewat Purchases, Stock Adjustment, atau transaksi resmi.
                    </div>
                  </div>
                  <StatusTag tone="success">Varian</StatusTag>
                </div>

                <div className="ims-readonly-stat-grid">
                  <div className="ims-readonly-stat-field">
                    <div className="ims-readonly-stat-label">Jumlah Varian</div>
                    <div className="ims-readonly-stat-value">
                      {formatNumberId(variantStats.count)}
                    </div>
                  </div>
                  <div className="ims-readonly-stat-field">
                    <div className="ims-readonly-stat-label">Total Stok</div>
                    <div className="ims-readonly-stat-value">
                      {formatNumberId(variantStats.stock)}
                    </div>
                  </div>
                  <div className="ims-readonly-stat-field">
                    <div className="ims-readonly-stat-label">Total Minimum</div>
                    <div className="ims-readonly-stat-value">
                      {formatNumberId(variantStats.minimumStock)}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          <ImsNotice
            variant="guard"
            compact
            style={{ marginTop: 16 }}
            title="Pakai varian hanya jika bahan punya turunan stok nyata. Minimum stok disimpan per varian."
          />
          </ResponsiveFormSection>
        </Form>
      </Drawer>
);

export default RawMaterialFormDrawer;
