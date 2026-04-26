import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebase';

// -----------------------------------------------------------------------------
// SUPPLIER MASTER CONFIG.
// FUNGSI: menyimpan nama collection supplier aktif yang dipakai Raw Material,
// Purchases, dan halaman Supplier.
// HUBUNGAN FLOW: Supplier adalah katalog vendor/restock, bukan transaksi pembelian.
// STATUS: aktif dipakai; bukan kandidat cleanup.
// -----------------------------------------------------------------------------
const SUPPLIER_MASTER_COLLECTION = 'supplierPurchases';
const RAW_MATERIAL_COLLECTION = 'raw_materials';
const BATCH_LIMIT = 450;

// -----------------------------------------------------------------------------
// BASIC NORMALIZER HELPERS.
// FUNGSI: menjaga parsing string/angka supplier tetap null-safe untuk data lama.
// HUBUNGAN FLOW: semua helper katalog supplier memakai fungsi ini agar field baru
// optional dan tidak membuat supplier lama crash.
// STATUS: aktif dipakai; bukan legacy.
// -----------------------------------------------------------------------------
const safeTrim = (value) => String(value || '').trim();
const toNumberSafe = (value, fallback = 0) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};
const toRoundedNumber = (value, fallback = 0) => Math.round(toNumberSafe(value, fallback));

// -----------------------------------------------------------------------------
// Helper normalisasi key untuk dedupe nama/link supplier.
// STATUS: aktif dipakai untuk menjaga materialDetails tidak dobel.
// -----------------------------------------------------------------------------
const normalizeKey = (value) =>
  safeTrim(value)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

// -----------------------------------------------------------------------------
// Dedupe array string tanpa peduli kapital atau spasi ganda.
// STATUS: aktif dipakai untuk supportedMaterialIds/supportedMaterialNames.
// -----------------------------------------------------------------------------
const uniqueStrings = (values = []) => {
  const seen = new Set();

  return (values || [])
    .flat()
    .map((value) => safeTrim(value))
    .filter((value) => {
      if (!value) return false;

      const normalizedValue = normalizeKey(value);
      if (seen.has(normalizedValue)) return false;

      seen.add(normalizedValue);
      return true;
    });
};

// -----------------------------------------------------------------------------
// Ambil nama supplier terbaik dari schema lama maupun baru.
// FUNGSI: menjaga kompatibilitas data lama tanpa menjadikan field lama sebagai
// input utama flow restock.
// STATUS: aktif dipakai di Raw Material, Supplier, dan Purchases.
// -----------------------------------------------------------------------------
export const getSupplierDisplayName = (supplier = {}) => {
  return (
    safeTrim(supplier.storeName) ||
    safeTrim(supplier.name) ||
    safeTrim(supplier.supplierName) ||
    safeTrim(supplier.title) ||
    safeTrim(supplier.item) ||
    'Supplier tanpa nama'
  );
};

// -----------------------------------------------------------------------------
// Ambil link toko supplier terbaik dari field lama maupun baru.
// FUNGSI: link toko hanya fallback/navigasi katalog, bukan link produk pembelian.
// STATUS: aktif dipakai sebagai referensi toko.
// -----------------------------------------------------------------------------
export const getSupplierLink = (supplier = {}) => {
  return (
    safeTrim(supplier.storeLink) ||
    safeTrim(supplier.link) ||
    safeTrim(supplier.url) ||
    safeTrim(supplier.shopLink) ||
    safeTrim(supplier.supplierLink) ||
    ''
  );
};

// -----------------------------------------------------------------------------
// Alias kompatibilitas lama agar file lain tidak whitescreen.
// STATUS: aktif sebagai compatibility import.
// -----------------------------------------------------------------------------
export const getSupplierStoreLink = getSupplierLink;

// -----------------------------------------------------------------------------
// Field kategori/keterangan supplier lama.
// FUNGSI: tetap dibaca sebagai legacy agar data lama tidak hilang, tetapi tidak
// lagi dipakai sebagai input utama UI Supplier.
// STATUS: legacy read-only / kandidat cleanup setelah data lama tidak dibutuhkan.
// -----------------------------------------------------------------------------
const getSupplierCategory = (supplier = {}) => {
  return safeTrim(supplier.category || supplier.description || supplier.type || supplier.note || '');
};

