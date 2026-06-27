import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { formatNumberId } from '../../utils/formatters/numberId';
import { formatCurrencyId } from '../../utils/formatters/currencyId';
import { formatDateId } from '../../utils/formatters/dateId';
import FilterBar from '../../components/Layout/Filters/FilterBar';
import PageHeader from '../../components/Layout/Page/PageHeader';
import PageSection from '../../components/Layout/Page/PageSection';
import SummaryStatGrid from '../../components/Layout/Display/SummaryStatGrid';
import StockDisplayBlock from '../../components/Layout/Table/StockDisplayBlock';
import ImsNotice from '../../components/Layout/Feedback/ImsNotice';
import InfoPopoverButton from '../../components/Layout/Feedback/InfoPopoverButton';
import {
  createRawMaterial,
  listenRawMaterials,
  RAW_MATERIAL_DEFAULT_FORM,
  toggleRawMaterialActive,
  updateRawMaterial,
} from '../../services/MasterData/rawMaterialsService';
import { getSupplierDisplayName } from '../../services/MasterData/suppliersService';
import { listSuppliers as listSupplierRepository } from '../../data/repositories/suppliersRepository';
import { listCategories } from '../../data/repositories/categoriesRepository';
import { CATEGORY_TYPES } from '../../constants/categoryOptions';
import { buildCategorySelectOptions, resolveCategoryLabel } from '../../utils/categories/categoryHelpers';
import {
  DEFAULT_RAW_MATERIAL_VARIANT,
  ensureAtLeastOneRawMaterialVariant,
} from '../../utils/variants/rawMaterialVariantHelpers';
import DataTableView from "../../components/Layout/Table/DataTableView";
import MobileDetailDrawer from '../../components/Layout/Mobile/MobileDetailDrawer';
import ResponsiveFormSection from '../../components/Layout/Mobile/ResponsiveFormSection';
import MasterRecordActions from './components/MasterRecordActions';
import { buildMasterRecordMobileActions } from './components/masterRecordActionHelpers';
import { isVariantStockEmpty } from '../../utils/variants/variantArchiveHelpers';

import { listenPurchaseRecords } from '../../services/Transaksi/purchasesService';
import { showFormValidationFeedback } from '../../utils/forms/formValidationFeedback';
import { compareRecordsByNameAsc, upsertRecordById } from '../../utils/state/recordCollectionState';
import { buildSinglePricingPreview, listPricingRulesByTargetType } from '../../services/Pricing/pricingService';
import PricingModeSwitch from '../../components/Pricing/PricingModeSwitch';
import {
  RAW_MATERIAL_PURCHASE_LOOKUP_LIMIT,
  buildFormValues,
  buildSupplierDetailRoute,
  compactCellStyles,
  formatStockWithUnit,
  getLatestPurchaseForMaterial,
  getPurchaseProductLink,
  getRawMaterialStatusMeta,
  getRawMaterialStockSummary,
  getRuleModeLabel,
  getActiveSupplierOffersForMaterial,
  getRawMaterialMinimumStockDisplay,
  getSupplierCatalogSummaryForMaterial,
  getVariantMinimumStock,
  hasSafeZeroMasterStock,
  integerParser,
  resolveRestockSupplierDisplay,
  unitOptions,
} from './helpers/rawMaterialsPageHelpers';


const { Option } = Select;
const { Text } = Typography;

