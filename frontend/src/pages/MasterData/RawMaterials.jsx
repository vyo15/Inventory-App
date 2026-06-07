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
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { formatNumberID } from '../../utils/formatters/numberId';
import { formatCurrencyId } from '../../utils/formatters/currencyId';
import { formatDateId } from '../../utils/formatters/dateId';
import FilterBar from '../../components/Layout/Filters/FilterBar';
import PageHeader from '../../components/Layout/Page/PageHeader';
import PageSection from '../../components/Layout/Page/PageSection';
import SummaryStatGrid from '../../components/Layout/Display/SummaryStatGrid';
import StockDisplayBlock from '../../components/Layout/Table/StockDisplayBlock';
import {
  createRawMaterial,
  listenRawMaterials,
  RAW_MATERIAL_DEFAULT_FORM,
  toggleRawMaterialActive,
  updateRawMaterial,
} from '../../services/MasterData/rawMaterialsService';
import {
  getSupplierDisplayName,
  getSupplierOptionLabel,
} from '../../services/MasterData/suppliersService';
import { listSuppliers as listSupplierRepository } from '../../data/repositories/suppliersRepository';
import {
  DEFAULT_RAW_MATERIAL_VARIANT,
  ensureAtLeastOneRawMaterialVariant,
} from '../../utils/variants/rawMaterialVariantHelpers';
import DataTableView from "../../components/Layout/Table/DataTableView";

