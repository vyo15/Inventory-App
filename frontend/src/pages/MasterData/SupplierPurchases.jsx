import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
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
import { useLocation, useNavigate } from 'react-router-dom';
import { REPOSITORY_MODES } from '../../data/repositories/repositoryMode';
import { getRepositoryModeStatus } from '../../data/repositories/repositoryModeService';
import {
  createSupplier as createSupplierRepository,
  deleteSupplier as deleteSupplierRepository,
  generateSupplierCode as generateSupplierCodeRepository,
  listSuppliers as listSupplierRepository,
  updateSupplier as updateSupplierRepository,
} from '../../data/repositories/suppliersRepository';
import { formatNumberID, parseIntegerIdInput } from '../../utils/formatters/numberId';
import { formatCurrencyIDR } from '../../utils/formatters/currencyId';
import FilterBar from '../../components/Layout/Filters/FilterBar';
import PageHeader from '../../components/Layout/Page/PageHeader';
import PageSection from '../../components/Layout/Page/PageSection';
import DataTableView from '../../components/Layout/Table/DataTableView';
import { DataRefreshIndicator, getDataTableEmptyText } from '../../components/Layout/Feedback/DataLoadingState';
import { listenRawMaterials } from '../../services/MasterData/rawMaterialsService';
import { listenPurchaseRecords } from '../../services/Transaksi/purchasesService';
import {
  calculateSupplierMaterialRestockMetrics,
  doesSupplierProvideMaterial,
  getSupplierDisplayName,
  getSupplierStoreLink,
  isManagedSupplierRecord,
  isValidSupplierCodeFormat,
  listenSuppliers,
  normalizeSupplierCode,
} from '../../services/MasterData/suppliersService';
import {
  PURCHASE_UNIT_OPTIONS,
  SUPPLIER_PURCHASE_LOOKUP_LIMIT,
  formatPurchaseDate,
  getLatestPurchaseForMaterial,
  getMaterialStockUnit,
  getSupplierBusinessCode,
  getSupplierTableSummaryDetail,
  renderSupplierBusinessCode,
} from './helpers/supplierPurchasesPageHelpers';


// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data lama decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema Firestore tetap sama.

const { Option } = Select;
const { Search } = Input;
const { Text } = Typography;




