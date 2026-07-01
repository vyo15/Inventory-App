import {
  Card,
  Col,
  Collapse,
  Descriptions,
  Row,
  Space,
  Statistic,
  Typography,
} from "antd";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import EmptyStateBlock from "../../../components/Layout/Feedback/EmptyStateBlock";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import MobileDetailDrawer from "../../../components/Layout/Mobile/MobileDetailDrawer";
import StatusTag from "../../../components/Layout/Feedback/StatusTag";
import { SEMI_FINISHED_CATEGORY_MAP } from "../../../constants/semiFinishedMaterialOptions";
import formatCurrency, { formatHppUnitCurrencyId } from "../../../utils/formatters/currencyId";
import formatNumber from "../../../utils/formatters/numberId";
import { formatStockWithUnit, getVariantDisplayLabel } from "../helpers/semiFinishedMaterialsPageHelpers";

const SemiFinishedMaterialDetailDrawer = ({
  detailVariantColumns,
  detailVisible,
  resolveComponentGroupLabel,
  resolveFlowerTypeLabel,
  selectedMaterial,
  selectedMaterialAverageCost,
  selectedMaterialCostSourceLabel,
  selectedMaterialRecipeCost,
  selectedMaterialRecipeMeta,
  selectedMaterialStatusMeta,
  selectedMaterialUnit,
  selectedMaterialVariants,
  setDetailVisible,
}) => (
      <MobileDetailDrawer
        title="Detail Semi Finished Material"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={900}
      >
        {!selectedMaterial ? (
          <EmptyStateBlock compact description="Tidak ada data" />
        ) : (
          <Space direction="vertical" style={{ width: "100%" }} size={16}>
            {/*
=====================================================
SECTION: Detail drawer semi finished material — GUARDED
Fungsi:
- Menampilkan status stok, biaya per unit, varian, dan metadata item semi finished secara read-only.

Dipakai oleh:
- Halaman SemiFinishedMaterials untuk audit master stok internal produksi.

Alasan perubahan:
- Detail dipisah menjadi metric, ringkasan, stok/biaya, varian, dan info tambahan tanpa mengubah kalkulasi stok/HPP.

Catatan cleanup:
- Data optional tetap dipindah ke Collapse; mapping varian dan field biaya tidak diubah.

Risiko:
- Jika current/available/reserved stock atau average cost salah dirender, HPP produk jadi bisa salah dibaca user.
=====================================================
*/}
            <ImsNotice
              variant={selectedMaterialStatusMeta?.alertType === "warning" ? "guard" : selectedMaterialStatusMeta?.alertType === "error" ? "critical" : selectedMaterialStatusMeta?.alertType === "success" ? "status" : "info"}
              compact
              title={`Status item: ${selectedMaterialStatusMeta?.label || "-"}`}
              description={
                selectedMaterial.isActive !== false
                  ? `Total stok ${formatStockWithUnit(
                      selectedMaterial.currentStock,
                      selectedMaterialUnit,
                    )} dengan stok tersedia ${formatStockWithUnit(
                      selectedMaterial.availableStock,
                      selectedMaterialUnit,
                    )}.`
                  : "Item nonaktif. Histori stok dan varian tetap tersimpan."
              }
            />

            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12} md={8}>
                <Card size="small">
                  <Statistic
                    title="Total Stok"
                    value={formatStockWithUnit(
                      selectedMaterial.currentStock,
                      selectedMaterialUnit,
                    )}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card size="small">
                  <Statistic
                    title="Stok Tersedia"
                    value={formatStockWithUnit(
                      selectedMaterial.availableStock,
                      selectedMaterialUnit,
                    )}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Card size="small">
                  <Statistic
                    title="Modal/HPP Aktif"
                    value={formatHppUnitCurrencyId(selectedMaterialAverageCost)}
                  />
                  <Space direction="vertical" size={0}>
                    <Typography.Text type="secondary" className="ims-cell-meta">
                      {selectedMaterialCostSourceLabel}
                    </Typography.Text>
                    {selectedMaterialRecipeMeta ? (
                      <Typography.Text type="secondary" className="ims-cell-meta">
                        ≈ {formatCurrency(selectedMaterialRecipeCost)} / {formatNumber(selectedMaterialRecipeMeta.qty)} {selectedMaterialRecipeMeta.label} per produk
                      </Typography.Text>
                    ) : null}
                  </Space>
                </Card>
              </Col>
            </Row>

            <Card size="small" title="Ringkasan Item">
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Nama">{selectedMaterial.name || "-"}</Descriptions.Item>
                <Descriptions.Item label="Jenis Komponen">
                  {SEMI_FINISHED_CATEGORY_MAP[selectedMaterial.category] || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Jenis Bunga">
                  {resolveFlowerTypeLabel(selectedMaterial)}
                </Descriptions.Item>
                <Descriptions.Item label="Kelompok Komponen">
                  {resolveComponentGroupLabel(selectedMaterial) || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <StatusTag color={selectedMaterialStatusMeta?.color || "default"}>
                    {selectedMaterialStatusMeta?.label || "-"}
                  </StatusTag>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="Stok & Biaya">
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Reserved Stock">
                  {formatStockWithUnit(selectedMaterial.reservedStock, selectedMaterialUnit)}
                </Descriptions.Item>
                <Descriptions.Item label="Min Stock Alert">
                  {formatStockWithUnit(selectedMaterial.minStockAlert, selectedMaterialUnit)}
                </Descriptions.Item>
                <Descriptions.Item label="Reference Cost / Unit">
                  {formatHppUnitCurrencyId(selectedMaterial.referenceCostPerUnit)}
                </Descriptions.Item>
                <Descriptions.Item label="Modal/HPP Aktif">
                  {formatHppUnitCurrencyId(selectedMaterialAverageCost)}
                </Descriptions.Item>
                {selectedMaterialRecipeMeta ? (
                  <Descriptions.Item label="Estimasi Resep Bunga">
                    ≈ {formatCurrency(selectedMaterialRecipeCost)} / {formatNumber(selectedMaterialRecipeMeta.qty)} {selectedMaterialRecipeMeta.label}
                  </Descriptions.Item>
                ) : null}
                <Descriptions.Item label="Last Production Cost / Unit">
                  {formatHppUnitCurrencyId(selectedMaterial.lastProductionCostPerUnit)}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="Rincian Varian Semi Finished" size="small">
              <DataTableView
                size="small"
                rowKey={(record, index) => `${record.variantKey || record.color}-${index}`}
                pagination={false}
                showRefreshIndicator={false}
                dataSource={selectedMaterialVariants}
                locale={{ emptyText: "Belum ada varian" }}
                columns={detailVariantColumns}
                tableLayout="fixed"
                scroll={{ x: 720 }}
                mobileCardConfig={{
                  title: (record, index) => getVariantDisplayLabel(record, index),
                  tags: (record) => (
                    <StatusTag tone={record.isActive === false ? "neutral" : "success"}>
                      {record.isActive === false ? "Nonaktif" : "Aktif"}
                    </StatusTag>
                  ),
                  meta: [
                    { label: "Stok", value: (record) => formatStockWithUnit(record.currentStock, selectedMaterialUnit) },
                    { label: "Reserved", value: (record) => formatStockWithUnit(record.reservedStock, selectedMaterialUnit) },
                    { label: "Tersedia", value: (record) => formatStockWithUnit(record.availableStock, selectedMaterialUnit) },
                  ],
                }}
              />
            </Card>

            <Collapse
              ghost
              items={[
                {
                  key: "additional",
                  label: "Info Tambahan",
                  children: (
                    <Descriptions column={1} bordered size="small">
                      <Descriptions.Item label="Deskripsi">
                        {selectedMaterial.description || "-"}
                      </Descriptions.Item>
                      <Descriptions.Item label={selectedMaterial.variantLabel || "Varian Aktif"}>
                        {formatNumber(selectedMaterial.activeVariantCount)} / {formatNumber(
                          selectedMaterial.variantCount,
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="Max Stock Target">
                        {selectedMaterial.maxStockTarget === null
                          ? "-"
                          : formatStockWithUnit(
                              selectedMaterial.maxStockTarget,
                              selectedMaterialUnit,
                            )}
                      </Descriptions.Item>
                    </Descriptions>
                  ),
                },
              ]}
            />
          </Space>
        )}
      </MobileDetailDrawer>
);

export default SemiFinishedMaterialDetailDrawer;