import { listenPurchaseRecords } from '../../services/Transaksi/purchasesService';
import { showFormValidationFeedback } from '../../utils/forms/formValidationFeedback';
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
  getSupplierOptionSearchText,
  getSupplierOptionsForMaterial,
  hasSafeZeroMasterStock,
  integerParser,
  resolvePrimarySupplierForMaterial,
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
        const [supplierRows, pricingRuleRows] = await Promise.all([
          listSupplierRepository(),
          listPricingRulesByTargetType('raw_materials'),
        ]);
        if (disposed) return;
        // -------------------------------------------------------------------
        // Supplier dibaca dari repository boundary. Dalam mode database lokal, ini C1
        // master-only dan tidak memutasi purchase/raw/stock.
        // Histori purchase tetap lewat purchasesService agar tidak mismatch dengan data transaksi aktif.
        // -------------------------------------------------------------------
        setSuppliers(supplierRows);
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
    const total = materials.length;
    const withVariants = materials.filter((item) => item.hasVariants).length;
    const noVariants = materials.filter((item) => !item.hasVariants).length;
    const lowStock = materials.filter((item) => {
      const statusMeta = getRawMaterialStatusMeta(item);
      return statusMeta.label === 'Kosong' || statusMeta.label === 'Stok Rendah';
    }).length;

    return { total, withVariants, noVariants, lowStock };
  }, [materials]);

  const summaryItems = [
    { key: 'raw-total', title: 'Total Bahan Baku', value: summary.total, subtitle: 'Semua master bahan baku yang tersimpan.', accent: 'primary' },
    { key: 'raw-variants', title: 'Pakai Varian', value: summary.withVariants, subtitle: 'Bahan baku yang memakai stok per varian.', accent: 'success' },
    { key: 'raw-single', title: 'Tanpa Varian', value: summary.noVariants, subtitle: 'Bahan baku yang cukup disimpan di stok master.', accent: 'warning' },
    { key: 'raw-low', title: 'Perlu Dicek', value: summary.lowStock, subtitle: 'Bahan yang kosong atau mendekati batas minimum.', accent: 'default' },
  ];

  // ---------------------------------------------------------------------------
  // Ringkasan realtime isi form saat mode varian aktif.
  // ---------------------------------------------------------------------------
  const variantStats = useMemo(() => {
    if (!Array.isArray(watchedVariants) || watchedVariants.length === 0) {
      return { count: 0, stock: 0 };
    }

    return watchedVariants.reduce(
      (acc, item) => ({
        count: acc.count + (String(item?.name || '').trim() ? 1 : 0),
        stock: acc.stock + Number(item?.currentStock || 0),
      }),
      { count: 0, stock: 0 },
    );
  }, [watchedVariants]);

  // ---------------------------------------------------------------------------
  // Opsi supplier untuk drawer form.
  // FUNGSI: create mode tetap menampilkan semua supplier, sedangkan edit mode
  // hanya menampilkan supplier yang menyediakan bahan terkait atau supplier yang
  // sudah tersimpan pada raw material tersebut.
  // ALASAN: filter ini membantu user memilih supplier yang relevan tanpa menulis
  // otomatis ke raw_materials dan tanpa mengubah flow supplier manual.
  // STATUS: aktif dipakai oleh Select supplier pada form Raw Material.
  // ---------------------------------------------------------------------------
  const formSupplierOptions = useMemo(
    () => getSupplierOptionsForMaterial(suppliers, editingRecord),
    [suppliers, editingRecord],
  );

  // ---------------------------------------------------------------------------
  // Restock inline untuk drawer detail.
  // FUNGSI: menyiapkan supplier utama dan purchase terakhir untuk bahan yang
  // sedang dibuka tanpa menampilkan section/list supplier terpisah di drawer.
  // ALASAN: detail bahan harus tetap ringkas; daftar supplier lengkap cukup
  // dibuka melalui tombol Lihat Supplier.
  // STATUS: aktif dipakai; read-only dan tidak mengubah Raw Material, Supplier,
  // Purchases, stok, kas, saving, atau laporan.
  // ---------------------------------------------------------------------------
  const detailPrimarySupplier = useMemo(
    () => resolvePrimarySupplierForMaterial(suppliers, selectedMaterial),
    [suppliers, selectedMaterial],
  );

  const detailLatestPurchase = useMemo(
    () => getLatestPurchaseForMaterial(purchaseRecords, selectedMaterial?.id),
    [purchaseRecords, selectedMaterial?.id],
  );

  const detailLatestPurchaseLink = useMemo(
    () => getPurchaseProductLink(detailLatestPurchase, selectedMaterial?.id),
    [detailLatestPurchase, selectedMaterial?.id],
  );

  const detailRestockSupplier = useMemo(
    () => resolveRestockSupplierDisplay(detailLatestPurchase, suppliers, detailPrimarySupplier),
    [detailLatestPurchase, suppliers, detailPrimarySupplier],
  );

  // ---------------------------------------------------------------------------
  // Filter list utama.
  // Search dibuat ringan supaya user cepat cari bahan, supplier, atau nama varian.
  // ---------------------------------------------------------------------------
  const filteredMaterials = useMemo(() => {
    const selectedSupplier = (suppliers || []).find((item) => String(item.id) === String(supplierFilter));
    const selectedSupplierName = String(getSupplierDisplayName(selectedSupplier) || '').trim().toLowerCase();

    return materials.filter((item) => {
      const keyword = search.trim().toLowerCase();
      const statusMeta = getRawMaterialStatusMeta(item);
      const variantNames = Array.isArray(item.variants)
        ? item.variants.map((variant) => String(variant?.name || '').toLowerCase())
        : [];

      const matchesSearch = !keyword
        ? true
        : [
            item.name,
            item.supplierName,
            item.variantLabel,
            ...variantNames,
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

      const matchesSupplier =
        supplierFilter === 'all'
          ? true
          : String(item.supplierId || '') === String(supplierFilter)
            ? true
            : selectedSupplierName
              ? String(item.supplierName || '').trim().toLowerCase() === selectedSupplierName
              : false;

      return matchesSearch && matchesStatus && matchesVariantMode && matchesSupplier;
    });
  }, [materials, search, statusFilter, variantModeFilter, supplierFilter, suppliers]);

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
    try {
      await toggleRawMaterialActive(record.id, record.isActive === false);
      message.success(`Bahan baku berhasil ${record.isActive === false ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (error) {
      console.error(error);
      message.error('Gagal mengubah status bahan baku.');
    }
  };

  // ---------------------------------------------------------------------------
  // Submit create/update bahan baku.
  // ACTIVE: jika user memilih supplier di form ini, raw material menyimpan snapshot manual supplierId/supplierName/supplierLink.
  // Supplier page tidak boleh menulis snapshot ini secara otomatis.
  // ---------------------------------------------------------------------------
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingRecord?.id) {
        await updateRawMaterial(editingRecord.id, values, formSupplierOptions);
        message.success('Bahan baku berhasil diupdate.');
      } else {
        await createRawMaterial(values, formSupplierOptions);
        message.success('Bahan baku berhasil ditambahkan.');
      }

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
      width: 280,
      render: (value, record) => {
        const statusMeta = getRawMaterialStatusMeta(record);

        return (
          <div style={compactCellStyles.stack}>
            <Text strong>{value || '-'}</Text>
            <Text type="secondary" style={compactCellStyles.meta}>
              {record.supplierName || '-'}
            </Text>
            <Space size={6} wrap>
              <Tag color={record.hasVariants ? 'blue' : 'default'}>
                {record.hasVariants ? 'Pakai Varian' : 'Tanpa Varian'}
              </Tag>
              {record.hasVariants ? (
                <Tag color="purple">{formatNumberID(record.variantCount || 0)} varian</Tag>
              ) : null}
              <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
            </Space>
          </div>
        );
      },
    },
    {
      title: 'Stok',
      key: 'stock',
      width: 320,
      render: (_, record) => (
        <StockDisplayBlock
          record={record}
          unit={record.stockUnit || 'pcs'}
          getVariantLabel={(variant, index) => variant.name || `Varian ${index + 1}`}
          className="ims-cell-stack ims-cell-stack-tight"
          metaClassName="ims-cell-meta"
          minStockThreshold={Number(record.minStock || 0)}
        />
      ),
    },
    {
      title: 'Harga',
      key: 'priceInfo',
      width: 220,
      render: (_, record) => (
        <div style={compactCellStyles.stack}>
          <Text strong>{`Restock ${formatCurrencyId(record.restockReferencePrice || 0)} / ${record.stockUnit || '-'}`}</Text>
          <Text type="secondary" style={compactCellStyles.meta}>
            {`Modal ${record.averageActualUnitCost ? formatCurrencyId(record.averageActualUnitCost) : '-'} / ${record.stockUnit || '-'}`}
          </Text>
          <Text type="secondary" style={compactCellStyles.meta}>
            {`Jual ${formatCurrencyId(record.sellingPrice || 0)} / ${record.stockUnit || '-'}`}
          </Text>
          <Text type="secondary" style={compactCellStyles.meta}>
            {getRuleModeLabel(record.pricingMode, record.pricingRuleId, pricingRuleMap)}
          </Text>
        </div>
      ),
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 170,
      className: 'app-table-action-column',
      render: (_, record) => (
        <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
          {/* AKTIF / GUARDED: action bahan baku disusun 3 baris agar mudah diklik; handler detail/edit/toggle tetap flow existing. */}
          <Button className="ims-action-button ims-action-button--block" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            Detail
          </Button>
          <Button className="ims-action-button ims-action-button--block" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title={record.isActive === false ? 'Aktifkan kembali bahan baku?' : 'Nonaktifkan bahan baku?'}
            description={
              record.isActive === false
                ? 'Bahan baku akan aktif kembali untuk dipakai pada transaksi baru.'
                : 'Bahan baku tidak akan muncul sebagai pilihan data baru, tetapi histori tetap aman.'
            }
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

  const rawMaterialMobileCardConfig = {
    density: 'compact',
    title: (record) => record.name || '-',
    subtitle: (record) => [record.supplierName || 'Supplier belum tercatat'],
    primary: (record) => {
      const stockSummary = getRawMaterialStockSummary(record);
      return `${formatStockWithUnit(stockSummary.availableStock, record.stockUnit || 'pcs')} tersedia`;
    },
    secondary: (record) => `Min ${formatStockWithUnit(record.minStock || 0, record.stockUnit || 'pcs')}`,
    tags: (record) => {
      const statusMeta = getRawMaterialStatusMeta(record);
      return [<Tag key="status" color={statusMeta.color}>{statusMeta.label}</Tag>];
    },
    meta: [
      { label: 'Jual', value: (record) => `${formatCurrencyId(record.sellingPrice || 0)} / ${record.stockUnit || '-'}` },
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
    <div className="page-container">
      {/* ---------------------------------------------------------------------
          Header halaman utama.
          Layout dibuat sama arah visualnya dengan halaman master lain.
      --------------------------------------------------------------------- */}
      <PageHeader
        title="Bahan Baku"
        subtitle="Master bahan baku dan stok varian."
        actions={[
          { key: 'create-raw-material', type: 'primary', icon: <PlusOutlined />, label: 'Tambah Bahan Baku', onClick: openCreateDrawer },
        ]}
      />

      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message="Gunakan varian hanya untuk bahan dengan turunan stok nyata."
      />

      {/* ---------------------------------------------------------------------
          Summary cards atas halaman.
      --------------------------------------------------------------------- */}
      <SummaryStatGrid items={summaryItems} />

      {/* ---------------------------------------------------------------------
          Filter bar utama.
      --------------------------------------------------------------------- */}
      <FilterBar>
          <Col xs={24} md={8}>
            <Input
              allowClear
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama bahan, supplier, atau varian..."
            />
          </Col>
          <Col xs={24} md={5}>
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: '100%' }}>
              <Option value="all">Semua Status</Option>
              <Option value="Aman">Aman</Option>
              <Option value="Stok Rendah">Stok Rendah</Option>
              <Option value="Kosong">Kosong</Option>
              <Option value="Nonaktif">Nonaktif</Option>
            </Select>
          </Col>
          <Col xs={24} md={5}>
            <Select value={variantModeFilter} onChange={setVariantModeFilter} style={{ width: '100%' }}>
              <Option value="all">Semua Mode Varian</Option>
              <Option value="variant">Pakai Varian</Option>
              <Option value="single">Tanpa Varian</Option>
            </Select>
          </Col>
          <Col xs={24} md={6}>
            <Select value={supplierFilter} onChange={setSupplierFilter} style={{ width: '100%' }} showSearch optionFilterProp="children">
              <Option value="all">Semua Supplier</Option>
              {(suppliers || []).map((supplier) => (
                <Option key={supplier.id} value={supplier.id}>
                  {getSupplierOptionLabel(supplier)}
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
        subtitle="Stok, supplier, dan varian bahan."
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
          {/* -----------------------------------------------------------------
              Section identitas utama bahan baku.
          ----------------------------------------------------------------- */}
          <Divider orientation="left">Informasi Utama</Divider>
          {/* =====================================================
          SECTION: Raw Material internal code hidden from main UI — AKTIF
          Fungsi:
          - Form Raw Material tidak menampilkan input kode utama agar user fokus pada nama bahan, supplier, satuan, stok, harga, dan varian.

          Dipakai oleh:
          - Drawer form Raw Materials dan rawMaterialsService sebagai pembuat kode internal.

          Alasan perubahan:
          - Kode RAW tetap dibuat otomatis oleh service, tetapi tidak perlu menjadi input utama di UI master item.

          Catatan cleanup:
          - Kode internal tetap dipakai relasi/audit teknis tanpa ditampilkan di form operasional.

          Risiko:
          - Jangan menyentuh SKU/kode varian karena variant identity dipakai stok dan transaksi.
          ===================================================== */}
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
              <Form.Item name="supplierId" label="Supplier">
                {/* ---------------------------------------------------------
                    Supplier dropdown filter.
                    FUNGSI: menampilkan supplier yang menyediakan bahan ini pada
                    mode edit, tetap menampilkan semua supplier pada mode create,
                    dan tetap menyertakan supplier tersimpan untuk data historis.
                    ALASAN: kebutuhan bug hanya filter opsi read-only; blok ini
                    tidak mengembalikan auto-sync Supplier ke Raw Material.
                    STATUS: aktif dipakai oleh form Raw Material.
                --------------------------------------------------------- */}
                <Select
                  allowClear
                  placeholder="Pilih supplier"
                  showSearch
                  optionFilterProp="searchText"
                  filterOption={(input, option) =>
                    String(option?.searchText || '')
                      .toLowerCase()
                      .includes(String(input || '').toLowerCase())
                  }
                  notFoundContent={
                    editingRecord?.id ? (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Belum ada supplier yang terhubung dengan bahan ini"
                      />
                    ) : null
                  }
                >
                  {(formSupplierOptions || []).map((supplier) => {
                    const optionLabel = getSupplierOptionLabel(supplier);

                    return (
                      <Option
                        key={supplier.id}
                        value={supplier.id}
                        label={optionLabel}
                        searchText={getSupplierOptionSearchText(supplier)}
                      >
                        <Space size={6} wrap>
                          <span>{optionLabel}</span>
                          {supplier.isStoredSupplierSnapshot ? (
                            <Tag color="default">Supplier tersimpan</Tag>
                          ) : null}
                        </Space>
                      </Option>
                    );
                  })}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="stockUnit"
                label="Satuan Stok"
                rules={[{ required: true, message: 'Satuan stok wajib dipilih.' }]}
              >
                <Select placeholder="Pilih satuan">
                  {unitOptions.map((unit) => (
                    <Option key={unit} value={unit}>
                      {unit}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="hasVariants"
                label="Pakai Varian"
                valuePropName="checked"
                extra={isEditingMaterial
                  ? canActivateVariantsForEditing
                    ? 'Bahan lama dengan stok 0 boleh mulai memakai varian. Semua varian baru tetap stok 0.'
                    : 'Mode varian dikunci setelah bahan baku dibuat agar struktur stok tidak berubah tanpa audit.'
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
                        stock: isEditingMaterial ? 0 : form.getFieldValue('stock'),
                        variantLabel: form.getFieldValue('variantLabel') || 'Varian',
                        variants: ensureAtLeastOneRawMaterialVariant(form.getFieldValue('variants') || []),
                      });
                    } else {
                      form.setFieldsValue({
                        variants: [],
                        variantLabel: 'Varian',
                      });
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="variantLabel" label="Label Varian" extra="Opsional. Contoh: Warna, Ukuran, Spesifikasi">
                <Input disabled={!hasVariantsValue} placeholder="Contoh: Warna" />
              </Form.Item>
            </Col>
          </Row>

          <Card size="small" style={{ marginBottom: 16 }}>
            <Alert
              type="info"
              showIcon
              message="Jika memakai varian, stok ada di varian; minimum stok dan harga tetap di master."
            />
          </Card>

          {/* IMS NOTE [GUARDED | behavior-preserving]: section stok/pricing tetap satu UI,
              tetapi field stock dikunci saat edit; minStock dan pricing tetap metadata editable.
              -----------------------------------------------------------------
              Section aturan stok dan pricing master.
          ----------------------------------------------------------------- */}
          <Divider orientation="left">Stok & Pricing Master</Divider>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="stock"
                label={hasVariantsValue ? 'Stok Master (Otomatis)' : 'Stok Awal'}
                extra={
                  isEditingMaterial
                    ? stockEditHelpText
                    : hasVariantsValue
                      ? 'Kalau pakai varian, stok master dihitung otomatis dari total semua varian.'
                      : 'Stok awal hanya dipakai untuk item tanpa varian.'
                }
              >
                <InputNumber
                  disabled={hasVariantsValue || isEditingMaterial}
                  style={{ width: '100%' }}
                  min={0}
                  precision={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={integerParser}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="minStock"
                label="Minimum Stok Master"
                rules={[{ required: true, message: 'Minimum stok wajib diisi.' }]}
                extra="Berlaku untuk bahan utama, bukan dipecah per varian."
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={integerParser}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              {/* =====================================================
              SECTION: Raw Material pricing mode switch — AKTIF / GUARDED
              Fungsi:
              - Mengubah mode pricing Raw Material dari Select menjadi Switch: OFF manual, ON pricing rule.

              Dipakai oleh:
              - Form create/edit Raw Materials.

              Alasan perubahan:
              - User lebih mudah memahami pilihan Manual vs Pricing Rule dan UX konsisten dengan Products.

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
                  ? 'Pricing Rule aktif: harga dihitung dari modal aktual rata-rata atau harga referensi restock.'
                  : 'Manual: harga jual bahan diisi langsung.'}
                onChange={(nextMode) => {
                  form.setFieldsValue({ pricingMode: nextMode });
                  if (nextMode !== 'rule') {
                    form.setFieldsValue({ pricingRuleId: null });
                    setPricingPreviewWarning('');
                  }
                }}
              />
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="restockReferencePrice"
                label="Harga Referensi Restock / Satuan"
                rules={[{ required: true, message: 'Harga referensi restock wajib diisi.' }]}
                extra="Tetap disimpan di master meskipun bahan memakai varian."
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={integerParser}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="averageActualUnitCost"
                label="Modal Aktual Rata-rata / Satuan"
                rules={[{ required: true, message: 'Modal aktual rata-rata wajib diisi.' }]}
                extra="Dipakai sebagai base cost utama untuk pricing raw materials."
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={0}
                  formatter={(value) => formatNumberID(value)}
                  parser={integerParser}
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

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="pricingRuleId"
                label="Pricing Rule"
                rules={[
                  {
                    required: pricingModeValue === 'rule',
                    message: 'Pricing rule wajib dipilih untuk mode rule.',
                  },
                ]}
              >
                <Select allowClear disabled={pricingModeValue !== 'rule'} placeholder="Pilih pricing rule">
                  {(pricingRules || []).map((rule) => (
                    <Option key={rule.id} value={rule.id}>
                      {rule.name}
                      {rule?.isActive ? '' : ' (Nonaktif)'}
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
                extra="Master price tetap satu agar maintenance harga lebih rapi."
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={0}
                  formatter={(value) => formatNumberID(value)}
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
              <Alert
                style={{ marginBottom: 16 }}
                type="info"
                showIcon
                message={isEditingMaterial
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
                            disabled={fields.length === 1}
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
                          <Col xs={24} md={6}>
                            <Form.Item
                              {...field}
                              name={[field.name, 'currentStock']}
                              label="Stok Varian"
                              extra={isEditingMaterial ? stockEditHelpText : undefined}
                            >
                              <InputNumber
                                disabled={isEditingMaterial}
                                style={{ width: '100%' }}
                                min={0}
                                precision={0}
                                formatter={(value) => formatNumberID(value)}
                                parser={integerParser}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={5}>
                            <Form.Item {...field} name={[field.name, 'isActive']} label="Aktif" valuePropName="checked">
                              <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
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
                      {formatNumberID(variantStats.count)}
                    </div>
                  </div>
                  <div className="ims-readonly-stat-field">
                    <div className="ims-readonly-stat-label">Total Stok</div>
                    <div className="ims-readonly-stat-value">
                      {formatNumberID(variantStats.stock)}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          <Alert
            style={{ marginTop: 16 }}
            type="warning"
            showIcon
            message="Pakai varian hanya jika bahan punya turunan stok nyata."
          />
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
      <Drawer
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
                  <Descriptions.Item label="Supplier">
                    <Space size={8} wrap>
                      <Text strong>{detailRestockSupplier.name}</Text>
                      {detailRestockSupplier.source === 'purchase' ? <Tag color="green">Terakhir dibeli</Tag> : null}
                      {detailRestockSupplier.source === 'manual' ? <Tag color="blue">Supplier manual</Tag> : null}
                      {detailPrimarySupplier.id && !detailPrimarySupplier.isActiveMaster ? <Tag color="orange">Snapshot lama</Tag> : null}
                      <Button
                        size="small"
                        onClick={() => navigate(buildSupplierDetailRoute(selectedMaterial.id, detailRestockSupplier.id))}
                      >
                        Lihat Supplier Lain
                      </Button>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="Minimum Stok">
                    {formatStockWithUnit(selectedMaterial.minStock || 0, selectedMaterial.stockUnit || 'pcs')}
                  </Descriptions.Item>
                  <Descriptions.Item label="Harga Jual">
                    {`${formatCurrencyId(selectedMaterial.sellingPrice || 0)} / ${selectedMaterial.stockUnit || '-'}`}
                  </Descriptions.Item>
                  <Descriptions.Item label="Mode Pricing">
                    {getRuleModeLabel(selectedMaterial.pricingMode, selectedMaterial.pricingRuleId, pricingRuleMap)}
                  </Descriptions.Item>
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
                  </Descriptions>
                )}
              </Card>
            </Space>
          );
        })() : null}
      </Drawer>
    </div>
  );
};

export default RawMaterials;
