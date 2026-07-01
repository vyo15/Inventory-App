import {
  Alert,
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
  Statistic,
  Switch,
} from "antd";
import ResponsiveFormSection from "../../../components/Layout/Mobile/ResponsiveFormSection";
import PricingModeSwitch from "../../../components/Pricing/PricingModeSwitch";
import { parseIntegerIdInput, formatNumberId } from "../../../utils/formatters/numberId";
import { ensureAtLeastOneVariant } from "../../../utils/variants/variantHelpers";
import { PRODUCT_DEFAULT_FORM } from "../../../services/MasterData/productsService";
import {
  DEFAULT_PRODUCT_VARIANT,
  buildFormValues,
} from "../helpers/productsPageHelpers";

const { TextArea } = Input;

const ProductFormDrawer = ({
  canActivateVariantsForEditing,
  categorySelectOptions,
  closeFormDrawer,
  editingProduct,
  flowerTypeSelectOptions,
  form,
  formVisible,
  handleSubmit,
  hasVariantModeSwitchLocked,
  hasVariantsValue,
  isEditingProduct,
  isGuardedVariantStock,
  pricingModeValue,
  pricingPreviewWarning,
  pricingRules,
  setPricingPreviewWarning,
  stockEditHelpText,
  submitting,
  variantLabelValue,
  watchedCurrentStock,
  watchedMinStockAlert,
  watchedReservedStock,
  watchedVariants,
}) => (
      <Drawer
        title={editingProduct ? 'Edit Produk' : 'Tambah Produk'}
        open={formVisible}
        onClose={closeFormDrawer}
        width={860}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={closeFormDrawer}>Batal</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>Simpan</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={buildFormValues(PRODUCT_DEFAULT_FORM)}>
          <ResponsiveFormSection
            title="Data Produk"
            subtitle="Atur identitas, pricing, stok, dan varian produk dalam satu pola form mobile."
          >
          <Divider orientation="left">Informasi Utama</Divider>
          {/* =====================================================
          SECTION: Product internal code hidden from main UI — AKTIF
          Fungsi:
          - Form Produk Jadi tidak menampilkan input kode utama agar user fokus pada nama, kategori, harga, stok, dan varian.

          Dipakai oleh:
          - Drawer form Products dan productsService sebagai pembuat kode internal.

          Alasan perubahan:
          - Kode PRD tetap dibuat otomatis oleh service, tetapi tidak perlu menjadi input utama di UI master item.

          Catatan cleanup:
          - Audit table/detail berikutnya dapat memastikan kode internal hanya muncul pada export/debug bila dibutuhkan.

          Risiko:
          - Jangan menambahkan input manual code karena dapat merusak immutability dan relasi produk lama.
          ===================================================== */}
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="name" label="Nama Produk" rules={[{ required: true, message: 'Nama produk wajib diisi.' }]}>
                <Input placeholder="Contoh: Bouquet Mawar Flanel 1 Tangkai" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="categoryId"
                label="Bentuk Produk"
                rules={[{ required: true, message: 'Bentuk produk wajib dipilih.' }]}
                tooltip="Contoh: Bouquet atau Bunga Tangkai."
              >
                <Select
                  placeholder="Pilih bentuk produk"
                  options={categorySelectOptions}
                  notFoundContent="Tambahkan Bentuk Produk dari menu Kategori & Kelompok."
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="flowerTypeId"
                label="Jenis Bunga"
                tooltip="Opsional untuk produk yang tidak khusus satu jenis bunga."
              >
                <Select
                  allowClear
                  placeholder="Contoh: Mawar"
                  options={flowerTypeSelectOptions}
                  notFoundContent="Tambahkan Jenis Bunga dari menu Kategori & Kelompok."
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Deskripsi">
            <TextArea rows={3} placeholder="Catatan produk" />
          </Form.Item>

          <Divider orientation="left">Pricing Master</Divider>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="hppPerUnit"
                label="HPP / Unit"
                rules={[{ required: true, message: 'HPP wajib diisi.' }]}
                extra={isEditingProduct ? 'HPP hasil produksi dikunci saat edit master agar nilai terbaru tidak tertimpa.' : undefined}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={1}
                  precision={0}
                  formatter={(value) => formatNumberId(value)}
                  parser={parseIntegerIdInput}
                  disabled={isEditingProduct}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              {/* =====================================================
              SECTION: Product pricing mode switch — AKTIF / GUARDED
              Fungsi:
              - Mengubah mode pricing Product dari Select menjadi Switch: OFF manual, ON pricing rule.

              Dipakai oleh:
              - Form create/edit Product.

              Alasan perubahan:
              - User lebih mudah memahami bahwa Pricing Rule adalah pilihan aktif/nonaktif, bukan kategori harga terpisah.

              Catatan cleanup:
              - Belum ada. Field payload tetap pricingMode dan pricingRuleId.

              Risiko:
              - Jangan ubah nilai domain pricingMode selain manual/rule karena service dan PricingRules bergantung pada nilai ini.
              ===================================================== */}
              <Form.Item name="pricingMode" hidden>
                <Input type="hidden" />
              </Form.Item>
              <PricingModeSwitch
                value={pricingModeValue || 'manual'}
                extra={pricingModeValue === 'rule'
                  ? 'Pricing Rule aktif: pilih rule untuk menghitung harga jual.'
                  : 'Manual: harga jual diisi langsung.'}
                onChange={(nextMode) => {
                  form.setFieldsValue({ pricingMode: nextMode });
                  if (nextMode !== 'rule') {
                    form.setFieldsValue({ pricingRuleId: null });
                    setPricingPreviewWarning('');
                  }
                }}
              />
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="price" label="Harga Jual" rules={[{ required: true, message: 'Harga jual wajib diisi.' }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={1}
                  precision={0}
                  formatter={(value) => formatNumberId(value)}
                  parser={parseIntegerIdInput}
                />
              </Form.Item>
            </Col>
          </Row>

          {pricingPreviewWarning ? (
            <Alert
              type="warning"
              showIcon
              message={pricingPreviewWarning}
              style={{ marginBottom: 16 }}
            />
          ) : null}

          <Form.Item
            name="pricingRuleId"
            label="Pricing Rule"
            rules={pricingModeValue === 'rule' ? [{ required: true, message: 'Pricing rule wajib dipilih.' }] : []}
          >
            <Select
              allowClear
              disabled={pricingModeValue !== 'rule'}
              placeholder="Pilih pricing rule"
              options={(pricingRules || []).map((item) => ({
                value: item.id,
                label: `${item.name}${item?.isActive ? '' : ' (Nonaktif)'}`,
              }))}
            />
          </Form.Item>

          {/* IMS NOTE [GUARDED | behavior-preserving]: section stok tetap tampil untuk konteks,
              tetapi input stok dikunci saat edit agar payload master tidak menjadi jalur mutasi stok. */}
          <Divider orientation="left">Mode Stok</Divider>
          <Form.Item
            name="hasVariants"
            label="Pakai Varian"
            valuePropName="checked"
            extra={isEditingProduct
              ? canActivateVariantsForEditing
                ? 'Produk lama dengan stok 0 boleh mulai memakai varian. Varian baru tetap mulai dari stok 0.'
                : 'Mode varian dikunci setelah produk dibuat agar struktur stok tetap konsisten.'
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
                    variants: ensureAtLeastOneVariant(form.getFieldValue('variants') || [], { defaultVariant: DEFAULT_PRODUCT_VARIANT }),
                    variantLabel: form.getFieldValue('variantLabel') || 'Varian',
                    currentStock: isEditingProduct ? 0 : form.getFieldValue('currentStock'),
                    reservedStock: isEditingProduct ? 0 : form.getFieldValue('reservedStock'),
                  });
                } else {
                  form.setFieldsValue({ variants: [], variantLabel: 'Varian' });
                }
              }}
            />
          </Form.Item>

          {hasVariantsValue ? (
            <Form.Item
              name="variantLabel"
              label="Label Varian"
              tooltip="Contoh: Warna, Ukuran, atau Motif."
            >
              <Input placeholder="Contoh: Warna" />
            </Form.Item>
          ) : null}

          <Alert
            type={isEditingProduct ? 'info' : 'warning'}
            showIcon
            style={{ marginBottom: 16 }}
            message={isEditingProduct
              ? canActivateVariantsForEditing
                ? 'Produk lama ini stoknya 0, jadi boleh mulai memakai varian. Stok tiap varian baru tetap 0 sampai diubah lewat Stock Adjustment/transaksi resmi.'
                : stockEditHelpText
              : hasVariantsValue
                ? 'Harga produk tetap di master. Varian hanya mengatur stok fisik; Minimum Stok tetap satu angka di master produk.'
                : 'Produk tanpa varian memakai stok awal dan minimum stok langsung di master produk.'}
          />

          {hasVariantsValue ? (
            <>
              {/* =====================================================
              SECTION: Product Variant Form Without Variant Min Stock — AKTIF
              Fungsi:
              - menampilkan stok fisik per varian sambil menjaga Minimum Stok sebagai field master produk.

              Dipakai oleh:
              - Products.jsx create/edit drawer dan productsService master payload.

              Alasan perubahan:
              - `variants[].minStockAlert` adalah compatibility data historis; user tidak lagi mengisi min stock per varian.

              Catatan cleanup:
              - field data historis varian dapat diaudit pada batch maintenance terpisah tanpa migrasi otomatis di UI ini.

              Risiko:
              - mengembalikan input min stock per varian akan membuat threshold low stock Product tidak konsisten dengan source master.
              ===================================================== */}
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="minStockAlert" label="Minimum Stok Master">
                    <InputNumber style={{ width: '100%' }} min={0} step={1} precision={0} parser={parseIntegerIdInput} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.List name="variants">
                {(fields, { add, remove }) => (
                  <Space direction="vertical" style={{ width: '100%' }} size={12}>
                    {fields.map((field) => (
                      <Card key={field.key} size="small" title={`${variantLabelValue || 'Varian'} ${field.name + 1}`}>
                        <Row gutter={12}>
                          {/* IMS NOTE [GUARDED | identity-safe]: hidden identity field menjaga variantKey lama tetap terkirim saat label varian diganti. Hubungan flow: variantKey adalah identitas stok varian/reference transaksi. STATUS: AKTIF. */}
                          <Form.Item name={[field.name, 'variantKey']} hidden>
                            <Input />
                          </Form.Item>
                          <Col xs={24} md={6}>
                            <Form.Item {...field} name={[field.name, 'color']} label={`Nama ${variantLabelValue || 'Varian'}`} rules={[{ required: true, message: 'Nama varian wajib diisi' }]}>
                              <Input placeholder="Contoh: Merah, Ukuran S, Motif Polkadot" />
                            </Form.Item>
                          </Col>
                          <Form.Item {...field} name={[field.name, 'sku']} hidden>
                            <Input />
                          </Form.Item>
                          <Col xs={24} md={5}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'currentStock']}
                              label="Stok"
                              initialValue={0}
                              extra={isEditingProduct ? stockEditHelpText : undefined}
                            >
                              <InputNumber style={{ width: '100%' }} min={0} step={1} precision={0} parser={parseIntegerIdInput} disabled={isEditingProduct} />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={4}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'reservedStock']}
                              label="Reserved"
                              initialValue={0}
                              extra={isEditingProduct ? 'Reserved stock dikunci saat edit karena memengaruhi available stock.' : undefined}
                            >
                              <InputNumber style={{ width: '100%' }} min={0} step={1} precision={0} parser={parseIntegerIdInput} disabled={isEditingProduct} />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={3}>
                            <Form.Item {...field} name={[field.name, 'isActive']} label="Aktif" valuePropName="checked" initialValue>
                              <Switch disabled={isGuardedVariantStock(field.name)} />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Button
                          danger
                          size="small"
                          disabled={fields.length === 1 || isGuardedVariantStock(field.name)}
                          onClick={() => remove(field.name)}
                        >
                          Arsipkan Varian
                        </Button>
                      </Card>
                    ))}

                    <Button type="dashed" onClick={() => add({ ...DEFAULT_PRODUCT_VARIANT })} block>
                      Tambah Varian
                    </Button>
                  </Space>
                )}
              </Form.List>
            </>
          ) : (
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item name="currentStock" label="Stok Master" extra={isEditingProduct ? stockEditHelpText : undefined}>
                  <InputNumber style={{ width: '100%' }} min={0} step={1} precision={0} parser={parseIntegerIdInput} disabled={isEditingProduct} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="reservedStock" label="Reserved Stock" extra={isEditingProduct ? 'Reserved stock dikunci saat edit karena memengaruhi available stock.' : undefined}>
                  <InputNumber style={{ width: '100%' }} min={0} step={1} precision={0} parser={parseIntegerIdInput} disabled={isEditingProduct} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="minStockAlert" label="Minimum Stok">
                  <InputNumber style={{ width: '100%' }} min={0} step={1} precision={0} parser={parseIntegerIdInput} />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Divider orientation="left">Ringkasan Form</Divider>
          <Card size="small">
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Statistic
                  title={hasVariantsValue ? 'Jumlah Varian' : 'Mode Stok'}
                  value={hasVariantsValue ? watchedVariants.length : 'Master'}
                  formatter={(value) => value}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="Stok Total"
                  value={hasVariantsValue ? watchedVariants.reduce((sum, item) => sum + Number(item?.currentStock || 0), 0) : watchedCurrentStock}
                  formatter={(value) => formatNumberId(value)}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title={hasVariantsValue ? 'Reserved Total | Min Master' : `Min Stok | Reserved ${formatNumberId(watchedReservedStock)}`}
                  value={hasVariantsValue
                    ? `${formatNumberId(watchedVariants.reduce((sum, item) => sum + Number(item?.reservedStock || 0), 0))} | ${formatNumberId(watchedMinStockAlert)}`
                    : watchedMinStockAlert}
                  formatter={(value) => hasVariantsValue ? value : formatNumberId(value)}
                />
              </Col>
            </Row>
          </Card>
          </ResponsiveFormSection>
        </Form>
      </Drawer>
);

export default ProductFormDrawer;
