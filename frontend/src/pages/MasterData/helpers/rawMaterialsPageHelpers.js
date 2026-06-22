import { RAW_MATERIAL_DEFAULT_FORM } from '../../../services/MasterData/rawMaterialsService';
import { getSupplierDisplayName, getSupplierLink, getSupplierOptionLabel } from '../../../services/MasterData/suppliersService';
import { parseIntegerIdInput } from '../../../utils/formatters/numberId';
import { formatStockWithUnitId } from '../../../utils/formatters/stockUnit';
import { ensureAtLeastOneRawMaterialVariant } from '../../../utils/variants/rawMaterialVariantHelpers';
import { getVariantAwareStockStatusMeta, hasSafeZeroStockSnapshot } from '../../../utils/stock/stockHelpers';
import { getMasterStockSummary } from '../../../utils/variants/variantStockNormalizer';

// -----------------------------------------------------------------------------
// Opsi satuan bahan baku.
// Tetap disimpan lokal di halaman agar form edit/create mudah dibaca dan dirawat.
// -----------------------------------------------------------------------------
export const unitOptions = ['pcs', 'meter', 'yard', 'kg', 'gram', 'liter', 'ml', 'roll', 'pack', 'batang'];

// -----------------------------------------------------------------------------
// AKTIF + GUARDED: batas lookup purchase terakhir Raw Material.
// FUNGSI: drawer detail bahan tetap bisa membaca link/supplier terakhir beli tanpa
// membuka seluruh collection purchases saat data real membesar.
// HUBUNGAN FLOW: read-only; tidak mengubah Raw Material, Supplier, Purchases,
// stok, kas, expense, harga, saving, atau laporan.
// DATA HISTORIS: purchase yang sangat tua di luar jendela lookup tidak dipakai sebagai
// pembanding ringkas; source of truth histori tetap laporan pembelian.
// CLEANUP CANDIDATE: ganti ke service latest purchase per material jika index
// Payload final sudah dibuat oleh service resmi.
// -----------------------------------------------------------------------------
export const RAW_MATERIAL_PURCHASE_LOOKUP_LIMIT = 500;

// -----------------------------------------------------------------------------
// Builder nilai awal form.
// Dipakai saat create dan edit agar struktur data form selalu konsisten.
// -----------------------------------------------------------------------------
export const buildFormValues = (record = {}) => ({
  ...RAW_MATERIAL_DEFAULT_FORM,
  ...record,
  hasVariants: record.hasVariants === true,
  variantLabel: record.variantLabel || 'Varian',
  variants:
    record.hasVariants === true
      ? ensureAtLeastOneRawMaterialVariant(record.variants || [])
      : [],
});

// -----------------------------------------------------------------------------
// Parser angka integer format Indonesia.
// Menghapus separator titik sebelum nilai dikirim ke InputNumber.
// -----------------------------------------------------------------------------
// IMS NOTE [AKTIF/GUARDED] - Parser angka bulat shared.
// Fungsi blok: memakai parser global agar input stok/harga Raw Material konsisten dengan halaman lain.
// Hubungan flow: hanya parser UI InputNumber; service lock stok dan mutasi resmi tetap berada di service/Stock Management.
// Alasan logic: menghapus parser lokal yang bisa berbeda dari standar no-decimal IMS.
export const integerParser = parseIntegerIdInput;

// -----------------------------------------------------------------------------
// Helper tampilan stok memakai formatter shared agar tabel/drawer konsisten dengan master data lain.
// -----------------------------------------------------------------------------
export const formatStockWithUnit = formatStockWithUnitId;

export const getRuleModeLabel = (mode, ruleId, pricingRuleMap = {}) => {
  if (mode !== 'rule') return 'Manual';
  return `Pricing Rule${pricingRuleMap[ruleId] ? ` | ${pricingRuleMap[ruleId]}` : ''}`;
};



export const hasSafeZeroMasterStock = hasSafeZeroStockSnapshot;

export const compactCellStyles = {
  stack: { display: 'flex', flexDirection: 'column', gap: 2 },
  meta: { fontSize: 12, lineHeight: 1.35 },
};