// -----------------------------------------------------------------------------
// Builder label dropdown supplier.
// FUNGSI: label aktif kini fokus ke nama supplier/toko agar flow restock tidak
// bercampur dengan kategori legacy.
// STATUS: aktif dipakai di form Raw Material dan Purchases.
// -----------------------------------------------------------------------------
export const buildSupplierDisplayLabel = (supplier = {}) => getSupplierDisplayName(supplier);
export const getSupplierOptionLabel = (supplier = {}) => buildSupplierDisplayLabel(supplier);

// -----------------------------------------------------------------------------
// Status record supplier master.
// FUNGSI: memastikan halaman Supplier hanya mengelola record master aktif.
// STATUS: aktif dipakai; legacy fallback supplier tidak lagi dipakai.
// -----------------------------------------------------------------------------
export const isManagedSupplierRecord = (supplier = {}) => {
  return (supplier.sourceCollection || SUPPLIER_MASTER_COLLECTION) === SUPPLIER_MASTER_COLLECTION;
};
export const isMasterSupplierRecord = isManagedSupplierRecord;
export const isLegacyMaterialSupplierRecord = () => false;

// -----------------------------------------------------------------------------
// Ambil supplierId aman untuk snapshot manual raw material / transaksi.
// STATUS: aktif dipakai Raw Material, Supplier cascade, dan Purchases payload.
// -----------------------------------------------------------------------------
export const getSupplierReferenceId = (supplier = {}, fallbackId = null) => {
  return (
    safeTrim(supplier.masterSupplierId) ||
    safeTrim(supplier.firestoreSupplierId) ||
    safeTrim(supplier.id) ||
    safeTrim(fallbackId) ||
    null
  );
};

// -----------------------------------------------------------------------------
// Normalisasi tipe pembelian supplier.
// FUNGSI: online/offline dipakai untuk konteks ongkir/admin/diskon di katalog.
// ALASAN: data lama belum punya purchaseType, jadi default dibuat aman.
// STATUS: aktif dipakai oleh normalisasi materialDetails.
// -----------------------------------------------------------------------------
export const normalizeSupplierPurchaseType = (detail = {}) => {
  const purchaseType = safeTrim(detail.purchaseType || detail.buyingType).toLowerCase();
  if (purchaseType === 'offline') return 'offline';
  if (purchaseType === 'online') return 'online';
  return safeTrim(detail.productLink) ? 'online' : 'offline';
};

