import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  HistoryOutlined,
  LinkOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  createSupplier,
  deleteSupplier,
  listSupplierHistory,
  listSuppliers,
  updateSupplier,
  verifySupplierCatalogOffer,
} from '../../data/repositories/suppliersRepository';
import { formatNumberId, parseIntegerIdInput } from '../../utils/formatters/numberId';
import { formatCurrencyIDR } from '../../utils/formatters/currencyId';
import FilterBar from '../../components/Layout/Filters/FilterBar';
import PageHeader from '../../components/Layout/Page/PageHeader';
import PageSection from '../../components/Layout/Page/PageSection';
import DataTableView from '../../components/Layout/Table/DataTableView';
import MobileDetailDrawer from '../../components/Layout/Mobile/MobileDetailDrawer';
import ResponsiveFormSection from '../../components/Layout/Mobile/ResponsiveFormSection';
import RupiahInputNumber from '../../components/Layout/Forms/RupiahInputNumber';
import ImsNotice from '../../components/Layout/Feedback/ImsNotice';
import { DataRefreshIndicator, getDataTableEmptyText } from '../../components/Layout/Feedback/DataLoadingState';
import { listenProducts } from '../../services/MasterData/productsService';
import { listenRawMaterials } from '../../services/MasterData/rawMaterialsService';
import {
  calculateSupplierMaterialRestockMetrics,
  doesSupplierProvideItem,
  getSupplierDisplayName,
  getSupplierStoreLink,
  isManagedSupplierRecord,
} from '../../services/MasterData/suppliersService';
import { PURCHASE_UNIT_OPTIONS, getMaterialStockUnit } from './helpers/supplierPurchasesPageHelpers';
import { resolveVariantSourceList } from '../../utils/variants/variantStockNormalizer';

const { Option } = Select;
const { Search } = Input;
const { Text } = Typography;

const CATALOG_ITEM_TYPE_OPTIONS = [
  { value: 'raw_material', label: 'Bahan Baku' },
  { value: 'product', label: 'Produk' },
];

const HISTORY_EVENT_LABELS = {
  offer_created: 'Penawaran ditambahkan',
  offer_updated: 'Detail penawaran diperbarui',
  offer_disabled: 'Penawaran dinonaktifkan',
  offer_enabled: 'Penawaran diaktifkan',
  link_changed: 'Link diperbarui',
  price_checked: 'Harga diperiksa',
  price_changed: 'Harga berubah',
  purchase_price_checked: 'Harga diverifikasi saat pembelian',
  purchase_price_changed: 'Harga diperbarui saat pembelian',
  stock_unavailable: 'Barang tidak tersedia',
  link_unavailable: 'Link tidak tersedia',
};

const PRICE_RESULT_LABELS = {
  price_same: 'Harga masih sama',
  price_up: 'Harga naik',
  price_down: 'Harga turun',
  stock_unavailable: 'Barang habis',
  link_unavailable: 'Link bermasalah',
  active: 'Aktif',
};

const formatHistoryDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getOfferStatusMeta = (offer = {}) => {
  if (offer.status === 'inactive' || offer.isActive === false) {
    return { label: 'Nonaktif', color: 'default' };
  }
  if (offer.availabilityStatus === 'stock_unavailable') {
    return { label: 'Barang habis', color: 'warning' };
  }
  if (offer.availabilityStatus === 'link_unavailable') {
    return { label: 'Link bermasalah', color: 'error' };
  }
  if (!offer.productLink && offer.purchaseType !== 'offline') {
    return { label: 'Link belum ada', color: 'warning' };
  }
  if (!offer.lastCheckedAt) {
    return { label: 'Perlu dicek', color: 'gold' };
  }
  return { label: 'Aktif', color: 'green' };
};