const SupplierPurchases = () => {
  // ---------------------------------------------------------------------------
  // State utama halaman Supplier.
  // FUNGSI: mengelola master supplier, katalog raw material, dan histori purchase
  // untuk perbandingan harga read-only.
  // STATUS: aktif dipakai di halaman Supplier.
  // ---------------------------------------------------------------------------
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [purchaseRecords, setPurchaseRecords] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [supplierCodeLoading, setSupplierCodeLoading] = useState(false);
  const [editingSupplierNeedsCodeRepair, setEditingSupplierNeedsCodeRepair] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [materialFilter, setMaterialFilter] = useState(undefined);
  const [repositoryMode, setRepositoryMode] = useState(REPOSITORY_MODES.SQLITE_SIDECAR);

  const isSqliteSupplierMode = repositoryMode === REPOSITORY_MODES.SQLITE_SIDECAR;
  const getModeOptions = useCallback((mode = repositoryMode) => ({ mode }), [repositoryMode]);

  const [form] = Form.useForm();
  const location = useLocation();
  const navigate = useNavigate();

  // ---------------------------------------------------------------------------
  // Query URL dari Raw Material/Dashboard.
  // FUNGSI: membuka Supplier dengan filter bahan dan highlight supplier terkait.
  // STATUS: aktif dipakai untuk flow Bandingkan Supplier / Lihat Supplier Lain.
  // ---------------------------------------------------------------------------
  const searchParams = new URLSearchParams(location.search);
  const materialIdFromQuery = searchParams.get('materialId');
  const supplierIdFromQuery = searchParams.get('supplierId');

  const selectedMaterialFromQuery = useMemo(() => {
    return materials.find((item) => item.id === materialIdFromQuery);
  }, [materials, materialIdFromQuery]);

  const fetchSuppliers = useCallback(async (mode = repositoryMode) => {
    setIsLoading(true);
    try {
      const nextSuppliers = await listSupplierRepository(getModeOptions(mode));
      setSuppliers(nextSuppliers);
      setLoadError('');
    } catch (error) {
      console.error(error);
      setSuppliers([]);
      setLoadError('Gagal memuat supplier. Pastikan backend aplikasi aktif.');
      message.error(error?.message || 'Gagal memuat supplier.');
    } finally {
      setIsLoading(false);
    }
  }, [getModeOptions, repositoryMode]);

  // ---------------------------------------------------------------------------
  // Load master supplier, bahan baku, dan purchases.
  // FUNGSI: C1 memindahkan master Supplier ke repository boundary agar mode
  // SQLite tidak lagi melakukan write langsung ke Firestore supplierPurchases.
  // BATASAN: raw material dan histori purchase tetap legacy read-only untuk
  // pembanding; tidak menulis purchase, stok, kas, raw material, atau finance.
  // STATUS: aktif dipakai.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isActive = true;
    let unsubscribeSuppliers = () => {};

    const initializeSupplierSource = async () => {
      try {
        const modeStatus = await getRepositoryModeStatus();
        if (!isActive) return;

        setRepositoryMode(modeStatus.mode);

        if (modeStatus.mode === REPOSITORY_MODES.SQLITE_SIDECAR) {
          await fetchSuppliers(modeStatus.mode);
          return;
        }

        setIsLoading(true);
        unsubscribeSuppliers = listenSuppliers(
          (nextSuppliers) => {
            if (!isActive) return;
            setSuppliers(nextSuppliers);
            setLoadError('');
            setIsLoading(false);
          },
          (error) => {
            if (!isActive) return;
            console.error(error);
            setSuppliers([]);
            setLoadError('Gagal memuat supplier.');
            setIsLoading(false);
            message.error('Gagal memuat supplier.');
          },
        );
      } catch (error) {
        if (!isActive) return;
        console.error(error);
        setSuppliers([]);
        setLoadError('Gagal membaca mode repository supplier.');
        setIsLoading(false);
      }
    };

    initializeSupplierSource();

    const unsubscribeMaterials = listenRawMaterials(
      (nextMaterials) => {
        if (!isActive) return;
        setMaterials(nextMaterials);
      },
      (error) => {
        console.error(error);
        message.warning('Referensi bahan baku belum bisa dimuat. Supplier tetap bisa dikelola sebagai master data.');
      },
    );

    const unsubscribePurchases = listenPurchaseRecords(
      (nextPurchases) => {
        if (!isActive) return;
        setPurchaseRecords((nextPurchases || []).slice(0, SUPPLIER_PURCHASE_LOOKUP_LIMIT));
      },
      (error) => {
        console.error(error);
        message.warning('Histori purchase belum bisa dimuat untuk pembanding supplier.');
      },
    );

    return () => {
      isActive = false;
      unsubscribeSuppliers();
      unsubscribeMaterials();
      unsubscribePurchases();
    };
  }, [fetchSuppliers]);

  // ---------------------------------------------------------------------------
  // Filter supplier dari query URL + filter manual user.
  // FUNGSI: hanya menampilkan supplier yang relevan dengan material jika filter
  // material aktif, tanpa mengubah data supplier/raw material.
  // STATUS: aktif dipakai; bukan auto-sync.
  // ---------------------------------------------------------------------------
  const filteredSuppliers = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return (suppliers || [])
      .filter((supplier) => {
        if (isSqliteSupplierMode || !materialIdFromQuery) return true;
        return doesSupplierProvideMaterial(supplier, materialIdFromQuery);
      })
      .filter((supplier) => {
        if (isSqliteSupplierMode || !materialFilter) return true;
        return doesSupplierProvideMaterial(supplier, materialFilter);
      })
      .filter((supplier) => {
        if (!keyword) return true;

        const searchableText = [
          getSupplierBusinessCode(supplier),
          getSupplierDisplayName(supplier),
          getSupplierStoreLink(supplier),
          ...(supplier.supportedMaterialNames || []),
          ...(supplier.materialDetails || []).map((detail) => detail.productLink),
          ...(supplier.materialDetails || []).map((detail) => detail.note),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchableText.includes(keyword);
      })
      .sort((leftSupplier, rightSupplier) =>
        getSupplierDisplayName(leftSupplier).localeCompare(getSupplierDisplayName(rightSupplier), 'id-ID'),
      );
  }, [suppliers, isSqliteSupplierMode, materialIdFromQuery, materialFilter, searchText]);

  // ---------------------------------------------------------------------------
  // Helper purchase terakhir per material.
  // FUNGSI: membaca harga terakhir beli sebagai pembanding katalog supplier.
  // BATASAN: read-only; tidak mengubah purchase dan tidak membuat purchase baru.
  // STATUS: aktif dipakai di detail Supplier.
  // ---------------------------------------------------------------------------
  const getLatestPurchaseForMaterialFromRecords = (materialId) => getLatestPurchaseForMaterial(purchaseRecords, materialId);

  // ---------------------------------------------------------------------------
  // Reset state modal agar buka/tutup form selalu bersih.
  // STATUS: aktif dipakai form create/edit supplier.
  // ---------------------------------------------------------------------------
  const resetSupplierModalState = () => {
    setModalVisible(false);
    setIsEditing(false);
    setEditingId(null);
    setSaving(false);
    setSupplierCodeLoading(false);
    setEditingSupplierNeedsCodeRepair(false);
    form.resetFields();
  };

  /* =====================================================
      SECTION: Prepare create supplier form — AKTIF / GUARDED
      Fungsi:
      - Membuka modal tambah Supplier dan langsung mengisi kode otomatis SUP-DDMMYYYY-001.

      Dipakai oleh:
      - Tombol Tambah Supplier di halaman Master Data / Supplier.

      Alasan perubahan:
      - Kode Supplier tidak boleh lagi diinput manual atau dibuat dari nama/singkatan toko.

      Catatan cleanup:
      - Belum ada.

      Risiko:
      - Jika preview kode dihapus, create Supplier bisa kehilangan referensi audit yang konsisten.
  ===================================================== */
  const prepareCreateSupplierForm = async () => {
    setModalVisible(true);
    setIsEditing(false);
    setEditingId(null);
    setEditingSupplierNeedsCodeRepair(false);
    form.resetFields();
    form.setFieldsValue({ materialDetails: [] });
    setSupplierCodeLoading(true);

    try {
      const generatedCode = await generateSupplierCodeRepository(getModeOptions());
      form.setFieldsValue({ code: generatedCode, materialDetails: [] });
    } catch (error) {
      console.error('Gagal membuat kode supplier otomatis:', error);
      message.error('Gagal membuat kode supplier otomatis.');
    } finally {
      setSupplierCodeLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Update material detail di Form.List.
  // FUNGSI: menjaga field materialName dan stockUnit otomatis sesuai bahan terpilih.
  // ALASAN: harga estimasi supplier per satuan stok perlu konteks satuan stok.
  // STATUS: aktif dipakai di form Supplier.
  // ---------------------------------------------------------------------------
  const updateMaterialDetailAtIndex = (index, nextValues = {}) => {
    const currentDetails = form.getFieldValue('materialDetails') || [];
    const nextDetails = [...currentDetails];
    nextDetails[index] = {
      ...(nextDetails[index] || {}),
      ...nextValues,
    };
    form.setFieldsValue({ materialDetails: nextDetails });
  };

  // ---------------------------------------------------------------------------
  // Normalisasi payload supplier sebelum dikirim ke master supplier.
  // FUNGSI: menyimpan katalog restock lengkap per material dan menghitung harga
  // estimasi supplier per satuan stok.
  // HUBUNGAN FLOW: data ini dipakai Purchases sebagai prefill/pembanding, bukan
  // sebagai harga aktual dan bukan transaksi.
  // STATUS: aktif dipakai; tidak menulis otomatis ke Raw Material.
  // ---------------------------------------------------------------------------
  const buildSupplierPayload = (values) => {
    const materialDetails = (values.materialDetails || [])
      .filter((item) => item.materialId)
      .map((item) => {
        const selectedMaterial = materials.find((material) => material.id === item.materialId);
        const stockUnit = getMaterialStockUnit(selectedMaterial) || item.stockUnit || '';
        // ---------------------------------------------------------------------
        // SUPPLIER OFFLINE CATALOG NORMALIZER.
        // FUNGSI: memastikan katalog offline tidak membawa ongkir/admin/diskon
        // lama ke estimasi supplier.
        // HUBUNGAN FLOW: hanya menyimpan referensi restock; tidak membuat
        // transaksi, tidak mengubah stok, dan tidak mengubah kas.
        // STATUS: aktif dipakai saat simpan Supplier.
        // ---------------------------------------------------------------------
        const purchaseType = item.purchaseType === 'offline' ? 'offline' : 'online';
        const normalizedDetail = {
          ...item,
          stockUnit,
          purchaseType,
          estimatedShippingCost: purchaseType === 'offline' ? 0 : item.estimatedShippingCost,
          serviceFee: purchaseType === 'offline' ? 0 : item.serviceFee,
          discount: purchaseType === 'offline' ? 0 : item.discount,
        };
        const metrics = calculateSupplierMaterialRestockMetrics(normalizedDetail);

        return {
          materialId: item.materialId,
          materialName: selectedMaterial?.name || item.materialName || '',
          productLink: item.productLink || '',
          purchaseType,
          purchaseUnit: item.purchaseUnit || '',
          purchaseQty: Number(item.purchaseQty || 1),
          conversionValue: Number(item.conversionValue || 0),
          stockUnit,
          supplierItemPrice: Math.round(Number(item.supplierItemPrice || 0)),
          estimatedShippingCost: metrics.estimatedShippingCost,
          serviceFee: metrics.serviceFee,
          discount: metrics.discount,
          totalStockQty: metrics.totalStockQty,
          totalEstimatedSupplier: metrics.totalEstimatedSupplier,
          estimatedUnitPrice: metrics.estimatedUnitPrice,
          referencePrice: metrics.estimatedUnitPrice,
          note: item.note || '',
        };
      });

    const normalizedCode = normalizeSupplierCode(values.code || values.supplierCode);
    const codeFields = isValidSupplierCodeFormat(normalizedCode)
      ? { code: normalizedCode, supplierCode: normalizedCode }
      : {};

    if (isSqliteSupplierMode) {
      return {
        ...codeFields,
        name: values.storeName,
        storeName: values.storeName,
        storeLink: values.storeLink || '',
        materialDetails,
        supportedMaterialIds: materialDetails.map((item) => item.materialId),
        supportedMaterialNames: materialDetails.map((item) => item.materialName),
      };
    }

    return {
      ...codeFields,
      storeName: values.storeName,
      storeLink: values.storeLink || '',
      // Field kategori lama tidak lagi disimpan dari UI aktif. Jika ada data lama,
      // service tetap membacanya sebagai legacy read-only.
      supportedMaterialIds: materialDetails.map((item) => item.materialId),
      supportedMaterialNames: materialDetails.map((item) => item.materialName),
      materialDetails,
      updatedAt: new Date().toISOString(),
    };
  };

  // ---------------------------------------------------------------------------
  // Simpan supplier baru / edit supplier.
  // FUNGSI: menyimpan master vendor dan katalog restock di collection Supplier.
  // ALASAN: saat edit, snapshot nama/link di Raw Material yang sudah memilih
  // supplierId ini ikut diperbarui agar tampilan tetap konsisten dengan master.
  // STATUS: aktif; cascade ini bukan pemasangan supplier dari katalog material.
  // ---------------------------------------------------------------------------
  const handleSaveSupplier = async (values) => {
    try {
      setSaving(true);
      const payload = buildSupplierPayload(values);

      if (isEditing && editingId) {
        await updateSupplierRepository(editingId, payload, getModeOptions());
        message.success('Supplier berhasil diubah.');
      } else {
        await createSupplierRepository(payload, getModeOptions());
        message.success('Supplier berhasil ditambahkan.');
      }

      resetSupplierModalState();
      await fetchSuppliers(repositoryMode);
    } catch (error) {
      console.error(error);
      if (error?.type === 'validation' && error.errors) {
        form.setFields(
          Object.entries(error.errors).map(([name, errorMessage]) => ({
            name,
            errors: [errorMessage],
          })),
        );
        return;
      }
      message.error(error?.message || 'Gagal menyimpan supplier.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSupplier = async (record) => {
    if (!isManagedSupplierRecord(record)) {
      message.warning('Supplier ini bukan record master yang bisa dihapus dari halaman ini.');
      return;
    }

    try {
      await deleteSupplierRepository(record.id, getModeOptions());
      message.success('Supplier berhasil dinonaktifkan.');
      await fetchSuppliers(repositoryMode);
    } catch (error) {
      console.error(error);
      message.error('Gagal menghapus supplier.');
    }
  };

  const openSupplierDrawer = (record) => {
    setSelectedSupplier(record);
    setDrawerVisible(true);
  };

  // ---------------------------------------------------------------------------
  // Kolom tabel supplier.
  // FUNGSI: menampilkan ringkasan katalog restock tanpa memuat detail panjang.
  // HUBUNGAN FLOW: Supplier tetap katalog vendor/restock; data lengkap tetap ada
  // di drawer Detail agar table utama tidak terlalu lebar.
  // STATUS: aktif dipakai; bukan logic save dan bukan auto-sync Raw Material.
  // ---------------------------------------------------------------------------
  const columns = [
    {
      title: 'Nama Supplier',
      dataIndex: 'storeName',
      key: 'storeName',
      width: '22%',
      render: (_, record) => (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Space size={6} wrap>
            <span className="ims-cell-title">{getSupplierDisplayName(record)}</span>
            {supplierIdFromQuery && String(record.id) === String(supplierIdFromQuery) ? (
              <Tag color="green">Dipilih</Tag>
            ) : null}
          </Space>
          {renderSupplierBusinessCode(record)}
          <span className="ims-cell-meta">
            {(record.materialDetails || []).length || 0} katalog restock
          </span>
        </Space>
      ),
    },
    {
      title: 'Link Toko',
      key: 'storeLink',
      width: '18%',
      render: (_, record) => (
        getSupplierStoreLink(record) ? (
          <a href={getSupplierStoreLink(record)} target="_blank" rel="noreferrer">
            Buka Link Toko
          </a>
        ) : (
          <span className="ims-cell-meta">Belum ada link</span>
        )
      ),
    },
    {
      title: 'Katalog Restock Ringkas',
      key: 'materials',
      width: '28%',
      render: (_, record) => {
        const detail = getSupplierTableSummaryDetail(record);
        const materialNames = record.supportedMaterialNames || [];

        if (!materialNames.length) return '-';

        return (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Space size={[4, 4]} wrap>
              {materialNames.slice(0, 2).map((name, index) => (
                <Tag key={`${name}-${index}`}>{name}</Tag>
              ))}
              {materialNames.length > 2 && <Tag>+{materialNames.length - 2} lainnya</Tag>}
            </Space>
            {detail ? (
              <span className="ims-cell-meta">
                Qty Beli {formatNumberID(detail.purchaseQty || 1)} {detail.purchaseUnit || 'satuan'} · Konversi Supplier {formatNumberID(detail.conversionValue || 0)} {detail.stockUnit || 'stok'}
              </span>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: 'Harga Estimasi Ringkas',
      key: 'estimatedPrice',
      width: '18%',
      render: (_, record) => {
        const detail = getSupplierTableSummaryDetail(record);
        if (!detail) return '-';

        const metrics = calculateSupplierMaterialRestockMetrics(detail);
        if (!metrics.estimatedUnitPrice) return '-';

        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <span className="ims-cell-title">{formatCurrencyIDR(metrics.estimatedUnitPrice)} / {detail.stockUnit || 'satuan'}</span>
            <span className="ims-cell-meta">
              Harga Supplier Tercatat: {formatCurrencyIDR(metrics.totalEstimatedSupplier || 0)}
            </span>
            <Tag color={detail.purchaseType === 'offline' ? 'default' : 'blue'}>
              {detail.purchaseType === 'offline' ? 'Offline' : 'Online'}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: 'Aksi',
      key: 'actions',
      width: '14%',
      // ---------------------------------------------------------------------
      // AKTIF + GUARDED: action column tanpa fixed/sticky.
      // FUNGSI: tombol Detail/Edit/Hapus tetap mudah diklik tanpa horizontal
      // scroll kanan yang berlebihan dan tanpa efek transparan/menumpuk.
      // HUBUNGAN FLOW: hanya UI; handler lama tetap dipakai dan tidak mengubah
      // Supplier schema, Purchases prefill, stok, kas, expense, atau Raw Material.
      // LEGACY: fixed action column lama tidak dipakai karena rawan overlap.
      // CLEANUP CANDIDATE: pindahkan styling ke CSS khusus jika nanti ada file
      // style Supplier yang terpisah.
      // ---------------------------------------------------------------------
      className: 'app-table-action-column',
      render: (_, record) => (
        <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
          {/* AKTIF / GUARDED: action supplier tetap 3 baris memakai utility shared; drawer, edit, dan Popconfirm hapus tetap handler existing. */}
          <Button className="ims-action-button ims-action-button--block" size="small" icon={<EyeOutlined />} onClick={() => openSupplierDrawer(record)}>
            Detail
          </Button>
          <Button className="ims-action-button ims-action-button--block" size="small" icon={<EditOutlined />} onClick={() => handleEditSupplier(record)}>
            Edit
          </Button>
          <Popconfirm title="Yakin hapus supplier ini?" onConfirm={() => handleDeleteSupplier(record)} okText="Ya" cancelText="Batal">
            <Button className="ims-action-button ims-action-button--block" danger size="small" icon={<DeleteOutlined />}>
              Hapus
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Kolom detail katalog restock Supplier.
  // FUNGSI: memperlihatkan konteks satuan, estimasi biaya, dan pembanding harga
  // terakhir beli tanpa membuat purchase otomatis.
  // STATUS: aktif dipakai di drawer Supplier.
  // ---------------------------------------------------------------------------
  const materialDetailColumns = [
    {
      title: 'Katalog Material',
      dataIndex: 'materialName',
      width: '28%',
      render: (value, record) => (
        <Space direction="vertical" size={2}>
          <span className="ims-cell-title">{value || '-'}</span>
          <Space size={[4, 4]} wrap>
            <Tag color={record.purchaseType === 'online' ? 'blue' : 'default'}>
              {record.purchaseType === 'online' ? 'Online' : 'Offline'}
            </Tag>
            {record.productLink ? (
              <a href={record.productLink} target="_blank" rel="noopener noreferrer">
                Buka Link
              </a>
            ) : null}
          </Space>
          {record.note ? (
            <span
              className="ims-cell-meta"
              title={record.note}
              style={{
                display: 'inline-block',
                maxWidth: 220,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                verticalAlign: 'bottom',
              }}
            >
              {record.note}
            </span>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Qty / Konversi',
      key: 'unitConversion',
      width: '20%',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <span>
            {formatNumberID(record.purchaseQty || 1)} {record.purchaseUnit || 'satuan beli'}
          </span>
          <span className="ims-cell-meta">
            = {formatNumberID(record.conversionValue || 0)} {record.stockUnit || 'satuan stok'}
          </span>
        </Space>
      ),
    },
    {
      title: 'Harga Supplier',
      key: 'supplierEstimate',
      width: '28%',
      render: (_, record) => {
        const metrics = calculateSupplierMaterialRestockMetrics(record);
        const isOfflinePurchase = record.purchaseType === 'offline';

        return (
          <Space direction="vertical" size={2}>
            <span>Total: {metrics.totalEstimatedSupplier ? formatCurrencyIDR(metrics.totalEstimatedSupplier) : '-'}</span>
            <span className="ims-cell-title">
              / {record.stockUnit || 'satuan'}: {metrics.estimatedUnitPrice ? formatCurrencyIDR(metrics.estimatedUnitPrice) : '-'}
            </span>
            <span className="ims-cell-meta">
              {isOfflinePurchase
                ? 'Offline: ongkir/admin/voucher tidak dipakai'
                : `Barang ${formatCurrencyIDR(metrics.supplierItemPrice || 0)} + Ongkir ${formatCurrencyIDR(metrics.estimatedShippingCost || 0)} + Admin ${formatCurrencyIDR(metrics.serviceFee || 0)} - Diskon ${formatCurrencyIDR(metrics.discount || 0)}`}
            </span>
          </Space>
        );
      },
    },
    {
      title: 'Pembanding Terakhir',
      key: 'latestPurchase',
      width: '24%',
      render: (_, record) => {
        const latestPurchase = getLatestPurchaseForMaterialFromRecords(record.materialId);
        const metrics = calculateSupplierMaterialRestockMetrics(record);
        const latestUnitCost = Math.round(Number(latestPurchase?.actualUnitCost || 0));

        if (!latestPurchase || !latestUnitCost) {
          return <span className="ims-cell-meta">Belum ada histori pembelian</span>;
        }

        const difference = metrics.estimatedUnitPrice - latestUnitCost;
        const statusLabel = difference < 0
          ? 'Lebih murah dari terakhir beli'
          : difference > 0
            ? 'Lebih mahal dari terakhir beli'
            : 'Sama dengan terakhir beli';

        return (
          <Space direction="vertical" size={2}>
            <span>{formatCurrencyIDR(latestUnitCost)}</span>
            <span style={{ color: difference <= 0 ? 'var(--ims-color-success-text)' : 'var(--ims-color-danger-text)' }}>{statusLabel}</span>
            <span className="ims-cell-meta">{formatPurchaseDate(latestPurchase.date || latestPurchase.createdAt)}</span>
          </Space>
        );
      },
    },
  ];


  const supplierMobileCardConfig = {
    title: (record) => getSupplierDisplayName(record),
    subtitle: (record) => [
      getSupplierBusinessCode(record) || null,
      `${(record.materialDetails || []).length || 0} katalog restock`,
    ].filter(Boolean),
    tags: (record) => {
      const detail = getSupplierTableSummaryDetail(record);
      return [
        supplierIdFromQuery && String(record.id) === String(supplierIdFromQuery) ? <Tag key="selected" color="green">Dipilih</Tag> : null,
        detail ? (
          <Tag key="purchase-type" color={detail.purchaseType === 'offline' ? 'default' : 'blue'}>
            {detail.purchaseType === 'offline' ? 'Offline' : 'Online'}
          </Tag>
        ) : null,
      ].filter(Boolean);
    },
    meta: [
      { label: 'Katalog', value: (record) => `${(record.materialDetails || []).length || 0} item` },
      { label: 'Link Toko', value: (record) => (getSupplierStoreLink(record) ? 'Ada' : 'Belum ada') },
      { label: 'Estimasi', value: (record) => {
        const detail = getSupplierTableSummaryDetail(record);
        if (!detail) return '-';
        const metrics = calculateSupplierMaterialRestockMetrics(detail);
        return metrics.estimatedUnitPrice ? `${formatCurrencyIDR(metrics.estimatedUnitPrice)} / ${detail.stockUnit || 'satuan'}` : '-';
      } },
    ],
    content: (record) => {
      const materialNames = record.supportedMaterialNames || [];
      if (!materialNames.length) return 'Belum ada katalog restock';
      return (
        <Space size={[4, 4]} wrap>
          {materialNames.slice(0, 3).map((name, index) => (
            <Tag key={`${name}-${index}`}>{name}</Tag>
          ))}
          {materialNames.length > 3 ? <Tag>+{materialNames.length - 3} lainnya</Tag> : null}
        </Space>
      );
    },
    actions: (record) => (
      <Space direction="vertical" size={6} className="ims-action-group ims-action-group--vertical">
        <Button className="ims-action-button ims-action-button--block" size="small" icon={<EyeOutlined />} onClick={() => openSupplierDrawer(record)}>
          Detail
        </Button>
        <Button className="ims-action-button ims-action-button--block" size="small" icon={<EditOutlined />} onClick={() => handleEditSupplier(record)}>
          Edit
        </Button>
        <Popconfirm title="Yakin hapus supplier ini?" onConfirm={() => handleDeleteSupplier(record)} okText="Ya" cancelText="Batal">
          <Button className="ims-action-button ims-action-button--block" danger size="small" icon={<DeleteOutlined />}>
            Hapus
          </Button>
        </Popconfirm>
      </Space>
    ),
  };


  return (
    <div className="page-container">
      <PageHeader
        title="Supplier"
        subtitle={
          materialIdFromQuery && selectedMaterialFromQuery
            ? `Supplier untuk bahan ${selectedMaterialFromQuery.name}.`
            : 'Kelola data supplier, kontak toko, dan referensi pembelian.'
        }
        extra={materialIdFromQuery && selectedMaterialFromQuery ? (
          <Button type="link" size="small" onClick={() => navigate('/suppliers')}>
            Reset Filter URL
          </Button>
        ) : null}
        actions={[
          {
            key: 'create-supplier',
            type: 'primary',
            icon: <PlusOutlined />,
            label: 'Tambah Supplier',
            onClick: prepareCreateSupplierForm,
          },
        ]}
      />

      <FilterBar>
        <Col xs={24} md={12}>
          <Search
            placeholder="Cari nama supplier, bahan, link, atau catatan"
            allowClear
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </Col>

        <Col xs={24} md={8}>
          <Select
            placeholder="Filter bahan"
            allowClear
            disabled={isSqliteSupplierMode}
            value={materialFilter}
            onChange={setMaterialFilter}
            style={{ width: '100%' }}
            showSearch
            optionFilterProp="children"
          >
            {materials.map((item) => (
              <Option key={item.id} value={item.id}>
                {item.name}
              </Option>
            ))}
          </Select>
        </Col>

        <Col xs={24} md={4}>
          <Button block onClick={() => { setSearchText(''); setMaterialFilter(undefined); }}>
            Reset Filter
          </Button>
        </Col>
      </FilterBar>

      {/* =====================================================
          SECTION: Table Supplier compact — AKTIF / GUARDED
          Fungsi: table utama Supplier tetap ringkas tanpa horizontal scroll default; detail katalog panjang tetap di drawer.
          Dipakai oleh: Master Data / Supplier sebagai katalog restock, bukan transaksi pembelian.
          Alasan perubahan: batch compact table menjaga action selalu terlihat tanpa fixed/sticky dan tanpa memadatkan flow Purchases.
          Catatan cleanup: detail drawer bisa dipisah ke component sendiri bila file Supplier makin besar.
          Risiko: jangan ubah save Supplier, cascade snapshot Raw Material, prefill Purchases, stok, kas, atau expense dari section UI ini.
      ===================================================== */}
      <PageSection
        title="Daftar Supplier"
        subtitle="Kontak dan katalog."
      >
        <DataRefreshIndicator loading={isLoading} dataSource={filteredSuppliers} />
        <DataTableView
          showRefreshIndicator={false}
          className="app-data-table"
          columns={columns}
          dataSource={filteredSuppliers}
          rowKey="id"
          tableLayout="fixed"
          locale={{
            emptyText: getDataTableEmptyText(
              isLoading,
              loadError ? (
                <Empty description={loadError} />
              ) : materialIdFromQuery ? (
                <Empty description="Belum ada supplier yang menyediakan bahan ini" />
              ) : (
                <Empty description="Belum ada data supplier" />
              ),
            ),
          }}
          mobileCardConfig={supplierMobileCardConfig}
        />
      </PageSection>

      <Modal
        title={isEditing ? 'Edit Supplier' : 'Tambah Supplier'}
        open={modalVisible}
        onCancel={resetSupplierModalState}
        onOk={() => form.submit()}
        okText="Simpan"
        okButtonProps={{ loading: saving || supplierCodeLoading, disabled: supplierCodeLoading }}
        cancelText="Batal"
        width={980}
      >
        <Form form={form} layout="vertical" onFinish={handleSaveSupplier}>
          {/* =====================================================
              SECTION: Supplier code disabled/read-only field — AKTIF / GUARDED
              Fungsi:
              - Menampilkan kode Supplier otomatis sebagai referensi audit yang tidak bisa diedit user.

              Dipakai oleh:
              - Modal tambah/edit Supplier.

              Alasan perubahan:
              - Kode Supplier harus dikunci agar perubahan nama/link/katalog tidak mengubah referensi master.

              Catatan cleanup:
              - Belum ada.

              Risiko:
              - Membuka field ini untuk edit manual dapat membuat Purchases/Raw Material supplier reference tidak konsisten.
          ===================================================== */}
          <Form.Item
            name="code"
            label="Kode Supplier"
            extra={
              isEditing && editingSupplierNeedsCodeRepair
                ? 'Supplier lama belum punya kode bisnis. Normalisasi lewat menu Reset & Maintenance Data.'
                : isEditing
                  ? 'Kode supplier tidak bisa diubah setelah dibuat agar audit tetap konsisten.'
                  : 'Kode supplier dibuat otomatis dengan format SUP-DDMMYYYY-001 dan dikunci untuk audit.'
            }
          >
            <Input
              disabled
              readOnly
              placeholder={supplierCodeLoading ? 'Membuat kode otomatis...' : 'Kode dibuat otomatis'}
            />
          </Form.Item>

          {isEditing && editingSupplierNeedsCodeRepair ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Supplier lama ini belum punya kode bisnis. Normalisasi lewat menu Reset & Maintenance Data agar audit rapi."
            />
          ) : null}

          <Form.Item
            name="storeName"
            label="Nama Supplier / Toko"
            rules={[{ required: true, message: 'Nama supplier wajib diisi' }]}
          >
            <Input placeholder="Nama toko / supplier" />
          </Form.Item>

          <Form.Item name="storeLink" label="Link Toko">
            <Input placeholder="https://link-toko-supplier" />
          </Form.Item>

          {/* -----------------------------------------------------------------
              FIELD LEGACY CATEGORY.
              FUNGSI: field kategori/keterangan supplier lama sengaja tidak lagi
              ditampilkan di UI aktif karena flow restock sekarang fokus pada
              katalog material, satuan, konversi, dan estimasi harga.
              STATUS: legacy read-only; data lama tetap dibaca service tetapi
              bukan input utama.
          ----------------------------------------------------------------- */}

          {!isSqliteSupplierMode ? (
            <Form.List name="materialDetails">
            {(fields, { add, remove }) => (
              <>
                <div className="ims-cell-title" style={{ marginBottom: 4 }}>Katalog Restock Supplier</div>
                <div className="ims-cell-meta" style={{ marginBottom: 12 }}>
                  Isi link, satuan beli, konversi, dan estimasi biaya.
                </div>

                {fields.map(({ key, name, ...restField }) => (
                  <div
                    key={key}
                    style={{
                      border: '1px solid var(--ims-border-color-soft)',
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 12,
                    }}
                  >
                    <Row gutter={[12, 8]}>
                      <Col xs={24} md={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'materialId']}
                          label="Bahan / Raw Material"
                          rules={[{ required: true, message: 'Pilih bahan' }]}
                        >
                          <Select
                            placeholder="Pilih bahan baku"
                            showSearch
                            optionFilterProp="children"
                            onChange={(materialId) => {
                              const selectedMaterial = materials.find((material) => material.id === materialId);
                              updateMaterialDetailAtIndex(name, {
                                materialId,
                                materialName: selectedMaterial?.name || '',
                                stockUnit: getMaterialStockUnit(selectedMaterial),
                              });
                            }}
                          >
                            {materials.map((item) => (
                              <Option key={item.id} value={item.id}>
                                {item.name}
                              </Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item {...restField} name={[name, 'productLink']} label="Link Produk">
                          <Input placeholder="https://link-produk-spesifik" />
                        </Form.Item>
                      </Col>

                      <Form.Item {...restField} name={[name, 'purchaseType']} hidden initialValue="online">
                        <Input />
                      </Form.Item>

                      <Col xs={24} md={8}>
                        <Form.Item shouldUpdate noStyle>
                          {({ getFieldValue }) => {
                            const detail = getFieldValue(['materialDetails', name]) || {};
                            const isOfflinePurchase = detail.purchaseType === 'offline';

                            return (
                              <Form.Item label="Pembelian Offline">
                                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                  {/* -------------------------------------------------------------
                                      Toggle ini hanya menentukan konteks katalog supplier online/offline.
                                      Tidak membuat transaksi dan tidak mengubah stok/kas.
                                      STATUS: aktif dipakai di katalog restock Supplier.
                                  ------------------------------------------------------------- */}
                                  <Switch
                                    checked={isOfflinePurchase}
                                    checkedChildren="Offline"
                                    unCheckedChildren="Online"
                                    onChange={(checked) => {
                                      updateMaterialDetailAtIndex(name, {
                                        purchaseType: checked ? 'offline' : 'online',
                                        ...(checked
                                          ? {
                                              estimatedShippingCost: 0,
                                              serviceFee: 0,
                                              discount: 0,
                                            }
                                          : {}),
                                      });
                                    }}
                                  />
                                  <span className="ims-cell-meta">
                                    {isOfflinePurchase
                                      ? 'Pembelian offline: ongkir, admin, dan voucher tidak dipakai di estimasi.'
                                      : 'Pembelian online: ongkir, admin, dan voucher ikut dihitung jika diisi.'}
                                  </span>
                                </Space>
                              </Form.Item>
                            );
                          }}
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={8}>
                        <Form.Item {...restField} name={[name, 'purchaseUnit']} label="Satuan Beli">
                          <Select placeholder="Pilih satuan" allowClear showSearch>
                            {PURCHASE_UNIT_OPTIONS.map((unit) => (
                              <Option key={unit} value={unit}>{unit}</Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={8}>
                        <Form.Item
                          {...restField}
                          name={[name, 'purchaseQty']}
                          label="Qty Beli"
                          initialValue={1}
                          extra="Contoh: pack, roll, atau dus."
                        >
                          <InputNumber min={1} step={1} precision={0} style={{ width: '100%' }} formatter={(value) => formatNumberID(value)} parser={parseIntegerIdInput} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'conversionValue']}
                          label="Konversi Supplier"
                          extra="Contoh: 1 pack = 6 pcs."
                        >
                          <InputNumber min={0} step={1} precision={0} style={{ width: '100%' }} formatter={(value) => formatNumberID(value)} parser={parseIntegerIdInput} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item {...restField} name={[name, 'stockUnit']} hidden>
                          <Input />
                        </Form.Item>
                        <Form.Item shouldUpdate noStyle>
                          {({ getFieldValue }) => {
                            const detail = getFieldValue(['materialDetails', name]) || {};

                            return (
                              <Alert
                                type={detail.stockUnit ? 'info' : 'warning'}
                                showIcon
                                message={detail.stockUnit ? `Satuan stok: ${detail.stockUnit}` : 'Satuan stok belum diisi di Raw Material.'}
                                description={null}
                              />
                            );
                          }}
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item {...restField} name={[name, 'supplierItemPrice']} label="Harga Barang Supplier">
                          <InputNumber min={0} step={1} precision={0} style={{ width: '100%' }} addonBefore="Rp" formatter={(value) => formatNumberID(value)} parser={parseIntegerIdInput} />
                        </Form.Item>
                      </Col>

                      <Form.Item shouldUpdate noStyle>
                        {({ getFieldValue }) => {
                          const detail = getFieldValue(['materialDetails', name]) || {};
                          const isOfflinePurchase = detail.purchaseType === 'offline';

                          if (isOfflinePurchase) {
                            return null;
                          }

                          return (
                            <>
                              {/* ---------------------------------------------------------
                                  Biaya online hanya tampil untuk katalog online.
                                  ALASAN: offline selalu memakai ongkir/admin/diskon 0 agar
                                  estimasi tidak membawa nilai lama. STATUS: aktif dipakai.
                              --------------------------------------------------------- */}
                              <Col xs={24} md={12}>
                                <Form.Item {...restField} name={[name, 'estimatedShippingCost']} label="Ongkir Default">
                                  <InputNumber min={0} step={1} precision={0} style={{ width: '100%' }} addonBefore="Rp" formatter={(value) => formatNumberID(value)} parser={parseIntegerIdInput} />
                                </Form.Item>
                              </Col>

                              <Col xs={24} md={12}>
                                <Form.Item {...restField} name={[name, 'serviceFee']} label="Biaya Layanan Default">
                                  <InputNumber min={0} step={1} precision={0} style={{ width: '100%' }} addonBefore="Rp" formatter={(value) => formatNumberID(value)} parser={parseIntegerIdInput} />
                                </Form.Item>
                              </Col>

                              <Col xs={24} md={12}>
                                <Form.Item {...restField} name={[name, 'discount']} label="Voucher Default">
                                  <InputNumber min={0} step={1} precision={0} style={{ width: '100%' }} addonBefore="Rp" formatter={(value) => formatNumberID(value)} parser={parseIntegerIdInput} />
                                </Form.Item>
                              </Col>
                            </>
                          );
                        }}
                      </Form.Item>

                      <Col span={24}>
                        <Form.Item {...restField} name={[name, 'note']} label="Catatan">
                          <Input placeholder="Contoh: warna tertentu, minimal order, kualitas bagus" />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Form.Item shouldUpdate noStyle>
                      {({ getFieldValue }) => {
                        const detail = getFieldValue(['materialDetails', name]) || {};
                        const metrics = calculateSupplierMaterialRestockMetrics(detail);

                        return (
                          <Alert
                            type="success"
                            showIcon
                            message="Estimasi Restock"
                            description={
                              <Space direction="vertical" size={2}>
                                <span>Total estimasi: <strong>{formatCurrencyIDR(metrics.totalEstimatedSupplier || 0)}</strong></span>
                                <span>Total stok: <strong>{formatNumberID(metrics.totalStockQty || 0)} {detail.stockUnit || 'satuan stok'}</strong></span>
                                <span>Harga / satuan stok: <strong>{formatCurrencyIDR(metrics.estimatedUnitPrice || 0)}</strong></span>
                              </Space>
                            }
                          />
                        );
                      }}
                    </Form.Item>

                    <Button danger style={{ marginTop: 10 }} onClick={() => remove(name)}>
                      Hapus Baris
                    </Button>
                  </div>
                ))}

                <Button
                  type="dashed"
                  block
                  icon={<PlusOutlined />}
                  onClick={() => add({
                    materialId: undefined,
                    productLink: '',
                    purchaseType: 'online',
                    purchaseUnit: 'pcs',
                    purchaseQty: 1,
                    conversionValue: 0,
                    stockUnit: '',
                    supplierItemPrice: 0,
                    estimatedShippingCost: 0,
                    serviceFee: 0,
                    discount: 0,
                    note: '',
                  })}
                >
                  Tambah Material
                </Button>
              </>
            )}
            </Form.List>
          ) : null}
        </Form>
      </Modal>

      {/* =====================================================
          SECTION: Supplier Detail Drawer — AKTIF
          Fungsi:
          - Menata ringkasan supplier, kontak toko, material supply, dan estimasi restock dalam section yang konsisten.

          Dipakai oleh:
          - Halaman Master Data / Supplier saat user membuka tombol Detail.

          Alasan perubahan:
          - Drawer lama memakai table HTML manual dan terlalu banyak border inline, sehingga detail supplier tidak konsisten dengan drawer Master Data lain.

          Catatan cleanup:
          - Belum ada.

          Risiko:
          - Jangan ubah mapping katalog supplier, cascade snapshot Raw Material, prefill Purchases, atau handler detail dari section presentasi ini.
      ===================================================== */}
      <Drawer
        title={`Detail Supplier: ${getSupplierDisplayName(selectedSupplier || {}) || '-'}`}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setSelectedSupplier(null);
        }}
        width={960}
      >
        {selectedSupplier && (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <Card size="small">
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Space size={[8, 8]} wrap>
                  <Text strong>{getSupplierDisplayName(selectedSupplier)}</Text>
                  <Tag color="green">Katalog Restock</Tag>
                  <Tag>{(selectedSupplier.materialDetails || []).length || 0} item restock</Tag>
                </Space>
                {getSupplierStoreLink(selectedSupplier) ? (
                  <a href={getSupplierStoreLink(selectedSupplier)} target="_blank" rel="noopener noreferrer">
                    {getSupplierStoreLink(selectedSupplier)}
                  </a>
                ) : (
                  <Text type="secondary">Belum ada link toko.</Text>
                )}
              </Space>
            </Card>

            <Card size="small" title="Ringkasan">
              <Descriptions bordered column={1} size="small">
                <Descriptions.Item label="Nama Supplier">{getSupplierDisplayName(selectedSupplier)}</Descriptions.Item>
                <Descriptions.Item label="Kode Supplier">
                  {getSupplierBusinessCode(selectedSupplier) || <Tag color="warning">Perlu repair kode</Tag>}
                </Descriptions.Item>
                <Descriptions.Item label="Link Toko">
                  {getSupplierStoreLink(selectedSupplier) ? (
                    <a href={getSupplierStoreLink(selectedSupplier)} target="_blank" rel="noopener noreferrer">
                      Buka Link Toko
                    </a>
                  ) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Material Terdaftar">
                  {(selectedSupplier.supportedMaterialNames || []).length ? (
                    <Space size={[6, 6]} wrap>
                      {(selectedSupplier.supportedMaterialNames || []).map((name, index) => (
                        <Tag key={`${name}-${index}`}>{name}</Tag>
                      ))}
                    </Space>
                  ) : (
                    'Belum ada material terdaftar'
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" title="Katalog Restock Supplier">
              <DataTableView
                className="app-data-table"
                rowKey={(record, index) => `${record.materialId || record.materialName || 'material'}-${index}`}
                pagination={false}
                showRefreshIndicator={false}
                dataSource={selectedSupplier.materialDetails || []}
                columns={materialDetailColumns}
                size="small"
                tableLayout="fixed"
                mobileCardConfig={{
                  title: (record) => record.materialName || 'Katalog material',
                  subtitle: (record) => record.note || null,
                  tags: (record) => (
                    <Tag color={record.purchaseType === 'online' ? 'blue' : 'default'}>
                      {record.purchaseType === 'online' ? 'Online' : 'Offline'}
                    </Tag>
                  ),
                  meta: [
                    { label: 'Qty Beli', value: (record) => `${formatNumberID(record.purchaseQty || 1)} ${record.purchaseUnit || 'satuan beli'}` },
                    { label: 'Konversi', value: (record) => `${formatNumberID(record.conversionValue || 0)} ${record.stockUnit || 'satuan stok'}` },
                    {
                      label: 'Estimasi/Unit',
                      value: (record) => {
                        const metrics = calculateSupplierMaterialRestockMetrics(record);
                        return metrics.estimatedUnitPrice ? formatCurrencyIDR(metrics.estimatedUnitPrice) : '-';
                      },
                    },
                  ],
                  content: (record) => record.productLink ? (
                    <a href={record.productLink} target="_blank" rel="noopener noreferrer">Buka Link Produk</a>
                  ) : null,
                }}
                locale={{ emptyText: <Empty description="Belum ada katalog restock supplier" /> }}
              />
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default SupplierPurchases;