// -----------------------------------------------------------------------------
// Hitung estimasi supplier per material.
// FUNGSI: menghitung Total Estimasi Supplier dan Harga Estimasi per Satuan Stok
// dari katalog supplier, bukan dari transaksi aktual.
// HUBUNGAN FLOW: nilai ini dipakai sebagai pembanding/Purchases prefill; tidak
// mengubah stok, kas, expense, saving, atau Raw Material.
// STATUS: aktif dipakai oleh Supplier UI dan Purchases.
// -----------------------------------------------------------------------------
export const calculateSupplierMaterialRestockMetrics = (detail = {}) => {
  // ---------------------------------------------------------------------------
  // SUPPLIER ONLINE/OFFLINE COST GUARD.
  // FUNGSI: menghitung estimasi katalog supplier dengan konteks online/offline.
  // ALASAN: pembelian offline tidak memakai ongkir/admin/voucher sehingga nilai
  // lama harus dianggap 0 agar estimasi tidak diam-diam ikut berubah.
  // STATUS: aktif dipakai oleh Supplier UI dan Purchases; bukan transaksi dan
  // tidak mengubah stok/kas/laporan.
  // ---------------------------------------------------------------------------
  const purchaseType = normalizeSupplierPurchaseType(detail);
  const isOfflinePurchase = purchaseType === 'offline';
  const purchaseQty = Math.max(toNumberSafe(detail.purchaseQty ?? detail.qtyPerPurchase ?? detail.packageQty, 1), 0);
  const conversionValue = Math.max(toNumberSafe(detail.conversionValue ?? detail.conversionToStock ?? detail.stockConversion, 0), 0);
  const totalStockQty = purchaseQty * conversionValue;

  const legacyReferencePrice = toRoundedNumber(detail.referencePrice || 0);
  const supplierItemPrice = toRoundedNumber(
    detail.supplierItemPrice ?? detail.itemPrice ?? detail.goodsPrice ?? detail.supplierPrice ?? 0,
  );
  const estimatedShippingCost = isOfflinePurchase
    ? 0
    : toRoundedNumber(detail.estimatedShippingCost ?? detail.shippingCost ?? detail.ongkir ?? 0);
  const serviceFee = isOfflinePurchase
    ? 0
    : toRoundedNumber(detail.serviceFee ?? detail.adminFee ?? detail.platformFee ?? 0);
  const discount = isOfflinePurchase
    ? 0
    : toRoundedNumber(detail.discount ?? detail.voucherDiscount ?? detail.supplierDiscount ?? 0);

  const calculatedTotal = Math.max(supplierItemPrice + estimatedShippingCost + serviceFee - discount, 0);
  const fallbackTotal = legacyReferencePrice > 0 && totalStockQty > 0 ? legacyReferencePrice * totalStockQty : legacyReferencePrice;
  const totalEstimatedSupplier = calculatedTotal > 0 ? calculatedTotal : fallbackTotal;
  const estimatedUnitPrice = totalStockQty > 0
    ? Math.round(totalEstimatedSupplier / totalStockQty)
    : legacyReferencePrice;

  return {
    purchaseType,
    purchaseQty,
    conversionValue,
    totalStockQty,
    supplierItemPrice,
    estimatedShippingCost,
    serviceFee,
    discount,
    totalEstimatedSupplier: Math.round(totalEstimatedSupplier || 0),
    estimatedUnitPrice: Math.round(estimatedUnitPrice || 0),
  };
};

// -----------------------------------------------------------------------------
// Normalisasi satu baris materialDetails supplier.
// FUNGSI: menyatukan field katalog lama dan baru agar UI/Purchases mendapat bentuk
// data yang sama.
// STATUS: aktif dipakai; backward-compatible dengan supplier lama.
// -----------------------------------------------------------------------------
const normalizeSupplierMaterialDetail = (detail = {}) => {
  const metrics = calculateSupplierMaterialRestockMetrics(detail);
  const purchaseType = normalizeSupplierPurchaseType(detail);
  const purchaseUnit = safeTrim(detail.purchaseUnit || detail.buyingUnit || detail.unitPerPurchase || '');
  const stockUnit = safeTrim(detail.stockUnit || detail.materialStockUnit || detail.baseUnit || '');

  return {
    ...detail,
    materialId: safeTrim(detail.materialId),
    materialName: safeTrim(detail.materialName),
    productLink: safeTrim(detail.productLink),
    purchaseType,
    purchaseUnit,
    purchaseQty: metrics.purchaseQty || 1,
    conversionValue: metrics.conversionValue || 0,
    stockUnit,
    supplierItemPrice: metrics.supplierItemPrice || 0,
    estimatedShippingCost: metrics.estimatedShippingCost || 0,
    serviceFee: metrics.serviceFee || 0,
    discount: metrics.discount || 0,
    totalStockQty: metrics.totalStockQty || 0,
    totalEstimatedSupplier: metrics.totalEstimatedSupplier || 0,
    estimatedUnitPrice: metrics.estimatedUnitPrice || 0,
    // referencePrice tetap disimpan sebagai alias kompatibilitas untuk Purchases lama.
    referencePrice: metrics.estimatedUnitPrice || toRoundedNumber(detail.referencePrice || 0),
    note: safeTrim(detail.note),
  };
};

