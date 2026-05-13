import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { generateDailySequenceCode, isBusinessCodeExists } from '../../utils/references/businessCodeGenerator';

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
const SUPPLIER_CODE_PREFIX = 'SUP';
const SUPPLIER_CODE_PATTERN = /^SUP-\d{8}-\d{3,}$/;

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

/* =====================================================
SECTION: Supplier daily sequence code helper — AKTIF
Fungsi:
- Membuat, menormalisasi, dan memvalidasi kode Supplier otomatis dengan format SUP-DDMMYYYY-001.

Dipakai oleh:
- SupplierPurchases.jsx saat membuka modal tambah dan saat menyimpan Supplier baru.

Alasan perubahan:
- Kode Supplier tidak boleh lagi berbasis nama/singkatan toko atau diinput manual; service menjadi source of truth.

Catatan cleanup:
- Belum ada.

Risiko:
- Duplikasi logic kode di page dapat mengembalikan random ID atau readable code lama yang tidak sesuai audit.
===================================================== */
export const normalizeSupplierCode = (value = '') => safeTrim(value).toUpperCase();
export const isValidSupplierCodeFormat = (code = '') => SUPPLIER_CODE_PATTERN.test(normalizeSupplierCode(code));

const toDateSafe = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    const dateValue = value.toDate();
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }
  if (typeof value.seconds === 'number') {
    const dateValue = new Date(value.seconds * 1000);
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }

  const dateValue = new Date(value);
  return Number.isNaN(dateValue.getTime()) ? null : dateValue;
};

export const formatSupplierCodeDate = (date = new Date()) => {
  const normalizedDate = toDateSafe(date) || new Date();
  const day = String(normalizedDate.getDate()).padStart(2, '0');
  const month = String(normalizedDate.getMonth() + 1).padStart(2, '0');
  const year = normalizedDate.getFullYear();

  return `${day}${month}${year}`;
};

const buildSupplierSequenceCode = (date = new Date(), sequence = 1) => {
  return `${SUPPLIER_CODE_PREFIX}-${formatSupplierCodeDate(date)}-${String(Number(sequence || 1)).padStart(3, '0')}`;
};

const isFirestoreRandomIdLike = (value = '') => /^[A-Za-z0-9]{20}$/.test(safeTrim(value));

export const generateSupplierCode = async (_values = {}, excludeId = null) => {
  void _values;
  return generateDailySequenceCode({
    db,
    collectionName: SUPPLIER_MASTER_COLLECTION,
    fieldNames: ['code', 'supplierCode'],
    prefix: SUPPLIER_CODE_PREFIX,
    excludeId,
    dateFormat: 'DDMMYYYY',
    sequenceLength: 3,
  });
};

export const assertSupplierCodeAvailable = async (code = '', editingId = null) => {
  const normalizedCode = normalizeSupplierCode(code);
  if (!normalizedCode) return;

  if (!isValidSupplierCodeFormat(normalizedCode)) {
    throw { type: 'validation', errors: { code: 'Format kode supplier tidak valid' } };
  }

  const existsByField = await isBusinessCodeExists({
    db,
    collectionName: SUPPLIER_MASTER_COLLECTION,
    fieldNames: ['code', 'supplierCode'],
    value: normalizedCode,
    excludeId: editingId,
  });

  if (existsByField) {
    throw { type: 'validation', errors: { code: 'Kode supplier sudah digunakan' } };
  }

  const existingDocument = await getDoc(doc(db, SUPPLIER_MASTER_COLLECTION, normalizedCode));
  if (existingDocument.exists() && existingDocument.id !== editingId) {
    throw { type: 'validation', errors: { code: 'Kode supplier sudah digunakan' } };
  }
};

export const resolveSupplierCode = async (values = {}, excludeId = null) => {
  const candidate = normalizeSupplierCode(values.code || values.supplierCode);

  if (isValidSupplierCodeFormat(candidate)) {
    try {
      await assertSupplierCodeAvailable(candidate, excludeId);
      return candidate;
    } catch (error) {
      if (error?.type !== 'validation') throw error;
    }
  }

  return generateSupplierCode(values, excludeId);
};

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