// -----------------------------------------------------------------------------
// Helper filter supplier untuk form Raw Material.
// FUNGSI: membatasi opsi supplier secara read-only berdasarkan katalog material
// yang dijual supplier, lalu tetap menyertakan supplier yang sudah tersimpan di
// Raw Material agar data historis tidak terlihat hilang dari form.
// ALASAN: user perlu melihat supplier yang relevan dengan bahan tersebut tanpa
// mengembalikan auto-sync Supplier ke Raw Material.
// STATUS: aktif dipakai oleh dropdown Supplier pada drawer create/edit; bukan
// kandidat cleanup selama Supplier tetap menyimpan materialDetails/support ids.
// BATASAN: blok ini tidak menulis ke raw_materials, tidak mengubah supplier,
// tidak mengubah stok, dan tidak membuat purchase otomatis.
// -----------------------------------------------------------------------------
export const normalizeRecordId = (value) => String(value || '').trim();

export const doesSupplierProvideMaterial = (supplier = {}, materialId = null) => {
  const normalizedMaterialId = normalizeRecordId(materialId);
  if (!normalizedMaterialId) return false;

  const supportedMaterialIds = Array.isArray(supplier.supportedMaterialIds)
    ? supplier.supportedMaterialIds
    : [];
  const materialDetails = Array.isArray(supplier.materialDetails) ? supplier.materialDetails : [];

  return (
    supportedMaterialIds.some((item) => normalizeRecordId(item) === normalizedMaterialId) ||
    materialDetails.some((detail) => normalizeRecordId(detail?.materialId) === normalizedMaterialId)
  );
};

export const buildStoredSupplierSnapshotOption = (materialRecord = {}) => {
  const supplierId = normalizeRecordId(materialRecord.supplierId);
  const supplierName = String(materialRecord.supplierName || '').trim();

  if (!supplierId || !supplierName) return null;

  return {
    id: supplierId,
    storeName: supplierName,
    name: supplierName,
    supplierName,
    storeLink: materialRecord.supplierLink || '',
    supplierLink: materialRecord.supplierLink || '',
    category: 'Supplier tersimpan',
    supportedMaterialIds: materialRecord.id ? [materialRecord.id] : [],
    materialDetails: [],
    isStoredSupplierSnapshot: true,
  };
};

export const getSupplierOptionsForMaterial = (supplierList = [], materialRecord = null) => {
  const normalizedSuppliers = Array.isArray(supplierList) ? supplierList : [];
  const materialId = normalizeRecordId(materialRecord?.id);

  if (!materialId) {
    return normalizedSuppliers;
  }

  const currentSupplierId = normalizeRecordId(materialRecord?.supplierId);
  const filteredSuppliers = normalizedSuppliers.filter((supplier) => {
    const supplierId = normalizeRecordId(supplier?.id);

    return (
      doesSupplierProvideMaterial(supplier, materialId) ||
      (currentSupplierId && supplierId === currentSupplierId)
    );
  });

  const hasCurrentSupplier = filteredSuppliers.some(
    (supplier) => normalizeRecordId(supplier?.id) === currentSupplierId,
  );
  const storedSupplierSnapshot = buildStoredSupplierSnapshotOption(materialRecord);

  if (storedSupplierSnapshot && !hasCurrentSupplier) {
    return [...filteredSuppliers, storedSupplierSnapshot];
  }

  return filteredSuppliers;
};

