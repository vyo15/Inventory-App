import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { formatNumberID, parseIntegerIdInput } from '../../utils/formatters/numberId';
import { formatCurrencyId } from '../../utils/formatters/currencyId';
import { formatDateId } from '../../utils/formatters/dateId';
import { formatStockWithUnitId } from '../../utils/formatters/stockUnit';
import FilterBar from '../../components/Layout/Filters/FilterBar';
import PageHeader from '../../components/Layout/Page/PageHeader';
import PageSection from '../../components/Layout/Page/PageSection';
import SummaryStatGrid from '../../components/Layout/Display/SummaryStatGrid';
import StockDisplayBlock from '../../components/Layout/Table/StockDisplayBlock';
import DataTableView from '../../components/Layout/Table/DataTableView';
import { listCategories } from '../../data/repositories/categoriesRepository';

import {
  COLOR_VARIANT_MAP,
  ensureAtLeastOneVariant,
} from '../../utils/variants/variantHelpers';
import {
  createProduct,
  listenProducts,
  PRODUCT_DEFAULT_FORM,
  toggleProductActive,
  updateProduct,
} from '../../services/MasterData/productsService';
import { showFormValidationFeedback } from '../../utils/forms/formValidationFeedback';
import { buildSinglePricingPreview, listPricingRulesByTargetType } from '../../services/Pricing/pricingService';
import PricingModeSwitch from '../../components/Pricing/PricingModeSwitch';
import {
  getVariantAwareStockStatusMeta,
} from '../../utils/stock/stockHelpers';

// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data lama decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema/database runtime tetap sama.

const { Text } = Typography;
const { TextArea } = Input;

// -----------------------------------------------------------------------------
// Builder nilai awal form produk.
// Menjaga form create/edit tetap satu pola dan kompatibel dengan data lama.
// -----------------------------------------------------------------------------
const buildFormValues = (record = {}) => {
  const hasVariants = record?.hasVariants === true || (record?.variants || []).length > 0;

  return {
    ...PRODUCT_DEFAULT_FORM,
    ...record,
    hasVariants,
    variantLabel: record.variantLabel || 'Varian',
    variants: hasVariants ? ensureAtLeastOneVariant(record.variants || []) : [],
    currentStock: Number(record.currentStock || record.stock || 0),
    reservedStock: Number(record.reservedStock || 0),
    minStockAlert: Number(record.minStockAlert || 0),
  };
};

// Helper detail drawer memakai formatter shared agar format stok + unit konsisten lintas master data.
const formatStockWithUnit = formatStockWithUnitId;

const getRuleModeLabel = (mode, ruleId, pricingRuleMap = {}) => {
  if (mode !== 'rule') return 'Manual';
  return `Pricing Rule${pricingRuleMap[ruleId] ? ` | ${pricingRuleMap[ruleId]}` : ''}`;
};



const DEFAULT_PRODUCT_VARIANT = {
  color: '',
  sku: '',
  currentStock: 0,
  reservedStock: 0,
  averageCostPerUnit: 0,
  isActive: true,
};

const getVariantDisplayLabel = (variant = {}, index = 0) =>
  variant.variantLabel || variant.label || variant.name || COLOR_VARIANT_MAP[variant.color] || variant.color || `Varian ${index + 1}`;

const hasSafeZeroMasterStock = (record = {}) => {
  const currentStock = Number(record.currentStock ?? record.stock ?? 0);
  const reservedStock = Number(record.reservedStock || 0);
  const availableStock = Number(record.availableStock ?? Math.max(currentStock - reservedStock, 0));

  return currentStock <= 0 && reservedStock <= 0 && availableStock <= 0;
};

// -----------------------------------------------------------------------------
// Class helper presentasi tabel batch 1.
// Semua metadata tabel diarahkan ke class global agar spacing dan dark mode
// seragam, tanpa menulis inline style berulang.
// -----------------------------------------------------------------------------
const compactCellClassNames = {
  stack: 'ims-cell-stack ims-cell-stack-tight',
  meta: 'ims-cell-meta',
};




// -----------------------------------------------------------------------------
// Status stok produk.
// Disamakan dengan bahasa visual halaman master lain: nonaktif, kosong, rendah, aman.
// -----------------------------------------------------------------------------
const getProductStockSummary = (record = {}) => {
  if (record?.hasVariants) {
    const variants = Array.isArray(record.variants) ? record.variants : [];
    const currentStock = variants.reduce((sum, item) => sum + Number(item?.currentStock || 0), 0);
    const reservedStock = variants.reduce((sum, item) => sum + Number(item?.reservedStock || 0), 0);

    return {
      currentStock,
      reservedStock,
      availableStock: Math.max(currentStock - reservedStock, 0),
    };
  }

  const currentStock = Number(record.currentStock ?? record.stock ?? 0);
  const reservedStock = Number(record.reservedStock || 0);

  return {
    currentStock,
    reservedStock,
    availableStock: Number(record.availableStock ?? Math.max(currentStock - reservedStock, 0)),
  };
};

