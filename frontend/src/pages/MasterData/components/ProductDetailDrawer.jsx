import { Card, Col, Descriptions, Row, Space, Statistic, Tag, Typography } from 'antd';
import DataTableView from '../../../components/Layout/Table/DataTableView';
import StatusTag from "../../../components/Layout/Feedback/StatusTag";
import MobileDetailDrawer from '../../../components/Layout/Mobile/MobileDetailDrawer';
import { formatCurrencyId } from '../../../utils/formatters/currencyId';
import { formatDateId } from '../../../utils/formatters/dateId';
import { formatNumberId } from '../../../utils/formatters/numberId';
import {
  formatStockWithUnit,
  getProductStatusMeta,
  getProductStockSummary,
  getRuleModeLabel,
  getVariantDisplayLabel,
} from '../helpers/productsPageHelpers';

const { Text } = Typography;

const ProductDetailDrawer = ({
  open,
  onClose,
  product,
  pricingRuleMap,
  resolveCategoryLabel,
  resolveFlowerTypeLabel,
}) => (
  <MobileDetailDrawer title="Detail Produk" open={open} onClose={onClose} width={900} destroyOnClose>
    {product ? (() => {
      const stockSummary = getProductStockSummary(product);
      const statusMeta = getProductStatusMeta(product);
      const categoryLabel = resolveCategoryLabel(product);
      const flowerTypeLabel = resolveFlowerTypeLabel(product);

      return (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Card size="small">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space size={[8, 8]} wrap>
                <Text strong style={{ fontSize: 18 }}>{product.name || '-'}</Text>
                <StatusTag color={statusMeta.color}>{statusMeta.label}</StatusTag>
                {product.hasVariants ? <Tag color="blue">Pakai Varian</Tag> : <Tag>Tanpa Varian</Tag>}
              </Space>
              <Text type="secondary">{categoryLabel}</Text>
              {flowerTypeLabel ? <Text type="secondary">Jenis bunga: {flowerTypeLabel}</Text> : null}
            </Space>
          </Card>

          <Row gutter={[12, 12]}>
            <Col xs={24} md={8}>
              <Card size="small"><Statistic title="Harga Jual" value={formatCurrencyId(product.price)} formatter={(value) => value} /></Card>
            </Col>
            <Col xs={24} md={8}>
              <Card size="small"><Statistic title="HPP / Unit" value={formatCurrencyId(product.hppPerUnit)} formatter={(value) => value} /></Card>
            </Col>
            <Col xs={24} md={8}>
              <Card size="small"><Statistic title="Stok Tersedia" value={`${formatNumberId(stockSummary.availableStock)} pcs`} formatter={(value) => value} /></Card>
            </Col>
          </Row>

          <Card size="small" title="Ringkasan">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Bentuk Produk">{categoryLabel}</Descriptions.Item>
              <Descriptions.Item label="Jenis Bunga">{flowerTypeLabel || '-'}</Descriptions.Item>
              <Descriptions.Item label="Mode Pricing">{getRuleModeLabel(product.pricingMode, product.pricingRuleId, pricingRuleMap)}</Descriptions.Item>
              <Descriptions.Item label="Pricing Rule">{pricingRuleMap[product.pricingRuleId] || '-'}</Descriptions.Item>
              <Descriptions.Item label="Minimum Stok">{formatStockWithUnit(product.minStockAlert)}</Descriptions.Item>
              <Descriptions.Item label="Update Terakhir">{formatDateId(product.updatedAt, true)}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card size="small" title={product.hasVariants ? 'Varian Produk' : 'Stok Master'}>
            {product.hasVariants ? (
              <DataTableView
                className="ims-table"
                rowKey={(record, index) => `${product.id}-${record.variantKey || record.color || index}`}
                pagination={false}
                size="small"
                showRefreshIndicator={false}
                dataSource={product.variants || []}
                mobileCardConfig={{
                  title: (variant, index) => getVariantDisplayLabel(variant, index),
                  tags: (variant) => (
                    <StatusTag tone={variant.isActive === false ? 'neutral' : 'success'}>
                      {variant.isActive === false ? 'Nonaktif' : 'Aktif'}
                    </StatusTag>
                  ),
                  meta: [
                    { label: 'Stok', value: (variant) => formatStockWithUnit(variant.currentStock || 0) },
                    { label: 'Reserved', value: (variant) => formatStockWithUnit(variant.reservedStock || 0) },
                    {
                      label: 'Tersedia',
                      value: (variant) => formatStockWithUnit(
                        Math.max(Number(variant.currentStock || 0) - Number(variant.reservedStock || 0), 0),
                      ),
                    },
                  ],
                }}
                columns={[
                  {
                    title: product.variantLabel || 'Varian',
                    dataIndex: 'color',
                    render: (_, variant, index) => getVariantDisplayLabel(variant, index),
                  },
                  { title: 'Stok', dataIndex: 'currentStock', render: (value) => formatStockWithUnit(value || 0) },
                  { title: 'Reserved', dataIndex: 'reservedStock', render: (value) => formatStockWithUnit(value || 0) },
                  {
                    title: 'Tersedia',
                    key: 'availableStock',
                    render: (_, variant) => formatStockWithUnit(
                      Math.max(Number(variant.currentStock || 0) - Number(variant.reservedStock || 0), 0),
                    ),
                  },
                  {
                    title: 'Status',
                    dataIndex: 'isActive',
                    render: (value) => <StatusTag tone={value === false ? 'neutral' : 'success'}>{value === false ? 'Nonaktif' : 'Aktif'}</StatusTag>,
                  },
                ]}
              />
            ) : (
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Stok Total">{formatStockWithUnit(stockSummary.currentStock)}</Descriptions.Item>
                <Descriptions.Item label="Reserved Stock">{formatStockWithUnit(stockSummary.reservedStock)}</Descriptions.Item>
                <Descriptions.Item label="Stok Tersedia">{formatStockWithUnit(stockSummary.availableStock)}</Descriptions.Item>
                <Descriptions.Item label="Minimum Stok">{formatStockWithUnit(product.minStockAlert)}</Descriptions.Item>
              </Descriptions>
            )}
          </Card>

          {product.description ? (
            <Card size="small" title="Catatan"><Text>{product.description}</Text></Card>
          ) : null}
        </Space>
      );
    })() : null}
  </MobileDetailDrawer>
);

export default ProductDetailDrawer;
