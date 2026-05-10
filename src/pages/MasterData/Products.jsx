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
import StockDisplayBlock from '../../components/Layout/Table/StockDisplayBlock';
import {
  COLOR_VARIANT_MAP,
  ensureAtLeastOneVariant,
} from '../../utils/variants/variantHelpers';
import {
  areAllVariantsStockEmpty,
  getVariantDisplayName,
  isVariantStockEmpty,
} from '../../utils/variants/variantArchiveHelpers';
import {
  createProduct,
  listenProducts,
  PRODUCT_DEFAULT_FORM,
  toggleProductActive,
  updateProduct,
} from '../../services/MasterData/productsService';
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import { showFormValidationFeedback } from '../../utils/forms/formValidationFeedback';
import { buildSinglePricingPreview } from '../../services/Pricing/pricingService';

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
  rule: <Tag color="green">Pricing Rule</Tag>,
};

const getPricingModeDisplayText = (record = {}, pricingRuleMap = {}) => {
  const mode = record?.pricingMode === 'rule' ? 'rule' : 'manual';

  if (mode !== 'rule') {
    return 'Manual';
  }

  const ruleName = pricingRuleMap?.[record?.pricingRuleId];
  return `Pricing Rule${ruleName ? ` | ${ruleName}` : ''}`;
};

// -----------------------------------------------------------------------------
// Builder nilai awal form produk.
// Menjaga form create/edit tetap satu pola dan kompatibel dengan data lama.
// -----------------------------------------------------------------------------
const buildFormValues = (record = {}) => {
  const activeVariants = (Array.isArray(record?.variants) ? record.variants : []).filter((variant) => variant?.isArchived !== true);
  const hasVariants = record?.hasVariants === true || activeVariants.length > 0;

  return {
    ...PRODUCT_DEFAULT_FORM,
    ...record,
    hasVariants,
    variantLabel: record.variantLabel || 'Varian',
    variants: hasVariants ? ensureAtLeastOneVariant(activeVariants) : [],
    currentStock: Number(record.currentStock || record.stock || 0),
    reservedStock: Number(record.reservedStock || 0),
    minStockAlert: Number(record.minStockAlert || 0),
  };
};

// Helper detail drawer: format stok tetap lokal untuk rincian per baris, sementara table utama memakai StockDisplayBlock locked.
const formatStockWithUnit = (value, unit = 'pcs') => `${formatNumberID(value)} ${unit}`;


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

