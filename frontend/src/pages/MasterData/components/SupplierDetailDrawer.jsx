import {
  Button,
  Card,
  Descriptions,
  Space,
  Tabs,
  Tag,
  Typography,
} from "antd";
import {
  EditOutlined,
  HistoryOutlined,
  LinkOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import EmptyStateBlock from '../../../components/Layout/Feedback/EmptyStateBlock';
import MobileDetailDrawer from '../../../components/Layout/Mobile/MobileDetailDrawer';
import DataTableView from '../../../components/Layout/Table/DataTableView';
import ImsNotice from '../../../components/Layout/Feedback/ImsNotice';
import StatusTag from '../../../components/Layout/Feedback/StatusTag';
import {
  DataRefreshIndicator,
  getDataTableEmptyText,
} from '../../../components/Layout/Feedback/DataLoadingState';
import {
  getSupplierDisplayName,
  getSupplierStoreLink,
} from '../../../services/MasterData/suppliersService';

const { Text } = Typography;

const SupplierDetailDrawer = ({
  selectedSupplier,
  open,
  activeTab,
  onTabChange,
  onClose,
  onEditSupplier,
  catalogColumns,
  supplierHistory,
  historyColumns,
  historyLoading,
}) => {
  if (!selectedSupplier) {
    return (
      <MobileDetailDrawer
        title="Detail Supplier"
        open={open}
        onClose={onClose}
        width={920}
      />
    );
  }

  const activeOffers = (selectedSupplier.catalogOffers || []).filter(
    (offer) => offer.isActive !== false,
  );
  const storeName = getSupplierDisplayName(selectedSupplier);
  const storeLink = getSupplierStoreLink(selectedSupplier);
  const items = [
    {
      key: 'summary',
      label: 'Ringkasan',
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Space wrap>
                <Text strong>{storeName}</Text>
                <StatusTag tone={selectedSupplier.isActive === false ? 'neutral' : 'success'}>
                  {selectedSupplier.isActive === false ? 'Nonaktif' : 'Aktif'}
                </StatusTag>
                <Tag>{activeOffers.length} penawaran</Tag>
              </Space>
              <Space wrap>
                {storeLink ? (
                  <Button
                    type="primary"
                    icon={<LinkOutlined />}
                    href={storeLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Buka Toko
                  </Button>
                ) : null}
                <Button icon={<EditOutlined />} onClick={() => onEditSupplier(selectedSupplier)}>
                  Edit Toko
                </Button>
              </Space>
            </Space>
          </Card>
          <Card size="small" title="Informasi Toko">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Nama Toko">{storeName}</Descriptions.Item>
              <Descriptions.Item label="Kontak">{selectedSupplier.contact || '-'}</Descriptions.Item>
              <Descriptions.Item label="Alamat">{selectedSupplier.address || '-'}</Descriptions.Item>
              <Descriptions.Item label="Catatan">{selectedSupplier.notes || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Space>
      ),
    },
    {
      key: 'catalog',
      label: 'Katalog',
      children: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <div>
              <div className="ims-cell-title">Katalog Barang</div>
              <div className="ims-cell-meta">
                Harga terbaru untuk operasional. Riwayat perubahan berada di tab Histori.
              </div>
            </div>
            <Button icon={<PlusOutlined />} onClick={() => onEditSupplier(selectedSupplier)}>
              Kelola Katalog
            </Button>
          </Space>
          <DataTableView
            className="app-data-table"
            rowKey={(record) => record.id || record.catalogOfferId}
            dataSource={selectedSupplier.catalogOffers || []}
            columns={catalogColumns}
            pagination={{ pageSize: 8, hideOnSinglePage: true }}
            size="small"
            tableLayout="fixed"
            showRefreshIndicator={false}
            locale={{ emptyText: <EmptyStateBlock compact description="Belum ada katalog barang di toko ini" /> }}
          />
        </Space>
      ),
    },
    {
      key: 'history',
      label: (
        <Space size={5}>
          <HistoryOutlined />
          Histori Toko
        </Space>
      ),
      children: (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <ImsNotice
            compact
            variant="info"
            title={`Histori khusus ${storeName}`}
            description="Harga lama, waktu pengecekan, perubahan link, dan verifikasi pembelian hanya ditampilkan di sini agar katalog utama tetap ringkas."
          />
          <DataRefreshIndicator loading={historyLoading} dataSource={supplierHistory} />
          <DataTableView
            className="app-data-table"
            rowKey="id"
            dataSource={supplierHistory}
            columns={historyColumns}
            pagination={{ pageSize: 12, hideOnSinglePage: true }}
            size="small"
            tableLayout="fixed"
            showRefreshIndicator={false}
            locale={{ emptyText: getDataTableEmptyText(historyLoading, 'Belum ada histori untuk toko ini.') }}
          />
        </Space>
      ),
    },
  ];

  return (
    <MobileDetailDrawer
      title={storeName}
      open={open}
      onClose={onClose}
      width={920}
    >
      <Tabs activeKey={activeTab} onChange={onTabChange} items={items} />
    </MobileDetailDrawer>
  );
};

export default SupplierDetailDrawer;
