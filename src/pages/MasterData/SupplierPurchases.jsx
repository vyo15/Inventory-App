import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Col,
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
  Table,
  Tag,
  message,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, limit as firestoreLimit, orderBy, query } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { formatNumberID } from '../../utils/formatters/numberId';
import { formatCurrencyIDR } from '../../utils/formatters/currencyId';
import {
  calculateSupplierMaterialRestockMetrics,
  cascadeSupplierSnapshotToRawMaterials,
  clearSupplierSnapshotFromRawMaterials,
  doesSupplierProvideMaterial,
  getSupplierDisplayName,
  getSupplierStoreLink,
  isManagedSupplierRecord,
  listenSuppliers,
} from '../../services/MasterData/suppliersService';
import PageHeader from '../../components/Layout/Page/PageHeader';

const { Option } = Select;
const { Search } = Input;

// -----------------------------------------------------------------------------
// Opsi satuan beli katalog supplier.
// FUNGSI: membantu user mencatat konteks harga supplier tanpa membuat transaksi.
// HUBUNGAN FLOW: dipakai hanya di menu Supplier sebagai katalog restock.
// STATUS: aktif dipakai; bukan business rule stok.
// -----------------------------------------------------------------------------
const PURCHASE_UNIT_OPTIONS = ['pcs', 'meter', 'roll', 'pack', 'ikat', 'dus', 'lainnya'];

// -----------------------------------------------------------------------------
// AKTIF + GUARDED: batas histori purchase untuk pembanding Supplier.
// FUNGSI: mencegah halaman Supplier membaca seluruh collection purchases saat
// data real mulai banyak.
// HUBUNGAN FLOW: hanya memengaruhi pembanding read-only; tidak membuat purchase,
// tidak mengubah stok, kas, expense, Supplier, atau Raw Material.
// LEGACY: purchase lama yang sangat tua bisa tidak muncul di pembanding ringkas;
// laporan lengkap tetap berada di menu Laporan/Purchases.
// CLEANUP CANDIDATE: ganti ke lookup per material jika nanti service latest
// purchase dan index Firestore sudah final.
// -----------------------------------------------------------------------------
const SUPPLIER_PURCHASE_LOOKUP_LIMIT = 500;

// -----------------------------------------------------------------------------
// Helper format tanggal purchase terakhir.
// FUNGSI: menampilkan histori pembelian sebagai perbandingan harga read-only.
// STATUS: aktif dipakai di detail Supplier; tidak menulis transaksi.
// -----------------------------------------------------------------------------
const formatPurchaseDate = (value) => {
  if (!value) return '-';
  const dateValue = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(dateValue.getTime())) return '-';
  return dateValue.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// -----------------------------------------------------------------------------
// Helper timestamp aman untuk sorting purchase terakhir.
// STATUS: aktif dipakai hanya untuk perbandingan harga di Supplier detail.
// -----------------------------------------------------------------------------
const getPurchaseTime = (purchase = {}) => {
  const value = purchase.date || purchase.purchaseDate || purchase.createdAt || purchase.updatedAt;
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
};