const RawMaterials = () => {
  // ---------------------------------------------------------------------------
  // State utama data dan tampilan halaman.
  // ---------------------------------------------------------------------------
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [purchaseRecords, setPurchaseRecords] = useState([]);
  const [pricingRules, setPricingRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [pricingPreviewWarning, setPricingPreviewWarning] = useState('');

  // ---------------------------------------------------------------------------
  // State filter agar layout raw materials sejalan dengan semi finished.
  // ---------------------------------------------------------------------------
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [variantModeFilter, setVariantModeFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [form] = Form.useForm();
  const navigate = useNavigate();

  // GUARDED: mode edit master hanya boleh mengubah metadata non-stok.
  // ALASAN: stok Raw Material setelah create wajib lewat purchases, Stock Adjustment, atau transaksi resmi agar inventory log tetap sinkron.
  // STATUS: AKTIF untuk mengunci field stok di UI; service update tetap menjadi guard utama.
  // IMS NOTE [GUARDED | behavior-preserving]: flag edit dipakai untuk mengunci stok dan mode varian.
  // Hubungan flow: raw material stock harus berubah lewat purchase, adjustment, atau transaksi resmi.
  const isEditingMaterial = Boolean(editingRecord?.id);
  const editingMaterialHasVariants = Boolean(editingRecord?.hasVariants || (editingRecord?.variants || []).length > 0);
  const canActivateVariantsForEditing = isEditingMaterial && !editingMaterialHasVariants && hasSafeZeroMasterStock(editingRecord);
  const hasVariantModeSwitchLocked = isEditingMaterial && !canActivateVariantsForEditing;
  const isGuardedVariantStock = (fieldName) => {
    if (!isEditingMaterial) return false;
    const variant = form.getFieldValue(['variants', fieldName]) || {};
    return Boolean(variant.variantKey) && !isVariantStockEmpty(variant);
  };
  const stockEditHelpText = 'Ubah stok lewat Stock Management / Stock Adjustment / transaksi resmi.';

  // ---------------------------------------------------------------------------
  // Navigasi internal aplikasi.
  // FUNGSI: dipakai tombol Lihat Supplier Lain dari drawer detail Raw Material.
  // ALASAN: aplikasi memakai HashRouter, jadi internal route harus memakai
  // React Router agar tidak keluar dari hash route dan memicu white screen.
  // STATUS: aktif dipakai untuk navigasi UI; bukan logic data dan bukan kandidat cleanup.
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Watcher form dipakai untuk preview ringkasan varian secara realtime.
  // ---------------------------------------------------------------------------
  const pricingModeValue = Form.useWatch('pricingMode', form);
  const pricingRuleIdValue = Form.useWatch('pricingRuleId', form);
  const watchedRestockReferencePrice = Form.useWatch('restockReferencePrice', form);
  const watchedAverageActualUnitCost = Form.useWatch('averageActualUnitCost', form);
  const hasVariantsValue = Form.useWatch('hasVariants', form);
  const variantLabelValue = Form.useWatch('variantLabel', form);
  const watchedVariants = Form.useWatch('variants', form);

  // ---------------------------------------------------------------------------
  // Loader data master.
  // Semua source of truth tetap datang dari service database lokal.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setLoading(true);

    const unsubMaterials = listenRawMaterials(
      (data) => {
        setMaterials(data);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        message.error('Gagal memuat bahan baku.');
        setLoading(false);
      },
    );

    const unsubPurchases = listenPurchaseRecords(
      (data) => {
        // AKTIF/GUARDED: histori pembelian tetap dibaca dari service purchase aktual.
        // C1-C8 belum menjadikan transaksi purchase sebagai database lokal writer, jadi jangan ambil dari adapter transaksi database lokal placeholder.
        setPurchaseRecords((data || []).slice(0, RAW_MATERIAL_PURCHASE_LOOKUP_LIMIT));
      },
      (error) => {
        console.error(error);
        message.warning('Histori pembelian belum bisa dimuat. Data bahan baku tetap bisa dibuka.');
      },
    );

    let disposed = false;

    const loadSqliteCompanions = async () => {
      try {
        const [supplierRows, categoryRows, pricingRuleRows] = await Promise.all([
          listSupplierRepository(),
          listCategories({ type: CATEGORY_TYPES.RAW_MATERIAL_GROUP }),
          listPricingRulesByTargetType('raw_materials'),
        ]);
        if (disposed) return;
        // -------------------------------------------------------------------
        // Supplier dibaca dari repository boundary. Dalam mode database lokal, ini C1
        // master-only dan tidak memutasi purchase/raw/stock.
        // Histori purchase tetap lewat purchasesService agar tidak mismatch dengan data transaksi aktif.
        // -------------------------------------------------------------------
        setSuppliers(supplierRows);
        setCategories(categoryRows);
        setPricingRules(pricingRuleRows);
      } catch (error) {
        console.error(error);
        message.warning('Supplier/aturan harga belum lengkap. Bahan Baku tetap bisa dimuat.');
      }
    };

    loadSqliteCompanions();

    return () => {
      disposed = true;
      unsubMaterials();
      unsubPurchases();
    };
  }, []);


  const categorySelectOptions = useMemo(
    () => buildCategorySelectOptions(categories, CATEGORY_TYPES.RAW_MATERIAL_GROUP),
    [categories],
  );
  const resolveMaterialCategoryLabel = useCallback((record = {}) => resolveCategoryLabel({
    categoryId: record.categoryId,
    categories,
    fallback: record.category || record.categoryName,
  }), [categories]);

  const pricingRuleMap = useMemo(() => (pricingRules || []).reduce((acc, item) => {
    acc[item.id] = item.name;
    return acc;
  }, {}), [pricingRules]);

  const selectedPricingRule = useMemo(
    () => (pricingRules || []).find((item) => item.id === pricingRuleIdValue) || null,
    [pricingRules, pricingRuleIdValue],
  );

  /* =====================================================
  SECTION: Raw Material pricing rule switch preview — AKTIF / GUARDED
  Fungsi:
  - Mengisi preview/form harga jual Raw Material saat user mengaktifkan Pricing Rule dan base cost + rule cukup.

  Dipakai oleh:
  - Drawer tambah/edit Raw Materials.

  Alasan perubahan:
  - Mode pricing memakai Switch yang konsisten dengan Product dan tetap memakai helper pricingService.

  Catatan cleanup:
  - Belum ada. Harga hanya masuk form, bukan auto-save database.

  Risiko:
  - Jangan mengubah sumber cost raw material; averageActualUnitCost/restockReferencePrice tetap mengikuti rule existing.
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
        id: editingRecord?.id || 'form-raw-material',
        name: form.getFieldValue('name') || editingRecord?.name || 'Bahan Baku',
        pricingMode: 'rule',
        sellingPrice: form.getFieldValue('sellingPrice') || 0,
        restockReferencePrice: watchedRestockReferencePrice || 0,
        averageActualUnitCost: watchedAverageActualUnitCost || 0,
      },
      selectedPricingRule,
    );

    if (preview?.status === 'ready' && Number(preview.roundedPrice || 0) >= 0) {
      form.setFieldsValue({ sellingPrice: preview.roundedPrice });
      setPricingPreviewWarning('');
      return;
    }

    setPricingPreviewWarning('Harga belum bisa dihitung. Isi modal aktual rata-rata atau harga referensi restock.');
  }, [pricingModeValue, selectedPricingRule, watchedRestockReferencePrice, watchedAverageActualUnitCost, editingRecord, form]);

  // ---------------------------------------------------------------------------
  // Ringkasan card atas halaman.
  // Fokus pada metrik yang paling kepakai saat operasional harian.
  // ---------------------------------------------------------------------------
  const summary = useMemo(() => {
    const active = materials.filter((item) => item.isActive !== false);
    const empty = active.filter((item) => getRawMaterialStatusMeta(item).label === 'Kosong').length;
    const lowStock = active.filter((item) => getRawMaterialStatusMeta(item).label === 'Stok Rendah').length;
    const withoutRestockSource = active.filter(
      (item) => getSupplierCatalogSummaryForMaterial(suppliers, item.id).offerCount === 0,
    ).length;

    return { active: active.length, empty, lowStock, withoutRestockSource };
  }, [materials, suppliers]);

  const summaryItems = [
    { key: 'raw-active', title: 'Bahan Aktif', value: summary.active, subtitle: 'Master bahan baku yang siap dipakai.', accent: 'primary' },
    { key: 'raw-low', title: 'Perlu Restock', value: summary.lowStock, subtitle: 'Bahan yang mendekati minimum stok.', accent: 'warning' },
    { key: 'raw-empty', title: 'Stok Kosong', value: summary.empty, subtitle: 'Bahan aktif yang stoknya sudah habis.', accent: 'default' },
    { key: 'raw-source', title: 'Belum Ada Sumber', value: summary.withoutRestockSource, subtitle: 'Belum terhubung ke katalog Supplier.', accent: 'success' },
  ];

  // ---------------------------------------------------------------------------
  // Ringkasan realtime isi form saat mode varian aktif.
  // ---------------------------------------------------------------------------
  const variantStats = useMemo(() => {
    if (!Array.isArray(watchedVariants) || watchedVariants.length === 0) {
      return { count: 0, stock: 0, minimumStock: 0 };
    }

    return watchedVariants.reduce(
      (acc, item) => ({
        count: acc.count + (String(item?.name || '').trim() ? 1 : 0),
        stock: acc.stock + Number(item?.currentStock || 0),
        minimumStock: acc.minimumStock + getVariantMinimumStock(item, 0),
      }),
      { count: 0, stock: 0, minimumStock: 0 },
    );
  }, [watchedVariants]);

  // ---------------------------------------------------------------------------
  // Restock inline untuk drawer detail.
  // FUNGSI: menyiapkan supplier utama dan purchase terakhir untuk bahan yang
  // sedang dibuka tanpa menampilkan section/list supplier terpisah di drawer.
  // ALASAN: detail bahan harus tetap ringkas; daftar supplier lengkap cukup
  // dibuka melalui tombol Lihat Supplier.
  // STATUS: aktif dipakai; read-only dan tidak mengubah Raw Material, Supplier,
  // Purchases, stok, kas, saving, atau laporan.
  // ---------------------------------------------------------------------------
  const detailLatestPurchase = useMemo(
    () => getLatestPurchaseForMaterial(purchaseRecords, selectedMaterial?.id),
    [purchaseRecords, selectedMaterial?.id],
  );

  const detailLatestPurchaseLink = useMemo(
    () => getPurchaseProductLink(detailLatestPurchase, selectedMaterial?.id),
    [detailLatestPurchase, selectedMaterial?.id],
  );

  const detailRestockSupplier = useMemo(
    () => resolveRestockSupplierDisplay(detailLatestPurchase, suppliers, {}),
    [detailLatestPurchase, suppliers],
  );

  // ---------------------------------------------------------------------------
  // Filter list utama.
  // Search dibuat ringan supaya user cepat cari bahan, supplier, atau nama varian.
  // ---------------------------------------------------------------------------
  const filteredMaterials = useMemo(() => materials.filter((item) => {
    const keyword = search.trim().toLowerCase();
    const statusMeta = getRawMaterialStatusMeta(item);
    const variantNames = Array.isArray(item.variants)
      ? item.variants.map((variant) => String(variant?.name || '').toLowerCase())
      : [];
    const supplierOffers = getActiveSupplierOffersForMaterial(suppliers, item.id);

    const matchesSearch = !keyword
      ? true
      : [
          item.name,
          resolveMaterialCategoryLabel(item),
          item.variantLabel,
          item.specifications,
          item.notes,
          ...variantNames,
          ...supplierOffers.flatMap((offer) => [offer.supplierName, offer.listingName, offer.channel]),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword));

    const matchesStatus = statusFilter === 'all' ? true : statusMeta.label === statusFilter;
    const matchesVariantMode =
      variantModeFilter === 'all'
        ? true
        : variantModeFilter === 'variant'
          ? item.hasVariants === true
          : item.hasVariants !== true;
    const matchesCategory = categoryFilter === 'all'
      ? true
      : String(item.categoryId || '') === String(categoryFilter);
    const matchesSupplier = supplierFilter === 'all'
      ? true
      : supplierOffers.some((offer) => String(offer.supplierId) === String(supplierFilter));

    return matchesSearch && matchesStatus && matchesVariantMode && matchesCategory && matchesSupplier;
  }), [materials, search, statusFilter, variantModeFilter, supplierFilter, categoryFilter, suppliers, resolveMaterialCategoryLabel]);

  // ---------------------------------------------------------------------------
  // Handler buka drawer form create.
  // ---------------------------------------------------------------------------
  const openCreateDrawer = () => {
    setEditingRecord(null);
    setPricingPreviewWarning('');
    form.setFieldsValue(buildFormValues(RAW_MATERIAL_DEFAULT_FORM));
    setFormVisible(true);
  };

  // ---------------------------------------------------------------------------
  // Handler tutup drawer form.
  // Form di-reset agar saat buka lagi tidak membawa state lama.
  // ---------------------------------------------------------------------------
  const closeFormDrawer = () => {
    setFormVisible(false);
    setSubmitting(false);
    setEditingRecord(null);
    setPricingPreviewWarning('');
    form.resetFields();
  };

  // ---------------------------------------------------------------------------
  // Handler edit.
  // ---------------------------------------------------------------------------
  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue(buildFormValues(record));
    setFormVisible(true);
  };

  // ---------------------------------------------------------------------------
  // Handler buka detail.
  // ---------------------------------------------------------------------------
  const handleViewDetail = (record) => {
    setSelectedMaterial(record);
    setDetailVisible(true);
  };

  // ---------------------------------------------------------------------------
  // Handler aktif/nonaktif bahan baku.
  // Data master tidak dihapus agar histori stok dan log transaksi tetap aman.
  // ---------------------------------------------------------------------------
  const handleToggleActive = async (record) => {
    if (record.isActive !== false && !hasSafeZeroMasterStock(record)) {
      message.error('Bahan masih memiliki stok atau reserved stock. Selesaikan melalui flow stok resmi sebelum dinonaktifkan.');
      return;
    }

    try {
      const savedMaterial = await toggleRawMaterialActive(record.id, record.isActive === false);
      setMaterials((current) => upsertRecordById(current, savedMaterial, {
        comparator: compareRecordsByNameAsc,
      }));
      message.success(`Bahan baku berhasil ${record.isActive === false ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (error) {
      console.error(error);
      message.error(error?.message || 'Gagal mengubah status bahan baku.');
    }
  };

  // ---------------------------------------------------------------------------
  // Submit create/update bahan baku.
  // Supplier dan link restock dikelola melalui Supplier Catalog, bukan disimpan sebagai pilihan tunggal di master bahan.
  // ---------------------------------------------------------------------------
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const savedMaterial = editingRecord?.id
        ? await updateRawMaterial(editingRecord.id, values, categories, {
          expectedVersion: editingRecord.versionToken || editingRecord.updatedAt || '',
        })
        : await createRawMaterial(values, categories);

      setMaterials((current) => upsertRecordById(current, savedMaterial, {
        comparator: compareRecordsByNameAsc,
      }));
      message.success(editingRecord?.id ? 'Bahan baku berhasil diupdate.' : 'Bahan baku berhasil ditambahkan.');

      closeFormDrawer();
    } catch (error) {
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
      message.error(error?.message || 'Gagal menyimpan bahan baku.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Kolom tabel utama Raw Materials.
  // FUNGSI: menjaga table tetap 4 kolom inti (Bahan, Stok, Harga, Aksi).
  // ALASAN: status dipindahkan ke kolom Bahan dan fixed action dihapus agar area
  // aksi tidak transparan/tembus serta tidak memaksa horizontal scroll desktop.
  // STATUS: aktif dipakai untuk UI list; handler detail/edit/nonaktif tetap sama
  // sehingga tidak menyentuh stok, supplier manual, atau flow transaksi.
  // ---------------------------------------------------------------------------
  const columns = [
    {
      title: 'Bahan Baku',
      dataIndex: 'name',
      key: 'name',
      width: 300,
      render: (value, record) => {
        const statusMeta = getRawMaterialStatusMeta(record);
        return (
          <div style={compactCellStyles.stack}>
            <Text strong>{value || '-'}</Text>
            <Text type="secondary" style={compactCellStyles.meta}>
              {resolveMaterialCategoryLabel(record)} · {record.stockUnit || '-'}
            </Text>
            {record.specifications ? (
              <Text type="secondary" ellipsis style={compactCellStyles.meta}>{record.specifications}</Text>
            ) : null}
            <Space size={6} wrap>
              <Tag color={record.hasVariants ? 'blue' : 'default'}>
                {record.hasVariants ? `${formatNumberId(record.variantCount || 0)} varian` : 'Tanpa Varian'}
              </Tag>
              <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
            </Space>
          </div>
        );
      },
    },
    {
      title: 'Stok',
      key: 'stock',
      width: 330,
      render: (_, record) => (
        <StockDisplayBlock
          record={record}
          unit={record.stockUnit || 'pcs'}
          getVariantLabel={(variant, index) => variant.name || `Varian ${index + 1}`}
          getVariantMinStockThreshold={(variant) => getVariantMinimumStock(variant, record.minStock || 0)}
          className="ims-cell-stack ims-cell-stack-tight"
          metaClassName="ims-cell-meta"
          minStockThreshold={Number(record.minStock || 0)}
        />
      ),
    },
    {
      title: 'Sumber Restock',
      key: 'restockSources',
      width: 210,
      render: (_, record) => {
        const catalogSummary = getSupplierCatalogSummaryForMaterial(suppliers, record.id);
        return (
          <div style={compactCellStyles.stack}>
            <Text strong>{catalogSummary.label}</Text>
            <Text type="secondary" style={compactCellStyles.meta}>
              {catalogSummary.offerCount > 0 ? 'Katalog Supplier aktif' : 'Tambahkan link toko untuk restock'}
            </Text>
            <Button
              type="link"
              size="small"
              style={{ paddingInline: 0, width: 'fit-content' }}
              onClick={() => navigate(buildSupplierDetailRoute(record.id))}
            >
              {catalogSummary.offerCount > 0 ? 'Bandingkan Supplier' : 'Atur Sumber Restock'}
            </Button>
          </div>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 170,
      className: 'app-table-action-column',
      render: (_, record) => (
        <MasterRecordActions
          record={record}
          onDetail={handleViewDetail}
          onEdit={handleEdit}
          onToggle={handleToggleActive}
          toggleTitle={record.isActive === false ? 'Aktifkan kembali bahan baku?' : 'Nonaktifkan bahan baku?'}
          toggleDescription={record.isActive === false
            ? 'Bahan baku akan aktif kembali untuk dipakai pada transaksi baru.'
            : 'Penonaktifan hanya dapat dilakukan jika stok, reserved stock, BOM aktif, dan proses produksi sudah aman.'}
        />
      ),
    },
  ];

  const rawMaterialMobileCardConfig = {
    density: 'compact',
    title: (record) => record.name || '-',
    subtitle: (record) => [resolveMaterialCategoryLabel(record), record.stockUnit || '-'],
    primary: (record) => {
      const stockSummary = getRawMaterialStockSummary(record);
      return `${formatStockWithUnit(stockSummary.availableStock, record.stockUnit || 'pcs')} tersedia`;
    },
    secondary: (record) => getSupplierCatalogSummaryForMaterial(suppliers, record.id).label,
    tags: (record) => {
      const statusMeta = getRawMaterialStatusMeta(record);
      return [<Tag key="status" color={statusMeta.color}>{statusMeta.label}</Tag>];
    },
    meta: [
      { label: 'Minimum', value: (record) => formatStockWithUnit(getRawMaterialMinimumStockDisplay(record), record.stockUnit || 'pcs') },
      { label: 'Varian', value: (record) => (record.hasVariants ? `${formatNumberId(record.variantCount || 0)} varian` : 'Tidak') },
    ],
    onCardClick: (record) => handleViewDetail(record),
    primaryActions: (record) => buildMasterRecordMobileActions({
      record,
      onDetail: handleViewDetail,
      onEdit: handleEdit,
      onToggle: handleToggleActive,
    }).primaryActions,
    moreActions: (record) => buildMasterRecordMobileActions({
      record,
      onDetail: handleViewDetail,
      onEdit: handleEdit,
      onToggle: handleToggleActive,
    }).moreActions,
  };

  return (
    <div className="page-container">
      {/* ---------------------------------------------------------------------
          Header halaman utama.
          Layout dibuat sama arah visualnya dengan halaman master lain.
      --------------------------------------------------------------------- */}
      <PageHeader
        title="Bahan Baku"
        subtitle="Master bahan baku, stok, sumber restock, dan status pemakaian."
        actions={[
          { key: 'create-raw-material', type: 'primary', icon: <PlusOutlined />, label: 'Tambah Bahan Baku', onClick: openCreateDrawer },
        ]}
      />


      {/* ---------------------------------------------------------------------
          Summary cards atas halaman.
      --------------------------------------------------------------------- */}
      <SummaryStatGrid items={summaryItems} />

      {/* ---------------------------------------------------------------------
          Filter bar utama.
      --------------------------------------------------------------------- */}
      <FilterBar>
          <Col xs={24} md={6}>
            <Input
              allowClear
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari bahan, kelompok, supplier, atau varian..."
            />
          </Col>
          <Col xs={24} md={4}>
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: '100%' }}>
              <Option value="all">Semua Status</Option>
              <Option value="Aman">Aman</Option>
              <Option value="Stok Rendah">Stok Rendah</Option>
              <Option value="Kosong">Kosong</Option>
              <Option value="Nonaktif">Nonaktif</Option>
            </Select>
          </Col>
          <Col xs={24} md={4}>
            <Select value={variantModeFilter} onChange={setVariantModeFilter} style={{ width: '100%' }}>
              <Option value="all">Semua Varian</Option>
              <Option value="variant">Pakai Varian</Option>
              <Option value="single">Tanpa Varian</Option>
            </Select>
          </Col>
          <Col xs={24} md={5}>
            <Select value={categoryFilter} onChange={setCategoryFilter} style={{ width: '100%' }}>
              <Option value="all">Semua Kelompok Bahan</Option>
              {categorySelectOptions.map((item) => (
                <Option key={item.value} value={item.value} disabled={item.disabled}>{item.label}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={5}>
            <Select value={supplierFilter} onChange={setSupplierFilter} style={{ width: '100%' }} showSearch optionFilterProp="children">
              <Option value="all">Semua Supplier</Option>
              {(suppliers || []).map((supplier) => (
                <Option key={supplier.id} value={supplier.id}>
                  {getSupplierDisplayName(supplier)}
                </Option>
              ))}
            </Select>
          </Col>
      </FilterBar>

      {/* ---------------------------------------------------------------------
          Tabel utama daftar bahan baku.
          FUNGSI: memakai class standar app-data-table dan tableLayout fixed agar
          surface table solid, kolom aksi tidak sticky/transparan, serta desktop
          normal tidak perlu geser horizontal.
          ALASAN: bug UI sebelumnya muncul dari scroll x besar dan fixed action.
          STATUS: aktif dipakai; hanya presentasi UI, tidak mengubah handler data.
      --------------------------------------------------------------------- */}
      <PageSection
        title="Daftar Bahan Baku"
        subtitle="Stok, sumber restock, dan varian bahan."
        extra={(
          <InfoPopoverButton
            label="Aturan Varian"
            title="Aturan varian bahan baku"
            description="Gunakan varian hanya untuk bahan yang memang memiliki turunan stok nyata, misalnya warna, ukuran, atau tipe yang perlu dilacak terpisah."
            items={[
              { label: 'Pakai varian', value: 'Jika stok tiap turunan harus dipantau.' },
              { label: 'Tanpa varian', value: 'Jika bahan cukup dicatat sebagai stok master.' },
              { label: 'Update stok', value: 'Tetap melalui flow stok resmi.' },
            ]}
          />
        )}
      >
        <DataTableView
          loading={loading}
          className="app-data-table"
          rowKey="id"
          dataSource={filteredMaterials}
          columns={columns}
          size="small"
          tableLayout="fixed"
          pagination={{ pageSize: 10 }}
          emptyText={<Empty description="Belum ada data bahan baku" />}
          mobileCardConfig={rawMaterialMobileCardConfig}
        />
      </PageSection>

      {/* ---------------------------------------------------------------------
          Drawer form create/edit.
          Ukuran drawer disamakan arah visualnya dengan halaman produk.
      --------------------------------------------------------------------- */}
      <Drawer
        title={editingRecord ? 'Edit Bahan Baku' : 'Tambah Bahan Baku'}
        open={formVisible}
        onClose={closeFormDrawer}
        width={860}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={closeFormDrawer}>Batal</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              Simpan
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={buildFormValues(RAW_MATERIAL_DEFAULT_FORM)}>
          <ResponsiveFormSection
            title="Data Bahan Baku"
            subtitle="Atur identitas, struktur stok, modal, harga, dan varian. Sumber restock dikelola dari katalog Supplier."
          >
            <Divider orientation="left">Informasi Bahan</Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="name"
                  label="Nama Bahan Baku"
                  rules={[{ required: true, message: 'Nama bahan baku wajib diisi.' }]}
                >
                  <Input placeholder="Contoh: Kain Flanel" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="categoryId"
                  label="Kelompok Bahan"
                  rules={[{ required: true, message: 'Kelompok bahan wajib dipilih.' }]}
                  extra="Kelompok bahan, bukan satuan beli atau warna varian."
                >
                  <Select
                    placeholder="Pilih kelompok bahan"
                    options={categorySelectOptions}
                    notFoundContent="Tambahkan Kelompok Bahan dari menu Kategori & Kelompok."
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="stockUnit"
                  label="Satuan Stok"
                  rules={[{ required: true, message: 'Satuan stok wajib dipilih.' }]}
                >
                  <Select placeholder="Pilih satuan">
                    {unitOptions.map((unit) => (
                      <Option key={unit} value={unit}>{unit}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="hasVariants"
                  label="Pakai Varian"
                  valuePropName="checked"
                  extra={isEditingMaterial
                    ? canActivateVariantsForEditing
                      ? 'Bahan lama dengan stok 0 boleh mulai memakai varian. Stok varian baru tetap 0.'
                      : 'Mode varian dikunci setelah bahan dibuat agar identitas stok tetap aman.'
                    : 'Aktifkan untuk warna, ukuran, atau tipe yang stoknya perlu dipantau terpisah.'}
                >
                  <Switch
                    checkedChildren="Ya"
                    unCheckedChildren="Tidak"
                    disabled={hasVariantModeSwitchLocked}
                    onChange={(checked) => {
                      if (hasVariantModeSwitchLocked) return;
                      if (checked) {
                        form.setFieldsValue({
                          stock: 0,
                          minStock: 0,
                          variantLabel: form.getFieldValue('variantLabel') || 'Varian',
                          variants: ensureAtLeastOneRawMaterialVariant(form.getFieldValue('variants') || []),
                        });
                      } else {
                        form.setFieldsValue({ variants: [], variantLabel: 'Varian' });
                      }
                    }}
                  />
                </Form.Item>
              </Col>
            </Row>

            {hasVariantsValue ? (
              <Form.Item name="variantLabel" label="Label Varian" extra="Contoh: Warna, Ukuran, atau Tipe.">
                <Input placeholder="Contoh: Warna" />
              </Form.Item>
            ) : null}

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="specifications" label="Spesifikasi" extra="Opsional. Contoh: ketebalan, lebar, merek, atau kualitas.">
                  <Input.TextArea rows={3} placeholder="Tulis spesifikasi bahan" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="notes" label="Catatan Internal" extra="Opsional dan hanya untuk kebutuhan operasional.">
                  <Input.TextArea rows={3} placeholder="Tulis catatan bahan" />
                </Form.Item>
              </Col>
            </Row>

            <ImsNotice
              variant="info"
              compact
              className="ims-mb-16"
              title="Supplier tidak dikunci di master bahan. Atur banyak toko dan link melalui Katalog Supplier setelah bahan tersimpan."
            />

            <Divider orientation="left">Struktur Stok</Divider>
            {!hasVariantsValue ? (
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="stock"
                    label={isEditingMaterial ? 'Stok Saat Ini' : 'Stok Awal'}
                    extra={isEditingMaterial ? stockEditHelpText : 'Isi hanya jika sudah ada stok saat master dibuat.'}
                  >
                    <InputNumber
                      disabled={isEditingMaterial}
                      style={{ width: '100%' }}
                      min={0}
                      precision={0}
                      formatter={(value) => formatNumberId(value)}
                      parser={integerParser}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="minStock"
                    label="Minimum Stok"
                    rules={[{ required: true, message: 'Minimum stok wajib diisi.' }]}
                    extra="Batas peringatan restock untuk bahan tanpa varian."
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      precision={0}
                      formatter={(value) => formatNumberId(value)}
                      parser={integerParser}
                    />
                  </Form.Item>
                </Col>
              </Row>
            ) : (
              <ImsNotice
                variant="info"
                compact
                className="ims-mb-16"
                title="Stok awal dan minimum stok diatur pada masing-masing varian."
              />
            )}

            <Divider orientation="left">Modal dan Harga</Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="averageActualUnitCost"
                  label={isEditingMaterial ? 'Modal Aktual Rata-rata / Satuan' : 'Modal Stok Awal / Satuan'}
                  extra={isEditingMaterial
                    ? 'Dihitung otomatis dari Pembelian dan tidak dapat diubah dari master.'
                    : 'Wajib diisi jika stok awal atau stok varian awal lebih dari 0.'}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    precision={0}
                    formatter={(value) => formatNumberId(value)}
                    parser={integerParser}
                    disabled={isEditingMaterial}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="restockReferencePrice"
                  label="Harga Acuan Restock / Satuan"
                  rules={[{ required: true, message: 'Harga acuan restock wajib diisi.' }]}
                  extra="Fallback internal; harga aktual tetap diverifikasi saat Pembelian."
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    precision={0}
                    formatter={(value) => formatNumberId(value)}
                    parser={integerParser}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="pricingMode" hidden><Input type="hidden" /></Form.Item>
            <PricingModeSwitch
              value={pricingModeValue || 'manual'}
              extra={pricingModeValue === 'rule'
                ? 'Pricing Rule aktif: harga dihitung dari modal aktual rata-rata atau harga acuan restock.'
                : 'Manual: harga jual bahan diisi langsung.'}
              onChange={(nextMode) => {
                form.setFieldsValue({ pricingMode: nextMode });
                if (nextMode !== 'rule') {
                  form.setFieldsValue({ pricingRuleId: null });
                  setPricingPreviewWarning('');
                }
              }}
            />

            {pricingPreviewWarning ? (
              <ImsNotice variant="guard" compact className="ims-mb-16" title={pricingPreviewWarning} />
            ) : null}

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="pricingRuleId"
                  label="Pricing Rule"
                  rules={[{ required: pricingModeValue === 'rule', message: 'Pricing rule wajib dipilih untuk mode rule.' }]}
                >
                  <Select allowClear disabled={pricingModeValue !== 'rule'} placeholder="Pilih pricing rule">
                    {(pricingRules || []).map((rule) => (
                      <Option key={rule.id} value={rule.id}>
                        {rule.name}{rule?.isActive ? '' : ' (Nonaktif)'}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="sellingPrice"
                  label="Harga Jual / Satuan"
                  rules={[{ required: true, message: 'Harga jual wajib diisi.' }]}
                  extra="Tetap tersedia karena Bahan Baku saat ini dapat dipilih pada flow Penjualan."
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    precision={0}
                    formatter={(value) => formatNumberId(value)}
                    parser={integerParser}
                  />
                </Form.Item>
              </Col>
            </Row>

          {/* -----------------------------------------------------------------
              Section varian bahan baku.
              Saat aktif, stok tampil per varian dengan layout lebih rapat.
          ----------------------------------------------------------------- */}
          {hasVariantsValue ? (
            <>
              <Divider orientation="left">Varian Bahan</Divider>
              <ImsNotice
                variant="info"
                compact
                className="ims-mb-16"
                title={isEditingMaterial
                  ? canActivateVariantsForEditing
                    ? 'Bahan lama ini stoknya 0, jadi boleh mulai memakai varian. Stok tiap varian baru tetap 0 sampai diubah lewat Purchase/Stock Adjustment/transaksi resmi.'
                    : stockEditHelpText
                  : `Gunakan varian untuk ${variantLabelValue || 'turunan bahan'} seperti warna, ukuran, atau spesifikasi lain. Pada tahap ini varian hanya menyimpan identitas dan stok awal.`}
              />

              <Form.List name="variants">
                {(fields, { remove }) => (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {fields.map((field, index) => (
                      <Card
                        key={field.key}
                        size="small"
                        title={`${variantLabelValue || 'Varian'} ${index + 1}`}
                        extra={
                          <Button
                            danger
                            type="text"
                            icon={<DeleteOutlined />}
                            disabled={fields.length === 1 || isGuardedVariantStock(field.name)}
                            onClick={() => remove(field.name)}
                          >
                            Hapus
                          </Button>
                        }
                      >
                        <Row gutter={12}>
                          {/* IMS NOTE [GUARDED | identity-safe]: hidden identity field menjaga variantKey existing tetap terkirim saat nama varian diganti. Hubungan flow: variantKey adalah identitas stok varian/reference transaksi. STATUS: AKTIF. */}
                          <Form.Item name={[field.name, 'variantKey']} hidden>
                            <Input />
                          </Form.Item>
                          <Col xs={24} md={8}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'name']}
                              label={`Nama ${variantLabelValue || 'Varian'}`}
                              rules={[{ required: true, message: 'Nama varian wajib diisi.' }]}
                            >
                              <Input
                                placeholder={variantLabelValue ? `Contoh: ${variantLabelValue} Merah` : 'Contoh: Merah'}
                              />
                            </Form.Item>
                          </Col>
                          <Form.Item {...field} name={[field.name, 'sku']} hidden>
                            <Input />
                          </Form.Item>
                          <Col xs={24} md={5}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'currentStock']}
                              label={isEditingMaterial ? 'Stok Saat Ini' : 'Stok Awal'}
                              extra={isEditingMaterial ? stockEditHelpText : undefined}
                            >
                              <InputNumber
                                disabled={isEditingMaterial}
                                style={{ width: '100%' }}
                                min={0}
                                precision={0}
                                formatter={(value) => formatNumberId(value)}
                                parser={integerParser}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={6}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'minStockAlert']}
                              label="Minimum Stok"
                              rules={[{ required: true, message: 'Minimum stok varian wajib diisi.' }]}
                            >
                              <InputNumber
                                style={{ width: '100%' }}
                                min={0}
                                precision={0}
                                formatter={(value) => formatNumberId(value)}
                                parser={integerParser}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={5}>
                            <Form.Item {...field} name={[field.name, 'isActive']} label="Aktif" valuePropName="checked">
                              <Switch
                                checkedChildren="Aktif"
                                unCheckedChildren="Nonaktif"
                                disabled={isGuardedVariantStock(field.name)}
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    ))}

                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        const current = form.getFieldValue('variants') || [];
                        form.setFieldsValue({
                          variants: [...current, { ...DEFAULT_RAW_MATERIAL_VARIANT }],
                        });
                      }}
                      block
                    >
                      Tambah Varian
                    </Button>
                  </Space>
                )}
              </Form.List>

              {/* IMS NOTE [AKTIF/GUARDED] - Ringkasan varian pasif.
                  Fungsi blok: menampilkan jumlah varian dan total stok form sebagai panel read-only, bukan Alert.
                  Hubungan flow: hanya mengganti tampilan summary; guard stok master, variantKey, pricing, conversion, dan service update tetap tidak berubah.
                  Alasan logic: ringkasan varian adalah snapshot pasif agar user membaca struktur varian tanpa merasa ada warning.
                  Status: AKTIF untuk UI master Raw Material, GUARDED terhadap business rule stok dan varian. */}
              <div className="ims-readonly-panel" style={{ marginTop: 16 }}>
                <div className="ims-readonly-panel-header">
                  <div>
                    <div className="ims-readonly-panel-title">
                      {isEditingMaterial ? 'Ringkasan Varian Read-only' : 'Ringkasan Varian'}
                    </div>
                    <div className="ims-readonly-panel-description">
                      Summary ini hanya membaca isi form. Perubahan stok fisik setelah create tetap lewat Purchases, Stock Adjustment, atau transaksi resmi.
                    </div>
                  </div>
                  <Tag color="green">Varian</Tag>
                </div>

                <div className="ims-readonly-stat-grid">
                  <div className="ims-readonly-stat-field">
                    <div className="ims-readonly-stat-label">Jumlah Varian</div>
                    <div className="ims-readonly-stat-value">
                      {formatNumberId(variantStats.count)}
                    </div>
                  </div>
                  <div className="ims-readonly-stat-field">
                    <div className="ims-readonly-stat-label">Total Stok</div>
                    <div className="ims-readonly-stat-value">
                      {formatNumberId(variantStats.stock)}
                    </div>
                  </div>
                  <div className="ims-readonly-stat-field">
                    <div className="ims-readonly-stat-label">Total Minimum</div>
                    <div className="ims-readonly-stat-value">
                      {formatNumberId(variantStats.minimumStock)}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          <ImsNotice
            variant="guard"
            compact
            style={{ marginTop: 16 }}
            title="Pakai varian hanya jika bahan punya turunan stok nyata. Minimum stok disimpan per varian."
          />
          </ResponsiveFormSection>
        </Form>
      </Drawer>

      {/* =====================================================
          SECTION: Raw Material Detail Drawer — AKTIF
          Fungsi:
          - Menata ringkasan bahan, stok, harga, supplier, varian, dan link restock dalam section yang mudah dibaca.

          Dipakai oleh:
          - Halaman Master Data / Bahan Baku saat user membuka tombol Detail.

          Alasan perubahan:
          - Drawer lama terlalu padat dalam satu Descriptions dan membuat stok, cost, supplier, serta varian kurang cepat dipahami.

          Catatan cleanup:
          - Belum ada.

          Risiko:
          - Jangan ubah mapping stok, average cost, supplier snapshot, varian, purchase linkage, atau handler detail dari section presentasi ini.
      ===================================================== */}
      <MobileDetailDrawer
        title="Detail Bahan Baku"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={900}
        destroyOnClose
      >
        {selectedMaterial ? (() => {
          const stockSummary = getRawMaterialStockSummary(selectedMaterial);
          const statusMeta = getRawMaterialStatusMeta(selectedMaterial);

          return (
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              <Card size="small">
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Space size={[8, 8]} wrap>
                    <Text strong style={{ fontSize: 18 }}>{selectedMaterial.name || '-'}</Text>
                    <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                    <Tag color={selectedMaterial.hasVariants ? 'blue' : 'default'}>
                      {selectedMaterial.hasVariants ? 'Pakai Varian' : 'Tanpa Varian'}
                    </Tag>
                  </Space>
                  <Text type="secondary">{resolveMaterialCategoryLabel(selectedMaterial)}</Text>
                  <Text type="secondary">Satuan stok: {selectedMaterial.stockUnit || '-'}</Text>
                </Space>
              </Card>

              <Row gutter={[12, 12]}>
                <Col xs={24} md={8}>
                  <Card size="small">
                    <Text type="secondary">Stok Tersedia</Text>
                    <div style={{ fontWeight: 700, fontSize: 20 }}>{formatStockWithUnit(stockSummary.availableStock, selectedMaterial.stockUnit || 'pcs')}</div>
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small">
                    <Text type="secondary">Modal Aktual Rata-rata</Text>
                    <div style={{ fontWeight: 700, fontSize: 20 }}>{selectedMaterial.averageActualUnitCost ? formatCurrencyId(selectedMaterial.averageActualUnitCost) : '-'}</div>
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  <Card size="small">
                    <Text type="secondary">Harga Referensi</Text>
                    <div style={{ fontWeight: 700, fontSize: 20 }}>{formatCurrencyId(selectedMaterial.restockReferencePrice || 0)}</div>
                  </Card>
                </Col>
              </Row>

              <Card size="small" title="Ringkasan">
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label="Kelompok Bahan">
                    {resolveMaterialCategoryLabel(selectedMaterial)}
                  </Descriptions.Item>
                  <Descriptions.Item label={selectedMaterial.hasVariants ? 'Minimum Stok Total Varian' : 'Minimum Stok'}>
                    {formatStockWithUnit(
                      getRawMaterialMinimumStockDisplay(selectedMaterial),
                      selectedMaterial.stockUnit || 'pcs',
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Sumber Restock">
                    <Space size={8} wrap>
                      <Text strong>{getSupplierCatalogSummaryForMaterial(suppliers, selectedMaterial.id).label}</Text>
                      <Button
                        size="small"
                        onClick={() => navigate(buildSupplierDetailRoute(selectedMaterial.id))}
                      >
                        {getSupplierCatalogSummaryForMaterial(suppliers, selectedMaterial.id).offerCount > 0
                          ? 'Bandingkan Supplier'
                          : 'Atur Sumber Restock'}
                      </Button>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="Supplier Pembelian Terakhir">
                    {detailLatestPurchase ? detailRestockSupplier.name : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Harga Jual">
                    {`${formatCurrencyId(selectedMaterial.sellingPrice || 0)} / ${selectedMaterial.stockUnit || '-'}`}
                  </Descriptions.Item>
                  <Descriptions.Item label="Mode Pricing">
                    {getRuleModeLabel(selectedMaterial.pricingMode, selectedMaterial.pricingRuleId, pricingRuleMap)}
                  </Descriptions.Item>
                  {selectedMaterial.specifications ? (
                    <Descriptions.Item label="Spesifikasi">{selectedMaterial.specifications}</Descriptions.Item>
                  ) : null}
                  {selectedMaterial.notes ? (
                    <Descriptions.Item label="Catatan Internal">{selectedMaterial.notes}</Descriptions.Item>
                  ) : null}
                  <Descriptions.Item label="Update Terakhir">
                    {formatDateId(selectedMaterial.updatedAt, true)}
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              <Card size="small" title="Link Restock Terakhir">
                <Space direction="vertical" size={6}>
                  {detailLatestPurchase ? (
                    <Text type="secondary">
                      {`Pembelian terakhir: ${formatDateId(detailLatestPurchase.date || detailLatestPurchase.purchaseDate || detailLatestPurchase.createdAt, true)}`}
                    </Text>
                  ) : null}
                  {detailLatestPurchaseLink ? (
                    <Button
                      size="small"
                      type="primary"
                      href={detailLatestPurchaseLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Buka Link Produk
                    </Button>
                  ) : (
                    <Text type="secondary">Belum ada link produk dari pembelian terakhir.</Text>
                  )}
                </Space>
              </Card>

              <Card size="small" title={selectedMaterial.hasVariants ? 'Varian Bahan Baku' : 'Stok Master'}>
                {selectedMaterial.hasVariants ? (
                  <DataTableView
                    rowKey={(variant, index) => `${selectedMaterial.id}-${variant.variantKey || variant.name}-${index}`}
                    pagination={false}
                    size="small"
                    showRefreshIndicator={false}
                    dataSource={selectedMaterial.variants || []}
                    mobileCardConfig={{
                      title: (variant) => variant.name || variant.variantLabel || variant.variantKey || 'Varian',
                      tags: (variant) => (
                        <Tag color={variant.isActive === false ? 'default' : 'green'}>
                          {variant.isActive === false ? 'Nonaktif' : 'Aktif'}
                        </Tag>
                      ),
                      meta: [
                        { label: 'Stok', value: (variant) => formatStockWithUnit(variant.currentStock || 0, selectedMaterial.stockUnit || 'pcs') },
                        { label: 'Reserved', value: (variant) => formatStockWithUnit(variant.reservedStock || 0, selectedMaterial.stockUnit || 'pcs') },
                        { label: 'Minimum', value: (variant) => formatStockWithUnit(getVariantMinimumStock(variant, 0), selectedMaterial.stockUnit || 'pcs') },
                        {
                          label: 'Tersedia',
                          value: (variant) => formatStockWithUnit(
                            Math.max(Number(variant.currentStock || 0) - Number(variant.reservedStock || 0), 0),
                            selectedMaterial.stockUnit || 'pcs',
                          ),
                        },
                      ],
                    }}
                    columns={[
                      {
                        title: selectedMaterial.variantLabel || 'Varian',
                        dataIndex: 'name',
                        key: 'name',
                        render: (value) => value || '-',
                      },
                      {
                        title: 'Stok',
                        dataIndex: 'currentStock',
                        key: 'currentStock',
                        render: (value) => formatStockWithUnit(value || 0, selectedMaterial.stockUnit || 'pcs'),
                      },
                      {
                        title: 'Reserved',
                        dataIndex: 'reservedStock',
                        key: 'reservedStock',
                        render: (value) => formatStockWithUnit(value || 0, selectedMaterial.stockUnit || 'pcs'),
                      },
                      {
                        title: 'Minimum',
                        key: 'minStockAlert',
                        render: (_, variant) => formatStockWithUnit(
                          getVariantMinimumStock(variant, 0),
                          selectedMaterial.stockUnit || 'pcs',
                        ),
                      },
                      {
                        title: 'Tersedia',
                        key: 'availableStock',
                        render: (_, variant) => formatStockWithUnit(
                          Math.max(Number(variant.currentStock || 0) - Number(variant.reservedStock || 0), 0),
                          selectedMaterial.stockUnit || 'pcs',
                        ),
                      },
                      {
                        title: 'Status',
                        dataIndex: 'isActive',
                        key: 'isActive',
                        render: (value) => (
                          <Tag color={value === false ? 'default' : 'green'}>
                            {value === false ? 'Nonaktif' : 'Aktif'}
                          </Tag>
                        ),
                      },
                    ]}
                  />
                ) : (
                  <Descriptions bordered column={1} size="small">
                    <Descriptions.Item label="Stok Total">
                      {formatStockWithUnit(stockSummary.currentStock, selectedMaterial.stockUnit || 'pcs')}
                    </Descriptions.Item>
                    <Descriptions.Item label="Reserved Stock">
                      {formatStockWithUnit(stockSummary.reservedStock, selectedMaterial.stockUnit || 'pcs')}
                    </Descriptions.Item>
                    <Descriptions.Item label="Stok Tersedia">
                      {formatStockWithUnit(stockSummary.availableStock, selectedMaterial.stockUnit || 'pcs')}
                    </Descriptions.Item>
                    <Descriptions.Item label="Minimum Stok">
                      {formatStockWithUnit(getRawMaterialMinimumStockDisplay(selectedMaterial), selectedMaterial.stockUnit || 'pcs')}
                    </Descriptions.Item>
                  </Descriptions>
                )}
              </Card>
            </Space>
          );
        })() : null}
      </MobileDetailDrawer>
    </div>
  );
};

export default RawMaterials;
