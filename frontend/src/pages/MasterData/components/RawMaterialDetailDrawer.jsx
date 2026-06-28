import { Button, Card, Col, Descriptions, Row, Space, Tag, Typography } from 'antd';
import DataTableView from '../../../components/Layout/Table/DataTableView';
import MobileDetailDrawer from '../../../components/Layout/Mobile/MobileDetailDrawer';
import { formatCurrencyId } from '../../../utils/formatters/currencyId';
import { formatDateId } from '../../../utils/formatters/dateId';
import {
  formatStockWithUnit,
  getRawMaterialMinimumStockDisplay,
  getRawMaterialStatusMeta,
  getRawMaterialStockSummary,
  getRuleModeLabel,
  getVariantMinimumStock,
} from '../helpers/rawMaterialsPageHelpers';

const { Text } = Typography;

const RawMaterialDetailDrawer = ({
  open,
  onClose,
  material,
  suppliers,
  latestPurchase,
  latestPurchaseLink,
  restockSupplier,
  pricingRuleMap,
  resolveCategoryLabel,
  getSupplierCatalogSummary,
  buildSupplierRoute,
  navigate,
}) => (
  <MobileDetailDrawer title="Detail Bahan Baku" open={open} onClose={onClose} width={900} destroyOnClose>
    {material ? (() => {
      const stockSummary = getRawMaterialStockSummary(material);
      const statusMeta = getRawMaterialStatusMeta(material);
      const categoryLabel = resolveCategoryLabel(material);
      const restockSummary = getSupplierCatalogSummary(suppliers, material.id);

      return (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Card size="small">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space size={[8, 8]} wrap>
                <Text strong style={{ fontSize: 18 }}>{material.name || '-'}</Text>
                <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                <Tag color={material.hasVariants ? 'blue' : 'default'}>{material.hasVariants ? 'Pakai Varian' : 'Tanpa Varian'}</Tag>
              </Space>
              <Text type="secondary">{categoryLabel}</Text>
              <Text type="secondary">Satuan stok: {material.stockUnit || '-'}</Text>
            </Space>
          </Card>

          <Row gutter={[12, 12]}>
            <Col xs={24} md={8}><Card size="small"><Text type="secondary">Stok Tersedia</Text><div style={{ fontWeight: 700, fontSize: 20 }}>{formatStockWithUnit(stockSummary.availableStock, material.stockUnit || 'pcs')}</div></Card></Col>
            <Col xs={24} md={8}><Card size="small"><Text type="secondary">Modal Aktual Rata-rata</Text><div style={{ fontWeight: 700, fontSize: 20 }}>{material.averageActualUnitCost ? formatCurrencyId(material.averageActualUnitCost) : '-'}</div></Card></Col>
            <Col xs={24} md={8}><Card size="small"><Text type="secondary">Harga Referensi</Text><div style={{ fontWeight: 700, fontSize: 20 }}>{formatCurrencyId(material.restockReferencePrice || 0)}</div></Card></Col>
          </Row>

          <Card size="small" title="Ringkasan">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Kelompok Bahan">{categoryLabel}</Descriptions.Item>
              <Descriptions.Item label={material.hasVariants ? 'Minimum Stok Total Varian' : 'Minimum Stok'}>{formatStockWithUnit(getRawMaterialMinimumStockDisplay(material), material.stockUnit || 'pcs')}</Descriptions.Item>
              <Descriptions.Item label="Sumber Restock">
                <Space size={8} wrap>
                  <Text strong>{restockSummary.label}</Text>
                  <Button size="small" onClick={() => navigate(buildSupplierRoute(material.id))}>
                    {restockSummary.offerCount > 0 ? 'Bandingkan Supplier' : 'Atur Sumber Restock'}
                  </Button>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Supplier Pembelian Terakhir">{latestPurchase ? restockSupplier.name : '-'}</Descriptions.Item>
              <Descriptions.Item label="Harga Jual">{`${formatCurrencyId(material.sellingPrice || 0)} / ${material.stockUnit || '-'}`}</Descriptions.Item>
              <Descriptions.Item label="Mode Pricing">{getRuleModeLabel(material.pricingMode, material.pricingRuleId, pricingRuleMap)}</Descriptions.Item>
              {material.specifications ? <Descriptions.Item label="Spesifikasi">{material.specifications}</Descriptions.Item> : null}
              {material.notes ? <Descriptions.Item label="Catatan Internal">{material.notes}</Descriptions.Item> : null}
              <Descriptions.Item label="Update Terakhir">{formatDateId(material.updatedAt, true)}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card size="small" title="Link Restock Terakhir">
            <Space direction="vertical" size={6}>
              {latestPurchase ? <Text type="secondary">{`Pembelian terakhir: ${formatDateId(latestPurchase.date || latestPurchase.purchaseDate || latestPurchase.createdAt, true)}`}</Text> : null}
              {latestPurchaseLink ? <Button size="small" type="primary" href={latestPurchaseLink} target="_blank" rel="noreferrer">Buka Link Produk</Button> : <Text type="secondary">Belum ada link produk dari pembelian terakhir.</Text>}
            </Space>
          </Card>

          <Card size="small" title={material.hasVariants ? 'Varian Bahan Baku' : 'Stok Master'}>
            {material.hasVariants ? (
              <DataTableView
                rowKey={(variant, index) => `${material.id}-${variant.variantKey || variant.name}-${index}`}
                pagination={false}
                size="small"
                showRefreshIndicator={false}
                dataSource={material.variants || []}
                mobileCardConfig={{
                  title: (variant) => variant.name || variant.variantLabel || variant.variantKey || 'Varian',
                  tags: (variant) => <Tag color={variant.isActive === false ? 'default' : 'green'}>{variant.isActive === false ? 'Nonaktif' : 'Aktif'}</Tag>,
                  meta: [
                    { label: 'Stok', value: (variant) => formatStockWithUnit(variant.currentStock || 0, material.stockUnit || 'pcs') },
                    { label: 'Reserved', value: (variant) => formatStockWithUnit(variant.reservedStock || 0, material.stockUnit || 'pcs') },
                    { label: 'Minimum', value: (variant) => formatStockWithUnit(getVariantMinimumStock(variant, 0), material.stockUnit || 'pcs') },
                    { label: 'Tersedia', value: (variant) => formatStockWithUnit(Math.max(Number(variant.currentStock || 0) - Number(variant.reservedStock || 0), 0), material.stockUnit || 'pcs') },
                  ],
                }}
                columns={[
                  { title: material.variantLabel || 'Varian', dataIndex: 'name', key: 'name', render: (value) => value || '-' },
                  { title: 'Stok', dataIndex: 'currentStock', key: 'currentStock', render: (value) => formatStockWithUnit(value || 0, material.stockUnit || 'pcs') },
                  { title: 'Reserved', dataIndex: 'reservedStock', key: 'reservedStock', render: (value) => formatStockWithUnit(value || 0, material.stockUnit || 'pcs') },
                  { title: 'Minimum', key: 'minStockAlert', render: (_, variant) => formatStockWithUnit(getVariantMinimumStock(variant, 0), material.stockUnit || 'pcs') },
                  { title: 'Tersedia', key: 'availableStock', render: (_, variant) => formatStockWithUnit(Math.max(Number(variant.currentStock || 0) - Number(variant.reservedStock || 0), 0), material.stockUnit || 'pcs') },
                  { title: 'Status', dataIndex: 'isActive', key: 'isActive', render: (value) => <Tag color={value === false ? 'default' : 'green'}>{value === false ? 'Nonaktif' : 'Aktif'}</Tag> },
                ]}
              />
            ) : (
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Stok Total">{formatStockWithUnit(stockSummary.currentStock, material.stockUnit || 'pcs')}</Descriptions.Item>
                <Descriptions.Item label="Reserved Stock">{formatStockWithUnit(stockSummary.reservedStock, material.stockUnit || 'pcs')}</Descriptions.Item>
                <Descriptions.Item label="Stok Tersedia">{formatStockWithUnit(stockSummary.availableStock, material.stockUnit || 'pcs')}</Descriptions.Item>
                <Descriptions.Item label="Minimum Stok">{formatStockWithUnit(getRawMaterialMinimumStockDisplay(material), material.stockUnit || 'pcs')}</Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Space>
      );
    })() : null}
  </MobileDetailDrawer>
);

export default RawMaterialDetailDrawer;
