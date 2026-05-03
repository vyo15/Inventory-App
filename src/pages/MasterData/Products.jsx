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
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { formatNumberID, parseIntegerIdInput } from '../../utils/formatters/numberId';
import { formatCurrencyId } from '../../utils/formatters/currencyId';
import { formatDateId } from '../../utils/formatters/dateId';
import FilterBar from '../../components/Layout/Filters/FilterBar';
import PageHeader from '../../components/Layout/Page/PageHeader';
import PageSection from '../../components/Layout/Page/PageSection';
import SummaryStatGrid from '../../components/Layout/Display/SummaryStatGrid';
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

// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data lama decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema Firestore tetap sama.

const { Text } = Typography;
const { TextArea } = Input;

// -----------------------------------------------------------------------------
// Tag mode pricing.
// Diletakkan di atas file agar mudah dipakai ulang di tabel dan detail drawer.
// -----------------------------------------------------------------------------
const PRICING_MODE_TAGS = {
  manual: <Tag color="orange">Manual</Tag>,
  rule: <Tag color="green">Rule</Tag>,
};

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

// -----------------------------------------------------------------------------
// Helper tampilan stok agar gaya visual konsisten dengan halaman semi finished.
// -----------------------------------------------------------------------------
const formatStockWithUnit = (value, unit = 'pcs') => `${formatNumberID(value)} ${unit}`;