const getProductStatusMeta = (record = {}) => {
  const availableStock = Number(record.availableStock ?? record.currentStock ?? record.stock ?? 0);
  const minStockAlert = Number(record.minStockAlert || 0);

  if (record.isActive === false) {
    return { color: 'default', label: 'Nonaktif' };
  }

  const variantStatusMeta = getVariantAwareStockStatusMeta(record, {
    sourceType: 'product',
    threshold: minStockAlert,
  });

  if (variantStatusMeta) return variantStatusMeta;

  if (availableStock <= 0) {
    return { color: 'red', label: 'Kosong' };
  }

  if (minStockAlert > 0 && availableStock <= minStockAlert) {
    return { color: 'orange', label: 'Stok Rendah' };
  }

  return { color: 'green', label: 'Aman' };
};

const Products = () => {
  // ---------------------------------------------------------------------------
  // State utama data produk dan tampilan halaman.
  // ---------------------------------------------------------------------------
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [pricingPreviewWarning, setPricingPreviewWarning] = useState('');

  // ---------------------------------------------------------------------------
  // State filter untuk menyamakan pengalaman pakai dengan halaman raw dan semi.
  // ---------------------------------------------------------------------------
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [variantModeFilter, setVariantModeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [form] = Form.useForm();

  // ---------------------------------------------------------------------------
  // Watcher form untuk preview statistik drawer secara realtime.
  // ---------------------------------------------------------------------------
  const pricingModeValue = Form.useWatch('pricingMode', form);
  const pricingRuleIdValue = Form.useWatch('pricingRuleId', form);
  const watchedHppPerUnit = Form.useWatch('hppPerUnit', form);
  const hasVariantsValue = Form.useWatch('hasVariants', form);
  const variantLabelValue = Form.useWatch('variantLabel', form);
  const watchedVariants = Form.useWatch('variants', form) || [];
  const watchedCurrentStock = Form.useWatch('currentStock', form) || 0;
  const watchedReservedStock = Form.useWatch('reservedStock', form) || 0;
  const watchedMinStockAlert = Form.useWatch('minStockAlert', form) || 0;

  // GUARDED: mode edit master hanya boleh mengubah metadata non-stok.
  // ALASAN: stok setelah create wajib berubah lewat Stock Management / Stock Adjustment / transaksi resmi agar audit log tetap utuh.
  // STATUS: AKTIF untuk mengunci field stok di UI; service update tetap menjadi guard utama.
  // IMS NOTE [GUARDED | behavior-preserving]: flag edit dipakai hanya untuk mengunci input stok master.
  // Hubungan flow: stok setelah create wajib berubah lewat Stock Management / Stock Adjustment / transaksi resmi.
  const isEditingProduct = Boolean(editingProduct?.id);
  const editingProductHasVariants = Boolean(editingProduct?.hasVariants || (editingProduct?.variants || []).length > 0);
  const canActivateVariantsForEditing = isEditingProduct && !editingProductHasVariants && hasSafeZeroMasterStock(editingProduct);
  const hasVariantModeSwitchLocked = isEditingProduct && !canActivateVariantsForEditing;
  const stockEditHelpText = 'Ubah stok lewat Stock Management / Stock Adjustment / transaksi resmi.';

  // ---------------------------------------------------------------------------
  // Loader data master produk, kategori, dan pricing rules.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setLoading(true);

    const unsubProducts = listenProducts(
      (data) => {
        setProducts(data);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        message.error('Gagal memuat produk.');
        setLoading(false);
      },
    );

    let disposed = false;

    const loadSqliteCompanions = async () => {
      try {
        const [categoryRows, pricingRuleRows] = await Promise.all([
          listCategories(),
          listPricingRulesByTargetType('products'),
        ]);
        if (disposed) return;
        setCategories(categoryRows);
        setPricingRules(pricingRuleRows);
      } catch (error) {
        console.error(error);
        message.warning('Kategori/aturan harga belum lengkap. Produk tetap bisa dimuat.');
      }
    };

    loadSqliteCompanions();

    return () => {
      disposed = true;
      unsubProducts();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Map nama pricing rule agar tampilan list dan detail lebih ringkas.
  // ---------------------------------------------------------------------------
  const pricingRuleMap = useMemo(() => {
    return pricingRules.reduce((acc, item) => {
      acc[item.id] = item.name;
      return acc;
    }, {});
  }, [pricingRules]);

  const selectedPricingRule = useMemo(
    () => (pricingRules || []).find((item) => item.id === pricingRuleIdValue) || null,
    [pricingRules, pricingRuleIdValue],
  );

  /* =====================================================
  SECTION: Product pricing rule switch preview — AKTIF / GUARDED
  Fungsi:
  - Mengisi preview/form harga jual Product saat user mengaktifkan Pricing Rule dan data HPP + rule cukup.

  Dipakai oleh:
  - Drawer tambah/edit Product pada Master Data > Products.

  Alasan perubahan:
  - Mode pricing sebelumnya Select Manual/Rule kurang jelas; switch membuat alur manual vs rule lebih manusiawi.

  Catatan cleanup:
  - Belum ada. Helper kalkulasi tetap memakai pricingService existing.

  Risiko:
  - Jangan menulis langsung ke database dari effect ini; harga hanya tersimpan saat user klik Simpan.
  ===================================================== */
  useEffect(() => {
    if (pricingModeValue !== 'rule') {
      setPricingPreviewWarning('');
      return;
    }

    if (!selectedPricingRule) {
      setPricingPreviewWarning('Pilih pricing rule untuk menghitung harga jual.');
      return;
    }

    const preview = buildSinglePricingPreview(
      {
        id: editingProduct?.id || 'form-product',
        name: form.getFieldValue('name') || editingProduct?.name || 'Produk',
        pricingMode: 'rule',
        price: form.getFieldValue('price') || 0,
        hppPerUnit: watchedHppPerUnit || 0,
      },
      selectedPricingRule,
    );

    if (preview?.status === 'ready' && Number(preview.roundedPrice || 0) >= 0) {
      form.setFieldsValue({ price: preview.roundedPrice });
      setPricingPreviewWarning('');
      return;
    }

    setPricingPreviewWarning('Harga belum bisa dihitung. Cek HPP dan pricing rule.');
  }, [pricingModeValue, selectedPricingRule, watchedHppPerUnit, editingProduct, form]);

  // ---------------------------------------------------------------------------
  // Summary cards halaman produk.
  // ---------------------------------------------------------------------------
  const summary = useMemo(() => {
    const total = products.length;
    const active = products.filter((item) => item.isActive !== false).length;
    const inactive = products.filter((item) => item.isActive === false).length;
    const lowStock = products.filter((item) => {
      const statusMeta = getProductStatusMeta(item);
      return statusMeta.label === 'Kosong' || statusMeta.label === 'Stok Rendah';
    }).length;

    return { total, active, inactive, lowStock };
  }, [products]);

  const summaryItems = [
    { key: 'products-total', title: 'Total Produk', value: summary.total, subtitle: 'Semua master produk jadi yang tersimpan.', accent: 'primary' },
    { key: 'products-active', title: 'Produk Aktif', value: summary.active, subtitle: 'Masih aktif dijual atau dipakai di flow utama.', accent: 'success' },
    { key: 'products-inactive', title: 'Produk Nonaktif', value: summary.inactive, subtitle: 'Disimpan untuk histori tetapi tidak aktif dipakai.', accent: 'warning' },
    { key: 'products-low-stock', title: 'Perlu Dicek', value: summary.lowStock, subtitle: 'Produk yang kosong atau mendekati batas minimum.', accent: 'default' },
  ];

  // ---------------------------------------------------------------------------
  // Filter data list utama.
  // ---------------------------------------------------------------------------
  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const keyword = search.trim().toLowerCase();
      const statusMeta = getProductStatusMeta(item);
      const variantLabels = Array.isArray(item.variants)
        ? item.variants.map((variant, index) => getVariantDisplayLabel(variant, index))
        : [];

      const matchesSearch = !keyword
        ? true
        : [item.name, item.category, item.description, ...variantLabels]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(keyword));

      const matchesStatus = statusFilter === 'all' ? true : statusMeta.label === statusFilter;
      const matchesVariantMode =
        variantModeFilter === 'all'
          ? true
          : variantModeFilter === 'variant'
            ? item.hasVariants === true
            : item.hasVariants !== true;
      const matchesCategory = categoryFilter === 'all' ? true : String(item.categoryId || '') === categoryFilter;

      return matchesSearch && matchesStatus && matchesVariantMode && matchesCategory;
    });
  }, [products, search, statusFilter, variantModeFilter, categoryFilter]);

  // ---------------------------------------------------------------------------
  // Handler buka form create.
  // ---------------------------------------------------------------------------
  const openCreateDrawer = () => {
    setEditingProduct(null);
    setPricingPreviewWarning('');
    form.setFieldsValue(buildFormValues(PRODUCT_DEFAULT_FORM));
    setFormVisible(true);
  };

  // ---------------------------------------------------------------------------
  // Handler tutup drawer form.
  // ---------------------------------------------------------------------------
  const closeFormDrawer = () => {
    setFormVisible(false);
    setSubmitting(false);
    setEditingProduct(null);
    setPricingPreviewWarning('');
    form.resetFields();
  };

  // ---------------------------------------------------------------------------
  // Handler edit produk.
  // ---------------------------------------------------------------------------
  const handleEdit = (record) => {
    setEditingProduct(record);
    form.setFieldsValue(buildFormValues(record));
    setFormVisible(true);
  };

  // ---------------------------------------------------------------------------
  // Handler buka detail produk.
  // ---------------------------------------------------------------------------
  const handleViewDetail = (record) => {
    setSelectedProduct(record);
    setDetailVisible(true);
  };

  // ---------------------------------------------------------------------------
  // Submit create/update produk.
  // ---------------------------------------------------------------------------
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingProduct?.id) {
        await updateProduct(editingProduct.id, values, categories);
        message.success('Produk berhasil diupdate.');
      } else {
        await createProduct(values, categories);
        message.success('Produk berhasil ditambahkan.');
      }

      closeFormDrawer();
    } catch (error) {
      /*
      =====================================================
      SECTION: Catch validasi form custom — AKTIF
      Fungsi:
      - Menampilkan popup field wajib ketika form.validateFields() gagal.

      Dipakai oleh:
      - Drawer/form custom yang tidak melewati PageFormModal.

      Alasan perubahan:
      - User perlu pesan validasi yang jelas saat klik Simpan.

      Catatan cleanup:
      - Belum ada.

      Risiko:
      - Jangan menelan error service non-validasi; helper mengembalikan false untuk error biasa.
      =====================================================
      */
      if (showFormValidationFeedback(error, { form })) return;
      if (error?.type === 'validation' && error?.errors) {
        form.setFields(
          Object.entries(error.errors).map(([name, err]) => ({
            name,
            errors: [err],
          })),
        );
        return;
      }

      console.error(error);
      message.error(error?.message || 'Gagal menyimpan produk.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Toggle aktif/nonaktif produk.
  // ---------------------------------------------------------------------------
  const handleToggleActive = async (record) => {
    try {
      await toggleProductActive(record.id, !(record.isActive !== false));
      message.success(record.isActive !== false ? 'Produk dinonaktifkan.' : 'Produk diaktifkan kembali.');
    } catch (error) {
      console.error(error);
      message.error('Gagal mengubah status produk.');
    }
  };

  /* =====================================================
  SECTION: Kolom tabel Produk Jadi compact — AKTIF / GUARDED
  Fungsi:
  - Menjaga table utama Produk Jadi tetap ringkas tanpa horizontal scroll besar.
  - Kolom Stok tetap memakai format locked: Total, Tersedia, dan semua variant pill langsung di table.

  Dipakai oleh:
  - Halaman Master Data / Produk Jadi.

  Alasan perubahan:
  - Batch table compact memindahkan metadata panjang ke drawer detail, tetapi stock variant owner-locked tidak boleh disembunyikan.

  Catatan cleanup:
  - Field harga/pricing bisa dipadatkan lagi ke detail bila owner ingin table lebih minimal.

  Risiko:
  - Jangan ubah create/edit/toggle product, variant guard, stock guard, atau payload produk dari section ini.
  ===================================================== */
  const columns = [
    {
      title: 'Produk Jadi',
      dataIndex: 'name',
      key: 'name',
      width: '24%',
      render: (value, record) => (
        <div className={compactCellClassNames.stack}>
          <Text strong>{value || '-'}</Text>
          <Text type="secondary" className={compactCellClassNames.meta}>{record.category || 'Produk Jadi'}</Text>
          <Space size={6} wrap className="ims-cell-tag-list">
            <Tag color={record.hasVariants ? 'blue' : 'default'}>
              {record.hasVariants ? 'Pakai Varian' : 'Tanpa Varian'}
            </Tag>
            {record.hasVariants ? (
              <Tag color="purple">{formatNumberID(record.variantCount || 0)} varian</Tag>
            ) : null}
          </Space>
        </div>
      ),
    },
    {
      title: 'Stok',
      key: 'stock',
      width: '30%',
      render: (_, record) => (
        <StockDisplayBlock
          record={record}
          unit="pcs"
          getVariantLabel={getVariantDisplayLabel}
          className={compactCellClassNames.stack}
          metaClassName={compactCellClassNames.meta}
          minStockThreshold={Number(record.minStockAlert || 0)}
        />
      ),
    },
    {
      title: 'Harga',
      key: 'priceInfo',
      width: '18%',
      render: (_, record) => (
        <div className={compactCellClassNames.stack}>
          <Text strong>{`Jual ${formatCurrencyId(record.price || 0)} / pcs`}</Text>
          <Text type="secondary" className={compactCellClassNames.meta}>
            {`HPP ${formatCurrencyId(record.hppPerUnit || 0)} / pcs`}
          </Text>
          <Text type="secondary" className={compactCellClassNames.meta}>
            {getRuleModeLabel(record.pricingMode, record.pricingRuleId, pricingRuleMap)}
          </Text>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: '14%',
      align: 'left',
      render: (_, record) => {
        const statusMeta = getProductStatusMeta(record);

        return (
          <div className={compactCellClassNames.stack}>
            <Tag className="ims-status-tag" color={statusMeta.color}>{statusMeta.label}</Tag>
          </div>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: '14%',
      className: 'app-table-action-column',
      render: (_, record) => (
        <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
          {/* AKTIF / GUARDED: kolom Aksi produk dibuat 3 baris agar Detail/Edit/Status rapi tanpa scroll horizontal; handler produk dan flow stok tetap tidak diubah. */}
          <Button className="ims-action-button ims-action-button--block" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            Detail
          </Button>
          <Button className="ims-action-button ims-action-button--block" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title={record.isActive === false ? 'Aktifkan kembali produk?' : 'Nonaktifkan produk?'}
            okText="Ya"
            cancelText="Batal"
            onConfirm={() => handleToggleActive(record)}
          >
            <Button className="ims-action-button ims-action-button--block" size="small">{record.isActive === false ? 'Aktifkan' : 'Nonaktifkan'}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const productMobileCardConfig = {
    density: 'compact',
    title: (record) => record.name || '-',
    subtitle: (record) => [record.category || 'Produk Jadi'],
    primary: (record) => {
      const stockSummary = getProductStockSummary(record);
      return `${formatStockWithUnit(stockSummary.availableStock)} tersedia`;
    },
    secondary: (record) => `${formatCurrencyId(record.price || 0)} / pcs`,
    tags: (record) => {
      const statusMeta = getProductStatusMeta(record);
      return [
        <Tag key="status" className="ims-status-tag" color={statusMeta.color}>{statusMeta.label}</Tag>,
      ];
    },
    meta: [
      { label: 'Min', value: (record) => formatStockWithUnit(record.minStockAlert || 0) },
      { label: 'Varian', value: (record) => (record.hasVariants ? `${formatNumberID(record.variantCount || 0)} varian` : 'Tidak') },
    ],
    onCardClick: (record) => handleViewDetail(record),
    primaryActions: [
      { key: 'detail', label: 'Detail', icon: <EyeOutlined />, onClick: (record) => handleViewDetail(record) },
    ],
    moreActions: (record) => [
      { key: 'edit', label: 'Edit', icon: <EditOutlined />, onClick: () => handleEdit(record) },
      { key: 'toggle', label: record.isActive === false ? 'Aktifkan' : 'Nonaktifkan', onClick: () => handleToggleActive(record) },
    ],
  };

  return (
    <div className="page-container ims-page">
      {/* ---------------------------------------------------------------------
          Header halaman produk.
      --------------------------------------------------------------------- */}
      <PageHeader
        title="Produk Jadi"
        subtitle="Master produk jadi dan stok varian."
        actions={[
          { key: 'create-product', type: 'primary', icon: <PlusOutlined />, label: 'Tambah Produk', onClick: openCreateDrawer },
        ]}
      />

      <Alert
        showIcon
        type="info"
        className="ims-page-alert"
        message="Stok varian dikelola per varian produk."
      />

      {/* ---------------------------------------------------------------------
          Summary cards produk.
      --------------------------------------------------------------------- */}
      <SummaryStatGrid items={summaryItems} className="ims-summary-row" />

      {/* ---------------------------------------------------------------------
          Filter bar utama.
      --------------------------------------------------------------------- */}
      <FilterBar>
          <Col xs={24} md={8}>
            <Input
              allowClear
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama produk, kategori, atau varian..."
            />
          </Col>
          <Col xs={24} md={5}>
            <Select className="ims-filter-control" value={statusFilter} onChange={setStatusFilter}>
              <Select.Option value="all">Semua Status</Select.Option>
              <Select.Option value="Aman">Aman</Select.Option>
              <Select.Option value="Stok Rendah">Stok Rendah</Select.Option>
              <Select.Option value="Kosong">Kosong</Select.Option>
              <Select.Option value="Nonaktif">Nonaktif</Select.Option>
            </Select>
          </Col>
          <Col xs={24} md={5}>
            <Select className="ims-filter-control" value={variantModeFilter} onChange={setVariantModeFilter}>
              <Select.Option value="all">Semua Mode Varian</Select.Option>
              <Select.Option value="variant">Pakai Varian</Select.Option>
              <Select.Option value="single">Tanpa Varian</Select.Option>
            </Select>
          </Col>
          <Col xs={24} md={6}>
            <Select className="ims-filter-control" value={categoryFilter} onChange={setCategoryFilter} allowClear={false}>
              <Select.Option value="all">Semua Kategori</Select.Option>
              {(categories || []).map((item) => (
                <Select.Option key={item.id} value={item.id}>{item.name}</Select.Option>
              ))}
            </Select>
          </Col>
      </FilterBar>

      {/* ---------------------------------------------------------------------
          Tabel utama produk.
      --------------------------------------------------------------------- */}
      <PageSection
        title="Daftar Produk Jadi"
        subtitle="Harga, stok, dan varian produk."
      >
        <DataTableView
          loading={loading}
          className="ims-table"
          rowKey="id"
          dataSource={filteredProducts}
          columns={columns}
          size="small"
          pagination={{ pageSize: 10 }}
          tableLayout="fixed"
          emptyText={<Empty description="Belum ada data produk" />}
          mobileCardConfig={productMobileCardConfig}
        />
      </PageSection>

      {/* ---------------------------------------------------------------------
          Drawer form create/edit produk.
          Ukuran dan pembagian section dibuat seragam dengan raw materials.
      --------------------------------------------------------------------- */}
      <Drawer
        title={editingProduct ? 'Edit Produk' : 'Tambah Produk'}
        open={formVisible}
        onClose={closeFormDrawer}
        width={860}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={closeFormDrawer}>Batal</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>Simpan</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={buildFormValues(PRODUCT_DEFAULT_FORM)}>
          <Divider orientation="left">Informasi Utama</Divider>
          {/* =====================================================
          SECTION: Product internal code hidden from main UI — AKTIF
          Fungsi:
          - Form Produk Jadi tidak menampilkan input kode utama agar user fokus pada nama, kategori, harga, stok, dan varian.

          Dipakai oleh:
          - Drawer form Products dan productsService sebagai pembuat kode internal.

          Alasan perubahan:
          - Kode PRD tetap dibuat otomatis oleh service, tetapi tidak perlu menjadi input utama di UI master item.

          Catatan cleanup:
          - Audit table/detail berikutnya dapat memastikan kode internal hanya muncul pada export/debug bila dibutuhkan.

          Risiko:
          - Jangan menambahkan input manual code karena dapat merusak immutability dan relasi produk lama.
          ===================================================== */}
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="Nama Produk" rules={[{ required: true, message: 'Nama produk wajib diisi.' }]}> 
                <Input placeholder="Contoh: Bunga Mawar Flanel" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="categoryId" label="Kategori">
                <Select
                  allowClear
                  placeholder="Pilih kategori"
                  options={(categories || []).map((item) => ({ value: item.id, label: item.name }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Deskripsi">
            <TextArea rows={3} placeholder="Catatan produk" />
          </Form.Item>

          <Divider orientation="left">Pricing Master</Divider>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="hppPerUnit" label="HPP / Unit" rules={[{ required: true, message: 'HPP wajib diisi.' }]}> 
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={1}
                  precision={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={parseIntegerIdInput}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              {/* =====================================================
              SECTION: Product pricing mode switch — AKTIF / GUARDED
              Fungsi:
              - Mengubah mode pricing Product dari Select menjadi Switch: OFF manual, ON pricing rule.

              Dipakai oleh:
              - Form create/edit Product.

              Alasan perubahan:
              - User lebih mudah memahami bahwa Pricing Rule adalah pilihan aktif/nonaktif, bukan kategori harga terpisah.

              Catatan cleanup:
              - Belum ada. Field payload tetap pricingMode dan pricingRuleId.

              Risiko:
              - Jangan ubah nilai domain pricingMode selain manual/rule karena service dan PricingRules bergantung pada nilai ini.
              ===================================================== */}
              <Form.Item name="pricingMode" hidden>
                <Input type="hidden" />
              </Form.Item>
              <PricingModeSwitch
                value={pricingModeValue || 'manual'}
                extra={pricingModeValue === 'rule'
                  ? 'Pricing Rule aktif: pilih rule untuk menghitung harga jual.'
                  : 'Manual: harga jual diisi langsung.'}
                onChange={(nextMode) => {
                  form.setFieldsValue({ pricingMode: nextMode });
                  if (nextMode !== 'rule') {
                    form.setFieldsValue({ pricingRuleId: null });
                    setPricingPreviewWarning('');
                  }
                }}
              />
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="price" label="Harga Jual" rules={[{ required: true, message: 'Harga jual wajib diisi.' }]}> 
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={1}
                  precision={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={parseIntegerIdInput}
                />
              </Form.Item>
            </Col>
          </Row>

          {pricingPreviewWarning ? (
            <Alert
              type="warning"
              showIcon
              message={pricingPreviewWarning}
              style={{ marginBottom: 16 }}
            />
          ) : null}

          <Form.Item
            name="pricingRuleId"
            label="Pricing Rule"
            rules={pricingModeValue === 'rule' ? [{ required: true, message: 'Pricing rule wajib dipilih.' }] : []}
          >
            <Select
              allowClear
              disabled={pricingModeValue !== 'rule'}
              placeholder="Pilih pricing rule"
              options={(pricingRules || []).map((item) => ({
                value: item.id,
                label: `${item.name}${item?.isActive ? '' : ' (Nonaktif)'}`,
              }))}
            />
          </Form.Item>

          {/* IMS NOTE [GUARDED | behavior-preserving]: section stok tetap tampil untuk konteks,
              tetapi input stok dikunci saat edit agar payload master tidak menjadi jalur mutasi stok. */}
          <Divider orientation="left">Mode Stok</Divider>
          <Form.Item
            name="hasVariants"
            label="Pakai Varian"
            valuePropName="checked"
            extra={isEditingProduct
              ? canActivateVariantsForEditing
                ? 'Produk lama dengan stok 0 boleh mulai memakai varian. Varian baru tetap mulai dari stok 0.'
                : 'Mode varian dikunci setelah produk dibuat agar struktur stok tetap konsisten.'
              : undefined}
          >
            <Switch
              checkedChildren="Ya"
              unCheckedChildren="Tidak"
              disabled={hasVariantModeSwitchLocked}
              onChange={(checked) => {
                if (hasVariantModeSwitchLocked) return;
                if (checked) {
                  form.setFieldsValue({
                    variants: ensureAtLeastOneVariant(form.getFieldValue('variants') || [], { defaultVariant: DEFAULT_PRODUCT_VARIANT }),
                    variantLabel: form.getFieldValue('variantLabel') || 'Varian',
                    currentStock: isEditingProduct ? 0 : form.getFieldValue('currentStock'),
                    reservedStock: isEditingProduct ? 0 : form.getFieldValue('reservedStock'),
                  });
                } else {
                  form.setFieldsValue({ variants: [], variantLabel: 'Varian' });
                }
              }}
            />
          </Form.Item>

          {hasVariantsValue ? (
            <Form.Item
              name="variantLabel"
              label="Label Varian"
              extra="Contoh: Warna, Ukuran, Motif."
            >
              <Input placeholder="Contoh: Warna" />
            </Form.Item>
          ) : null}

          <Alert
            type={isEditingProduct ? 'info' : 'warning'}
            showIcon
            style={{ marginBottom: 16 }}
            message={isEditingProduct
              ? canActivateVariantsForEditing
                ? 'Produk lama ini stoknya 0, jadi boleh mulai memakai varian. Stok tiap varian baru tetap 0 sampai diubah lewat Stock Adjustment/transaksi resmi.'
                : stockEditHelpText
              : hasVariantsValue
                ? 'Harga produk tetap di master. Varian hanya mengatur stok fisik; Minimum Stok tetap satu angka di master produk.'
                : 'Produk tanpa varian memakai stok awal dan minimum stok langsung di master produk.'}
          />

          {hasVariantsValue ? (
            <>
              {/* =====================================================
              SECTION: Product Variant Form Without Variant Min Stock — AKTIF
              Fungsi:
              - menampilkan stok fisik per varian sambil menjaga Minimum Stok sebagai field master produk.

              Dipakai oleh:
              - Products.jsx create/edit drawer dan productsService master payload.

              Alasan perubahan:
              - `variants[].minStockAlert` adalah compatibility data lama; user tidak lagi mengisi min stock per varian.

              Catatan cleanup:
              - field data lama varian dapat diaudit pada batch maintenance terpisah tanpa migrasi otomatis di UI ini.

              Risiko:
              - mengembalikan input min stock per varian akan membuat threshold low stock Product tidak konsisten dengan source master.
              ===================================================== */}
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="minStockAlert" label="Minimum Stok Master">
                    <InputNumber style={{ width: '100%' }} min={0} step={1} precision={0} parser={parseIntegerIdInput} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.List name="variants">
                {(fields, { add, remove }) => (
                  <Space direction="vertical" style={{ width: '100%' }} size={12}>
                    {fields.map((field) => (
                      <Card key={field.key} size="small" title={`${variantLabelValue || 'Varian'} ${field.name + 1}`}>
                        <Row gutter={12}>
                          {/* IMS NOTE [GUARDED | identity-safe]: hidden identity field menjaga variantKey lama tetap terkirim saat label varian diganti. Hubungan flow: variantKey adalah identitas stok varian/reference transaksi. STATUS: AKTIF. */}
                          <Form.Item name={[field.name, 'variantKey']} hidden>
                            <Input />
                          </Form.Item>
                          <Col xs={24} md={6}>
                            <Form.Item {...field} name={[field.name, 'color']} label={`Nama ${variantLabelValue || 'Varian'}`} rules={[{ required: true, message: 'Nama varian wajib diisi' }]}> 
                              <Input placeholder="Contoh: Merah, Ukuran S, Motif Polkadot" />
                            </Form.Item>
                          </Col>
                          <Form.Item {...field} name={[field.name, 'sku']} hidden>
                            <Input />
                          </Form.Item>
                          <Col xs={24} md={5}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'currentStock']}
                              label="Stok"
                              initialValue={0}
                              extra={isEditingProduct ? stockEditHelpText : undefined}
                            >
                              <InputNumber style={{ width: '100%' }} min={0} step={1} precision={0} parser={parseIntegerIdInput} disabled={isEditingProduct} />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={4}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'reservedStock']}
                              label="Reserved"
                              initialValue={0}
                              extra={isEditingProduct ? 'Reserved stock dikunci saat edit karena memengaruhi available stock.' : undefined}
                            >
                              <InputNumber style={{ width: '100%' }} min={0} step={1} precision={0} parser={parseIntegerIdInput} disabled={isEditingProduct} />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={3}>
                            <Form.Item {...field} name={[field.name, 'isActive']} label="Aktif" valuePropName="checked" initialValue>
                              <Switch />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Button
                          danger
                          size="small"
                          disabled={fields.length === 1}
                          onClick={() => remove(field.name)}
                        >
                          Hapus Varian
                        </Button>
                      </Card>
                    ))}

                    <Button type="dashed" onClick={() => add({ ...DEFAULT_PRODUCT_VARIANT })} block>
                      Tambah Varian
                    </Button>
                  </Space>
                )}
              </Form.List>
            </>
          ) : (
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item name="currentStock" label="Stok Master" extra={isEditingProduct ? stockEditHelpText : undefined}>
                  <InputNumber style={{ width: '100%' }} min={0} step={1} precision={0} parser={parseIntegerIdInput} disabled={isEditingProduct} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="reservedStock" label="Reserved Stock" extra={isEditingProduct ? 'Reserved stock dikunci saat edit karena memengaruhi available stock.' : undefined}>
                  <InputNumber style={{ width: '100%' }} min={0} step={1} precision={0} parser={parseIntegerIdInput} disabled={isEditingProduct} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="minStockAlert" label="Minimum Stok">
                  <InputNumber style={{ width: '100%' }} min={0} step={1} precision={0} parser={parseIntegerIdInput} />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Divider orientation="left">Ringkasan Form</Divider>
          <Card size="small">
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Statistic
                  title={hasVariantsValue ? 'Jumlah Varian' : 'Mode Stok'}
                  value={hasVariantsValue ? watchedVariants.length : 'Master'}
                  formatter={(value) => value}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="Stok Total"
                  value={hasVariantsValue ? watchedVariants.reduce((sum, item) => sum + Number(item?.currentStock || 0), 0) : watchedCurrentStock}
                  formatter={(value) => formatNumberID(value)}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title={hasVariantsValue ? 'Reserved Total | Min Master' : `Min Stok | Reserved ${formatNumberID(watchedReservedStock)}`}
                  value={hasVariantsValue
                    ? `${formatNumberID(watchedVariants.reduce((sum, item) => sum + Number(item?.reservedStock || 0), 0))} | ${formatNumberID(watchedMinStockAlert)}`
                    : watchedMinStockAlert}
                  formatter={(value) => hasVariantsValue ? value : formatNumberID(value)}
                />
              </Col>
            </Row>
          </Card>
        </Form>
      </Drawer>

      {/* =====================================================
          SECTION: Product Detail Drawer — AKTIF
          Fungsi:
          - Menata ringkasan produk, harga, stok, varian, dan catatan dalam section yang mudah dibaca.

          Dipakai oleh:
          - Halaman Master Data / Produk Jadi saat user membuka tombol Detail.

          Alasan perubahan:
          - Drawer lama menampilkan semua data dalam satu blok sehingga harga, stok, dan varian kurang cepat dibaca.

          Catatan cleanup:
          - Belum ada.

          Risiko:
          - Jangan ubah mapping stok, varian, pricing, HPP, atau handler detail dari section presentasi ini.
      ===================================================== */}
      <Drawer title="Detail Produk" open={detailVisible} onClose={() => setDetailVisible(false)} width={900} destroyOnClose>
        {selectedProduct ? (() => {
          const stockSummary = getProductStockSummary(selectedProduct);
          const statusMeta = getProductStatusMeta(selectedProduct);

          return (
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              <Card size="small">
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Space size={[8, 8]} wrap>
                    <Text strong style={{ fontSize: 18 }}>{selectedProduct.name || '-'}</Text>
                    <Tag className="ims-status-tag" color={statusMeta.color}>{statusMeta.label}</Tag>
                    {selectedProduct.hasVariants ? <Tag color="blue">Pakai Varian</Tag> : <Tag>Tanpa Varian</Tag>}
                  </Space>
                  <Text type="secondary">{selectedProduct.category || 'Tanpa kategori'}</Text>
                </Space>
              </Card>

              <Row gutter={[12, 12]}>
                <Col xs={24} md={8}>
                  <Card size="small"><Statistic title="Harga Jual" value={formatCurrencyId(selectedProduct.price)} formatter={(value) => value} /></Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small"><Statistic title="HPP / Unit" value={formatCurrencyId(selectedProduct.hppPerUnit)} formatter={(value) => value} /></Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small"><Statistic title="Stok Tersedia" value={`${formatNumberID(stockSummary.availableStock)} pcs`} formatter={(value) => value} /></Card>
                </Col>
              </Row>

              <Card size="small" title="Ringkasan">
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="Kategori">{selectedProduct.category || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Mode Pricing">{getRuleModeLabel(selectedProduct.pricingMode, selectedProduct.pricingRuleId, pricingRuleMap)}</Descriptions.Item>
                  <Descriptions.Item label="Pricing Rule">{pricingRuleMap[selectedProduct.pricingRuleId] || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Minimum Stok">{formatStockWithUnit(selectedProduct.minStockAlert)}</Descriptions.Item>
                  <Descriptions.Item label="Update Terakhir">{formatDateId(selectedProduct.updatedAt, true)}</Descriptions.Item>
                </Descriptions>
              </Card>

              <Card size="small" title={selectedProduct.hasVariants ? 'Varian Produk' : 'Stok Master'}>
                {selectedProduct.hasVariants ? (
                  <DataTableView
                    className="ims-table"
                    rowKey={(record, index) => `${selectedProduct.id}-${record.variantKey || record.color || index}`}
                    pagination={false}
                    size="small"
                    showRefreshIndicator={false}
                    dataSource={selectedProduct.variants || []}
                    mobileCardConfig={{
                      title: (variant, index) => getVariantDisplayLabel(variant, index),
                      tags: (variant) => (
                        <Tag className="ims-status-tag" color={variant.isActive === false ? 'default' : 'green'}>
                          {variant.isActive === false ? 'Nonaktif' : 'Aktif'}
                        </Tag>
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
                        title: selectedProduct.variantLabel || 'Varian',
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
                        render: (value) => <Tag className="ims-status-tag" color={value === false ? 'default' : 'green'}>{value === false ? 'Nonaktif' : 'Aktif'}</Tag>,
                      },
                    ]}
                  />
                ) : (
                  <Descriptions bordered column={1} size="small">
                    <Descriptions.Item label="Stok Total">{formatStockWithUnit(stockSummary.currentStock)}</Descriptions.Item>
                    <Descriptions.Item label="Reserved Stock">{formatStockWithUnit(stockSummary.reservedStock)}</Descriptions.Item>
                    <Descriptions.Item label="Stok Tersedia">{formatStockWithUnit(stockSummary.availableStock)}</Descriptions.Item>
                    <Descriptions.Item label="Minimum Stok">{formatStockWithUnit(selectedProduct.minStockAlert)}</Descriptions.Item>
                  </Descriptions>
                )}
              </Card>

              {selectedProduct.description ? (
                <Card size="small" title="Catatan">
                  <Text>{selectedProduct.description}</Text>
                </Card>
              ) : null}
            </Space>
          );
        })() : null}
      </Drawer>
    </div>
  );
};

export default Products;
