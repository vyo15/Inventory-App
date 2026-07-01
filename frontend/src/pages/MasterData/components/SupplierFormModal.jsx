import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Switch,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import ResponsiveFormSection from "../../../components/Layout/Mobile/ResponsiveFormSection";
import RupiahInputNumber from "../../../components/Layout/Forms/RupiahInputNumber";
import { formatNumberId, parseIntegerIdInput } from "../../../utils/formatters/numberId";
import { PURCHASE_UNIT_OPTIONS } from "../helpers/supplierPurchasesPageHelpers";

const { Option } = Select;

const CATALOG_ITEM_TYPE_OPTIONS = [
  { value: "raw_material", label: "Bahan Baku" },
  { value: "product", label: "Produk" },
];

const SupplierFormModal = ({
  closeSupplierModal,
  form,
  getItemById,
  getItemCollection,
  getItemStockUnit,
  getVariantOptions,
  handleSaveSupplier,
  isEditing,
  modalVisible,
  saving,
  updateCatalogOfferAtIndex,
}) => (
      <Modal
        title={isEditing ? 'Edit Supplier dan Katalog' : 'Tambah Supplier dan Katalog'}
        open={modalVisible}
        onCancel={closeSupplierModal}
        onOk={() => form.submit()}
        okText="Simpan"
        cancelText="Batal"
        confirmLoading={saving}
        width={1040}
      >
        <Form form={form} layout="vertical" onFinish={handleSaveSupplier}>
          <ResponsiveFormSection
            title="Informasi Supplier"
            subtitle="Kode dan ID dibuat otomatis di backend. UI hanya menampilkan informasi yang digunakan pengguna."
          >
            <Row gutter={[12, 0]}>
              <Col xs={24} md={12}>
                <Form.Item name="storeName" label="Nama Supplier / Toko" rules={[{ required: true, message: 'Nama supplier wajib diisi' }]}>
                  <Input placeholder="Nama toko atau supplier" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="storeLink"
                  label="Link Toko"
                  rules={[{
                    validator: (_, value) => !value || /^https?:\/\//i.test(value)
                      ? Promise.resolve()
                      : Promise.reject(new Error('Gunakan link http:// atau https://')),
                  }]}
                >
                  <Input placeholder="https://link-toko" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="contact" label="Kontak"><Input placeholder="Nomor telepon atau kontak" /></Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="address" label="Alamat"><Input placeholder="Alamat toko atau supplier" /></Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="notes" label="Catatan"><Input.TextArea rows={2} placeholder="Catatan umum supplier" /></Form.Item>
              </Col>
            </Row>
          </ResponsiveFormSection>

          <ResponsiveFormSection
            title="Katalog Barang"
            subtitle="Satu toko dapat menyimpan banyak barang dan beberapa link berbeda untuk barang yang sama."
          >
            <Form.List name="catalogOffers">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }, index) => (
                    <Card
                      key={key}
                      size="small"
                      style={{ marginBottom: 12 }}
                      title={`Penawaran ${index + 1}`}
                      extra={<Button danger type="text" onClick={() => remove(name)}>Nonaktifkan Penawaran</Button>}
                    >
                      <Form.Item {...restField} name={[name, 'id']} hidden><Input /></Form.Item>
                      <Row gutter={[12, 0]}>
                        <Col xs={24} md={8}>
                          <Form.Item {...restField} name={[name, 'itemType']} label="Jenis Barang" rules={[{ required: true, message: 'Pilih jenis barang' }]}>
                            <Select
                              placeholder="Pilih jenis"
                              onChange={(itemType) => updateCatalogOfferAtIndex(name, {
                                itemType,
                                itemId: undefined,
                                itemName: '',
                                variantKey: undefined,
                                variantLabel: '',
                                stockUnit: '',
                                conversionValue: 1,
                              })}
                            >
                              {CATALOG_ITEM_TYPE_OPTIONS.map((option) => <Option key={option.value} value={option.value}>{option.label}</Option>)}
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item shouldUpdate noStyle>
                            {({ getFieldValue }) => {
                              const offer = getFieldValue(['catalogOffers', name]) || {};
                              const itemOptions = getItemCollection(offer.itemType);
                              return (
                                <Form.Item {...restField} name={[name, 'itemId']} label="Nama Barang" rules={[{ required: true, message: 'Pilih barang' }]}>
                                  <Select
                                    placeholder="Pilih barang"
                                    showSearch
                                    optionFilterProp="children"
                                    onChange={(itemId) => {
                                      const selectedItem = getItemById(offer.itemType, itemId);
                                      updateCatalogOfferAtIndex(name, {
                                        itemId,
                                        itemName: selectedItem?.name || '',
                                        stockUnit: getItemStockUnit(offer.itemType, selectedItem || {}),
                                        conversionValue: offer.itemType === 'product' ? 1 : (offer.conversionValue || 1),
                                        variantKey: undefined,
                                        variantLabel: '',
                                      });
                                    }}
                                  >
                                    {itemOptions.map((item) => <Option key={item.id} value={item.id}>{item.name}</Option>)}
                                  </Select>
                                </Form.Item>
                              );
                            }}
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item shouldUpdate noStyle>
                            {({ getFieldValue }) => {
                              const offer = getFieldValue(['catalogOffers', name]) || {};
                              const selectedItem = getItemById(offer.itemType, offer.itemId);
                              const variantOptions = getVariantOptions(selectedItem || {});
                              if (!variantOptions.length) return null;
                              return (
                                <Form.Item {...restField} name={[name, 'variantKey']} label="Varian">
                                  <Select
                                    allowClear
                                    placeholder="Semua varian / pilih varian"
                                    onChange={(variantKey) => {
                                      const variant = variantOptions.find((item) => String(item.value) === String(variantKey || ''));
                                      updateCatalogOfferAtIndex(name, { variantKey, variantLabel: variant?.label || '' });
                                    }}
                                  >
                                    {variantOptions.map((variant) => <Option key={variant.value} value={variant.value}>{variant.label}</Option>)}
                                  </Select>
                                </Form.Item>
                              );
                            }}
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item {...restField} name={[name, 'listingName']} label="Nama Listing / Paket">
                            <Input placeholder="Contoh: Paket 10 lembar" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item {...restField} name={[name, 'channel']} label="Marketplace / Channel">
                            <Input placeholder="Shopee, Tokopedia, offline" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item
                            {...restField}
                            name={[name, 'productLink']}
                            label="Link Barang"
                            rules={[{
                              validator: (_, value) => !value || /^https?:\/\//i.test(value)
                                ? Promise.resolve()
                                : Promise.reject(new Error('Gunakan link http:// atau https://')),
                            }]}
                          >
                            <Input placeholder="https://link-barang-spesifik" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item {...restField} name={[name, 'purchaseUnit']} label="Satuan Beli">
                            <Select allowClear showSearch placeholder="Pilih satuan">
                              {PURCHASE_UNIT_OPTIONS.map((unit) => <Option key={unit} value={unit}>{unit}</Option>)}
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item {...restField} name={[name, 'purchaseQty']} label="Qty per Pembelian" initialValue={1}>
                            <InputNumber min={1} step={1} precision={0} style={{ width: '100%' }} formatter={formatNumberId} parser={parseIntegerIdInput} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item shouldUpdate noStyle>
                            {({ getFieldValue }) => {
                              const offer = getFieldValue(['catalogOffers', name]) || {};
                              return (
                                <Form.Item {...restField} name={[name, 'conversionValue']} label="Isi / Konversi" initialValue={1}>
                                  <InputNumber
                                    min={1}
                                    step={1}
                                    precision={0}
                                    disabled={offer.itemType === 'product'}
                                    style={{ width: '100%' }}
                                    formatter={formatNumberId}
                                    parser={parseIntegerIdInput}
                                  />
                                </Form.Item>
                              );
                            }}
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item {...restField} name={[name, 'stockUnit']} label="Satuan Stok">
                            <Input disabled placeholder="Otomatis dari barang" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item {...restField} name={[name, 'supplierItemPrice']} label="Harga Saat Ini" rules={[{ required: true, message: 'Harga wajib diisi' }]}>
                            <RupiahInputNumber min={0} step={1} precision={0} formatter={formatNumberId} parser={parseIntegerIdInput} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item {...restField} name={[name, 'purchaseType']} label="Jenis Pembelian" initialValue="online">
                            <Select>
                              <Option value="online">Online</Option>
                              <Option value="offline">Offline</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={4}>
                          <Form.Item {...restField} name={[name, 'isPrimary']} label="Pilihan Utama" valuePropName="checked">
                            <Switch />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={4}>
                          <Form.Item {...restField} name={[name, 'isActive']} label="Aktif" valuePropName="checked" initialValue>
                            <Switch />
                          </Form.Item>
                        </Col>
                        <Form.Item shouldUpdate noStyle>
                          {({ getFieldValue }) => {
                            const offer = getFieldValue(['catalogOffers', name]) || {};
                            if (offer.purchaseType === 'offline') return null;
                            return (
                              <>
                                <Col xs={24} md={8}>
                                  <Form.Item {...restField} name={[name, 'estimatedShippingCost']} label="Estimasi Ongkir">
                                    <RupiahInputNumber min={0} step={1} precision={0} formatter={formatNumberId} parser={parseIntegerIdInput} />
                                  </Form.Item>
                                </Col>
                                <Col xs={24} md={8}>
                                  <Form.Item {...restField} name={[name, 'serviceFee']} label="Estimasi Biaya Layanan">
                                    <RupiahInputNumber min={0} step={1} precision={0} formatter={formatNumberId} parser={parseIntegerIdInput} />
                                  </Form.Item>
                                </Col>
                                <Col xs={24} md={8}>
                                  <Form.Item {...restField} name={[name, 'discount']} label="Estimasi Diskon">
                                    <RupiahInputNumber min={0} step={1} precision={0} formatter={formatNumberId} parser={parseIntegerIdInput} />
                                  </Form.Item>
                                </Col>
                              </>
                            );
                          }}
                        </Form.Item>
                        <Col span={24}>
                          <Form.Item {...restField} name={[name, 'note']} label="Catatan Penawaran">
                            <Input placeholder="Kualitas, minimal order, warna, atau catatan lain" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => add({
                      itemType: 'raw_material',
                      itemId: undefined,
                      purchaseType: 'online',
                      purchaseUnit: 'pcs',
                      purchaseQty: 1,
                      conversionValue: 1,
                      supplierItemPrice: 0,
                      estimatedShippingCost: 0,
                      serviceFee: 0,
                      discount: 0,
                      isPrimary: false,
                      isActive: true,
                    })}
                  >
                    Tambah Penawaran / Link Barang
                  </Button>
                </>
              )}
            </Form.List>
          </ResponsiveFormSection>
        </Form>
      </Modal>
);

export default SupplierFormModal;
