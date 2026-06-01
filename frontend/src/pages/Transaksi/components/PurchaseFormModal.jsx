import React from "react";
import {
  Modal,
  Form,
  Select,
  InputNumber,
  DatePicker,
  Input,
  Space,
  Switch,
} from "antd";
import { formatNumberId, parseIntegerIdInput } from "../../../utils/formatters/numberId";
import { showFormValidationFeedback } from "../../../utils/forms/formValidationFeedback";
import {
  getSupplierOptionLabel,
  getSupplierProductLinkForMaterial,
} from "../../../services/MasterData/suppliersService";
import PurchaseOcrDraftPanel from "./PurchaseOcrDraftPanel";
import PurchaseStockPreview from "./PurchaseStockPreview";
import PurchaseCostSummaryCard from "./PurchaseCostSummaryCard";
import {
  formatShopeeOcrMoney,
  SHOPEE_OCR_REVIEW_ALERT_TYPE,
  SHOPEE_OCR_REVIEW_TAG_COLOR,
} from "./purchaseOcrUiConstants";

const { Option } = Select;

// IMS NOTE [AKTIF/GUARDED] - Modal Form Pembelian
// Fungsi blok: memusatkan UI modal tambah pembelian agar Purchases.jsx tetap menjadi orchestrator data/effect.
// Hubungan flow: presentational only; submit handler, OCR handler, kalkulasi form, stock-in, expense, inventory log, dan service transaction tetap dari parent/service.
const PurchaseFormModal = ({
  form,
  isModalOpen,
  isSubmittingPurchase,
  onCancel,
  handleSubmitPurchase,
  itemType,
  products,
  materials,
  selectedMaterial,
  materialVariantOptions,
  selectedProduct,
  selectedProductHasVariants,
  productVariantOptions,
  selectedPurchaseStockPreview,
  filteredSuppliers,
  itemId,
  supplierId,
  selectedSupplier,
  shopeeOcrState,
  shopeeOcrApplyFeedback,
  handleShopeeScreenshotUpload,
  applyShopeeOcrDraftToForm,
  isOfflinePurchase,
  conversionValue,
  selectedSupplierCatalogCost,
  subtotalManualOverrideRef,
}) => (
      <Modal
        title="Tambah Pembelian"
        open={isModalOpen}
        onOk={form.submit}
        onCancel={onCancel}
        confirmLoading={isSubmittingPurchase}
        okButtonProps={{ disabled: isSubmittingPurchase }}
        cancelButtonProps={{ disabled: isSubmittingPurchase }}
        okText="Simpan"
        cancelText="Batal"
        width={820}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitPurchase}
          onFinishFailed={(errorInfo) => showFormValidationFeedback(errorInfo, { form })}
        >
          <Form.Item
            name="date"
            label="Tanggal"
            rules={[{ required: true, message: "Tanggal wajib diisi" }]}
          >
            <DatePicker className="ims-filter-control" />
          </Form.Item>

          <Form.Item
            name="type"
            label="Jenis Item"
            initialValue="material"
            rules={[{ required: true, message: "Jenis wajib dipilih" }]}
          >
            <Select placeholder="Pilih jenis item">
              <Option value="product">Produk</Option>
              <Option value="material">Bahan Baku</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="itemId"
            label="Nama Item"
            rules={[{ required: true, message: "Item wajib dipilih" }]}
          >
            <Select
              placeholder="Pilih item"
              showSearch
              optionFilterProp="children"
            >
              {(itemType === "product" ? products : materials).map((item) => (
                <Option key={item.id} value={item.id}>
                  {item.name}
                </Option>
              ))}
            </Select>
          </Form.Item>


          {itemType === "material" && (selectedMaterial?.hasVariantOptions || selectedMaterial?.hasVariants) ? (
            <Form.Item
              name="materialVariantId"
              label={selectedMaterial?.variantLabel || "Varian Bahan"}
              rules={[{ required: true, message: "Varian bahan wajib dipilih" }]}
            >
              <Select placeholder="Pilih varian bahan">
                {materialVariantOptions.map((item) => (
                  <Option key={item.value} value={item.value}>
                    {item.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          ) : null}

          {itemType === "product" && selectedProductHasVariants ? (
            <Form.Item
              name="productVariantKey"
              label={selectedProduct?.variantLabel || "Varian Produk"}
              rules={[{ required: true, message: "Varian produk wajib dipilih" }]}
              extra="Item bervarian wajib masuk ke varian."
            >
              <Select placeholder="Pilih varian produk">
                {productVariantOptions.map((item) => (
                  <Option key={item.value} value={item.value}>
                    {item.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          ) : null}

          <PurchaseStockPreview preview={selectedPurchaseStockPreview} />

          <Form.Item
            name="supplierId"
            label="Nama Supplier"
            rules={[{ required: true, message: "Supplier wajib dipilih" }]}
            extra={
              itemType === "material" && itemId
                ? filteredSuppliers.length
                  ? "Supplier difilter dari katalog Supplier yang menyediakan bahan ini."
                  : "Belum ada supplier yang menyediakan bahan ini. Tambahkan material ini di menu Supplier terlebih dahulu."
                : "Pilih supplier"
            }
          >
            <Select
              placeholder="Pilih supplier"
              showSearch
              optionFilterProp="children"
              notFoundContent={
                itemType === "material" && itemId
                  ? "Belum ada supplier relevan untuk bahan ini"
                  : "Supplier tidak ditemukan"
              }
            >
              {filteredSuppliers.map((item) => (
                <Option key={item.id} value={item.id}>
                  {getSupplierOptionLabel(item)}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {/* ===============================================================
              Field Link Produk untuk referensi restock berikutnya.
              Fungsi: menyimpan URL produk dari transaksi pembelian terakhir.
              Alasan perubahan: saat supplier dipilih, default link dibaca dari
              materialDetails supplier yang cocok dengan bahan ini agar user tidak
              perlu copy-paste ulang dari menu Supplier.
              Status: aktif dipakai sebagai data referensi; field tetap boleh
              disesuaikan untuk histori purchase ini, tetapi tidak dipakai untuk
              perhitungan harga, stok, kas, saving, expense, atau laporan.
          =============================================================== */}
          <Form.Item
            name="productLink"
            label="Link Produk Restock"
            extra={
              itemType === "material" && supplierId
                ? getSupplierProductLinkForMaterial(selectedSupplier || {}, itemId)
                  ? "Default dari katalog Supplier. Jika link marketplace berubah saat pembelian, boleh disesuaikan untuk histori purchase ini."
                  : "Supplier ini belum punya link produk untuk bahan ini."
                : "Opsional. Dipakai untuk referensi restock berikutnya, bukan untuk perhitungan pembelian."
            }
          >
            <Input placeholder="Link produk marketplace / supplier" />
          </Form.Item>

          {/* ===============================================================
              OCR Draft Screenshot Shopee.
              Fungsi: membantu isi biaya marketplace setelah item/supplier dipilih.
              Guard: hasil OCR selalu preview dulu, tidak mengganti item/supplier/link, tidak auto-save, dan tidak menyimpan gambar/alamat.
          =============================================================== */}
          <PurchaseOcrDraftPanel
            shopeeOcrState={shopeeOcrState}
            applyFeedback={shopeeOcrApplyFeedback}
            onUpload={handleShopeeScreenshotUpload}
            onApply={applyShopeeOcrDraftToForm}
            formatMoney={formatShopeeOcrMoney}
            reviewAlertTypeMap={SHOPEE_OCR_REVIEW_ALERT_TYPE}
            reviewTagColorMap={SHOPEE_OCR_REVIEW_TAG_COLOR}
          />

          {itemType === "material" ? (
            <>
              {/* ===============================================================
                  Baris Qty Beli + Satuan Beli.
                  Fungsi: memisahkan input aktual dan referensi supplier dalam satu baris yang ringkas.
                  Hubungan flow Purchases: Qty Beli tetap diedit user, sedangkan Satuan Beli hanya snapshot read-only dari katalog Supplier.
                  Status: aktif dipakai; bukan kandidat cleanup karena menjaga form Pembelian tidak terasa dobel.
              =============================================================== */}
              <Form.Item name="purchaseUnit" hidden>
                <Input />
              </Form.Item>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                {/* ===============================================================
                    AKTIF / GUARDED UI CLEANUP:
                    - read-only field memakai class shared agar token warna/border konsisten.
                    - perubahan ini presentational only; tidak mengubah value, validasi, atau payload Purchases.
                =============================================================== */}
                <Form.Item
                  name="quantity"
                  label="Qty Beli"
                  rules={[{ required: true, message: "Qty wajib diisi" }]}
                  extra="Jumlah aktual beli."
                >
                  <InputNumber
                    min={1}
                    step={1}
                    precision={0}
                    className="ims-filter-control"
                    formatter={(value) => formatNumberId(value)}
                    parser={parseIntegerIdInput}
                  />
                </Form.Item>

                <Form.Item
                  label="Satuan Beli"
                  extra="Satuan dari katalog supplier."
                >
                  <Form.Item shouldUpdate noStyle>
                    {({ getFieldValue }) => (
                      <div className="ims-readonly-field ims-readonly-field--compact">
                        {getFieldValue("purchaseUnit") || "-"}
                      </div>
                    )}
                  </Form.Item>
                </Form.Item>
              </div>

              {/* ===============================================================
                  Baris Stok Masuk + Satuan Stok.
                  Fungsi: menonjolkan total stok yang benar-benar akan masuk dari transaksi ini.
                  Hubungan flow Purchases: Stok Masuk tetap dihitung dari Qty Beli x Konversi Supplier,
                  sementara Konversi Supplier disimpan hidden/read-only sebagai sumber hitung katalog restock.
                  Status: aktif dipakai; jika ada reject/selisih barang, koreksi dilakukan lewat Penyesuaian Stok,
                  bukan edit konversi langsung di Purchases.
              =============================================================== */}
              <Form.Item
                name="conversionValue"
                hidden
                rules={[
                  { required: true, message: "Konversi wajib diisi dari katalog Supplier" },
                  {
                    validator: (_, value) =>
                      Number(value || 0) > 0
                        ? Promise.resolve()
                        : Promise.reject(new Error("Konversi Supplier harus lebih dari 0")),
                  },
                ]}
              >
                <InputNumber />
              </Form.Item>
              <Form.Item name="stockUnit" hidden>
                <Input />
              </Form.Item>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                <Form.Item
                  label="Stok Masuk"
                  validateStatus={Number(conversionValue || 0) > 0 ? "" : "warning"}
                  help={
                    Number(conversionValue || 0) > 0
                      ? "Nilai akhir stok yang akan masuk."
                      : "Konversi belum diisi di katalog Supplier."
                  }
                >
                  <Form.Item shouldUpdate noStyle>
                    {({ getFieldValue }) => {
                      // ACTIVE: UI Stok Masuk hanya menampilkan hasil akhir agar form Pembelian tidak ramai.
                      // ALASAN: rumus Qty Beli x Konversi Supplier tetap dipakai di logic, tetapi detail formula tidak perlu ditampilkan ke user.
                      // CLEANUP: bukan kandidat cleanup; blok ini menjaga tampilan ringkas tanpa mengubah perhitungan stok/kas.
                      const stockInValue = Math.round(Number(getFieldValue("totalStockIn") || 0));
                      const unit = getFieldValue("stockUnit") || "satuan stok";

                      return (
                        <div className="ims-readonly-field">
                          <strong style={{ fontSize: 16 }}>
                            {formatNumberId(stockInValue)} {unit}
                          </strong>
                        </div>
                      );
                    }}
                  </Form.Item>
                </Form.Item>

                <Form.Item label="Satuan Stok" extra="Satuan dari Raw Material.">
                  <Form.Item shouldUpdate noStyle>
                    {({ getFieldValue }) => (
                      <div className="ims-readonly-field ims-readonly-field--compact">
                        {getFieldValue("stockUnit") || "-"}
                      </div>
                    )}
                  </Form.Item>
                </Form.Item>
              </div>
            </>
          ) : (
            <Form.Item
              name="quantity"
              label="Qty Beli"
              rules={[{ required: true, message: "Qty wajib diisi" }]}
            >
              <InputNumber
                min={1}
                step={1}
                precision={0}
                className="ims-filter-control"
                formatter={(value) => formatNumberId(value)}
                parser={parseIntegerIdInput}
              />
            </Form.Item>
          )}

          {/* ===============================================================
              Toggle Pembelian Offline.
              Fungsi: menentukan apakah biaya online dipakai di transaksi aktual.
              Alasan perubahan: katalog Supplier sudah punya tipe online/offline, sehingga Purchases perlu mengikuti default tersebut namun tetap bisa disesuaikan user.
              Status: aktif dipakai; tidak membuat transaksi otomatis dan tidak mengubah stok/kas sebelum user klik Simpan.
          =============================================================== */}
          <Form.Item name="purchaseType" hidden>
            <Input />
          </Form.Item>

          <Form.Item
            label="Pembelian Offline"
            extra={
              isOfflinePurchase
                ? "Offline: biaya online tidak dipakai."
                : "Online: ongkir, voucher/koin, dan biaya layanan ikut menghitung total aktual."
            }
          >
            <Switch
              checked={isOfflinePurchase}
              checkedChildren="Offline"
              unCheckedChildren="Online"
              onChange={(checked) => {
                form.setFieldsValue({
                  purchaseType: checked ? "offline" : "online",
                  ...(checked
                    ? {
                        shippingCost: 0,
                        shippingDiscount: 0,
                        voucherDiscount: 0,
                        serviceFee: 0,
                      }
                    : {}),
                });
              }}
            />
          </Form.Item>

          {/* ===============================================================
              Subtotal Barang aktual.
              Fungsi: menyimpan harga aktual barang untuk transaksi purchase yang sedang dibuat.
              Alasan perubahan: default boleh berasal dari Qty x Harga Barang Supplier, tetapi user tetap bisa mengedit jika harga marketplace/toko berubah.
              Status: aktif dipakai; bukan kandidat cleanup karena menjaga Supplier sebagai default, bukan transaksi final.
          =============================================================== */}
          <Form.Item
            name="subtotalItems"
            label="Subtotal Barang"
            rules={[{ required: true, message: "Subtotal barang wajib diisi" }]}
            extra={
              selectedSupplierCatalogCost.supplierItemPrice > 0
                ? "Default dari Supplier. Tetap bisa diedit jika harga aktual berbeda."
                : "Isi harga aktual barang yang dibeli."
            }
          >
            <InputNumber
              min={0}
              step={1}
              precision={0}
              className="ims-filter-control"
              addonBefore="Rp"
              formatter={(value) => formatNumberId(value)}
              parser={parseIntegerIdInput}
              onChange={() => {
                subtotalManualOverrideRef.current = true;
              }}
            />
          </Form.Item>

          {!isOfflinePurchase ? (
            <>
              <Space style={{ display: "flex", width: "100%" }} size={12} wrap>
                <Form.Item
                  name="shippingCost"
                  label="Ongkir"
                  style={{ flex: 1, minWidth: 180 }}
                >
                  <InputNumber
                    min={0}
                    step={1}
                    precision={0}
                    className="ims-filter-control"
                    addonBefore="Rp"
                    formatter={(value) => formatNumberId(value)}
                    parser={parseIntegerIdInput}
                  />
                </Form.Item>

                <Form.Item
                  name="shippingDiscount"
                  label="Diskon Ongkir"
                  style={{ flex: 1, minWidth: 180 }}
                >
                  <InputNumber
                    min={0}
                    step={1}
                    precision={0}
                    className="ims-filter-control"
                    addonBefore="Rp"
                    formatter={(value) => formatNumberId(value)}
                    parser={parseIntegerIdInput}
                  />
                </Form.Item>
              </Space>

              <Space style={{ display: "flex", width: "100%" }} size={12} wrap>
                <Form.Item
                  name="voucherDiscount"
                  label="Voucher / Koin / Potongan"
                  style={{ flex: 1, minWidth: 180 }}
                >
                  <InputNumber
                    min={0}
                    step={1}
                    precision={0}
                    className="ims-filter-control"
                    addonBefore="Rp"
                    formatter={(value) => formatNumberId(value)}
                    parser={parseIntegerIdInput}
                  />
                </Form.Item>

                <Form.Item
                  name="serviceFee"
                  label="Biaya Layanan"
                  style={{ flex: 1, minWidth: 180 }}
                >
                  <InputNumber
                    min={0}
                    step={1}
                    precision={0}
                    className="ims-filter-control"
                    addonBefore="Rp"
                    formatter={(value) => formatNumberId(value)}
                    parser={parseIntegerIdInput}
                  />
                </Form.Item>
              </Space>
            </>
          ) : null}

          <PurchaseCostSummaryCard />

          <Form.Item
            name="note"
            label="Catatan"
            extra="Catatan manual dan ringkasan OCR akan tampil per baris agar mudah dicek ulang."
          >
            <Input.TextArea
              autoSize={{ minRows: 4, maxRows: 8 }}
              placeholder="Contoh: Catatan supplier, kondisi barang, atau ringkasan OCR Shopee."
              style={{ lineHeight: 1.6 }}
            />
          </Form.Item>
        </Form>
      </Modal>
);

export default PurchaseFormModal;