const DEFAULT_PRODUCT_VARIANT = {
  color: '',
  sku: '',
  currentStock: 0,
  reservedStock: 0,
  minStockAlert: 0,
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
// Helper tampilan varian pada kolom stok.
// Semua varian langsung ditampilkan sebagai pill agar user bisa membaca stok
// per varian tanpa jarak terlalu lebar dan tanpa buka detail drawer.
// -----------------------------------------------------------------------------
const renderVariantStockPills = (variants = [], unit = 'pcs') => {
  const normalizedVariants = Array.isArray(variants)
    ? variants.filter((variant) => String(variant?.variantLabel || variant?.name || variant?.color || '').trim())
    : [];

  if (normalizedVariants.length === 0) {
    return null;
  }

  return (
    <div className="stock-variant-pill-wrap">
      {normalizedVariants.map((variant, index) => {
        const variantLabel = getVariantDisplayLabel(variant, index);

        return (
          <span key={`${variant.variantKey || variant.color || 'variant'}-${index}`} className="stock-variant-pill">
            <Text className="stock-variant-pill-label">{`${variantLabel}:`}</Text>
            <Text className="stock-variant-pill-value">
              {formatStockWithUnit(variant.currentStock || 0, unit)}
            </Text>
          </span>
        );
      })}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Status stok produk.
// Disamakan dengan bahasa visual halaman master lain: nonaktif, kosong, rendah, aman.
// -----------------------------------------------------------------------------
const getProductStatusMeta = (record = {}) => {
  const availableStock = Number(record.availableStock ?? record.currentStock ?? record.stock ?? 0);
  const minStockAlert = Number(record.minStockAlert || 0);

  if (record.isActive === false) {
    return { color: 'default', label: 'Nonaktif' };
  }

  if (availableStock <= 0) {
    return { color: 'red', label: 'Kosong' };
  }

  if (availableStock <= minStockAlert) {
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

    const unsubCategories = onSnapshot(
      collection(db, 'categories'),
      (snapshot) => {
        setCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      },
      (error) => {
        console.error(error);
        message.error('Gagal memuat kategori.');
      },
    );

    const unsubPricingRules = onSnapshot(
      collection(db, 'pricing_rules'),
      (snapshot) => {
        setPricingRules(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .filter((item) => item?.targetType === 'products'),
        );
      },
      (error) => {
        console.error(error);
        message.error('Gagal memuat pricing rules.');
      },
    );

    return () => {
      unsubProducts();
      unsubCategories();
      unsubPricingRules();
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
      if (error?.errorFields) return;
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

  // ---------------------------------------------------------------------------
  // Kolom tabel utama.
  // Varian dipindah menjadi rincian di kolom stok agar lebih padat dan mudah dibaca.
  // ---------------------------------------------------------------------------
  const columns = [
    {
      title: 'Produk Jadi',
      dataIndex: 'name',
      key: 'name',
      width: 280,
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
      width: 360,
      render: (_, record) => {
        const variants = Array.isArray(record.variants) ? record.variants : [];
        const hasVariants = record.hasVariants === true && variants.length > 0;

        return (
          <div className={compactCellClassNames.stack}>
            <Text strong>{`Total ${formatStockWithUnit(record.currentStock ?? record.stock ?? 0)}`}</Text>
            <Text type="secondary" className={compactCellClassNames.meta}>
              {`Tersedia ${formatStockWithUnit(record.availableStock ?? record.currentStock ?? record.stock ?? 0)}`}
            </Text>

            {hasVariants ? (
              renderVariantStockPills(variants)
            ) : (
              <Text type="secondary" className={compactCellClassNames.meta}>Non-varian</Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Harga',
      key: 'priceInfo',
      width: 250,
      render: (_, record) => (
        <div className={compactCellClassNames.stack}>
          <Text strong>{`Jual ${formatCurrencyId(record.price || 0)} / pcs`}</Text>
          <Text type="secondary" className={compactCellClassNames.meta}>
            {`HPP ${formatCurrencyId(record.hppPerUnit || 0)} / pcs`}
          </Text>
          <Text type="secondary" className={compactCellClassNames.meta}>
            {`${record.pricingMode === 'manual' ? 'Manual' : 'Rule'} ${pricingRuleMap[record.pricingRuleId] ? `| ${pricingRuleMap[record.pricingRuleId]}` : ''}`}
          </Text>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      align: 'center',
      render: (_, record) => {
        const statusMeta = getProductStatusMeta(record);
        return <Tag className="ims-status-tag" color={statusMeta.color}>{statusMeta.label}</Tag>;
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: 170,
      fixed: 'right',
      className: 'app-table-action-column',
      render: (_, record) => (
        <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
          {/* AKTIF / GUARDED: kolom Aksi produk dibuat 3 baris fixed agar Detail/Edit/Status rapi; handler produk dan flow stok tetap tidak diubah. */}
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

  return (
    <div className="page-container ims-page">
      {/* ---------------------------------------------------------------------
          Header halaman produk.
      --------------------------------------------------------------------- */}
      <PageHeader
        title="Produk Jadi"
        subtitle="Master produk jadi dengan harga di master dan stok per varian fleksibel supaya data tetap rapi dan mudah dipantau."
        actions={[
          { key: 'refresh-products', icon: <ReloadOutlined />, label: 'Refresh', onClick: () => window.location.reload() },
          { key: 'create-product', type: 'primary', icon: <PlusOutlined />, label: 'Tambah Produk', onClick: openCreateDrawer },
        ]}
      />

      <Alert
        showIcon
        type="info"
        className="ims-page-alert"
        message="Nama produk tidak perlu dipecah per varian. Cukup 1 master produk lalu stok varian dikelola di bucket varian. Status list akan mengikuti kondisi stok dan status aktif produk."
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
        subtitle="Tabel ini merangkum stok, kategori, mode pricing, dan varian produk jadi."
      >
        <Table
          className="ims-table"
          rowKey="id"
          loading={loading}
          dataSource={filteredProducts}
          columns={columns}
          size="small"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 1180 }}
          locale={{ emptyText: <Empty description="Belum ada data produk" /> }}
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
              <Form.Item name="pricingMode" label="Mode Pricing" rules={[{ required: true, message: 'Mode pricing wajib dipilih.' }]}> 
                <Select
                  options={[{ value: 'manual', label: 'Manual' }, { value: 'rule', label: 'Rule' }]}
                  onChange={(value) => {
                    if (value === 'manual') {
                      form.setFieldsValue({ pricingRuleId: null });
                    }
                  }}
                />
              </Form.Item>
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
                : 'Mode varian dikunci setelah produk dibuat agar bucket stok tidak berubah tanpa audit.'
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
              extra="AKTIF: label ini hanya metadata tampilan. Contoh: Warna, Ukuran, Tipe, Motif, Spesifikasi."
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
                ? 'Harga produk tetap di master. Di bawah ini mengatur stok awal, minimum stok, dan status per varian.'
                : 'Produk tanpa varian memakai stok awal langsung di master produk.'}
          />

          {hasVariantsValue ? (
            <>
              <Form.List name="variants">
                {(fields, { add, remove }) => (
                  <Space direction="vertical" style={{ width: '100%' }} size={12}>
                    {fields.map((field) => (
                      <Card key={field.key} size="small" title={`${variantLabelValue || 'Varian'} ${field.name + 1}`}>
                        <Row gutter={12}>
                          {/* IMS NOTE [GUARDED | identity-safe]: hidden identity field menjaga variantKey lama tetap terkirim saat label varian diganti. Hubungan flow: variantKey adalah bucket stok/reference transaksi. STATUS: AKTIF. */}
                          <Form.Item name={[field.name, 'variantKey']} hidden>
                            <Input />
                          </Form.Item>
                          <Col xs={24} md={6}>
                            <Form.Item {...field} name={[field.name, 'color']} label={`Nama ${variantLabelValue || 'Varian'}`} rules={[{ required: true, message: 'Nama varian wajib diisi' }]}> 
                              <Input placeholder="Contoh: Merah, Ukuran S, Motif Polkadot" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={5}>
                            <Form.Item {...field} name={[field.name, 'sku']} label="SKU Varian">
                              <Input placeholder="Opsional" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={4}>
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
                          <Col xs={24} md={4}>
                            <Form.Item {...field} name={[field.name, 'minStockAlert']} label="Min Stok" initialValue={0}>
                              <InputNumber style={{ width: '100%' }} min={0} step={1} precision={0} parser={parseIntegerIdInput} />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={1}>
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
                  title={hasVariantsValue ? 'Reserved Total' : `Min Stok | Reserved ${formatNumberID(watchedReservedStock)}`}
                  value={hasVariantsValue ? watchedVariants.reduce((sum, item) => sum + Number(item?.reservedStock || 0), 0) : watchedMinStockAlert}
                  formatter={(value) => formatNumberID(value)}
                />
              </Col>
            </Row>
          </Card>
        </Form>
      </Drawer>

      {/* ---------------------------------------------------------------------
          Drawer detail produk.
      --------------------------------------------------------------------- */}
      <Drawer title="Detail Produk" open={detailVisible} onClose={() => setDetailVisible(false)} width={820} destroyOnClose>
        {selectedProduct ? (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Nama Produk">{selectedProduct.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="Kategori">{selectedProduct.category || '-'}</Descriptions.Item>
              <Descriptions.Item label="Harga Jual">{formatCurrencyId(selectedProduct.price)}</Descriptions.Item>
              <Descriptions.Item label="HPP / Unit">{formatCurrencyId(selectedProduct.hppPerUnit)}</Descriptions.Item>
              <Descriptions.Item label="Mode Pricing">{PRICING_MODE_TAGS[selectedProduct.pricingMode || 'manual']}</Descriptions.Item>
              <Descriptions.Item label="Pricing Rule">{pricingRuleMap[selectedProduct.pricingRuleId] || '-'}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag className="ims-status-tag" color={getProductStatusMeta(selectedProduct).color}>{getProductStatusMeta(selectedProduct).label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Update Terakhir">{formatDateId(selectedProduct.updatedAt, true)}</Descriptions.Item>
              <Descriptions.Item label="Deskripsi">{selectedProduct.description || '-'}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title={selectedProduct.hasVariants ? 'Rincian Varian Produk' : 'Rincian Stok Master'}>
              {selectedProduct.hasVariants ? (
                <Table
                  className="ims-table"
                  rowKey={(record, index) => `${selectedProduct.id}-${record.variantKey || record.color || index}`}
                  pagination={false}
                  size="small"
                  dataSource={selectedProduct.variants || []}
                  columns={[
                    {
                      title: selectedProduct.variantLabel || 'Varian',
                      dataIndex: 'color',
                      render: (_, variant, index) => getVariantDisplayLabel(variant, index),
                    },
                    { title: 'SKU', dataIndex: 'sku', render: (value) => value || '-' },
                    { title: 'Stok', dataIndex: 'currentStock', render: (value) => formatStockWithUnit(value || 0) },
                    { title: 'Reserved', dataIndex: 'reservedStock', render: (value) => formatStockWithUnit(value || 0) },
                    {
                      title: 'Tersedia',
                      key: 'availableStock',
                      render: (_, variant) => formatStockWithUnit(
                        Math.max(Number(variant.currentStock || 0) - Number(variant.reservedStock || 0), 0),
                      ),
                    },
                    { title: 'Min Stok', dataIndex: 'minStockAlert', render: (value) => formatStockWithUnit(value || 0) },
                    {
                      title: 'Status',
                      dataIndex: 'isActive',
                      render: (value) => <Tag className="ims-status-tag" color={value === false ? 'default' : 'green'}>{value === false ? 'Nonaktif' : 'Aktif'}</Tag>,
                    },
                  ]}
                />
              ) : (
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="Stok Master">{formatStockWithUnit(selectedProduct.currentStock)}</Descriptions.Item>
                  <Descriptions.Item label="Reserved Stock">{formatStockWithUnit(selectedProduct.reservedStock)}</Descriptions.Item>
                  <Descriptions.Item label="Available Stock">{formatStockWithUnit(selectedProduct.availableStock)}</Descriptions.Item>
                  <Descriptions.Item label="Minimum Stok">{formatStockWithUnit(selectedProduct.minStockAlert)}</Descriptions.Item>
                </Descriptions>
              )}
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </div>
  );
};

export default Products;
