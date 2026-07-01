import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import formatNumber, { parseIntegerIdInput } from "../../../utils/formatters/numberId";
import {
  PRIORITY_OPTIONS,
  PRODUCTION_ORDER_TARGET_TYPES,
  formatQtyWithUnit,
  getCompactLineStatus,
  getRequirementStockSourceMeta,
} from "../helpers/productionOrdersPageHelpers";

const ProductionOrderFormDrawer = ({
  formState: { form, formVisible, submitting },
  selectionState: {
    bomIdValue,
    orderQtyValue,
    selectedProductionTargetKey,
    semiCategoryFilter,
    semiFamilyFilter,
    targetTypeValue,
    targetVariantKeyValue,
    targetVariantOptions,
  },
  referenceData: {
    recipeOptions,
    semiCategoryOptions,
    semiFamilyOptions,
    visibleProductionTargetGroups,
  },
  previewState: {
    requirementPreview,
    requirementPreviewError,
    requirementPreviewLoading,
  },
  uiState: {
    bomLoading,
    isSemiFinishedProduction,
    shouldShowRecipeSelect,
    targetSelectLabel,
    targetSelectPlaceholder,
  },
  actions: {
    closeFormDrawer,
    handleSelectProductionTarget,
    handleSubmit,
    loadBomOptions,
    loadGeneratedCode,
    loadSemiFinishedReferences,
    setSelectedProductionTargetKey,
    setSemiCategoryFilter,
    setSemiFamilyFilter,
    setTargetVariantOptions,
  },
}) => (
      <Drawer
        title="Buat Production Order"
        open={formVisible}
        onClose={closeFormDrawer}
        width={680}
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
        <Form form={form} layout="vertical">
          <Form.Item label="Kode Order" name="code">
            <Input
              placeholder="Auto generate"
              disabled
            />
          </Form.Item>

          <div style={{ margin: "16px 0 8px" }}>
            <Typography.Text strong>Target Produksi</Typography.Text>
          </div>

          <Form.Item
            label="Jenis Produksi"
            name="targetType"
            tooltip="Tentukan jenis produksi dan target yang ingin dibuat."
            rules={[{ required: true, message: "Jenis produksi wajib dipilih" }]}
          >
            <Select
              options={PRODUCTION_ORDER_TARGET_TYPES}
              onChange={async (value) => {
                form.setFieldsValue({
                  code: "",
                  bomId: undefined,
                  targetVariantKey: undefined,
                  targetVariantLabel: "",
                });
                setSelectedProductionTargetKey("");
                setSemiFamilyFilter("");
                setSemiCategoryFilter("all");
                setTargetVariantOptions([]);
                if (value === "semi_finished_material") {
                  await loadSemiFinishedReferences();
                }
                await loadBomOptions(value);
                await loadGeneratedCode(value);
              }}
            />
          </Form.Item>

          {isSemiFinishedProduction ? (
            <>
              <Form.Item label="Jenis Bunga / Product Family" required>
                <Select
                  showSearch
                  allowClear
                  optionFilterProp="label"
                  value={semiFamilyFilter || undefined}
                  options={semiFamilyOptions}
                  loading={bomLoading}
                  placeholder="Pilih jenis bunga..."
                  onFocus={loadSemiFinishedReferences}
                  onChange={(value) => {
                    setSemiFamilyFilter(value || "");
                    setSemiCategoryFilter("all");
                    setSelectedProductionTargetKey("");
                    setTargetVariantOptions([]);
                    form.setFieldsValue({
                      bomId: undefined,
                      targetVariantKey: undefined,
                      targetVariantLabel: "",
                    });
                  }}
                />
              </Form.Item>

              <Form.Item label="Kategori Bahan">
                <Select
                  optionFilterProp="label"
                  value={semiCategoryFilter}
                  options={semiCategoryOptions}
                  disabled={!semiFamilyFilter}
                  placeholder="Pilih kategori bahan..."
                  onChange={(value) => {
                    setSemiCategoryFilter(value || "all");
                    setSelectedProductionTargetKey("");
                    setTargetVariantOptions([]);
                    form.setFieldsValue({
                      bomId: undefined,
                      targetVariantKey: undefined,
                      targetVariantLabel: "",
                    });
                  }}
                />
              </Form.Item>
            </>
          ) : null}

          <Form.Item label={targetSelectLabel} required>
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              value={selectedProductionTargetKey || undefined}
              options={visibleProductionTargetGroups.map((group) => ({
                value: group.key,
                label: group.label,
              }))}
              loading={bomLoading}
              disabled={isSemiFinishedProduction && !semiFamilyFilter}
              placeholder={targetSelectPlaceholder}
              onFocus={() => {
                loadBomOptions(targetTypeValue || "product");
                if (isSemiFinishedProduction) loadSemiFinishedReferences();
              }}
              onDropdownVisibleChange={(open) => {
                if (open) {
                  loadBomOptions(targetTypeValue || "product");
                  if (isSemiFinishedProduction) loadSemiFinishedReferences();
                }
              }}
              onChange={handleSelectProductionTarget}
            />
          </Form.Item>

          <div style={{ margin: "20px 0 8px" }}>
            <Typography.Text strong>Detail Produksi</Typography.Text>
          </div>

          <Form.Item
            label="Resep Produksi"
            name="bomId"
            tooltip="Sistem memakai resep aktif sebagai acuan kebutuhan material."
            rules={[{ required: true, message: "Resep produksi wajib dipilih" }]}
            hidden={!shouldShowRecipeSelect}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={recipeOptions}
              loading={bomLoading}
              disabled={!selectedProductionTargetKey}
              placeholder={selectedProductionTargetKey ? "Pilih resep produksi..." : "Pilih target produksi dulu"}
              onFocus={() => loadBomOptions(targetTypeValue || "product")}
              onDropdownVisibleChange={(open) => {
                if (open) loadBomOptions(targetTypeValue || "product");
              }}
              onChange={() => {
                form.setFieldsValue({
                  targetVariantKey: undefined,
                  targetVariantLabel: "",
                });
              }}
            />
          </Form.Item>

          <div style={{ margin: "20px 0 8px" }}>
            <Typography.Text strong>Preview Kebutuhan</Typography.Text>
          </div>

          {targetVariantOptions.length > 0 ? (
            <Form.Item
              label="Varian Target"
              name="targetVariantKey"
              rules={[
                { required: true, message: "Varian target wajib dipilih" },
              ]}
              tooltip="Pilih varian target jika ada."
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={targetVariantOptions}
                placeholder="Pilih varian target..."
                onChange={(value) => {
                  const selectedVariant = targetVariantOptions.find(
                    (item) => item.value === value,
                  );
                  form.setFieldValue(
                    "targetVariantLabel",
                    selectedVariant?.label || "",
                  );
                }}
              />
            </Form.Item>
          ) : null}

          <Form.Item
            label="Qty Batch Produksi"
            name="orderQty"
            tooltip="Isi qty batch untuk melihat kebutuhan material dan kondisi stok."
            rules={[{ required: true, message: "Qty order wajib diisi" }]}
          >
            <InputNumber min={1} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
          </Form.Item>

          {/* =====================================================
              ACTIVE / FINAL - preview compact Buat Production Order.
              Fungsi:
              - mengganti kotak summary hijau besar dengan info target produksi
                dan kebutuhan material yang lebih berguna;
              - membaca requirementLines dan targetStockPreview dari helper final.
              Alasan perubahan:
              - drawer PO sebelumnya terlalu penuh oleh summary agregat.
              Status:
              - aktif dipakai sebagai preview read-only;
              - tidak menyimpan ke database, tidak mengubah stok, dan tidak mengubah status PO.
          ===================================================== */}
          {bomIdValue && Number(orderQtyValue || 0) > 0 ? (
            <div style={{ marginBottom: 16 }}>
              {requirementPreviewError ? (
                <ImsNotice
                  variant="critical"
                  compact
                  className="ims-mb-16"
                  title="Preview kebutuhan material tidak valid"
                  description={requirementPreviewError}
                />
              ) : requirementPreview?.targetHasVariants === true && !targetVariantKeyValue ? (
                <ImsNotice
                  variant="info"
                  compact
                  className="ims-mb-16"
                  title="Pilih varian target untuk preview kebutuhan."
                />
              ) : requirementPreview ? (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Card size="small" title="Target Produksi">
                    {(() => {
                      const targetPreview = requirementPreview.targetStockPreview || {};
                      const targetVariantLabel = targetPreview.targetVariantLabel || "";
                      const targetName = targetPreview.targetName || "-";
                      const targetUnit = targetPreview.targetUnit || "pcs";
                      const currentStockLabel =
                        targetPreview.currentStockSnapshot === null ||
                        targetPreview.currentStockSnapshot === undefined
                          ? targetPreview.note || "Stok target belum terbaca"
                          : formatQtyWithUnit(targetPreview.currentStockSnapshot, targetUnit);

                      return (
                        <Space direction="vertical" size={2} style={{ width: "100%" }}>
                          <Typography.Text strong>
                            {targetName}
                            {targetVariantLabel ? ` · ${targetVariantLabel}` : ""}
                          </Typography.Text>
                          <Typography.Text type="secondary">
                            Stok saat ini {currentStockLabel} · Qty batch {formatNumber(orderQtyValue || 0)} · Output {formatQtyWithUnit(targetPreview.expectedOutputQty || 0, targetUnit)}
                          </Typography.Text>
                        </Space>
                      );
                    })()}
                  </Card>

                  <Card
                    size="small"
                    title="Kebutuhan Material"
                    bodyStyle={{ padding: 12 }}
                  >
                    {requirementPreviewLoading ? (
                      <Typography.Text type="secondary">
                        Memuat preview kebutuhan material...
                      </Typography.Text>
                    ) : (requirementPreview.requirementLines || []).length === 0 ? (
                      <Typography.Text type="secondary">
                        Resep produksi belum memiliki material.
                      </Typography.Text>
                    ) : (
                      <div style={{ maxHeight: 220, overflowY: "auto" }}>
                        {(requirementPreview.requirementLines || []).map((line, index) => {
                          const sourceMeta = getRequirementStockSourceMeta(line);
                          const statusMeta = getCompactLineStatus(line);

                          return (
                            <div
                              key={line.id || `${line.itemId || "material"}-${index}`}
                              style={{
                                padding: "8px 0",
                                borderBottom:
                                  index === requirementPreview.requirementLines.length - 1
                                    ? "none"
                                    : "1px solid var(--ims-border-color-soft)",
                              }}
                            >
                              <Space direction="vertical" size={2} style={{ width: "100%" }}>
                                <Typography.Text strong>
                                  {line.itemName || "Material"}
                                </Typography.Text>
                                <Space size={6} wrap>
                                  <Tag className="ims-status-tag" color={sourceMeta.color}>
                                    {sourceMeta.label}
                                  </Tag>
                                  <Typography.Text type="secondary">
                                    {sourceMeta.variantLabel}
                                  </Typography.Text>
                                  <Typography.Text type="secondary">·</Typography.Text>
                                  <Typography.Text type="secondary">
                                    Butuh {formatQtyWithUnit(line.qtyRequired, line.unit)}
                                  </Typography.Text>
                                  <Typography.Text type="secondary">·</Typography.Text>
                                  <Typography.Text type="secondary">
                                    Stok {formatQtyWithUnit(line.availableStockSnapshot, line.unit)}
                                  </Typography.Text>
                                  <Tag className="ims-status-tag" color={statusMeta.color}>
                                    {statusMeta.label}
                                  </Tag>
                                </Space>
                              </Space>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </Space>
              ) : (
                <Typography.Text type="secondary">
                  Memuat preview kebutuhan material...
                </Typography.Text>
              )}
            </div>
          ) : null}

          <Form.Item label="Priority" name="priority">
            <Select options={PRIORITY_OPTIONS} />
          </Form.Item>

          <Form.Item label="Catatan" name="notes">
            <Input.TextArea rows={3} placeholder="Catatan order..." />
          </Form.Item>
        </Form>
      </Drawer>
);

export default ProductionOrderFormDrawer;