// -----------------------------------------------------------------------------
// Helper satuan stok bahan.
// FUNGSI: otomatis mengisi satuan stok pada katalog supplier dari Raw Material.
// STATUS: aktif dipakai; null-safe untuk data lama.
// -----------------------------------------------------------------------------
const getMaterialStockUnit = (material = {}) => {
  return material.stockUnit || material.unit || material.baseUnit || '';
};

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
  const [searchText, setSearchText] = useState('');
  const [materialFilter, setMaterialFilter] = useState(undefined);

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

  // ---------------------------------------------------------------------------
  // Load master supplier, bahan baku, dan purchases.
  // FUNGSI: Supplier tetap katalog restock; purchase hanya dibaca read-only untuk
  // menampilkan perbandingan harga terakhir beli.
  // BATASAN: tidak menulis purchase, stok, kas, atau raw material.
  // STATUS: aktif dipakai.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsubscribeSuppliers = listenSuppliers(
      (nextSuppliers) => setSuppliers(nextSuppliers),
      (error) => {
        console.error(error);
        message.error('Gagal memuat supplier.');
      },
    );

    const unsubscribeMaterials = onSnapshot(
      collection(db, 'raw_materials'),
      (snapshot) => {
        setMaterials(snapshot.docs.map((documentItem) => ({ id: documentItem.id, ...documentItem.data() })));
      },
      (error) => {
        console.error(error);
        message.error('Gagal memuat bahan baku untuk referensi supplier.');
      },
    );

    const purchaseHistoryQuery = query(
      collection(db, 'purchases'),
      orderBy('date', 'desc'),
      firestoreLimit(SUPPLIER_PURCHASE_LOOKUP_LIMIT),
    );

    const unsubscribePurchases = onSnapshot(
      purchaseHistoryQuery,
      (snapshot) => {
        // -------------------------------------------------------------------
        // AKTIF + GUARDED: histori purchase dibaca terbatas dan terbaru dulu.
        // FUNGSI: pembanding harga Supplier tetap cepat saat data real banyak.
        // HUBUNGAN FLOW: read-only; tidak membuat purchase, tidak mengubah stok,
        // kas, Supplier, Raw Material, expense, atau laporan.
        // LEGACY: pembanding untuk purchase sangat lama tetap bukan source of truth
        // laporan; laporan lengkap tetap di menu Laporan.
        // CLEANUP CANDIDATE: pindahkan ke service latest purchase per material
        // jika nanti index Firestore final sudah dikunci.
        // -------------------------------------------------------------------
        setPurchaseRecords(snapshot.docs.map((documentItem) => ({ id: documentItem.id, ...documentItem.data() })));
      },
      (error) => {
        console.error(error);
        message.warning('Histori purchase belum bisa dimuat untuk pembanding supplier.');
      },
    );

    return () => {
      unsubscribeSuppliers();
      unsubscribeMaterials();
      unsubscribePurchases();
    };
  }, []);

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
        if (!materialIdFromQuery) return true;
        return doesSupplierProvideMaterial(supplier, materialIdFromQuery);
      })
      .filter((supplier) => {
        if (!materialFilter) return true;
        return doesSupplierProvideMaterial(supplier, materialFilter);
      })
      .filter((supplier) => {
        if (!keyword) return true;

        const searchableText = [
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
  }, [suppliers, materialIdFromQuery, materialFilter, searchText]);

  // ---------------------------------------------------------------------------
  // Helper purchase terakhir per material.
  // FUNGSI: membaca harga terakhir beli sebagai pembanding katalog supplier.
  // BATASAN: read-only; tidak mengubah purchase dan tidak membuat purchase baru.
  // STATUS: aktif dipakai di detail Supplier.
  // ---------------------------------------------------------------------------
  const getLatestPurchaseForMaterial = (materialId) => {
    if (!materialId) return null;

    return (purchaseRecords || [])
      .filter((purchase) => {
        const purchaseType = String(purchase.itemType || purchase.type || '').toLowerCase();
        return purchaseType === 'material';
      })
      .filter((purchase) => String(purchase.itemId || purchase.materialId || purchase.rawMaterialId || '') === String(materialId))
      .sort((leftPurchase, rightPurchase) => getPurchaseTime(rightPurchase) - getPurchaseTime(leftPurchase))[0] || null;
  };

  // ---------------------------------------------------------------------------
  // Reset state modal agar buka/tutup form selalu bersih.
  // STATUS: aktif dipakai form create/edit supplier.
  // ---------------------------------------------------------------------------
  const resetSupplierModalState = () => {
    setModalVisible(false);
    setIsEditing(false);
    setEditingId(null);
    setSaving(false);
    form.resetFields();
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

    return {
      storeName: values.storeName,
      storeLink: values.storeLink || '',
      // Field kategori lama tidak lagi disimpan dari UI aktif. Jika ada data lama,
      // service tetap membacanya sebagai legacy read-only.
      supportedMaterialIds: materialDetails.map((item) => item.materialId),
      supportedMaterialNames: materialDetails.map((item) => item.materialName),
      materialDetails,
      updatedAt: serverTimestamp(),
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
        await updateDoc(doc(db, 'supplierPurchases', editingId), payload);

        try {
          const affectedMaterials = await cascadeSupplierSnapshotToRawMaterials(editingId, {
            id: editingId,
            ...payload,
          });

          message.success(
            affectedMaterials > 0
              ? `Supplier berhasil diupdate. Snapshot ${affectedMaterials} bahan ikut diperbarui.`
              : 'Supplier berhasil diupdate.',
          );
        } catch (snapshotError) {
          console.error('Gagal memperbarui snapshot supplier di Raw Material.', snapshotError);
          message.warning('Supplier berhasil diupdate, tetapi snapshot bahan belum ikut diperbarui. Coba simpan ulang supplier.');
        }
      } else {
        await addDoc(collection(db, 'supplierPurchases'), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        message.success('Supplier berhasil ditambahkan.');
      }

      resetSupplierModalState();
    } catch (error) {
      console.error(error);
      message.error('Gagal menyimpan supplier.');
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Isi modal saat edit supplier.
  // FUNGSI: memetakan data lama dan baru ke form katalog restock.
  // STATUS: aktif; backward-compatible untuk supplier lama tanpa field baru.
  // ---------------------------------------------------------------------------
  const handleEditSupplier = (record) => {
    setIsEditing(true);
    setEditingId(record.id);
    setModalVisible(true);

    form.setFieldsValue({
      storeName: getSupplierDisplayName(record),
      storeLink: getSupplierStoreLink(record),
      materialDetails:
        (record.materialDetails || []).length > 0
          ? record.materialDetails.map((item) => {
              // ---------------------------------------------------------------
              // BACKWARD COMPATIBILITY FORM MAPPER.
              // FUNGSI: membuka supplier lama/baru ke form tanpa crash.
              // ALASAN: data lama belum punya toggle offline, sehingga type
              // ditentukan dari purchaseType atau keberadaan link produk.
              // STATUS: aktif dipakai saat edit Supplier; bukan migration.
              // ---------------------------------------------------------------
              const purchaseType = item.purchaseType || (item.productLink ? 'online' : 'offline');
              const isOfflinePurchase = purchaseType === 'offline';

              return {
                materialId: item.materialId,
                materialName: item.materialName,
                productLink: item.productLink || '',
                purchaseType,
                purchaseUnit: item.purchaseUnit || '',
                purchaseQty: Number(item.purchaseQty || 1),
                conversionValue: Number(item.conversionValue || 0),
                stockUnit: item.stockUnit || '',
                supplierItemPrice: Math.round(Number(item.supplierItemPrice || 0)),
                estimatedShippingCost: isOfflinePurchase ? 0 : Math.round(Number(item.estimatedShippingCost || 0)),
                serviceFee: isOfflinePurchase ? 0 : Math.round(Number(item.serviceFee || 0)),
                discount: isOfflinePurchase ? 0 : Math.round(Number(item.discount || 0)),
                note: item.note || '',
              };
            })
          : [],
    });
  };

  // ---------------------------------------------------------------------------
  // Hapus supplier dari master dan bersihkan snapshot pada Raw Material terkait.
  // STATUS: aktif; tidak mengubah stok, harga, purchase, atau katalog material.
  // ---------------------------------------------------------------------------
  const handleDeleteSupplier = async (record) => {
    if (!isManagedSupplierRecord(record)) {
      message.warning('Supplier ini bukan record master yang bisa dihapus dari halaman ini.');
      return;
    }

    try {
      await deleteDoc(doc(db, 'supplierPurchases', record.id));

      try {
        const clearedMaterials = await clearSupplierSnapshotFromRawMaterials(record.id);
        message.success(
          clearedMaterials > 0
            ? `Supplier berhasil dihapus. Snapshot supplier di ${clearedMaterials} bahan ikut dibersihkan.`
            : 'Supplier berhasil dihapus dari master supplier.',
        );
      } catch (snapshotError) {
        console.error('Gagal membersihkan snapshot supplier di Raw Material.', snapshotError);
        message.warning('Supplier berhasil dihapus, tetapi snapshot di bahan belum ikut dibersihkan. Cek Raw Material terkait.');
      }
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
  // Supplier table summary helper.
  // FUNGSI: memilih satu katalog representatif untuk ringkasan table Supplier.
  // ALASAN: table harus informatif untuk membandingkan supplier, tetapi detail
  // lengkap tetap ada di drawer agar UI tidak terlalu penuh.
  // STATUS: aktif dipakai; tidak mengubah data dan bukan transaksi.
  // ---------------------------------------------------------------------------
  const getSupplierTableSummaryDetail = (supplier = {}) => {
    const restockDetails = (supplier.materialDetails || []).filter((detail) => detail.materialId || detail.materialName);
    if (!restockDetails.length) return null;

    return [...restockDetails].sort((leftDetail, rightDetail) => {
      const leftPrice = calculateSupplierMaterialRestockMetrics(leftDetail).estimatedUnitPrice || Number.MAX_SAFE_INTEGER;
      const rightPrice = calculateSupplierMaterialRestockMetrics(rightDetail).estimatedUnitPrice || Number.MAX_SAFE_INTEGER;
      return leftPrice - rightPrice;
    })[0];
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
      width: '24%',
      render: (_, record) => (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Space size={6} wrap>
            <span style={{ fontWeight: 600 }}>{getSupplierDisplayName(record)}</span>
            {supplierIdFromQuery && String(record.id) === String(supplierIdFromQuery) ? (
              <Tag color="green">Dipilih</Tag>
            ) : null}
          </Space>
          <span style={{ color: '#666' }}>
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
          <span style={{ color: '#999' }}>Belum ada link</span>
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
              <span style={{ color: '#666' }}>
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
      width: '20%',
      render: (_, record) => {
        const detail = getSupplierTableSummaryDetail(record);
        if (!detail) return '-';

        const metrics = calculateSupplierMaterialRestockMetrics(detail);
        if (!metrics.estimatedUnitPrice) return '-';

        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <span style={{ fontWeight: 600 }}>{formatCurrencyIDR(metrics.estimatedUnitPrice)} / {detail.stockUnit || 'satuan'}</span>
            <span style={{ color: '#666' }}>
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
      width: 150,
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
          <Button className="ims-action-button ims-action-button--block" block size="small" icon={<EyeOutlined />} onClick={() => openSupplierDrawer(record)}>
            Detail
          </Button>
          <Button className="ims-action-button ims-action-button--block" block size="small" icon={<EditOutlined />} onClick={() => handleEditSupplier(record)}>
            Edit
          </Button>
          <Popconfirm title="Yakin hapus supplier ini?" onConfirm={() => handleDeleteSupplier(record)} okText="Ya" cancelText="Batal">
            <Button className="ims-action-button ims-action-button--block" block danger size="small" icon={<DeleteOutlined />}>
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
      title: 'Bahan',
      dataIndex: 'materialName',
      render: (value, record) => (
        <Space direction="vertical" size={2}>
          <span style={{ fontWeight: 600 }}>{value || '-'}</span>
          <Tag color={record.purchaseType === 'online' ? 'blue' : 'default'}>
            {record.purchaseType === 'online' ? 'Online' : 'Offline'}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Link Produk',
      dataIndex: 'productLink',
      render: (value) =>
        value ? (
          <a href={value} target="_blank" rel="noopener noreferrer">
            Buka Link
          </a>
        ) : (
          '-'
        ),
    },
    {
      title: 'Qty Beli / Konversi Supplier',
      key: 'unitConversion',
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <span>
            {formatNumberID(record.purchaseQty || 1)} {record.purchaseUnit || 'satuan beli'}
          </span>
          <span style={{ color: '#666' }}>
            = {formatNumberID(record.conversionValue || 0)} {record.stockUnit || 'satuan stok'}
          </span>
        </Space>
      ),
    },
    {
      title: 'Harga Supplier Tercatat',
      key: 'supplierEstimate',
      render: (_, record) => {
        const metrics = calculateSupplierMaterialRestockMetrics(record);
        const isOfflinePurchase = record.purchaseType === 'offline';
        return (
          <Space direction="vertical" size={2}>
            <span>Total: {metrics.totalEstimatedSupplier ? formatCurrencyIDR(metrics.totalEstimatedSupplier) : '-'}</span>
            <span style={{ fontWeight: 600 }}>
              / {record.stockUnit || 'satuan'}: {metrics.estimatedUnitPrice ? formatCurrencyIDR(metrics.estimatedUnitPrice) : '-'}
            </span>
            {isOfflinePurchase ? (
              <span style={{ color: '#999' }}>Offline: ongkir/admin/voucher tidak dipakai</span>
            ) : (
              <span style={{ color: '#999' }}>
                Barang {formatCurrencyIDR(metrics.supplierItemPrice || 0)} + Ongkir {formatCurrencyIDR(metrics.estimatedShippingCost || 0)} + Admin {formatCurrencyIDR(metrics.serviceFee || 0)} - Diskon {formatCurrencyIDR(metrics.discount || 0)}
              </span>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Pembanding Terakhir',
      key: 'latestPurchase',
      render: (_, record) => {
        const latestPurchase = getLatestPurchaseForMaterial(record.materialId);
        const metrics = calculateSupplierMaterialRestockMetrics(record);
        const latestUnitCost = Math.round(Number(latestPurchase?.actualUnitCost || 0));

        if (!latestPurchase || !latestUnitCost) {
          return <span style={{ color: '#999' }}>Belum ada histori pembelian</span>;
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
            <span style={{ color: difference <= 0 ? '#389e0d' : '#cf1322' }}>{statusLabel}</span>
            <span style={{ color: '#999' }}>{formatPurchaseDate(latestPurchase.date || latestPurchase.createdAt)}</span>
          </Space>
        );
      },
    },
    {
      title: 'Catatan',
      dataIndex: 'note',
      render: (value) => (
        value ? (
          <span
            title={value}
            style={{
              display: 'inline-block',
              maxWidth: 180,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              verticalAlign: 'bottom',
            }}
          >
            {value}
          </span>
        ) : '-'
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Supplier"
        subtitle={materialIdFromQuery && selectedMaterialFromQuery ? (
          <span>
            Menampilkan supplier untuk bahan: <strong>{selectedMaterialFromQuery.name}</strong>{" "}
            <Button type="link" size="small" onClick={() => navigate('/suppliers')} style={{ paddingInline: 4 }}>
              Reset Filter URL
            </Button>
          </span>
        ) : (
          "Katalog restock supplier dan pembanding harga"
        )}
        actions={[
          {
            key: 'add-supplier',
            type: 'primary',
            icon: <PlusOutlined />,
            label: 'Tambah Supplier',
            onClick: () => {
              setModalVisible(true);
              setIsEditing(false);
              setEditingId(null);
              form.resetFields();
              form.setFieldsValue({ materialDetails: [] });
            },
          },
        ]}
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Supplier adalah katalog restock, bukan transaksi pembelian"
        description="Supplier hanya menyimpan katalog restock dan pembanding. Stok, kas, expense, dan harga aktual tetap berubah lewat Purchases saat user klik Simpan."
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
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
      </Row>

      {/* -------------------------------------------------------------------
          TABLE UTAMA TANPA HORIZONTAL SCROLL PAKSA.
          FUNGSI: table Supplier tetap ringkas di laptop normal dan action tidak
          perlu digeser ke kanan. Detail katalog panjang tetap dibuka di drawer.
          STATUS: aktif sebagai UI cleanup; tidak mengubah save Supplier.
      ------------------------------------------------------------------- */}
      <Table
        className="app-data-table"
        columns={columns}
        dataSource={filteredSuppliers}
        rowKey="id"
        tableLayout="fixed"
        locale={{
          emptyText: materialIdFromQuery ? (
            <Empty description="Belum ada supplier yang menyediakan bahan ini" />
          ) : (
            <Empty description="Belum ada data supplier" />
          ),
        }}
      />

      <Modal
        title={isEditing ? 'Edit Supplier' : 'Tambah Supplier'}
        open={modalVisible}
        onCancel={resetSupplierModalState}
        onOk={() => form.submit()}
        okText="Simpan"
        okButtonProps={{ loading: saving }}
        cancelText="Batal"
        width={980}
      >
        <Form form={form} layout="vertical" onFinish={handleSaveSupplier}>
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

          <Form.List name="materialDetails">
            {(fields, { add, remove }) => (
              <>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Katalog Restock Supplier</div>
                <div style={{ color: '#666', marginBottom: 12 }}>
                  Isi link produk, satuan beli, konversi, dan estimasi biaya. Data ini hanya referensi/pembanding, bukan transaksi.
                </div>

                {fields.map(({ key, name, ...restField }) => (
                  <div
                    key={key}
                    style={{
                      border: '1px solid #f0f0f0',
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
                                  <span style={{ color: '#666' }}>
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
                          extra="Contoh: beli 1 pack, 1 roll, 1 ikat, atau 1 dus."
                        >
                          <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} formatter={(value) => formatNumberID(value)} parser={(value) => value?.replace(/\./g, '') || ''} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'conversionValue']}
                          label="Konversi Supplier"
                          extra="Contoh: beli 1 pack isi 6 pcs, maka Konversi Supplier = 6."
                        >
                          <InputNumber min={0} step={0.01} style={{ width: '100%' }} formatter={(value) => formatNumberID(value)} parser={(value) => value?.replace(/\./g, '') || ''} />
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
                                description="Satuan ini otomatis diambil dari Raw Material dan dipakai untuk menghitung harga estimasi per satuan stok."
                              />
                            );
                          }}
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item {...restField} name={[name, 'supplierItemPrice']} label="Harga Barang Supplier">
                          <InputNumber min={0} style={{ width: '100%' }} addonBefore="Rp" formatter={(value) => formatNumberID(value)} parser={(value) => value?.replace(/\./g, '') || ''} />
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
                                  <InputNumber min={0} style={{ width: '100%' }} addonBefore="Rp" formatter={(value) => formatNumberID(value)} parser={(value) => value?.replace(/\./g, '') || ''} />
                                </Form.Item>
                              </Col>

                              <Col xs={24} md={12}>
                                <Form.Item {...restField} name={[name, 'serviceFee']} label="Biaya Layanan Default">
                                  <InputNumber min={0} style={{ width: '100%' }} addonBefore="Rp" formatter={(value) => formatNumberID(value)} parser={(value) => value?.replace(/\./g, '') || ''} />
                                </Form.Item>
                              </Col>

                              <Col xs={24} md={12}>
                                <Form.Item {...restField} name={[name, 'discount']} label="Voucher Default">
                                  <InputNumber min={0} style={{ width: '100%' }} addonBefore="Rp" formatter={(value) => formatNumberID(value)} parser={(value) => value?.replace(/\./g, '') || ''} />
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
                            message="Harga Supplier Tercatat"
                            description={
                              <Space direction="vertical" size={2}>
                                <span>Total Estimasi Supplier: <strong>{formatCurrencyIDR(metrics.totalEstimatedSupplier || 0)}</strong></span>
                                <span>Total Stok dari Konversi: <strong>{formatNumberID(metrics.totalStockQty || 0)} {detail.stockUnit || 'satuan stok'}</strong></span>
                                <span>Harga Supplier Tercatat / Satuan Stok: <strong>{formatCurrencyIDR(metrics.estimatedUnitPrice || 0)}</strong></span>
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
        </Form>
      </Modal>

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
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
              <tbody>
                <tr>
                  <td style={{ width: 220, padding: 10, border: '1px solid #f0f0f0' }}>Nama Supplier</td>
                  <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>{getSupplierDisplayName(selectedSupplier)}</td>
                </tr>
                <tr>
                  <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>Sumber Data</td>
                  <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>Master supplier / katalog restock</td>
                </tr>
                <tr>
                  <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>Link Toko</td>
                  <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>
                    {getSupplierStoreLink(selectedSupplier) ? (
                      <a href={getSupplierStoreLink(selectedSupplier)} target="_blank" rel="noopener noreferrer">
                        {getSupplierStoreLink(selectedSupplier)}
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>Material Terdaftar</td>
                  <td style={{ padding: 10, border: '1px solid #f0f0f0' }}>
                    {(selectedSupplier.supportedMaterialNames || []).length ? (
                      <Space size={[6, 6]} wrap>
                        {(selectedSupplier.supportedMaterialNames || []).map((name, index) => (
                          <Tag key={`${name}-${index}`}>{name}</Tag>
                        ))}
                      </Space>
                    ) : (
                      'Belum ada material terdaftar'
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ fontWeight: 700, marginBottom: 12 }}>Katalog Restock Supplier</div>
            <Table
              rowKey={(record, index) => `${record.materialId || record.materialName || 'material'}-${index}`}
              pagination={false}
              dataSource={selectedSupplier.materialDetails || []}
              columns={materialDetailColumns}
              scroll={{ x: 960 }}
              locale={{ emptyText: <Empty description="Belum ada katalog restock supplier" /> }}
            />
          </>
        )}
      </Drawer>
    </div>
  );
};

export default SupplierPurchases;