export const getSupplierOptionSearchText = (supplier = {}) => {
  const materialNames = Array.isArray(supplier.supportedMaterialNames)
    ? supplier.supportedMaterialNames
    : [];
  const detailMaterialNames = Array.isArray(supplier.materialDetails)
    ? supplier.materialDetails.map((detail) => detail?.materialName)
    : [];

  return [
    getSupplierOptionLabel(supplier),
    supplier.storeName,
    supplier.name,
    supplier.supplierName,
    supplier.category,
    supplier.storeLink,
    supplier.link,
    supplier.url,
    supplier.shopLink,
    supplier.supplierLink,
    ...materialNames,
    ...detailMaterialNames,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
};


// -----------------------------------------------------------------------------
// Helper restock inline untuk drawer Detail Raw Material.
// FUNGSI: mengambil purchase terakhir untuk raw material yang sedang dibuka dan
// membaca link produk yang tersimpan di transaksi pembelian tersebut.
// ALASAN: Detail Raw Material tidak lagi menampilkan semua supplier; link restock
// utama harus berasal dari pembelian terakhir, bukan dari link toko supplier umum.
// STATUS: aktif dipakai oleh row Supplier dan Link Produk; read-only, tidak menulis ke
// raw_materials, tidak mengubah Purchases, tidak mengubah stok/kas/laporan.
// -----------------------------------------------------------------------------
export const getTimestampMillis = (value) => {
  if (!value) return 0;

  if (typeof value?.toDate === 'function') {
    return value.toDate().getTime();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const getPurchaseSortMillis = (purchase = {}) => (
  getTimestampMillis(purchase.date) ||
  getTimestampMillis(purchase.purchaseDate) ||
  getTimestampMillis(purchase.createdAt) ||
  getTimestampMillis(purchase.updatedAt)
);

export const getSafeRestockLink = (...values) => {
  const validValue = values.find((value) => String(value || '').trim());
  return validValue ? String(validValue).trim() : null;
};

export const getPurchaseLineItems = (purchase = null) => {
  if (!purchase || typeof purchase !== 'object') return [];

  return [
    purchase.items,
    purchase.purchaseItems,
    purchase.materialItems,
    purchase.details,
  ].find((candidate) => Array.isArray(candidate)) || [];
};

export const getPurchaseProductLink = (purchase = null, materialId = null) => {
  // ---------------------------------------------------------------------------
  // Helper link produk purchase terakhir.
  // FUNGSI: membaca link produk restock secara null-safe dari header purchase
  // atau item purchase yang cocok dengan raw material aktif.
  // ALASAN: data purchase lama bisa null/undefined atau belum punya productLink,
  // sehingga akses langsung ke .productLink dapat membuat halaman white screen.
  // STATUS: aktif dipakai oleh drawer detail Raw Material; read-only dan tidak
  // mengubah stok, harga, kas, laporan, Purchases, maupun supplier.
  // ---------------------------------------------------------------------------
  if (!purchase || typeof purchase !== 'object') return null;

  const directLink = getSafeRestockLink(
    purchase?.productLink,
    purchase?.purchaseProductLink,
    purchase?.restockProductLink,
  );

  if (directLink) return directLink;

  const normalizedMaterialId = normalizeRecordId(materialId);
  const matchedPurchaseItem = getPurchaseLineItems(purchase).find((item) => {
    if (!item || typeof item !== 'object') return false;

    return [item.itemId, item.materialId, item.rawMaterialId].some(
      (value) => normalizeRecordId(value) === normalizedMaterialId,
    );
  });

  return getSafeRestockLink(
    matchedPurchaseItem?.productLink,
    matchedPurchaseItem?.purchaseProductLink,
    matchedPurchaseItem?.restockProductLink,
  );
};

export const getLatestPurchaseForMaterial = (purchaseList = [], materialId = null) => {
  const normalizedMaterialId = normalizeRecordId(materialId);
  if (!normalizedMaterialId || !Array.isArray(purchaseList)) return null;

  return purchaseList
    .filter((purchase) => {
      const purchaseType = String(purchase?.itemType || purchase?.type || '').toLowerCase();
      const purchaseMaterialId = normalizeRecordId(
        purchase?.itemId || purchase?.materialId || purchase?.rawMaterialId,
      );

      return purchaseType === 'material' && purchaseMaterialId === normalizedMaterialId;
    })
    .sort((leftItem, rightItem) => getPurchaseSortMillis(rightItem) - getPurchaseSortMillis(leftItem))[0] || null;
};

export const resolvePrimarySupplierForMaterial = (supplierList = [], materialRecord = {}) => {
  const supplierId = normalizeRecordId(materialRecord?.supplierId);
  const activeSupplier = Array.isArray(supplierList)
    ? supplierList.find((supplier) => normalizeRecordId(supplier?.id) === supplierId)
    : null;

  /*
   * Guard anti-white-screen supplier snapshot.
   * Fungsi: helper display supplier hanya dipanggil saat master Supplier aktif ditemukan.
   * Alasan: raw material lama bisa punya supplierId orphan sehingga harus fallback ke snapshot lama.
   * Status: aktif dipakai; read-only dan bukan kandidat cleanup selama data historis masih ada.
   */
  return {
    id: supplierId,
    name: (activeSupplier ? getSupplierDisplayName(activeSupplier) : '') || String(materialRecord?.supplierName || '').trim() || '-',
    link: (activeSupplier ? getSupplierLink(activeSupplier) : '') || String(materialRecord?.supplierLink || '').trim(),
    isActiveMaster: Boolean(activeSupplier),
  };
};

export const resolveRestockSupplierDisplay = (purchase = null, supplierList = [], fallbackSupplier = {}) => {
  // ---------------------------------------------------------------------------
  // Helper supplier terakhir dibeli.
  // FUNGSI: menentukan nama supplier yang tampil pada row Supplier di detail
  // bahan baku dengan prioritas supplier dari transaksi Purchases terakhir.
  // ALASAN: detail restock harus mencerminkan pembelian aktual terakhir; jika
  // data purchase lama belum punya supplier, UI fallback ke supplier manual
  // Raw Material tanpa menulis ulang database.
  // STATUS: aktif dipakai oleh drawer detail Raw Material; read-only, bukan
  // auto-sync, tidak mengubah raw_materials, supplier, stok, harga, kas, atau
  // laporan. Kandidat cleanup hanya jika schema purchase sudah distandarkan.
  // ---------------------------------------------------------------------------
  const purchaseSupplierId = normalizeRecordId(
    purchase?.supplierId || purchase?.supplierRefId || purchase?.supplierReferenceId,
  );
  const activeSupplier = purchaseSupplierId && Array.isArray(supplierList)
    ? supplierList.find((supplier) => normalizeRecordId(supplier?.id) === purchaseSupplierId)
    : null;
  const purchaseSupplierName = String(
    purchase?.supplierName || purchase?.supplierLabel || purchase?.supplierStoreName || '',
  ).trim();
  const activeSupplierName = activeSupplier ? getSupplierDisplayName(activeSupplier) : '';

  if (purchaseSupplierId || purchaseSupplierName) {
    return {
      id: purchaseSupplierId || normalizeRecordId(fallbackSupplier?.id),
      name: purchaseSupplierName || activeSupplierName || fallbackSupplier?.name || '-',
      source: 'purchase',
    };
  }

  return {
    id: normalizeRecordId(fallbackSupplier?.id),
    name: fallbackSupplier?.name || '-',
    source: fallbackSupplier?.id ? 'manual' : 'empty',
  };
};

export const buildSupplierDetailRoute = (materialId, supplierId) => {
  const params = new URLSearchParams();
  if (materialId) params.set('materialId', materialId);
  if (supplierId) params.set('supplierId', supplierId);

  return `/suppliers?${params.toString()}`;
};

/* =====================================================
SECTION: Raw Material Minimum Stock Status — AKTIF
Fungsi:
- Menentukan status minimum stok bahan baku secara read-only memakai stok tersedia lebih dulu, lalu fallback stok lama.

Dipakai oleh:
- RawMaterials.jsx summary, filter status, table row, dan drawer detail.

Alasan perubahan:
- Status Raw Material harus konsisten dengan Dashboard/Stock Report: `availableStock ?? currentStock ?? stock ?? 0` dibandingkan dengan master `minStock`.

Catatan cleanup:
- Fallback `currentStock`/`stock` bisa diaudit lagi setelah semua data historis punya `availableStock`.

Risiko:
- Jika helper ini kembali memakai currentStock langsung, item dengan reserved stock bisa terlihat aman padahal available stock sudah di bawah minimum.
===================================================== */
export const getRawMaterialMinimumStockValue = (record = {}) =>
  Number(record.availableStock ?? record.currentStock ?? record.stock ?? 0);

export const getRawMaterialStatusMeta = (record = {}) => {
  const comparableStock = getRawMaterialMinimumStockValue(record);
  const minStock = Number(record.minStock || 0);

  if (record.isActive === false) {
    return { color: 'default', label: 'Nonaktif' };
  }

  const variantStatusMeta = getVariantAwareStockStatusMeta(record, {
    sourceType: 'material',
    threshold: minStock,
  });

  if (variantStatusMeta) return variantStatusMeta;

  if (comparableStock <= 0) {
    return { color: 'red', label: 'Kosong' };
  }

  if (minStock > 0 && comparableStock <= minStock) {
    return { color: 'orange', label: 'Stok Rendah' };
  }

  return { color: 'green', label: 'Aman' };
};

export const getRawMaterialStockSummary = getMasterStockSummary;


