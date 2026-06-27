import {
  Modal,
  Form,
  Select,
  InputNumber,
  DatePicker,
  Input,
  Space,
  Switch,
  Button,
  Tag,
} from "antd";
import { formatNumberId, parseIntegerIdInput } from "../../../utils/formatters/numberId";
import ResponsiveFormSection from "../../../components/Layout/Mobile/ResponsiveFormSection";
import RupiahInputNumber from "../../../components/Layout/Forms/RupiahInputNumber";
import { showFormValidationFeedback } from "../../../utils/forms/formValidationFeedback";
import {
  calculateSupplierMaterialRestockMetrics,
  getSupplierOptionLabel,
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
  selectedSupplierOffers,
  selectedCatalogOffer,
  priceVerified,
  onVerifyPrice,
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
        okButtonProps={{ disabled: isSubmittingPurchase || !priceVerified }}
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
          <ResponsiveFormSection
            title="Detail Pembelian"
            subtitle="Data item, supplier, stok masuk, dan biaya aktual dibuat ringkas untuk mobile."
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
              itemId
                ? filteredSuppliers.length
                  ? "Hanya toko yang memiliki katalog untuk barang dan varian ini."
                  : "Belum ada toko yang menyediakan barang ini. Tambahkan melalui menu Supplier."
                : "Pilih barang terlebih dahulu."
            }
          >
            <Select
              placeholder="Pilih supplier"
              showSearch
              optionFilterProp="children"
              notFoundContent={itemId ? "Belum ada supplier relevan" : "Supplier tidak ditemukan"}
            >
              {filteredSuppliers.map((item) => (
                <Option key={item.id} value={item.id}>
                  {getSupplierOptionLabel(item)}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="catalogOfferId"
            label="Link / Paket Toko"
            rules={[{ required: true, message: "Link atau paket toko wajib dipilih" }]}
            extra={
              supplierId
                ? selectedSupplierOffers.length
                  ? "Pilih penawaran yang akan dipakai untuk Pembelian ini."
                  : "Toko ini belum memiliki penawaran aktif untuk barang dan varian terpilih."
                : "Pilih supplier terlebih dahulu."
            }
          >
            <Select
              placeholder="Pilih link atau paket"
              showSearch
              optionFilterProp="children"
              disabled={!supplierId || !selectedSupplierOffers.length}
            >
              {selectedSupplierOffers.map((offer) => {
                const metrics = calculateSupplierMaterialRestockMetrics(offer);
                const label = offer.listingName
                  || [offer.channel, offer.purchaseUnit].filter(Boolean).join(" · ")
                  || "Penawaran toko";
                return (
                  <Option key={offer.id || offer.catalogOfferId} value={offer.id || offer.catalogOfferId}>
                    {`${label} — ${formatNumberId(metrics.supplierItemPrice || 0)}`}
                  </Option>
                );
              })}
            </Select>
          </Form.Item>

          <Form.Item name="productLink" hidden>
            <Input />
          </Form.Item>

          {selectedCatalogOffer ? (
            <div className="ims-readonly-field" style={{ marginBottom: 16 }}>
              <Space direction="vertical" size={6} style={{ width: "100%" }}>
                <Space wrap>
                  <strong>{selectedCatalogOffer.listingName || selectedCatalogOffer.itemName}</strong>
                  {selectedCatalogOffer.channel ? <Tag>{selectedCatalogOffer.channel}</Tag> : null}
                </Space>
                <Space wrap>
                  <span>Harga katalog: Rp {formatNumberId(selectedCatalogOffer.supplierItemPrice || 0)}</span>
                  {selectedCatalogOffer.productLink ? (
                    <Button
                      size="small"
                      href={selectedCatalogOffer.productLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Buka Toko
                    </Button>
                  ) : null}
                </Space>
              </Space>
            </div>
          ) : null}

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
            <RupiahInputNumber
              min={0}
              step={1}
              precision={0}
              inputClassName="ims-filter-control"
              formatter={(value) => formatNumberId(value)}
              parser={parseIntegerIdInput}
              onChange={() => {
                subtotalManualOverrideRef.current = true;
              }}
            />
          </Form.Item>

          <Form.Item name="priceVerified" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="priceVerifiedAt" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="verifiedCatalogPrice" hidden>
            <InputNumber />
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const qty = Math.round(Number(getFieldValue("quantity") || 0));
              const subtotal = Math.round(Number(getFieldValue("subtotalItems") || 0));
              const actualPackagePrice = qty > 0 ? Math.round(subtotal / qty) : 0;
              const referencePrice = Math.round(Number(selectedCatalogOffer?.supplierItemPrice || 0));
              const isChanged = Boolean(priceVerified && actualPackagePrice !== referencePrice);
              return (
                <div className="ims-readonly-field" style={{ marginBottom: 16 }}>
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    <Space wrap style={{ justifyContent: "space-between", width: "100%" }}>
                      <strong>Verifikasi Harga Aktual</strong>
                      <Tag color={priceVerified ? (isChanged ? "gold" : "green") : "default"}>
                        {priceVerified ? (isChanged ? "Harga berubah" : "Harga sesuai") : "Belum diverifikasi"}
                      </Tag>
                    </Space>
                    <span>
                      Harga aktual per paket: <strong>Rp {formatNumberId(actualPackagePrice)}</strong>
                    </span>
                    <span style={{ opacity: 0.72 }}>
                      Buka toko, cocokkan harga dan isi paket, lalu konfirmasi sebelum menyimpan.
                    </span>
                    <Button
                      type={priceVerified ? "default" : "primary"}
                      onClick={onVerifyPrice}
                      disabled={!selectedCatalogOffer || qty <= 0 || actualPackagePrice <= 0}
                    >
                      {priceVerified ? "Verifikasi Ulang" : "Verifikasi Harga"}
                    </Button>
                  </Space>
                </div>
              );
            }}
          </Form.Item>

          {!isOfflinePurchase ? (
            <>
              <Space style={{ display: "flex", width: "100%" }} size={12} wrap>
                <Form.Item
                  name="shippingCost"
                  label="Ongkir"
                  style={{ flex: 1, minWidth: 180 }}
                >
                  <RupiahInputNumber
                    min={0}
                    step={1}
                    precision={0}
                    inputClassName="ims-filter-control"
                    formatter={(value) => formatNumberId(value)}
                    parser={parseIntegerIdInput}
                  />
                </Form.Item>

                <Form.Item
                  name="shippingDiscount"
                  label="Diskon Ongkir"
                  style={{ flex: 1, minWidth: 180 }}
                >
                  <RupiahInputNumber
                    min={0}
                    step={1}
                    precision={0}
                    inputClassName="ims-filter-control"
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
                  <RupiahInputNumber
                    min={0}
                    step={1}
                    precision={0}
                    inputClassName="ims-filter-control"
                    formatter={(value) => formatNumberId(value)}
                    parser={parseIntegerIdInput}
                  />
                </Form.Item>

                <Form.Item
                  name="serviceFee"
                  label="Biaya Layanan"
                  style={{ flex: 1, minWidth: 180 }}
                >
                  <RupiahInputNumber
                    min={0}
                    step={1}
                    precision={0}
                    inputClassName="ims-filter-control"
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
          </ResponsiveFormSection>
        </Form>
      </Modal>
);

export default PurchaseFormModal;