const SupplierPurchases = () => {
  const [form] = Form.useForm();
  const [priceCheckForm] = Form.useForm();
  const location = useLocation();
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchText, setSearchText] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerTab, setDrawerTab] = useState('summary');
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierHistory, setSupplierHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadedSupplierId, setHistoryLoadedSupplierId] = useState(null);

  const [priceCheckVisible, setPriceCheckVisible] = useState(false);
  const [priceCheckOffer, setPriceCheckOffer] = useState(null);
  const [priceCheckSaving, setPriceCheckSaving] = useState(false);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const materialIdFromQuery = searchParams.get('materialId');
  const supplierIdFromQuery = searchParams.get('supplierId');

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      const nextSuppliers = await listSuppliers();
      setSuppliers(nextSuppliers);
      setLoadError('');
      setSelectedSupplier((current) => {
        if (!current) return current;
        return nextSuppliers.find((item) => String(item.id) === String(current.id)) || current;
      });
    } catch (error) {
      console.error(error);
      setSuppliers([]);
      setLoadError('Gagal memuat supplier. Pastikan layanan aplikasi aktif.');
      message.error(error?.message || 'Gagal memuat supplier.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
    const unsubscribeProducts = listenProducts(setProducts, (error) => {
      console.error(error);
      message.warning('Referensi Produk belum bisa dimuat.');
    });
    const unsubscribeMaterials = listenRawMaterials(setMaterials, (error) => {
      console.error(error);
      message.warning('Referensi Bahan Baku belum bisa dimuat.');
    });
    return () => {
      unsubscribeProducts();
      unsubscribeMaterials();
    };
  }, [fetchSuppliers]);

  useEffect(() => {
    if (!supplierIdFromQuery || !suppliers.length || drawerVisible) return;
    const supplier = suppliers.find((item) => String(item.id) === String(supplierIdFromQuery));
    if (supplier) {
      setSelectedSupplier(supplier);
      setDrawerVisible(true);
      setDrawerTab('catalog');
    }
  }, [drawerVisible, supplierIdFromQuery, suppliers]);

  const filteredSuppliers = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return suppliers
      .filter((supplier) => !materialIdFromQuery || doesSupplierProvideItem(supplier, 'raw_material', materialIdFromQuery))
      .filter((supplier) => {
        if (!keyword) return true;
        return [
          getSupplierDisplayName(supplier),
          getSupplierStoreLink(supplier),
          supplier.contact,
          supplier.address,
          supplier.notes,
          ...(supplier.catalogOffers || []).flatMap((offer) => [
            offer.itemName,
            offer.listingName,
            offer.channel,
            offer.productLink,
            offer.note,
          ]),
        ].filter(Boolean).join(' ').toLowerCase().includes(keyword);
      })
      .sort((left, right) => getSupplierDisplayName(left).localeCompare(getSupplierDisplayName(right), 'id-ID'));
  }, [materialIdFromQuery, searchText, suppliers]);

  const getItemCollection = (itemType) => itemType === 'product' ? products : materials;
  const getItemById = (itemType, itemId) => getItemCollection(itemType)
    .find((item) => String(item.id) === String(itemId)) || null;
  const getItemStockUnit = (itemType, item = {}) => itemType === 'product'
    ? (item.stockUnit || item.unit || 'pcs')
    : getMaterialStockUnit(item);
  const getVariantOptions = (item = {}) => resolveVariantSourceList(item)
    .filter((variant) => variant.isActive !== false)
    .map((variant) => ({
      value: variant.variantKey || variant.id || variant.key,
      label: variant.variantName || variant.name || variant.label,
    }))
    .filter((variant) => variant.value && variant.label);

  const updateCatalogOfferAtIndex = (index, nextValues = {}) => {
    const currentOffers = form.getFieldValue('catalogOffers') || [];
    const nextOffers = [...currentOffers];
    nextOffers[index] = { ...(nextOffers[index] || {}), ...nextValues };
    form.setFieldsValue({ catalogOffers: nextOffers });
  };

  const openCreateSupplier = () => {
    setIsEditing(false);
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      storeName: '',
      storeLink: '',
      contact: '',
      address: '',
      notes: '',
      catalogOffers: [],
    });
    setModalVisible(true);
  };

  const openEditSupplier = (record) => {
    if (!isManagedSupplierRecord(record)) return;
    setIsEditing(true);
    setEditingId(record.id);
    form.resetFields();
    form.setFieldsValue({
      storeName: record.storeName || record.name || '',
      storeLink: record.storeLink || '',
      contact: record.contact || record.phone || '',
      address: record.address || '',
      notes: record.notes || record.note || '',
      catalogOffers: (record.catalogOffers || []).map((offer) => ({
        ...offer,
        id: offer.id || offer.catalogOfferId,
        isActive: offer.isActive !== false && offer.status !== 'inactive',
        purchaseQty: Number(offer.purchaseQty || 1),
        conversionValue: Number(offer.conversionValue || 1),
        supplierItemPrice: Number(offer.supplierItemPrice || 0),
      })),
    });
    setModalVisible(true);
  };

  const closeSupplierModal = () => {
    if (saving) return;
    setModalVisible(false);
    setIsEditing(false);
    setEditingId(null);
    form.resetFields();
  };

  const buildSupplierPayload = (values = {}) => ({
    storeName: values.storeName,
    name: values.storeName,
    storeLink: values.storeLink || '',
    contact: values.contact || '',
    address: values.address || '',
    notes: values.notes || '',
    catalogOffers: (values.catalogOffers || []).map((offer) => {
      const itemType = offer.itemType === 'product' ? 'product' : 'raw_material';
      const selectedItem = getItemById(itemType, offer.itemId);
      const variants = getVariantOptions(selectedItem || {});
      const selectedVariant = variants.find((variant) => String(variant.value) === String(offer.variantKey || ''));
      return {
        ...offer,
        itemType,
        itemId: offer.itemId,
        itemName: selectedItem?.name || offer.itemName || '',
        variantKey: offer.variantKey || '',
        variantLabel: selectedVariant?.label || offer.variantLabel || '',
        stockUnit: getItemStockUnit(itemType, selectedItem || {}) || offer.stockUnit || '',
        purchaseType: offer.purchaseType === 'offline' ? 'offline' : 'online',
        purchaseQty: Math.max(1, Number(offer.purchaseQty || 1)),
        conversionValue: itemType === 'product' ? 1 : Math.max(1, Number(offer.conversionValue || 1)),
        supplierItemPrice: Math.max(0, Number(offer.supplierItemPrice || 0)),
        isActive: offer.isActive !== false,
        status: offer.isActive === false ? 'inactive' : 'active',
      };
    }),
  });

  const handleSaveSupplier = async (values) => {
    try {
      setSaving(true);
      const payload = buildSupplierPayload(values);
      if (isEditing && editingId) {
        await updateSupplier(editingId, payload);
        message.success('Supplier berhasil diperbarui.');
      } else {
        await createSupplier(payload);
        message.success('Supplier berhasil ditambahkan.');
      }
      setModalVisible(false);
      setIsEditing(false);
      setEditingId(null);
      form.resetFields();
      await fetchSuppliers();
    } catch (error) {
      console.error(error);
      message.error(error?.message || 'Gagal menyimpan supplier.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSupplier = async (record) => {
    try {
      await deleteSupplier(record.id);
      message.success('Supplier berhasil dinonaktifkan.');
      if (String(selectedSupplier?.id) === String(record.id)) {
        setDrawerVisible(false);
        setSelectedSupplier(null);
      }
      await fetchSuppliers();
    } catch (error) {
      console.error(error);
      message.error(error?.message || 'Gagal menonaktifkan supplier.');
    }
  };

  const loadSupplierHistory = useCallback(async (supplierId, { force = false } = {}) => {
    if (!supplierId || (!force && String(historyLoadedSupplierId) === String(supplierId))) return;
    setHistoryLoading(true);
    try {
      const rows = await listSupplierHistory(supplierId, { limit: 150 });
      setSupplierHistory(rows);
      setHistoryLoadedSupplierId(supplierId);
    } catch (error) {
      console.error(error);
      setSupplierHistory([]);
      message.error(error?.message || 'Gagal memuat histori toko.');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyLoadedSupplierId]);

  const openSupplierDrawer = (record, initialTab = 'summary') => {
    setSelectedSupplier(record);
    setDrawerTab(initialTab);
    setDrawerVisible(true);
    setSupplierHistory([]);
    setHistoryLoadedSupplierId(null);
    if (initialTab === 'history') loadSupplierHistory(record.id, { force: true });
  };

  const handleDrawerTabChange = (key) => {
    setDrawerTab(key);
    if (key === 'history' && selectedSupplier?.id) {
      loadSupplierHistory(selectedSupplier.id);
    }
  };

  const openPriceCheck = (offer) => {
    setPriceCheckOffer(offer);
    priceCheckForm.resetFields();
    priceCheckForm.setFieldsValue({
      resultStatus: 'verified',
      actualPrice: Number(offer.supplierItemPrice || 0),
      note: '',
    });
    setPriceCheckVisible(true);
  };

  const handlePriceCheck = async (values) => {
    if (!selectedSupplier?.id || !priceCheckOffer?.id) return;
    try {
      setPriceCheckSaving(true);
      await verifySupplierCatalogOffer(selectedSupplier.id, priceCheckOffer.id, values);
      message.success('Pengecekan harga berhasil disimpan ke Histori Toko.');
      setPriceCheckVisible(false);
      setPriceCheckOffer(null);
      await fetchSuppliers();
      await loadSupplierHistory(selectedSupplier.id, { force: true });
    } catch (error) {
      console.error(error);
      message.error(error?.message || 'Gagal menyimpan pengecekan harga.');
    } finally {
      setPriceCheckSaving(false);
    }
  };

  const handleUseOfferForPurchase = (offer) => {
    const type = offer.itemType === 'product' ? 'product' : 'material';
    const params = new URLSearchParams({
      type,
      itemId: String(offer.itemId),
      supplierId: String(selectedSupplier.id),
      offerId: String(offer.id || offer.catalogOfferId),
    });
    navigate(`/purchases?${params.toString()}`);
  };

  const columns = [
    {
      title: 'Supplier / Toko',
      key: 'supplier',
      width: '30%',
      render: (_, record) => (
        <Space direction="vertical" size={3}>
          <span className="ims-cell-title">{getSupplierDisplayName(record)}</span>
          <span className="ims-cell-meta">{record.contact || record.address || 'Kontak belum dilengkapi'}</span>
        </Space>
      ),
    },
    {
      title: 'Katalog',
      key: 'catalog',
      width: '24%',
      render: (_, record) => {
        const activeOffers = (record.catalogOffers || []).filter((offer) => offer.isActive !== false && offer.status !== 'inactive');
        const itemNames = [...new Set(activeOffers.map((offer) => offer.itemName).filter(Boolean))];
        return (
          <Space direction="vertical" size={4}>
            <span>{activeOffers.length} penawaran · {itemNames.length} barang</span>
            <Space size={[4, 4]} wrap>
              {itemNames.slice(0, 2).map((name) => <Tag key={name}>{name}</Tag>)}
              {itemNames.length > 2 ? <Tag>+{itemNames.length - 2}</Tag> : null}
            </Space>
          </Space>
        );
      },
    },
    {
      title: 'Toko',
      key: 'storeLink',
      width: '18%',
      render: (_, record) => getSupplierStoreLink(record) ? (
        <Button
          type="link"
          size="small"
          icon={<LinkOutlined />}
          href={getSupplierStoreLink(record)}
          target="_blank"
          rel="noreferrer"
        >
          Buka Toko
        </Button>
      ) : <span className="ims-cell-meta">Belum ada link</span>,
    },
    {
      title: 'Status',
      key: 'status',
      width: '12%',
      render: (_, record) => <Tag color={record.isActive === false ? 'default' : 'green'}>{record.isActive === false ? 'Nonaktif' : 'Aktif'}</Tag>,
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: '16%',
      className: 'app-table-action-column',
      render: (_, record) => (
        <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
          <Button className="ims-action-button ims-action-button--block" size="small" icon={<EyeOutlined />} onClick={() => openSupplierDrawer(record)}>
            Detail
          </Button>
          <Button className="ims-action-button ims-action-button--block" size="small" icon={<EditOutlined />} onClick={() => openEditSupplier(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Nonaktifkan supplier ini?"
            description="Katalog dan histori lama tetap tersimpan."
            onConfirm={() => handleDeleteSupplier(record)}
            okText="Nonaktifkan"
            cancelText="Batal"
          >
            <Button className="ims-action-button ims-action-button--block" danger size="small" icon={<DeleteOutlined />}>
              Nonaktifkan
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const catalogColumns = [
    {
      title: 'Barang',
      key: 'item',
      width: '30%',
      render: (_, offer) => (
        <Space direction="vertical" size={2}>
          <span className="ims-cell-title">{offer.itemName || '-'}</span>
          <span className="ims-cell-meta">{offer.listingName || offer.variantLabel || (offer.itemType === 'product' ? 'Produk' : 'Bahan Baku')}</span>
          <Space size={[4, 4]} wrap>
            <Tag>{offer.channel || (offer.purchaseType === 'offline' ? 'Offline' : 'Online')}</Tag>
            {offer.isPrimary ? <Tag color="blue">Pilihan Utama</Tag> : null}
          </Space>
        </Space>
      ),
    },
    {
      title: 'Paket / Konversi',
      key: 'conversion',
      width: '22%',
      render: (_, offer) => (
        <Space direction="vertical" size={2}>
          <span>{formatNumberId(offer.purchaseQty || 1)} {offer.purchaseUnit || 'satuan beli'}</span>
          <span className="ims-cell-meta">= {formatNumberId(offer.conversionValue || 1)} {offer.stockUnit || 'satuan stok'} per pembelian</span>
        </Space>
      ),
    },
    {
      title: 'Harga Saat Ini',
      key: 'price',
      width: '20%',
      render: (_, offer) => {
        const metrics = calculateSupplierMaterialRestockMetrics(offer);
        return (
          <Space direction="vertical" size={2}>
            <span className="ims-cell-title">{formatCurrencyIDR(offer.supplierItemPrice || 0)}</span>
            <span className="ims-cell-meta">{formatCurrencyIDR(metrics.estimatedUnitPrice || 0)} / {offer.stockUnit || 'unit'}</span>
          </Space>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      width: '12%',
      render: (_, offer) => {
        const status = getOfferStatusMeta(offer);
        return <Tag color={status.color}>{status.label}</Tag>;
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: '16%',
      render: (_, offer) => (
        <Space direction="vertical" size={5}>
          {offer.productLink ? (
            <Button size="small" type="link" icon={<LinkOutlined />} href={offer.productLink} target="_blank" rel="noreferrer">
              Buka Link
            </Button>
          ) : null}
          <Button size="small" icon={<SafetyCertificateOutlined />} onClick={() => openPriceCheck(offer)} disabled={offer.status === 'inactive'}>
            Cek Harga
          </Button>
          <Button size="small" type="primary" icon={<ShoppingCartOutlined />} onClick={() => handleUseOfferForPurchase(offer)} disabled={offer.status === 'inactive' || offer.availabilityStatus !== 'available'}>
            Beli
          </Button>
        </Space>
      ),
    },
  ];

  const historyColumns = [
    {
      title: 'Waktu',
      dataIndex: 'createdAt',
      width: '18%',
      render: formatHistoryDate,
    },
    {
      title: 'Barang',
      dataIndex: 'itemName',
      width: '22%',
      render: (value) => value || '-',
    },
    {
      title: 'Aktivitas',
      key: 'event',
      width: '22%',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <span>{HISTORY_EVENT_LABELS[record.eventType] || record.eventType}</span>
          {record.resultStatus ? <Tag>{PRICE_RESULT_LABELS[record.resultStatus] || record.resultStatus}</Tag> : null}
        </Space>
      ),
    },
    {
      title: 'Detail',
      key: 'detail',
      width: '25%',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <span>{record.description || '-'}</span>
          {record.previousPrice !== null && record.previousPrice !== undefined && record.newPrice !== null && record.newPrice !== undefined ? (
            <span className="ims-cell-meta">
              {formatCurrencyIDR(record.previousPrice)} → {formatCurrencyIDR(record.newPrice)}
            </span>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Oleh',
      dataIndex: 'actor',
      width: '13%',
      render: (value) => value || '-',
    },
  ];

  const mobileCardConfig = {
    title: (record) => getSupplierDisplayName(record),
    subtitle: (record) => record.contact || record.address || null,
    tags: (record) => <Tag color={record.isActive === false ? 'default' : 'green'}>{record.isActive === false ? 'Nonaktif' : 'Aktif'}</Tag>,
    meta: [
      { label: 'Penawaran', value: (record) => `${(record.catalogOffers || []).filter((offer) => offer.isActive !== false).length} katalog` },
      { label: 'Toko', value: (record) => getSupplierStoreLink(record) ? 'Link tersedia' : 'Belum ada link' },
    ],
    content: (record) => {
      const names = [...new Set((record.catalogOffers || []).filter((offer) => offer.isActive !== false).map((offer) => offer.itemName).filter(Boolean))];
      return names.length ? names.slice(0, 3).join(', ') : 'Belum ada katalog barang';
    },
    actions: (record) => (
      <Space direction="vertical" size={6}>
        <Button block size="small" onClick={() => openSupplierDrawer(record)}>Detail</Button>
        <Button block size="small" onClick={() => openEditSupplier(record)}>Edit</Button>
      </Space>
    ),
  };

  const drawerTabs = selectedSupplier ? [
    {
      key: 'summary',
      label: 'Ringkasan',
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small">
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Space wrap>
                <Text strong>{getSupplierDisplayName(selectedSupplier)}</Text>
                <Tag color={selectedSupplier.isActive === false ? 'default' : 'green'}>
                  {selectedSupplier.isActive === false ? 'Nonaktif' : 'Aktif'}
                </Tag>
                <Tag>{(selectedSupplier.catalogOffers || []).filter((offer) => offer.isActive !== false).length} penawaran</Tag>
              </Space>
              <Space wrap>
                {getSupplierStoreLink(selectedSupplier) ? (
                  <Button type="primary" icon={<LinkOutlined />} href={getSupplierStoreLink(selectedSupplier)} target="_blank" rel="noreferrer">
                    Buka Toko
                  </Button>
                ) : null}
                <Button icon={<EditOutlined />} onClick={() => openEditSupplier(selectedSupplier)}>Edit Toko</Button>
              </Space>
            </Space>
          </Card>
          <Card size="small" title="Informasi Toko">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Nama Toko">{getSupplierDisplayName(selectedSupplier)}</Descriptions.Item>
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
              <div className="ims-cell-meta">Harga terbaru untuk operasional. Riwayat perubahan berada di tab Histori.</div>
            </div>
            <Button icon={<PlusOutlined />} onClick={() => openEditSupplier(selectedSupplier)}>Kelola Katalog</Button>
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
            locale={{ emptyText: <Empty description="Belum ada katalog barang di toko ini" /> }}
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
            title={`Histori khusus ${getSupplierDisplayName(selectedSupplier)}`}
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
  ] : [];

  return (
    <div className="page-container">
      <PageHeader
        title="Supplier"
        subtitle="Kelola toko dan katalog restock. Kode serta ID dibuat otomatis dan tidak ditampilkan."
        extra={materialIdFromQuery ? (
          <Button type="link" size="small" onClick={() => navigate('/suppliers')}>Reset Filter Barang</Button>
        ) : null}
        actions={[{
          key: 'create-supplier',
          type: 'primary',
          icon: <PlusOutlined />,
          label: 'Tambah Supplier',
          onClick: openCreateSupplier,
        }]}
      />

      <FilterBar>
        <Col xs={24} md={18}>
          <Search
            placeholder="Cari nama toko, barang, marketplace, link, atau catatan"
            allowClear
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </Col>
        <Col xs={24} md={6}>
          <Button block onClick={() => setSearchText('')}>Reset Pencarian</Button>
        </Col>
      </FilterBar>

      <PageSection title="Daftar Supplier" subtitle="Pilih satu toko untuk melihat katalog dan historinya.">
        <DataRefreshIndicator loading={isLoading} dataSource={filteredSuppliers} />
        <DataTableView
          showRefreshIndicator={false}
          className="app-data-table"
          columns={columns}
          dataSource={filteredSuppliers}
          rowKey="id"
          tableLayout="fixed"
          locale={{ emptyText: getDataTableEmptyText(isLoading, loadError || 'Belum ada data supplier.') }}
          mobileCardConfig={mobileCardConfig}
        />
      </PageSection>

      <Modal
        title={isEditing ? 'Edit Supplier dan Katalog' : 'Tambah Supplier dan Katalog'}
        open={modalVisible}
        onCancel={closeSupplierModal}
        onOk={() => form.submit()}
        okText="Simpan"
        cancelText="Batal"
        confirmLoading={saving}
        width={1040}
      >
        <Form form={form} layout="vertical" onFinish={handleSaveSupplier}>
          <ResponsiveFormSection
            title="Informasi Supplier"
            subtitle="Kode dan ID dibuat otomatis di backend. UI hanya menampilkan informasi yang digunakan pengguna."
          >
            <Row gutter={[12, 0]}>
              <Col xs={24} md={12}>
                <Form.Item name="storeName" label="Nama Supplier / Toko" rules={[{ required: true, message: 'Nama supplier wajib diisi' }]}>
                  <Input placeholder="Nama toko atau supplier" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="storeLink"
                  label="Link Toko"
                  rules={[{
                    validator: (_, value) => !value || /^https?:\/\//i.test(value)
                      ? Promise.resolve()
                      : Promise.reject(new Error('Gunakan link http:// atau https://')),
                  }]}
                >
                  <Input placeholder="https://link-toko" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="contact" label="Kontak"><Input placeholder="Nomor telepon atau kontak" /></Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="address" label="Alamat"><Input placeholder="Alamat toko atau supplier" /></Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item name="notes" label="Catatan"><Input.TextArea rows={2} placeholder="Catatan umum supplier" /></Form.Item>
              </Col>
            </Row>
          </ResponsiveFormSection>

          <ResponsiveFormSection
            title="Katalog Barang"
            subtitle="Satu toko dapat menyimpan banyak barang dan beberapa link berbeda untuk barang yang sama."
          >
            <Form.List name="catalogOffers">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }, index) => (
                    <Card
                      key={key}
                      size="small"
                      style={{ marginBottom: 12 }}
                      title={`Penawaran ${index + 1}`}
                      extra={<Button danger type="text" onClick={() => remove(name)}>Hapus</Button>}
                    >
                      <Form.Item {...restField} name={[name, 'id']} hidden><Input /></Form.Item>
                      <Row gutter={[12, 0]}>
                        <Col xs={24} md={8}>
                          <Form.Item {...restField} name={[name, 'itemType']} label="Jenis Barang" rules={[{ required: true, message: 'Pilih jenis barang' }]}>
                            <Select
                              placeholder="Pilih jenis"
                              onChange={(itemType) => updateCatalogOfferAtIndex(name, {
                                itemType,
                                itemId: undefined,
                                itemName: '',
                                variantKey: undefined,
                                variantLabel: '',
                                stockUnit: '',
                                conversionValue: 1,
                              })}
                            >
                              {CATALOG_ITEM_TYPE_OPTIONS.map((option) => <Option key={option.value} value={option.value}>{option.label}</Option>)}
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item shouldUpdate noStyle>
                            {({ getFieldValue }) => {
                              const offer = getFieldValue(['catalogOffers', name]) || {};
                              const itemOptions = getItemCollection(offer.itemType);
                              return (
                                <Form.Item {...restField} name={[name, 'itemId']} label="Nama Barang" rules={[{ required: true, message: 'Pilih barang' }]}>
                                  <Select
                                    placeholder="Pilih barang"
                                    showSearch
                                    optionFilterProp="children"
                                    onChange={(itemId) => {
                                      const selectedItem = getItemById(offer.itemType, itemId);
                                      updateCatalogOfferAtIndex(name, {
                                        itemId,
                                        itemName: selectedItem?.name || '',
                                        stockUnit: getItemStockUnit(offer.itemType, selectedItem || {}),
                                        conversionValue: offer.itemType === 'product' ? 1 : (offer.conversionValue || 1),
                                        variantKey: undefined,
                                        variantLabel: '',
                                      });
                                    }}
                                  >
                                    {itemOptions.map((item) => <Option key={item.id} value={item.id}>{item.name}</Option>)}
                                  </Select>
                                </Form.Item>
                              );
                            }}
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item shouldUpdate noStyle>
                            {({ getFieldValue }) => {
                              const offer = getFieldValue(['catalogOffers', name]) || {};
                              const selectedItem = getItemById(offer.itemType, offer.itemId);
                              const variantOptions = getVariantOptions(selectedItem || {});
                              if (!variantOptions.length) return null;
                              return (
                                <Form.Item {...restField} name={[name, 'variantKey']} label="Varian">
                                  <Select
                                    allowClear
                                    placeholder="Semua varian / pilih varian"
                                    onChange={(variantKey) => {
                                      const variant = variantOptions.find((item) => String(item.value) === String(variantKey || ''));
                                      updateCatalogOfferAtIndex(name, { variantKey, variantLabel: variant?.label || '' });
                                    }}
                                  >
                                    {variantOptions.map((variant) => <Option key={variant.value} value={variant.value}>{variant.label}</Option>)}
                                  </Select>
                                </Form.Item>
                              );
                            }}
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item {...restField} name={[name, 'listingName']} label="Nama Listing / Paket">
                            <Input placeholder="Contoh: Paket 10 lembar" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item {...restField} name={[name, 'channel']} label="Marketplace / Channel">
                            <Input placeholder="Shopee, Tokopedia, offline" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item
                            {...restField}
                            name={[name, 'productLink']}
                            label="Link Barang"
                            rules={[{
                              validator: (_, value) => !value || /^https?:\/\//i.test(value)
                                ? Promise.resolve()
                                : Promise.reject(new Error('Gunakan link http:// atau https://')),
                            }]}
                          >
                            <Input placeholder="https://link-barang-spesifik" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item {...restField} name={[name, 'purchaseUnit']} label="Satuan Beli">
                            <Select allowClear showSearch placeholder="Pilih satuan">
                              {PURCHASE_UNIT_OPTIONS.map((unit) => <Option key={unit} value={unit}>{unit}</Option>)}
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item {...restField} name={[name, 'purchaseQty']} label="Qty per Pembelian" initialValue={1}>
                            <InputNumber min={1} step={1} precision={0} style={{ width: '100%' }} formatter={formatNumberId} parser={parseIntegerIdInput} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item shouldUpdate noStyle>
                            {({ getFieldValue }) => {
                              const offer = getFieldValue(['catalogOffers', name]) || {};
                              return (
                                <Form.Item {...restField} name={[name, 'conversionValue']} label="Isi / Konversi" initialValue={1}>
                                  <InputNumber
                                    min={1}
                                    step={1}
                                    precision={0}
                                    disabled={offer.itemType === 'product'}
                                    style={{ width: '100%' }}
                                    formatter={formatNumberId}
                                    parser={parseIntegerIdInput}
                                  />
                                </Form.Item>
                              );
                            }}
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={6}>
                          <Form.Item {...restField} name={[name, 'stockUnit']} label="Satuan Stok">
                            <Input disabled placeholder="Otomatis dari barang" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item {...restField} name={[name, 'supplierItemPrice']} label="Harga Saat Ini" rules={[{ required: true, message: 'Harga wajib diisi' }]}>
                            <RupiahInputNumber min={0} step={1} precision={0} formatter={formatNumberId} parser={parseIntegerIdInput} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item {...restField} name={[name, 'purchaseType']} label="Jenis Pembelian" initialValue="online">
                            <Select>
                              <Option value="online">Online</Option>
                              <Option value="offline">Offline</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={4}>
                          <Form.Item {...restField} name={[name, 'isPrimary']} label="Pilihan Utama" valuePropName="checked">
                            <Switch />
                          </Form.Item>
                        </Col>
                        <Col xs={12} md={4}>
                          <Form.Item {...restField} name={[name, 'isActive']} label="Aktif" valuePropName="checked" initialValue>
                            <Switch />
                          </Form.Item>
                        </Col>
                        <Form.Item shouldUpdate noStyle>
                          {({ getFieldValue }) => {
                            const offer = getFieldValue(['catalogOffers', name]) || {};
                            if (offer.purchaseType === 'offline') return null;
                            return (
                              <>
                                <Col xs={24} md={8}>
                                  <Form.Item {...restField} name={[name, 'estimatedShippingCost']} label="Estimasi Ongkir">
                                    <RupiahInputNumber min={0} step={1} precision={0} formatter={formatNumberId} parser={parseIntegerIdInput} />
                                  </Form.Item>
                                </Col>
                                <Col xs={24} md={8}>
                                  <Form.Item {...restField} name={[name, 'serviceFee']} label="Estimasi Biaya Layanan">
                                    <RupiahInputNumber min={0} step={1} precision={0} formatter={formatNumberId} parser={parseIntegerIdInput} />
                                  </Form.Item>
                                </Col>
                                <Col xs={24} md={8}>
                                  <Form.Item {...restField} name={[name, 'discount']} label="Estimasi Diskon">
                                    <RupiahInputNumber min={0} step={1} precision={0} formatter={formatNumberId} parser={parseIntegerIdInput} />
                                  </Form.Item>
                                </Col>
                              </>
                            );
                          }}
                        </Form.Item>
                        <Col span={24}>
                          <Form.Item {...restField} name={[name, 'note']} label="Catatan Penawaran">
                            <Input placeholder="Kualitas, minimal order, warna, atau catatan lain" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => add({
                      itemType: 'raw_material',
                      itemId: undefined,
                      purchaseType: 'online',
                      purchaseUnit: 'pcs',
                      purchaseQty: 1,
                      conversionValue: 1,
                      supplierItemPrice: 0,
                      estimatedShippingCost: 0,
                      serviceFee: 0,
                      discount: 0,
                      isPrimary: false,
                      isActive: true,
                    })}
                  >
                    Tambah Penawaran / Link Barang
                  </Button>
                </>
              )}
            </Form.List>
          </ResponsiveFormSection>
        </Form>
      </Modal>

      <MobileDetailDrawer
        title={selectedSupplier ? getSupplierDisplayName(selectedSupplier) : 'Detail Supplier'}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setSelectedSupplier(null);
          setSupplierHistory([]);
          setHistoryLoadedSupplierId(null);
        }}
        width={920}
      >
        {selectedSupplier ? (
          <Tabs activeKey={drawerTab} onChange={handleDrawerTabChange} items={drawerTabs} />
        ) : null}
      </MobileDetailDrawer>

      <Modal
        title={`Cek Harga: ${priceCheckOffer?.itemName || ''}`}
        open={priceCheckVisible}
        onCancel={() => {
          if (priceCheckSaving) return;
          setPriceCheckVisible(false);
          setPriceCheckOffer(null);
        }}
        onOk={() => priceCheckForm.submit()}
        okText="Simpan Pengecekan"
        cancelText="Batal"
        confirmLoading={priceCheckSaving}
      >
        <Form form={priceCheckForm} layout="vertical" onFinish={handlePriceCheck}>
          <ImsNotice
            compact
            variant="guard"
            title="Buka link toko dan cocokkan harga aktual sebelum menyimpan."
            description="Harga lama dan waktu pengecekan hanya masuk ke Histori Toko, tidak memadati tampilan katalog utama."
          />
          <Form.Item name="resultStatus" label="Hasil Pengecekan" rules={[{ required: true }]}>
            <Select>
              <Option value="verified">Harga tersedia / sudah diperiksa</Option>
              <Option value="stock_unavailable">Barang habis</Option>
              <Option value="link_unavailable">Link tidak tersedia</Option>
            </Select>
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const resultStatus = getFieldValue('resultStatus');
              if (resultStatus !== 'verified') return null;
              return (
                <Form.Item name="actualPrice" label="Harga Aktual per Paket / Satuan Beli" rules={[{ required: true, message: 'Harga aktual wajib diisi' }]}>
                  <RupiahInputNumber min={1} step={1} precision={0} formatter={formatNumberId} parser={parseIntegerIdInput} />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item name="note" label="Catatan"><Input.TextArea rows={3} placeholder="Opsional" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SupplierPurchases;