const getCodeOwners = (supplierRows = []) => {
  const owners = new Map();

  supplierRows.forEach(({ id, data }) => {
    [id, data?.code, data?.supplierCode].forEach((rawValue) => {
      const code = normalizeSupplierCode(rawValue);
      if (!isValidSupplierCodeFormat(code)) return;

      if (!owners.has(code)) owners.set(code, new Set());
      owners.get(code).add(id);
    });
  });

  return owners;
};

const isCodeOwnedOnlyBySupplier = (code = '', supplierId = '', codeOwners = new Map()) => {
  const owners = codeOwners.get(normalizeSupplierCode(code));
  if (!owners || owners.size === 0) return true;
  return owners.size === 1 && owners.has(supplierId);
};

const getNextAvailableSupplierCode = ({ date = new Date(), usedCodes = new Set() } = {}) => {
  const prefixDate = `${SUPPLIER_CODE_PREFIX}-${formatSupplierCodeDate(date)}-`;
  let nextSequence = 1;

  usedCodes.forEach((code) => {
    const normalizedCode = normalizeSupplierCode(code);
    if (!normalizedCode.startsWith(prefixDate)) return;

    const sequence = Number(normalizedCode.slice(prefixDate.length).match(/^\d+/)?.[0] || 0);
    if (sequence >= nextSequence) nextSequence = sequence + 1;
  });

  let candidate = buildSupplierSequenceCode(date, nextSequence);
  while (usedCodes.has(candidate)) {
    nextSequence += 1;
    candidate = buildSupplierSequenceCode(date, nextSequence);
  }

  return candidate;
};

const getLegacySupplierRepairReason = ({ id, currentCode, currentSupplierCode, codeOwners = new Map() } = {}) => {
  const reasons = [];
  const normalizedCode = normalizeSupplierCode(currentCode);
  const normalizedSupplierCode = normalizeSupplierCode(currentSupplierCode);

  if (!normalizedCode) reasons.push('Kode kosong');
  else if (isFirestoreRandomIdLike(normalizedCode)) reasons.push('Kode masih random ID');
  else if (!isValidSupplierCodeFormat(normalizedCode)) reasons.push('Kode tidak valid');
  else if (!isCodeOwnedOnlyBySupplier(normalizedCode, id, codeOwners)) reasons.push('Kode duplikat');

  if (!normalizedSupplierCode) reasons.push('SupplierCode kosong');
  else if (isFirestoreRandomIdLike(normalizedSupplierCode)) reasons.push('SupplierCode masih random ID');
  else if (!isValidSupplierCodeFormat(normalizedSupplierCode)) reasons.push('SupplierCode tidak valid');
  else if (!isCodeOwnedOnlyBySupplier(normalizedSupplierCode, id, codeOwners)) reasons.push('SupplierCode duplikat');

  if (
    isValidSupplierCodeFormat(normalizedCode)
    && isValidSupplierCodeFormat(normalizedSupplierCode)
    && normalizedCode !== normalizedSupplierCode
  ) {
    reasons.push('code dan supplierCode tidak sama');
  }

  if (!normalizedCode && !normalizedSupplierCode && isFirestoreRandomIdLike(id)) {
    reasons.push('ID dokumen lama random tidak boleh tampil sebagai kode bisnis');
  }

  return reasons.join(' / ') || 'Kode supplier perlu dirapikan';
};