// -----------------------------------------------------------------------------
// Helper katalog material supplier yang bersifat read-only.
// FUNGSI: mencari detail bahan tertentu di materialDetails supplier untuk prefill
// form Purchases dan tampilan katalog restock.
// BATASAN: tidak menulis ke raw_materials, tidak mengubah stok, dan tidak
// mengembalikan auto-sync supplier.
// STATUS: aktif dipakai; bukan legacy.
// -----------------------------------------------------------------------------
export const getSupplierMaterialDetail = (supplier = {}, materialId = '') => {
  const normalizedMaterialId = safeTrim(materialId);
  if (!normalizedMaterialId) return null;

  const foundDetail = (supplier.materialDetails || []).find((detail = {}) => {
    return safeTrim(detail.materialId) === normalizedMaterialId;
  });

  return foundDetail ? normalizeSupplierMaterialDetail(foundDetail) : null;
};

// -----------------------------------------------------------------------------
// Helper productLink per material.
// FUNGSI: mengambil link produk spesifik bahan yang cocok, bukan link barang lain.
// STATUS: aktif sebagai helper read-only untuk Purchases dan UI restock.
// -----------------------------------------------------------------------------
export const getSupplierProductLinkForMaterial = (supplier = {}, materialId = '') => {
  const materialDetail = getSupplierMaterialDetail(supplier, materialId);
  return safeTrim(materialDetail?.productLink);
};

// -----------------------------------------------------------------------------
// Helper harga supplier tercatat per material.
// FUNGSI: mengambil harga estimasi per satuan stok dari katalog supplier.
// BATASAN: nilai ini bukan harga aktual pembelian dan tidak boleh menjadi actualUnitCost.
// STATUS: aktif sebagai referensi read-only.
// -----------------------------------------------------------------------------
export const getSupplierReferencePriceForMaterial = (supplier = {}, materialId = '') => {
  const materialDetail = getSupplierMaterialDetail(supplier, materialId);
  return Math.round(Number(materialDetail?.referencePrice || 0));
};

// -----------------------------------------------------------------------------
// Helper prefill satuan beli dari katalog supplier.
// FUNGSI: membantu Purchases mengisi default tanpa mengubah transaksi otomatis.
// STATUS: aktif read-only.
// -----------------------------------------------------------------------------
export const getSupplierPurchaseUnitForMaterial = (supplier = {}, materialId = '') => {
  const materialDetail = getSupplierMaterialDetail(supplier, materialId);
  return safeTrim(materialDetail?.purchaseUnit);
};

// -----------------------------------------------------------------------------
// Helper prefill konversi ke satuan stok dari katalog supplier.
// STATUS: aktif read-only; nilai tetap bisa disesuaikan di Purchases.
// -----------------------------------------------------------------------------
export const getSupplierConversionValueForMaterial = (supplier = {}, materialId = '') => {
  const materialDetail = getSupplierMaterialDetail(supplier, materialId);
  return Number(materialDetail?.conversionValue || 0);
};

// -----------------------------------------------------------------------------
// Helper satuan stok katalog supplier.
// STATUS: aktif read-only untuk menjaga label Purchases dan katalog Supplier jelas.
// -----------------------------------------------------------------------------
export const getSupplierStockUnitForMaterial = (supplier = {}, materialId = '') => {
  const materialDetail = getSupplierMaterialDetail(supplier, materialId);
  return safeTrim(materialDetail?.stockUnit);
};

// -----------------------------------------------------------------------------
// Helper catatan supplier per material.
// STATUS: aktif sebagai info kecil read-only.
// -----------------------------------------------------------------------------
export const getSupplierMaterialNoteForMaterial = (supplier = {}, materialId = '') => {
  const materialDetail = getSupplierMaterialDetail(supplier, materialId);
  return safeTrim(materialDetail?.note);
};

// -----------------------------------------------------------------------------
// Helper cek supplier menyediakan bahan.
// FUNGSI: filter dropdown Purchases agar user tidak memilih supplier yang tidak relevan.
// STATUS: aktif; hanya membaca materialDetails/supportedMaterialIds dan tidak menulis database.
// -----------------------------------------------------------------------------
export const doesSupplierProvideMaterial = (supplier = {}, materialId = '') => {
  const normalizedMaterialId = safeTrim(materialId);
  if (!normalizedMaterialId) return false;

  const hasMaterialDetail = Boolean(getSupplierMaterialDetail(supplier, normalizedMaterialId));
  const hasSupportedMaterialId = (supplier.supportedMaterialIds || []).some((supportedMaterialId) => {
    return safeTrim(supportedMaterialId) === normalizedMaterialId;
  });

  return hasMaterialDetail || hasSupportedMaterialId;
};

