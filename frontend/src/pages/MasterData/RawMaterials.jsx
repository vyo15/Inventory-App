import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  App as AntdApp,
  Button,
  Col,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { formatNumberId } from '../../utils/formatters/numberId';
import FilterBar from '../../components/Layout/Filters/FilterBar';
import PageHeader from '../../components/Layout/Page/PageHeader';
import PageContentCanvas from '../../components/Layout/Page/PageContentCanvas';
import PageSection from '../../components/Layout/Page/PageSection';
import SummaryStatGrid from '../../components/Layout/Display/SummaryStatGrid';
import StockDisplayBlock from '../../components/Layout/Table/StockDisplayBlock';
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
import DataTableView from "../../components/Layout/Table/DataTableView";
import MasterRecordActions from './components/MasterRecordActions';
import RawMaterialDetailDrawer from './components/RawMaterialDetailDrawer';
import RawMaterialFormDrawer from "./components/RawMaterialFormDrawer";
import { buildMasterRecordMobileActions } from './components/masterRecordActionHelpers';
import { isVariantStockEmpty } from '../../utils/variants/variantArchiveHelpers';

import { listenPurchaseRecords } from '../../services/Transaksi/purchasesService';
import { showFormValidationFeedback } from '../../utils/forms/formValidationFeedback';
import { compareRecordsByNameAsc, upsertRecordById } from '../../utils/state/recordCollectionState';
import { buildSinglePricingPreview, listPricingRulesByTargetType } from '../../services/Pricing/pricingService';
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
  getActiveSupplierOffersForMaterial,
  getRawMaterialMinimumStockDisplay,
  getSupplierCatalogSummaryForMaterial,
  getVariantMinimumStock,
  hasSafeZeroMasterStock,
  resolveRestockSupplierDisplay,
} from './helpers/rawMaterialsPageHelpers';


const { Option } = Select;
const { Text } = Typography;

const RawMaterials = () => {
  const { message } = AntdApp.useApp();
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
  }, [message]);


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
      toggleTitle: record.isActive === false ? 'Aktifkan kembali bahan baku?' : 'Nonaktifkan bahan baku?',
      toggleDescription: record.isActive === false
        ? 'Bahan baku akan aktif kembali untuk dipakai pada transaksi baru.'
        : 'Penonaktifan hanya dapat dilakukan jika stok, reserved stock, BOM aktif, dan proses produksi sudah aman.',
    }).primaryActions,
    moreActions: (record) => buildMasterRecordMobileActions({
      record,
      onDetail: handleViewDetail,
      onEdit: handleEdit,
      onToggle: handleToggleActive,
      toggleTitle: record.isActive === false ? 'Aktifkan kembali bahan baku?' : 'Nonaktifkan bahan baku?',
      toggleDescription: record.isActive === false
        ? 'Bahan baku akan aktif kembali untuk dipakai pada transaksi baru.'
        : 'Penonaktifan hanya dapat dilakukan jika stok, reserved stock, BOM aktif, dan proses produksi sudah aman.',
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

      <PageContentCanvas>


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
          emptyState={{ description: "Belum ada data bahan baku" }}
          mobileCardConfig={rawMaterialMobileCardConfig}
        />
      </PageSection>

      {/* ---------------------------------------------------------------------
          Drawer form create/edit.
          Ukuran drawer disamakan arah visualnya dengan halaman produk.
      --------------------------------------------------------------------- */}
      </PageContentCanvas>

<RawMaterialFormDrawer
        canActivateVariantsForEditing={canActivateVariantsForEditing}
        categorySelectOptions={categorySelectOptions}
        closeFormDrawer={closeFormDrawer}
        editingRecord={editingRecord}
        form={form}
        formVisible={formVisible}
        handleSubmit={handleSubmit}
        hasVariantModeSwitchLocked={hasVariantModeSwitchLocked}
        hasVariantsValue={hasVariantsValue}
        isEditingMaterial={isEditingMaterial}
        isGuardedVariantStock={isGuardedVariantStock}
        pricingModeValue={pricingModeValue}
        pricingPreviewWarning={pricingPreviewWarning}
        pricingRules={pricingRules}
        setPricingPreviewWarning={setPricingPreviewWarning}
        stockEditHelpText={stockEditHelpText}
        submitting={submitting}
        variantLabelValue={variantLabelValue}
        variantStats={variantStats}
      />

      <RawMaterialDetailDrawer
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        material={selectedMaterial}
        suppliers={suppliers}
        latestPurchase={detailLatestPurchase}
        latestPurchaseLink={detailLatestPurchaseLink}
        restockSupplier={detailRestockSupplier}
        pricingRuleMap={pricingRuleMap}
        resolveCategoryLabel={resolveMaterialCategoryLabel}
        getSupplierCatalogSummary={getSupplierCatalogSummaryForMaterial}
        buildSupplierRoute={buildSupplierDetailRoute}
        navigate={navigate}
      />
    </div>
  );
};

export default RawMaterials;