/* =====================================================
SECTION: Legacy supplier code repair preview — LEGACY-COMPAT / GUARDED
Fungsi:
- Membaca supplier lama yang belum punya kode SUP-DDMMYYYY-001 valid dan menyiapkan proposed code tanpa menulis database.

Dipakai oleh:
- SupplierPurchases.jsx pada tombol Repair Kode Supplier Lama.

Alasan perubahan:
- Data lama masih bisa memiliki field kode kosong, tidak valid, atau terlihat seperti Firestore random ID sehingga tidak layak tampil sebagai kode audit.

Catatan cleanup:
- Setelah semua data lama direpair/reset, preview ini bisa dievaluasi lagi apakah masih dibutuhkan.

Risiko:
- Menjalankan repair otomatis tanpa preview dapat mengubah audit reference supplier lama tanpa kontrol user.
===================================================== */
export const getLegacySupplierCodeRepairPreview = async () => {
  const supplierSnapshot = await getDocs(collection(db, SUPPLIER_MASTER_COLLECTION));
  const supplierRows = supplierSnapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    data: documentItem.data() || {},
  }));
  const codeOwners = getCodeOwners(supplierRows);
  const usedCodes = new Set(codeOwners.keys());
  const rows = [];
  let skipped = 0;

  supplierRows.forEach(({ id, data }) => {
    const currentCode = normalizeSupplierCode(data.code);
    const currentSupplierCode = normalizeSupplierCode(data.supplierCode);
    const currentCodeValid = isValidSupplierCodeFormat(currentCode);
    const currentSupplierCodeValid = isValidSupplierCodeFormat(currentSupplierCode);
    const hasDuplicateCode =
      (currentCodeValid && !isCodeOwnedOnlyBySupplier(currentCode, id, codeOwners))
      || (currentSupplierCodeValid && !isCodeOwnedOnlyBySupplier(currentSupplierCode, id, codeOwners));
    const hasInvalidOrRandomCode =
      !currentCodeValid
      || !currentSupplierCodeValid
      || currentCode !== currentSupplierCode
      || isFirestoreRandomIdLike(currentCode)
      || isFirestoreRandomIdLike(currentSupplierCode)
      || hasDuplicateCode;

    if (!hasInvalidOrRandomCode) {
      skipped += 1;
      return;
    }

    const existingValidCode = [currentCode, currentSupplierCode, normalizeSupplierCode(id)].find((candidate) => {
      return isValidSupplierCodeFormat(candidate) && isCodeOwnedOnlyBySupplier(candidate, id, codeOwners);
    });
    const proposedDate = toDateSafe(data.createdAt) || new Date();
    const proposedCode = existingValidCode || getNextAvailableSupplierCode({ date: proposedDate, usedCodes });
    usedCodes.add(proposedCode);

    rows.push({
      id,
      supplierName: getSupplierDisplayName({ id, ...data }),
      currentCode: safeTrim(data.code),
      currentSupplierCode: safeTrim(data.supplierCode),
      proposedCode,
      reason: getLegacySupplierRepairReason({
        id,
        currentCode: data.code,
        currentSupplierCode: data.supplierCode,
        codeOwners,
      }),
    });
  });

  return {
    rows,
    total: rows.length,
    skipped,
    warnings: [],
  };
};

/* =====================================================
SECTION: Legacy supplier code repair apply — LEGACY-COMPAT / GUARDED
Fungsi:
- Menulis field code dan supplierCode pada dokumen supplier lama berdasarkan preview yang sudah disetujui user.

Dipakai oleh:
- SupplierPurchases.jsx saat user menekan Apply Repair pada modal preview.

Alasan perubahan:
- Supplier lama perlu kode bisnis manusiawi tanpa rename/delete/recreate document ID agar relasi Raw Material/Purchases tetap aman.

Catatan cleanup:
- Bisa dipindahkan ke maintenance module jika repair legacy bertambah banyak.

Risiko:
- Jika field selain code/supplierCode ikut diubah, katalog supplier, Raw Material, Purchases, atau relasi lama dapat terdampak.
===================================================== */
export const applyLegacySupplierCodeRepair = async (previewRows = []) => {
  const preparedRows = (previewRows || [])
    .map((row = {}) => ({
      id: safeTrim(row.id),
      proposedCode: normalizeSupplierCode(row.proposedCode),
    }))
    .filter((row) => row.id && isValidSupplierCodeFormat(row.proposedCode));

  const proposedCodes = new Set();
  preparedRows.forEach((row) => {
    if (proposedCodes.has(row.proposedCode)) {
      throw { type: 'validation', errors: { code: 'Preview repair memiliki kode supplier duplikat' } };
    }
    proposedCodes.add(row.proposedCode);
  });

  for (const row of preparedRows) {
    await assertSupplierCodeAvailable(row.proposedCode, row.id);
  }

  const operations = preparedRows.map((row) => (batch) => {
    batch.update(doc(db, SUPPLIER_MASTER_COLLECTION, row.id), {
      code: row.proposedCode,
      supplierCode: row.proposedCode,
      updatedAt: serverTimestamp(),
    });
  });

  await commitBatches(operations);
  return { updated: operations.length };
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