// -----------------------------------------------------------------------------
// Dedupe detail material supplier berdasarkan materialId atau nama material.
// FUNGSI: memastikan katalog supplier tidak menampilkan baris dobel setelah edit.
// STATUS: aktif dipakai oleh normalizeSupplierRecord.
// -----------------------------------------------------------------------------
const uniqueMaterialDetails = (details = []) => {
  const materialMap = new Map();

  (details || []).forEach((detail = {}) => {
    const normalizedDetail = normalizeSupplierMaterialDetail(detail);
    const dedupeKey =
      normalizedDetail.materialId ||
      normalizeKey(normalizedDetail.materialName) ||
      normalizeKey(normalizedDetail.productLink) ||
      `detail-${materialMap.size}`;

    const existingDetail = materialMap.get(dedupeKey);

    if (!existingDetail) {
      materialMap.set(dedupeKey, normalizedDetail);
      return;
    }

    materialMap.set(dedupeKey, {
      ...existingDetail,
      ...normalizedDetail,
      materialId: existingDetail.materialId || normalizedDetail.materialId,
      materialName: existingDetail.materialName || normalizedDetail.materialName,
      productLink: normalizedDetail.productLink || existingDetail.productLink,
      note: normalizedDetail.note || existingDetail.note,
      referencePrice: normalizedDetail.referencePrice || existingDetail.referencePrice,
    });
  });

  return Array.from(materialMap.values());
};

// -----------------------------------------------------------------------------
// Normalisasi satu record supplier agar bentuk data konsisten di UI.
// FUNGSI: source of truth supplier catalog untuk Raw Material, Purchases, dan Supplier.
// STATUS: aktif; tetap menyimpan category sebagai legacy read-only.
// -----------------------------------------------------------------------------
export const normalizeSupplierRecord = (supplier = {}) => {
  const materialDetails = uniqueMaterialDetails(supplier.materialDetails || []);
  const supportedMaterialIds = uniqueStrings([
    ...(supplier.supportedMaterialIds || []),
    ...materialDetails.map((detail) => detail.materialId),
  ]);
  const supportedMaterialNames = uniqueStrings([
    ...(supplier.supportedMaterialNames || []),
    ...materialDetails.map((detail) => detail.materialName),
  ]);

  return {
    ...supplier,
    id: supplier.id,
    firestoreSupplierId: supplier.id,
    masterSupplierId: supplier.id,
    sourceCollection: SUPPLIER_MASTER_COLLECTION,
    isMasterRecord: true,
    canRestore: false,
    storeName: getSupplierDisplayName(supplier),
    storeLink: getSupplierLink(supplier),
    category: getSupplierCategory(supplier),
    materialDetails,
    supportedMaterialIds,
    supportedMaterialNames,
  };
};

// -----------------------------------------------------------------------------
// Merge snapshot supplier. Tetap diexport untuk kompatibilitas import lama.
// STATUS: compatibility helper; di flow aktif hanya supplierPurchases yang dipakai.
// -----------------------------------------------------------------------------
export const mergeSupplierSnapshots = ({ masterGroups = {} } = {}) => {
  const masterSuppliers = Object.values(masterGroups)
    .flatMap((items) => items || [])
    .map((item) => normalizeSupplierRecord(item));

  return masterSuppliers.sort((leftSupplier, rightSupplier) =>
    getSupplierDisplayName(leftSupplier).localeCompare(getSupplierDisplayName(rightSupplier), 'id-ID'),
  );
};

// -----------------------------------------------------------------------------
// Builder options Select Ant Design untuk dropdown supplier.
// STATUS: aktif sebagai helper kompatibilitas.
// -----------------------------------------------------------------------------
export const buildSupplierSelectOptions = (suppliers = []) => {
  return (suppliers || []).map((supplier) => ({
    value: supplier.id,
    label: getSupplierOptionLabel(supplier),
    supplier,
  }));
};

