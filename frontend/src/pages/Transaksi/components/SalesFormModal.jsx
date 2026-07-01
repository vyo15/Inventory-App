import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tag,
} from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import ResponsiveFormSection from "../../../components/Layout/Mobile/ResponsiveFormSection";
import { formatNumberId, parseIntegerIdInput } from "../../../utils/formatters/numberId";
import {
  buildVariantOptionsFromItem,
  findVariantByKey,
  getItemStockSnapshot,
  inferHasVariants,
} from "../../../utils/variants/variantStockHelpers";
import { showFormValidationFeedback } from "../../../utils/forms/formValidationFeedback";

const { Option } = Select;

const SalesFormModal = ({
  customers,
  defaultSaleLineItemType,
  findSellableItem,
  form,
  getSellableItemsByType,
  handleAddSale,
  handleSaleItemChange,
  handleSaleItemTypeChange,
  handleSalesChannelChange,
  isModalOpen,
  isOfflineChannel,
  isReferenceNumberEnabledChannel,
  isSubmittingSale,
  onlineStatuses,
  salesChannels,
  sellableItemTypeOptions,
  setIsModalOpen,
}) => (
      <Modal
        title="Tambah Penjualan"
        open={isModalOpen}
        onOk={form.submit}
        onCancel={() => {
          if (!isSubmittingSale) {
            setIsModalOpen(false);
          }
        }}
        confirmLoading={isSubmittingSale}
        okButtonProps={{ disabled: isSubmittingSale }}
        cancelButtonProps={{ disabled: isSubmittingSale }}
        okText="Simpan"
        cancelText="Batal"
        width={860}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddSale}
          onFinishFailed={(errorInfo) => showFormValidationFeedback(errorInfo, { form })}
        >
          <ResponsiveFormSection
            title="Data Penjualan"
            subtitle="Isi pelanggan, item, channel, status, tanggal, dan catatan tanpa mengubah flow stok keluar."
          >
          <Form.Item label="Pelanggan" name="customerId" tooltip="Opsional untuk pembeli umum.">
            <Select placeholder="Pilih pelanggan" allowClear showSearch optionFilterProp="children">
              {customers.map((customer) => (
                <Option key={customer.id} value={customer.id}>
                  {customer.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <div key={key} style={{ border: "1px solid var(--ims-border-color)", padding: 12, marginBottom: 16, borderRadius: 8 }}>
                    <Space style={{ width: "100%" }} align="baseline" wrap>
                      <Form.Item
                        {...restField}
                        label="Jenis Item"
                        name={[name, "itemType"]}
                        rules={[{ required: true, message: "Pilih jenis item!" }]}
                        style={{ width: 180, marginBottom: 12 }}
                      >
                        <Select placeholder="Pilih jenis" onChange={(itemType) => handleSaleItemTypeChange(itemType, name)}>
                          {sellableItemTypeOptions.map((option) => (
                            <Option key={option.value} value={option.value}>
                              {option.label}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>

                      <Form.Item shouldUpdate noStyle>
                        {({ getFieldValue }) => {
                          const selectedItemType = getFieldValue(["items", name, "itemType"]);
                          const filteredSellableItems = getSellableItemsByType(selectedItemType);

                          return (
                            <Form.Item
                              {...restField}
                              label="Item Penjualan"
                              name={[name, "itemId"]}
                              rules={[{ required: true, message: "Pilih item!" }]}
                              extra={
                                selectedItemType
                                  ? "Item difilter sesuai jenis."
                                  : "Pilih jenis item dulu."
                              }
                              style={{ flex: 1, minWidth: 320, marginBottom: 12 }}
                            >
                              <Select
                                placeholder={selectedItemType ? "Pilih item sesuai jenis" : "Pilih Jenis Item dulu"}
                                disabled={!selectedItemType}
                                onChange={(itemId) => handleSaleItemChange(itemId, name)}
                                showSearch
                                optionFilterProp="children"
                              >
                                {/* IMS NOTE [AKTIF] - opsi item difilter per collection dan label stok disederhanakan karena detail stok sudah tampil di panel read-only. */}
                                {filteredSellableItems.map((item) => (
                                  <Option key={item.itemKey} value={item.itemKey}>
                                    {item.name} ({item.typeLabel})
                                  </Option>
                                ))}
                              </Select>
                            </Form.Item>
                          );
                        }}
                      </Form.Item>
                    </Space>

                    <Form.Item shouldUpdate noStyle>
                      {({ getFieldValue }) => {
                        const selectedItemKey = getFieldValue(["items", name, "itemId"]);
                        const selectedItem = findSellableItem(selectedItemKey);
                        const hasVariants = inferHasVariants(selectedItem || {});
                        const currentVariantKey = getFieldValue(["items", name, "variantKey"]);
                        const selectedVariant = hasVariants ? findVariantByKey(selectedItem, currentVariantKey) : null;

                        return selectedItem ? (
                          <>
                            {hasVariants ? (
                              <Form.Item
                                {...restField}
                                name={[name, "variantKey"]}
                                label={selectedItem.variantLabel || "Varian"}
                                rules={[{ required: true, message: "Pilih varian!" }]}
                                tooltip="Item bervarian wajib pilih varian."
                              >
                                <Select placeholder="Pilih varian" showSearch optionFilterProp="children">
                                  {buildVariantOptionsFromItem(selectedItem).map((item) => (
                                    <Option key={item.value} value={item.value}>
                                      {item.label}
                                    </Option>
                                  ))}
                                </Select>
                              </Form.Item>
                            ) : null}

                            {/* IMS NOTE [AKTIF/GUARDED] - Snapshot stok Sales.
                                Fungsi blok: menampilkan stok current/reserved/available item terpilih sebagai panel read-only pasif.
                                Hubungan flow: hanya mengganti tampilan Alert lama; validasi stok, create sale, stock reduction, income timing, alur Return, dan payload layanan database tetap memakai logic existing.
                                Alasan logic: stok tersedia sebelum penjualan adalah info snapshot, bukan warning/error, sehingga mengikuti pola clean panel seperti Purchases/Stock Adjustment.
                                Status: AKTIF untuk UI Sales, GUARDED terhadap business rule stok dan transaksi. */}
                            <div className="ims-readonly-panel">
                              <div className="ims-readonly-panel-header">
                                <div>
                                  <div className="ims-readonly-panel-title">
                                    Stok Tersedia Sebelum Penjualan
                                  </div>
                                  <div className="ims-readonly-panel-description">
                                    Info stok sebelum transaksi disimpan.
                                  </div>
                                </div>
                                <Tag color={hasVariants ? "purple" : "default"}>
                                  {hasVariants ? "Varian" : "Master"}
                                </Tag>
                              </div>

                              <div style={{ marginBottom: 10 }}>
                                <span className="ims-cell-title">
                                  {selectedItem.name || "Item"}
                                </span>
                                {hasVariants ? (
                                  <span style={{ color: "var(--ims-text-secondary)" }}>
                                    {` — ${selectedVariant?.variantLabel || selectedVariant?.name || "Pilih varian"}`}
                                  </span>
                                ) : null}
                              </div>

                              <div className="ims-readonly-stat-grid">
                                <div className="ims-readonly-stat-field">
                                  <div className="ims-readonly-stat-label">Stok Saat Ini</div>
                                  <div className="ims-readonly-stat-value">
                                    {formatNumberId((hasVariants ? selectedVariant?.currentStock : getItemStockSnapshot(selectedItem).currentStock) || 0)}
                                  </div>
                                </div>
                                <div className="ims-readonly-stat-field">
                                  <div className="ims-readonly-stat-label">Stok Tertahan</div>
                                  <div className="ims-readonly-stat-value">
                                    {formatNumberId((hasVariants ? selectedVariant?.reservedStock : getItemStockSnapshot(selectedItem).reservedStock) || 0)}
                                  </div>
                                </div>
                                <div className="ims-readonly-stat-field">
                                  <div className="ims-readonly-stat-label">Stok Tersedia</div>
                                  <div className="ims-readonly-stat-value">
                                    {formatNumberId((hasVariants ? selectedVariant?.availableStock : getItemStockSnapshot(selectedItem).availableStock) || 0)}
                                  </div>
                                </div>
                              </div>

                              {hasVariants ? (
                                <div className="ims-readonly-panel-note">
                                  Item bervarian wajib memilih varian agar stok keluar dari varian yang benar.
                                </div>
                              ) : null}
                            </div>
                          </>
                        ) : null;
                      }}
                    </Form.Item>

                    <Space style={{ marginBottom: 12 }} align="baseline" wrap>
                      <Form.Item {...restField} name={[name, "quantity"]} rules={[{ required: true, message: "Jumlah!" }]}>
                        <InputNumber min={1} step={1} precision={0} parser={parseIntegerIdInput} placeholder="Jumlah" style={{ width: 120 }} />
                      </Form.Item>

                      <Form.Item {...restField} name={[name, "pricePerUnit"]} rules={[{ required: true, message: "Harga!" }]}>
                        <InputNumber min={0} step={1} precision={0} parser={parseIntegerIdInput} placeholder="Harga Satuan" style={{ width: "min(100%, 180px)" }} />
                      </Form.Item>

                      <Button danger onClick={() => remove(name)} icon={<DeleteOutlined />} />
                    </Space>
                  </div>
                ))}

                <Form.Item>
                  <Button type="dashed" onClick={() => add({ itemType: defaultSaleLineItemType, itemId: undefined, variantKey: undefined, quantity: 1, pricePerUnit: 0 })} block icon={<PlusOutlined />}>
                    Tambah Item
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item label="Channel Penjualan" name="salesChannel" rules={[{ required: true, message: "Harap pilih channel!" }]} initialValue="Shopee">
            <Select placeholder="Pilih channel penjualan" onChange={handleSalesChannelChange}>
              {salesChannels.map((channel) => (
                <Option key={channel.value} value={channel.value}>
                  {channel.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const salesChannel = getFieldValue("salesChannel");
              const isOffline = isOfflineChannel(salesChannel);

              return (
                <Form.Item label="Status" name="status" rules={[{ required: true, message: "Harap pilih status!" }]} initialValue={isOffline ? "Selesai" : "Diproses"}>
                  <Select placeholder="Pilih status" disabled={isOffline}>
                    {isOffline ? (
                      <Option value="Selesai">Selesai</Option>
                    ) : (
                      onlineStatuses.map((status) => (
                        <Option key={status} value={status}>
                          {status}
                        </Option>
                      ))
                    )}
                  </Select>
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const salesChannel = getFieldValue("salesChannel");
              const referenceEnabled = isReferenceNumberEnabledChannel(salesChannel);

              return (
                <Form.Item
                  label="No. Resi / No. Order Marketplace"
                  name="referenceNumber"
                  extra={
                    referenceEnabled
                      ? "Opsional untuk nomor resi/order marketplace."
                      : "Tidak diperlukan untuk channel ini."
                  }
                >
                  <Input
                    disabled={!referenceEnabled}
                    placeholder={
                      referenceEnabled
                        ? "Opsional: masukkan nomor resi / order marketplace"
                        : "Tidak diperlukan untuk channel ini"
                    }
                  />
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item label="Tanggal" name="date" rules={[{ required: true, message: "Harap pilih tanggal!" }]} initialValue={dayjs()}>
            <DatePicker format="YYYY-MM-DD" style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item label="Catatan" name="note">
            <Input.TextArea rows={3} placeholder="Catatan tambahan" />
          </Form.Item>
          </ResponsiveFormSection>
        </Form>
      </Modal>
);

export default SalesFormModal;
