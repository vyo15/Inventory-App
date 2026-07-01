import {
  Card,
  Col,
  Descriptions,
  Row,
  Space,
  Statistic,
  Typography,
} from "antd";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import MobileDetailDrawer from "../../../components/Layout/Mobile/MobileDetailDrawer";
import { PRODUCTION_PROFILE_TYPE_MAP } from "../../../constants/productionProfileOptions";
import formatNumber from "../../../utils/formatters/numberId";

const ProductionProfileDetailDrawer = ({
  closeDetail,
  detailRequirementRows,
  detailVisible,
  detailYieldRows,
  renderProfileStatus,
  renderStatisticValue,
  requirementMobileCardConfig,
  selectedProfile,
  yieldMobileCardConfig,
}) => (
      <MobileDetailDrawer
        title="Detail Profil Produksi"
        open={detailVisible}
        onClose={closeDetail}
        width={860}
        destroyOnClose
      >
        {selectedProfile ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {/*
=====================================================
SECTION: Detail profil produksi — AKTIF
Fungsi:
- Menampilkan ringkasan template produksi tanpa mengubah data, payload, atau rumus profil.

Dipakai oleh:
- Tombol Detail pada halaman ProductionProfiles.

Alasan perubahan:
- Template produksi sebelumnya hanya punya Edit/Toggle sehingga user tidak bisa review detail tanpa membuka form edit.

Risiko:
- Detail ini hanya presentasi; jangan memindahkan logic kalkulasi dari constants/service ke drawer.
=====================================================
*/}
            <Card size="small">
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} md={16}>
                  <Typography.Title level={4} style={{ marginBottom: 4 }}>
                    {selectedProfile.profileName || '-'}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    {selectedProfile.productName || '-'}
                  </Typography.Text>
                </Col>
                <Col xs={24} md={8}>
                  <div style={{ textAlign: 'right' }}>{renderProfileStatus(selectedProfile)}</div>
                </Col>
              </Row>
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic title="Target Batch" value={selectedProfile.assemblyTargetOutput || 0} suffix="bunga" formatter={renderStatisticValue} />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic title="Total Kawat / Batch" value={selectedProfile.assemblyStemQty || 0} formatter={renderStatisticValue} />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic title="Sisa Daun Teoritis" value={selectedProfile.assemblyLeafTheoreticalLeftover || 0} formatter={renderStatisticValue} />
                </Card>
              </Col>
            </Row>

            <Card size="small" title="Ringkasan">
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Produk">{selectedProfile.productName || '-'}</Descriptions.Item>
                <Descriptions.Item label="Tipe Profil">{PRODUCTION_PROFILE_TYPE_MAP[selectedProfile.profileType] || '-'}</Descriptions.Item>
                <Descriptions.Item label="Alert Miss">
                  Kuning {formatNumber(selectedProfile.missYellowPercent || 0)}% · Merah {formatNumber(selectedProfile.missRedPercent || 0)}%
                </Descriptions.Item>
                <Descriptions.Item label="Catatan">{selectedProfile.notes || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="Kebutuhan per Produk">
              <DataTableView
                size="small"
                pagination={false}
                showRefreshIndicator={false}
                rowKey="key"
                dataSource={detailRequirementRows(selectedProfile)}
                mobileCardConfig={requirementMobileCardConfig}
                columns={[
                  { title: 'Komponen', dataIndex: 'component', key: 'component' },
                  { title: 'Qty', dataIndex: 'qty', key: 'qty', align: 'right', render: (value) => formatNumber(value || 0) },
                  { title: 'Satuan', dataIndex: 'unit', key: 'unit' },
                ]}
              />
            </Card>

            <Card size="small" title="Hasil Standar Bahan Awal">
              <DataTableView
                size="small"
                pagination={false}
                showRefreshIndicator={false}
                rowKey="key"
                dataSource={detailYieldRows(selectedProfile)}
                mobileCardConfig={yieldMobileCardConfig}
                columns={[
                  { title: 'Material', dataIndex: 'material', key: 'material' },
                  { title: 'Output', dataIndex: 'output', key: 'output', align: 'right', render: (value) => formatNumber(value || 0) },
                  { title: 'Basis', dataIndex: 'base', key: 'base' },
                ]}
              />
            </Card>

            <Card size="small" title="Batch Assembly">
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Plastik Kelopak">{formatNumber(selectedProfile.assemblyPetalPackCount || 0)}</Descriptions.Item>
                <Descriptions.Item label="Plastik Daun">{formatNumber(selectedProfile.assemblyLeafPackCount || 0)}</Descriptions.Item>
                <Descriptions.Item label="Ikat Kawat">{formatNumber(selectedProfile.assemblyStemBundleCount || 0)}</Descriptions.Item>
                <Descriptions.Item label="Kawat Extra">{formatNumber(selectedProfile.assemblyStemExtraQty || 0)} pcs</Descriptions.Item>
              </Descriptions>
            </Card>
          </Space>
        ) : null}
      </MobileDetailDrawer>
);

export default ProductionProfileDetailDrawer;
