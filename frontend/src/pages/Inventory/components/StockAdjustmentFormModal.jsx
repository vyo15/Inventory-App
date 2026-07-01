import {
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Tag,
} from "antd";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import ResponsiveFormSection from "../../../components/Layout/Mobile/ResponsiveFormSection";
import { formatNumberId, parseIntegerIdInput } from "../../../utils/formatters/numberId";
import { showFormValidationFeedback } from "../../../utils/forms/formValidationFeedback";

const { Option } = Select;

const StockAdjustmentFormModal = ({
  availableItems,
  form,
  formatQuantityId,
  handleSubmitStockAdjustment,
  isModalOpen,
  isSubmitting,
  needsUnitCostGuard,
  quantityUnitLabel,
  quantityUsesWholeNumber,
  resetAdjustmentFormState,
  selectedAdjustmentType,
  selectedCurrentUnitCost,
  selectedItem,
  selectedItemHasVariants,
  selectedStockSnapshot,
  selectedVariant,
  variantOptions,
}) => (
      <Modal
        title="Penyesuaian Stok"
        open={isModalOpen}
        onCancel={resetAdjustmentFormState}
        onOk={() => form.submit()}
        okText="Simpan"
        confirmLoading={isSubmitting}
        cancelText="Batal"
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitStockAdjustment}
          onFinishFailed={(errorInfo) => showFormValidationFeedback(errorInfo, { form })}
        >
          <ResponsiveFormSection
            title="Data Penyesuaian Stok"
            subtitle="Cek item, arah penyesuaian, qty, modal, alasan, dan catatan sebelum simpan."
          >
          <ImsNotice
            variant="guard"
            compact
            className="ims-mb-16"
            title="Penyesuaian akan mengubah stok"
            description="Cek item, varian, qty, dan alasan sebelum simpan."
          />

          <Form.Item
            name="date"
            label="Tanggal"
            rules={[{ required: true, message: "Tanggal wajib diisi" }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="itemType"
            label="Jenis Item"
            rules={[{ required: true, message: "Jenis item wajib dipilih" }]}
          >
            <Select
              placeholder="Pilih jenis item"
              onChange={() => {
                form.setFieldsValue({ itemId: undefined, variantKey: undefined, unitCost: undefined });
              }}
            >
              <Option value="raw_material">Bahan Baku</Option>
              <Option value="semi_finished">Semi Finished</Option>
              <Option value="product">Produk Jadi</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="itemId"
            label="Pilih Item"
            rules={[{ required: true, message: "Item wajib dipilih" }]}
          >
            <Select
              showSearch
              placeholder="Pilih item"
              optionFilterProp="children"
              onChange={() => {
                form.setFieldsValue({ variantKey: undefined, unitCost: undefined });
              }}
            >
              {availableItems.map((item) => (
                <Option key={item.id} value={item.id}>
                  {item.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {selectedItemHasVariants ? (
            <Form.Item
              name="variantKey"
              label="Varian Item"
              rules={[{ required: true, message: "Varian wajib dipilih untuk item bervarian" }]}
              tooltip="Pilih varian jika item bervarian."
            >
              <Select
                showSearch
                placeholder="Pilih varian"
                optionFilterProp="children"
                onChange={() => {
                  form.setFieldsValue({ unitCost: undefined });
                }}
              >
                {variantOptions.map((variantOption) => (
                  <Option key={variantOption.value} value={variantOption.value}>
                    {variantOption.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          ) : null}

          {/* =====================================================
              SECTION: Snapshot stok terpilih - AKTIF / GUARDED
              Fungsi blok:
              - menampilkan current/reserved/available stock sebagai panel read-only pasif, bukan Alert warning.
              Hubungan flow Stock Adjustment:
              - hanya mengganti tampilan snapshot sebelum submit; validasi availableStock, variantKey, transaction, stock_adjustments, dan inventory_logs tetap memakai logic existing.
              Alasan logic:
              - info stok bukan warning/error, sehingga lebih aman secara UX ditampilkan sebagai panel clean seperti Purchases.
              Status: AKTIF untuk UI Stock Adjustment, GUARDED terhadap mutasi stok dan payload layanan database lokal.
          ===================================================== */}
          {selectedItem ? (
            <div className="ims-readonly-panel">
              <div className="ims-readonly-panel-header">
                <div>
                  <div className="ims-readonly-panel-title">
                    Stok Sebelum Penyesuaian
                  </div>
                  <div className="ims-readonly-panel-description">
                    Cek stok terpilih sebelum submit. Perubahan baru terjadi setelah disimpan.
                  </div>
                </div>
                <Tag color={selectedItemHasVariants ? "purple" : "default"}>
                  {selectedItemHasVariants ? "Varian" : "Master"}
                </Tag>
              </div>

              <div style={{ marginBottom: selectedStockSnapshot ? 10 : 0 }}>
                <span className="ims-cell-title">
                  {selectedItem.name || "Item"}
                </span>
                {selectedStockSnapshot?.label ? (
                  <span style={{ color: "var(--ims-text-secondary)" }}>
                    {` — ${selectedStockSnapshot.label}`}
                  </span>
                ) : null}
              </div>

              {selectedStockSnapshot ? (
                <div className="ims-readonly-stat-grid">
                  <div className="ims-readonly-stat-field">
                    <div className="ims-readonly-stat-label">Stok Saat Ini</div>
                    <div className="ims-readonly-stat-value">
                      {formatQuantityId(selectedStockSnapshot.currentStock, quantityUnitLabel)}
                    </div>
                  </div>
                  <div className="ims-readonly-stat-field">
                    <div className="ims-readonly-stat-label">Stok Dipesan</div>
                    <div className="ims-readonly-stat-value">
                      {formatQuantityId(selectedStockSnapshot.reservedStock, quantityUnitLabel)}
                    </div>
                  </div>
                  <div className="ims-readonly-stat-field">
                    <div className="ims-readonly-stat-label">Stok Tersedia</div>
                    <div className="ims-readonly-stat-value">
                      {formatQuantityId(selectedStockSnapshot.availableStock, quantityUnitLabel)}
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedItemHasVariants ? (
                <div className="ims-readonly-panel-note">
                  Item bervarian wajib masuk ke varian yang dipilih agar stok varian dan total master tetap sinkron.
                </div>
              ) : null}
            </div>
          ) : null}

          <Form.Item
            name="adjustmentType"
            label="Tipe Penyesuaian"
            rules={[{ required: true, message: "Tipe penyesuaian wajib dipilih" }]}
          >
            <Select
              placeholder="Pilih tipe penyesuaian"
              onChange={() => {
                form.setFieldsValue({ unitCost: undefined });
              }}
            >
              <Option value="in">Tambah</Option>
              <Option value="out">Kurang</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="quantity"
            label="Jumlah"
            dependencies={["adjustmentType", "itemId", "variantKey"]}
            rules={[
              { required: true, message: "Jumlah wajib diisi" },
              {
                validator: (_, value) => {
                  const numericValue = Number(value || 0);

                  if (
                    selectedAdjustmentType === "out" &&
                    selectedStockSnapshot &&
                    numericValue > selectedStockSnapshot.availableStock
                  ) {
                    return Promise.reject(
                      new Error(
                        `Jumlah keluar melebihi stok tersedia (${formatQuantityId(
                          selectedStockSnapshot.availableStock,
                          quantityUnitLabel,
                        )}).`,
                      ),
                    );
                  }

                  return Promise.resolve();
                },
              },
            ]}
            extra={
              quantityUnitLabel
                ? `Satuan: ${quantityUnitLabel}. ${quantityUsesWholeNumber ? "Qty tanpa desimal." : "Qty ditampilkan tanpa desimal."}${selectedVariant ? ` Varian: ${selectedVariant.variantLabel}.` : ""}`
                : "Pilih item dulu agar satuan qty jelas."
            }
          >
            <InputNumber
              min={1}
              step={1}
              precision={0}
              style={{ width: "100%" }}
              formatter={(value) => formatNumberId(value)}
              parser={parseIntegerIdInput}
            />
          </Form.Item>

          {selectedAdjustmentType === "in" ? (
            <Form.Item
              name="unitCost"
              label="Modal per Unit"
              rules={[
                {
                  validator: (_, value) => {
                    if (!needsUnitCostGuard) return Promise.resolve();

                    const numericValue = Number(value || 0);
                    if (Number.isFinite(numericValue) && numericValue > 0) {
                      return Promise.resolve();
                    }

                    return Promise.reject(
                      new Error("Modal per unit wajib diisi karena cost/HPP item masih 0."),
                    );
                  },
                },
              ]}
              extra={
                selectedCurrentUnitCost > 0
                  ? "Cost/HPP master sudah ada, field ini opsional dan tidak mengubah cost lama."
                  : "Wajib untuk stok masuk pertama atau data arsip yang cost/HPP-nya masih 0."
              }
            >
              <InputNumber
                min={0}
                step={1}
                precision={0}
                style={{ width: "100%" }}
                formatter={(value) => formatNumberId(value)}
                parser={parseIntegerIdInput}
              />
            </Form.Item>
          ) : null}

          <Form.Item
            name="reason"
            label="Alasan"
            rules={[{ required: true, message: "Alasan wajib diisi" }]}
          >
            <Select placeholder="Pilih alasan">
              <Option value="stok_awal">Stok Awal</Option>
              <Option value="opname">Selisih Opname</Option>
              <Option value="rusak">Barang Rusak</Option>
              <Option value="hilang">Barang Hilang</Option>
              <Option value="lainnya">Lainnya</Option>
            </Select>
          </Form.Item>

          <Form.Item name="note" label="Catatan">
            <Input.TextArea rows={3} placeholder="Opsional" />
          </Form.Item>
          </ResponsiveFormSection>
        </Form>
      </Modal>
);

export default StockAdjustmentFormModal;