// -----------------------------------------------------------------------------
// Listener supplier aktif.
// STATUS: aktif; hanya baca supplierPurchases agar operasional stabil.
// -----------------------------------------------------------------------------
export const listenSuppliers = (callback, onError) => {
  return onSnapshot(
    collection(db, SUPPLIER_MASTER_COLLECTION),
    (snapshot) => {
      const nextSuppliers = snapshot.docs
        .map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }))
        .map((item) => normalizeSupplierRecord(item))
        .sort((leftSupplier, rightSupplier) =>
          getSupplierDisplayName(leftSupplier).localeCompare(getSupplierDisplayName(rightSupplier), 'id-ID'),
        );

      callback(nextSuppliers);
    },
    (error) => {
      console.error('Gagal memuat master supplier.', error);
      if (typeof onError === 'function') {
        onError(error, SUPPLIER_MASTER_COLLECTION);
      }
    },
  );
};
export const listenSupplierCatalog = listenSuppliers;

// -----------------------------------------------------------------------------
// SUPPLIER SNAPSHOT CASCADE GUARD.
// FUNGSI: helper di bawah hanya menjaga snapshot nama/link supplier pada Raw Material
// yang sudah memilih supplierId tersebut secara manual.
// BATASAN: tidak memasang supplier baru berdasarkan materialDetails dan tidak
// mengubah stok, harga, purchase, maupun daftar material.
// STATUS: aktif dipakai oleh halaman Supplier.
// -----------------------------------------------------------------------------
const commitBatches = async (operations = []) => {
  for (let startIndex = 0; startIndex < operations.length; startIndex += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = operations.slice(startIndex, startIndex + BATCH_LIMIT);

    chunk.forEach((operation) => operation(batch));
    await batch.commit();
  }
};

// -----------------------------------------------------------------------------
// Update snapshot supplier pada Raw Material yang memang sudah memilih supplierId ini.
// STATUS: aktif dipakai saat edit Supplier; bukan sync katalog material.
// -----------------------------------------------------------------------------
export const cascadeSupplierSnapshotToRawMaterials = async (supplierId, supplier = {}) => {
  const normalizedSupplierId = safeTrim(supplierId);
  if (!normalizedSupplierId) return 0;

  const supplierName = getSupplierDisplayName(supplier);
  const supplierLink = getSupplierLink(supplier);

  const rawMaterialSnapshot = await getDocs(
    query(
      collection(db, RAW_MATERIAL_COLLECTION),
      where('supplierId', '==', normalizedSupplierId),
    ),
  );

  const operations = rawMaterialSnapshot.docs.map((materialDocument) => (batch) => {
    batch.update(doc(db, RAW_MATERIAL_COLLECTION, materialDocument.id), {
      supplierName,
      supplierLink,
      updatedAt: serverTimestamp(),
    });
  });

  await commitBatches(operations);
  return operations.length;
};

// -----------------------------------------------------------------------------
// Bersihkan snapshot supplier pada Raw Material yang masih menunjuk supplierId yang dihapus.
// STATUS: aktif dipakai saat hapus Supplier; tidak menyentuh stok/purchase.
// -----------------------------------------------------------------------------
export const clearSupplierSnapshotFromRawMaterials = async (supplierId) => {
  const normalizedSupplierId = safeTrim(supplierId);
  if (!normalizedSupplierId) return 0;

  const rawMaterialSnapshot = await getDocs(
    query(
      collection(db, RAW_MATERIAL_COLLECTION),
      where('supplierId', '==', normalizedSupplierId),
    ),
  );

  const operations = rawMaterialSnapshot.docs.map((materialDocument) => (batch) => {
    batch.update(doc(db, RAW_MATERIAL_COLLECTION, materialDocument.id), {
      supplierId: null,
      supplierName: '',
      supplierLink: '',
      updatedAt: serverTimestamp(),
    });
  });

  await commitBatches(operations);
  return operations.length;
};