const formatArchivedVariantDate = (value) => value ? formatDateId(value, true) : '-';

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
  const pricingRuleIdValue = Form.useWatch('pricingRuleId', form);
  const hppPerUnitValue = Form.useWatch('hppPerUnit', form);
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
  const stockEditHelpText = 'Ubah stok lewat Stock Management / Stock Adjustment / transaksi resmi.';
  const archivedProductVariants = Array.isArray(editingProduct?.archivedVariants) ? editingProduct.archivedVariants : [];
  const canDisableVariantModeForEditing = isEditingProduct && editingProductHasVariants && areAllVariantsStockEmpty(editingProduct?.variants || []);

  /* =====================================================
  SECTION: Product Variant Mode Switch Guard — GUARDED
  Fungsi:
  - Mengizinkan user klik switch Pakai Varian saat edit, lalu memvalidasi ON/OFF tanpa mengubah stok dari master edit.

  Dipakai oleh:
  - Drawer create/edit Product pada Products.jsx dan guard service productsService.

  Alasan perubahan:
  - Switch tidak boleh disabled permanen. Aktivasi varian item lama aman hanya saat stok master 0, sedangkan deaktivasi varian existing hanya boleh saat semua stok varian 0 dan akan diarsipkan.

  Catatan cleanup:
  - Belum ada.

  Risiko:
  - Jika guard ini dihapus, user bisa mengirim payload yang mencoba menghilangkan bucket stok/reference varian atau memindahkan stok tanpa flow resmi.
  ===================================================== */
  const handleProductVariantModeChange = (checked) => {
    if (!isEditingProduct) {
      if (checked) {
        form.setFieldsValue({
          variants: ensureAtLeastOneVariant(form.getFieldValue('variants') || [], { defaultVariant: DEFAULT_PRODUCT_VARIANT }),
          variantLabel: form.getFieldValue('variantLabel') || 'Varian',
        });
      } else {
        form.setFieldsValue({ variants: [], variantLabel: 'Varian' });
      }
      return;
    }

    if (editingProductHasVariants && !checked) {
      if (!areAllVariantsStockEmpty(editingProduct?.variants || [])) {
        message.warning('Mode varian hanya bisa dimatikan setelah semua varian current/reserved/available stock 0. Nolkan lewat flow resmi dulu.');
        form.setFieldsValue({
          hasVariants: true,
          variantLabel: form.getFieldValue('variantLabel') || editingProduct.variantLabel || 'Varian',
          variants: ensureAtLeastOneVariant(form.getFieldValue('variants') || editingProduct.variants || [], { defaultVariant: DEFAULT_PRODUCT_VARIANT }),
        });
        return;
      }

      message.info('Semua varian stok 0 akan diarsipkan. Varian lama bisa direstore bila dibuat lagi dengan nama/struktur yang sama.');
      form.setFieldsValue({ hasVariants: false, variants: [], variantLabel: 'Varian', currentStock: 0, reservedStock: 0 });
      return;
    }

    if (!editingProductHasVariants && checked && !hasSafeZeroMasterStock(editingProduct)) {
      message.warning('Mode varian tidak bisa diaktifkan karena item masih punya stok. Nolkan stok lewat flow resmi dulu.');
      form.setFieldsValue({ hasVariants: false, variants: [], variantLabel: 'Varian' });
      return;
    }

    if (checked) {
      message.info('Varian baru untuk item lama selalu mulai dari stok 0.');
      form.setFieldsValue({
        hasVariants: true,
        variants: ensureAtLeastOneVariant(form.getFieldValue('variants') || [], { defaultVariant: DEFAULT_PRODUCT_VARIANT }),
        variantLabel: form.getFieldValue('variantLabel') || 'Varian',
        currentStock: 0,
        reservedStock: 0,
      });
    } else {
      form.setFieldsValue({ hasVariants: false, variants: [], variantLabel: 'Varian' });
    }
  };

  const handleRemoveProductVariant = (fieldName, remove) => {
    const currentVariants = form.getFieldValue('variants') || [];
    const targetVariant = currentVariants[fieldName] || {};

    if (isEditingProduct && !isVariantStockEmpty(targetVariant)) {
      message.warning('Varian masih punya current/reserved/available stock. Nolkan lewat Stock Adjustment/transaksi resmi sebelum diarsipkan.');
      return;
    }

    if (isEditingProduct) {
      message.info(`${getVariantDisplayName(targetVariant, 'Varian')} akan dipindahkan ke Arsip Varian setelah disimpan.`);
    }
    remove(fieldName);
  };

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

  const selectedPricingRule = useMemo(
    () => (pricingRules || []).find((item) => item.id === pricingRuleIdValue) || null,
    [pricingRules, pricingRuleIdValue],
  );

  const productRulePreview = useMemo(() => {
    if (pricingModeValue !== 'rule' || !selectedPricingRule) return null;

    return buildSinglePricingPreview(
      {
        ...form.getFieldsValue(),
        pricingMode: 'rule',
        hppPerUnit: hppPerUnitValue || 0,
        price: form.getFieldValue('price') || 0,
      },
      selectedPricingRule,
    );
  }, [form, hppPerUnitValue, pricingModeValue, selectedPricingRule]);

  const productRuleWarning = pricingModeValue === 'rule' && (!productRulePreview || productRulePreview.status !== 'ready')
    ? 'Harga belum bisa dihitung. Cek HPP dan pricing rule.'
    : '';

  /* =====================================================
  SECTION: Auto-preview harga Product dari Pricing Rule — AKTIF
  Fungsi:
  - Mengisi field `price` dari helper pricing existing saat mode rule, rule, dan HPP sudah valid.

  Dipakai oleh:
  - Drawer form Product pada halaman Master Data / Products.

  Alasan perubahan:
  - User perlu melihat harga jual hasil Pricing Rule langsung di form sebelum klik Simpan.

  Catatan cleanup:
  - Belum ada.

  Risiko:
  - Jangan mengganti rumus di sini; semua kalkulasi wajib tetap lewat pricingService agar tidak duplikatif.
  ===================================================== */
  useEffect(() => {
    if (pricingModeValue !== 'rule' || !selectedPricingRule) return;

    const preview = buildSinglePricingPreview(
      {
        ...form.getFieldsValue(),
        pricingMode: 'rule',
        hppPerUnit: hppPerUnitValue || 0,
        price: form.getFieldValue('price') || 0,
      },
      selectedPricingRule,
    );

    const nextPrice = Number(preview?.roundedPrice || 0);

    if (preview?.status === 'ready' && Number.isFinite(nextPrice) && nextPrice >= 0) {
      const currentPrice = Number(form.getFieldValue('price') || 0);
      if (currentPrice !== nextPrice) {
        form.setFieldsValue({ price: nextPrice });
      }
    }
  }, [form, hppPerUnitValue, pricingModeValue, selectedPricingRule]);

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
        : [item.code, item.productCode, item.name, item.category, item.description, ...variantLabels]
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
          <Text type="secondary" className={compactCellClassNames.meta}>{record.code || record.productCode || 'Kode otomatis'}</Text>
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
      width: '34%',
      render: (_, record) => (
        <StockDisplayBlock
          record={record}
          unit="pcs"
          getVariantLabel={getVariantDisplayLabel}
          className={compactCellClassNames.stack}
          metaClassName={compactCellClassNames.meta}
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
            {getPricingModeDisplayText(record, pricingRuleMap)}
          </Text>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: '10%',
      align: 'center',
      render: (_, record) => {
        const statusMeta = getProductStatusMeta(record);
        return <Tag className="ims-status-tag" color={statusMeta.color}>{statusMeta.label}</Tag>;
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

  return (
    <div className="page-container ims-page">
      {/* ---------------------------------------------------------------------
          Header halaman produk.
      --------------------------------------------------------------------- */}
      <PageHeader
        title="Produk Jadi"
        subtitle="Master produk, harga, dan stok."
        actions={[
          { key: 'create-product', type: 'primary', icon: <PlusOutlined />, label: 'Tambah Produk', onClick: openCreateDrawer },
        ]}
      />

      <Alert
        showIcon
        type="info"
        className="ims-page-alert"
        message="Stok varian mengikuti varian aktif."
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
        subtitle="Harga, stok, dan varian."
      >
        <DataRefreshIndicator loading={loading} dataSource={filteredProducts} />
        <Table
          className="ims-table"
          rowKey="id"
          dataSource={filteredProducts}
          columns={columns}
          size="small"
          pagination={{ pageSize: 10 }}
          tableLayout="fixed"
          locale={{
            emptyText: getDataTableEmptyText(loading, <Empty description="Belum ada data produk" />),
          }}
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
            <Col xs={24} md={8}>
              <Form.Item name="code" label="Kode Produk">
                <Input placeholder="Opsional, otomatis: PRD-BG-MWR-FLN" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="name" label="Nama Produk" rules={[{ required: true, message: 'Nama produk wajib diisi.' }]}> 
                <Input placeholder="Contoh: Bunga Mawar Flanel" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
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
          <Form.Item name="pricingMode" hidden>
            <Input />
          </Form.Item>
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
                  SECTION: Switch pricing mode Product — AKTIF
                  Fungsi:
                  - Mengubah pilihan harga jual Product dari select Manual/Rule menjadi switch yang lebih mudah dipahami.

                  Dipakai oleh:
                  - Drawer form Product pada halaman Master Data / Products.

                  Alasan perubahan:
                  - User perlu memahami bahwa OFF berarti harga manual, sedangkan ON berarti wajib pilih Pricing Rule.

                  Catatan cleanup:
                  - Belum ada.

                  Risiko:
                  - Jangan mengubah nilai field `pricingMode`; service tetap mengharapkan `manual` atau `rule`.
              ===================================================== */}
              <Form.Item
                label="Gunakan Pricing Rule"
                extra={pricingModeValue === 'rule'
                  ? 'Harga dihitung dari rule jika HPP valid.'
                  : 'Harga jual diisi manual.'}
              >
                <Switch
                  checked={pricingModeValue === 'rule'}
                  checkedChildren="Rule"
                  unCheckedChildren="Manual"
                  onChange={(checked) => {
                    form.setFieldsValue({
                      pricingMode: checked ? 'rule' : 'manual',
                      pricingRuleId: checked ? form.getFieldValue('pricingRuleId') : null,
                    });
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="price"
                label="Harga Jual"
                rules={[{ required: true, message: 'Harga jual wajib diisi.' }]}
                extra={pricingModeValue === 'rule' ? 'Terisi dari rule jika HPP valid.' : undefined}
              > 
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
            extra={pricingModeValue === 'rule' ? 'Wajib saat rule aktif.' : 'Tidak dipakai untuk harga manual.'}
          >
            <Select
              allowClear
              disabled={pricingModeValue !== 'rule'}
              placeholder={pricingModeValue === 'rule' ? 'Pilih pricing rule' : 'Manual: pricing rule tidak dipakai'}
              options={(pricingRules || []).map((item) => ({
                value: item.id,
                label: `${item.name}${item?.isActive ? '' : ' (Nonaktif)'}`,
              }))}
            />
          </Form.Item>

          {productRuleWarning ? (
            <Alert
              style={{ marginBottom: 16 }}
              type="warning"
              showIcon
              message={productRuleWarning}
            />
          ) : null}

          {/* IMS NOTE [GUARDED | behavior-preserving]: section stok tetap tampil untuk konteks,
              tetapi input stok dikunci saat edit agar payload master tidak menjadi jalur mutasi stok. */}
          <Divider orientation="left">Mode Stok</Divider>
          <Form.Item
            name="hasVariants"
            label="Pakai Varian"
            valuePropName="checked"
            extra={isEditingProduct
              ? editingProductHasVariants
                ? canDisableVariantModeForEditing
                  ? 'Bisa dimatikan jika semua stok varian 0.'
                  : 'Bisa dimatikan jika semua stok varian 0.'
                : canActivateVariantsForEditing
                  ? 'Boleh aktifkan varian. Stok varian baru mulai dari 0.'
                  : 'Bisa diaktifkan setelah stok master 0.'
              : undefined}
          >
            <Switch
              checkedChildren="Ya"
              unCheckedChildren="Tidak"
              onChange={handleProductVariantModeChange}
            />
          </Form.Item>

          {hasVariantsValue ? (
            <Form.Item
              name="variantLabel"
              label="Label Varian"
              extra="Contoh: Warna atau Ukuran."
            >
              <Input placeholder="Contoh: Warna" />
            </Form.Item>
          ) : null}

          <Alert
            type={isEditingProduct ? 'info' : 'warning'}
            showIcon
            style={{ marginBottom: 16 }}
            message={isEditingProduct
              ? editingProductHasVariants
                ? 'Metadata varian bisa diedit. Mode varian bisa OFF jika semua stok varian 0.'
                : canActivateVariantsForEditing
                  ? 'Boleh aktifkan varian. Stok varian baru mulai dari 0.'
                  : stockEditHelpText
              : hasVariantsValue
                ? 'Harga dan minimum stok tetap di master.'
                : 'Stok dan minimum stok memakai master.'}
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
              - `variants[].minStockAlert` adalah legacy-compat; user tidak lagi mengisi min stock per varian.

              Catatan cleanup:
              - field legacy varian dapat diaudit pada batch maintenance terpisah tanpa migrasi otomatis di UI ini.

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

              {isEditingProduct && archivedProductVariants.length > 0 ? (
                <Card size="small" title="Arsip Varian" style={{ marginBottom: 16 }}>
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Text type="secondary">Varian arsip tidak muncul di transaksi baru. Buat lagi untuk restore.</Text>
                    {archivedProductVariants.map((variant, index) => (
                      <Tag key={`${variant.variantKey || variant.color || index}-archived`} color="default">
                        {getVariantDisplayName(variant, `Varian ${index + 1}`)} • diarsipkan {formatArchivedVariantDate(variant.archivedAt)}
                      </Tag>
                    ))}
                  </Space>
                </Card>
              ) : null}

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
                              extra={isEditingProduct ? 'Reserved dikunci saat edit.' : undefined}
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
                          onClick={() => handleRemoveProductVariant(field.name, remove)}
                        >
                          Arsipkan Varian
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
                <Form.Item name="reservedStock" label="Reserved Stock" extra={isEditingProduct ? 'Reserved dikunci saat edit.' : undefined}>
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
                  <Descriptions.Item label="Mode Pricing">
                    <Space size={6} wrap>
                      {PRICING_MODE_TAGS[selectedProduct.pricingMode || 'manual']}
                      <Text>{getPricingModeDisplayText(selectedProduct, pricingRuleMap)}</Text>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="Pricing Rule">{pricingRuleMap[selectedProduct.pricingRuleId] || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Minimum Stok">{formatStockWithUnit(selectedProduct.minStockAlert)}</Descriptions.Item>
                  <Descriptions.Item label="Update Terakhir">{formatDateId(selectedProduct.updatedAt, true)}</Descriptions.Item>
                </Descriptions>
              </Card>

              <Card size="small" title={selectedProduct.hasVariants ? 'Varian Produk' : 'Stok Master'}>
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

              {Array.isArray(selectedProduct.archivedVariants) && selectedProduct.archivedVariants.length > 0 ? (
                <Card size="small" title="Arsip Varian">
                  <Table
                    className="ims-table"
                    rowKey={(record, index) => `${selectedProduct.id}-archived-${record.variantKey || record.color || index}`}
                    pagination={false}
                    size="small"
                    dataSource={selectedProduct.archivedVariants}
                    columns={[
                      { title: selectedProduct.variantLabel || 'Varian', render: (_, variant, index) => getVariantDisplayName(variant, `Varian ${index + 1}`) },
                      { title: 'SKU', dataIndex: 'sku', render: (value) => value || '-' },
                      { title: 'Diarsipkan', dataIndex: 'archivedAt', render: (value) => formatArchivedVariantDate(value) },
                      { title: 'Alasan', dataIndex: 'archiveReason', render: (value) => value || '-' },
                    ]}
                  />
                </Card>
              ) : null}

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
