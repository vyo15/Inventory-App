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
// Collection master supplier yang dipakai operasional harian.
// Kita sederhanakan lagi: supplier aktif hanya datang dari supplierPurchases.
// -----------------------------------------------------------------------------
const SUPPLIER_MASTER_COLLECTION = 'supplierPurchases';

// -----------------------------------------------------------------------------
// Helper trim aman supaya semua normalisasi string tetap konsisten.
// -----------------------------------------------------------------------------
const safeTrim = (value) => String(value || '').trim();

// -----------------------------------------------------------------------------
// Helper normalisasi key untuk dedupe nama/link supplier.
// -----------------------------------------------------------------------------
const normalizeKey = (value) =>
  safeTrim(value)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

// -----------------------------------------------------------------------------
// Dedupe array string tanpa peduli kapital atau spasi ganda.
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
// Ini menjaga kompatibilitas saat masih ada field lama di beberapa dokumen.
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
// Ambil link supplier terbaik dari field lama maupun baru.
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
// -----------------------------------------------------------------------------
export const getSupplierStoreLink = getSupplierLink;

// -----------------------------------------------------------------------------
// Ambil kategori / keterangan supplier.
// -----------------------------------------------------------------------------
const getSupplierCategory = (supplier = {}) => {
  return safeTrim(supplier.category || supplier.description || supplier.type || supplier.note || '');
};

// -----------------------------------------------------------------------------
// Builder label dropdown supplier agar seragam di semua form.
// -----------------------------------------------------------------------------
export const buildSupplierDisplayLabel = (supplier = {}) => {
  const supplierName = getSupplierDisplayName(supplier);
  const supplierCategory = getSupplierCategory(supplier);

  if (!supplierCategory || normalizeKey(supplierCategory) === normalizeKey(supplierName)) {
    return supplierName;
  }

  return `${supplierName} • ${supplierCategory}`;
};

// -----------------------------------------------------------------------------
// Alias nama helper yang dipakai halaman lain.
// -----------------------------------------------------------------------------
export const getSupplierOptionLabel = (supplier = {}) => buildSupplierDisplayLabel(supplier);

// -----------------------------------------------------------------------------
// Record supplier aktif dianggap selalu record master.
// -----------------------------------------------------------------------------
export const isManagedSupplierRecord = (supplier = {}) => {
  return (supplier.sourceCollection || SUPPLIER_MASTER_COLLECTION) === SUPPLIER_MASTER_COLLECTION;
};

// -----------------------------------------------------------------------------
// Alias kompatibilitas baru.
// -----------------------------------------------------------------------------
export const isMasterSupplierRecord = isManagedSupplierRecord;

// -----------------------------------------------------------------------------
// Mode legacy fallback dimatikan di versi sederhana ini.
// Export tetap ada supaya import lama aman.
// -----------------------------------------------------------------------------
export const isLegacyMaterialSupplierRecord = () => false;

// -----------------------------------------------------------------------------
// Ambil supplierId aman untuk snapshot manual raw material / transaksi.
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
// Dedupe detail material supplier berdasarkan materialId atau nama material.
// -----------------------------------------------------------------------------
const uniqueMaterialDetails = (details = []) => {
  const materialMap = new Map();

  (details || []).forEach((detail = {}) => {
    const materialId = safeTrim(detail.materialId);
    const materialName = safeTrim(detail.materialName);
    const productLink = safeTrim(detail.productLink);
    const note = safeTrim(detail.note);
    const referencePrice = Math.round(Number(detail.referencePrice || 0));

    const dedupeKey =
      materialId ||
      normalizeKey(materialName) ||
      normalizeKey(productLink) ||
      `detail-${materialMap.size}`;

    const existingDetail = materialMap.get(dedupeKey);

    if (!existingDetail) {
      materialMap.set(dedupeKey, {
        materialId,
        materialName,
        productLink,
        note,
        referencePrice,
      });
      return;
    }

    materialMap.set(dedupeKey, {
      ...existingDetail,
      materialId: existingDetail.materialId || materialId,
      materialName: existingDetail.materialName || materialName,
      productLink: existingDetail.productLink || productLink,
      note: existingDetail.note || note,
      referencePrice: existingDetail.referencePrice || referencePrice,
    });
  });

  return Array.from(materialMap.values());
};

// -----------------------------------------------------------------------------
// Normalisasi satu record supplier agar bentuk data konsisten di UI.
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
// Merge snapshot supplier. Tetap diexport untuk kompatibilitas,
// tetapi di mode sederhana ini hanya me-return master supplier aktif.
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
// Versi sederhana: hanya baca supplierPurchases agar operasional stabil.
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

// -----------------------------------------------------------------------------
// Alias nama listener yang dipakai halaman lain.
// -----------------------------------------------------------------------------
export const listenSupplierCatalog = listenSuppliers;

// -----------------------------------------------------------------------------
// SUPPLIER SNAPSHOT CASCADE GUARD.
// FUNGSI: helper di bawah hanya menjaga snapshot nama/link supplier pada Raw Material
// yang sudah memilih supplierId tersebut secara manual.
// ALASAN: ketika master Supplier diedit atau dihapus, tampilan Raw Material perlu
// tetap konsisten tanpa memasang supplier baru berdasarkan katalog materialDetails.
// STATUS: aktif dipakai oleh halaman Supplier; bukan kandidat cleanup selama Raw
// Material masih menyimpan snapshot supplierId/supplierName/supplierLink.
// BATASAN: helper ini tidak mengubah stok, harga, purchase, maupun daftar material.
// -----------------------------------------------------------------------------
const RAW_MATERIAL_COLLECTION = 'raw_materials';
const BATCH_LIMIT = 450;

// -----------------------------------------------------------------------------
// Commit operasi batch secara bertahap agar aman terhadap batas maksimal batch
// Firestore.
// FUNGSI: dipakai oleh cascade update/clear snapshot supplier.
// STATUS: aktif dan spesifik untuk helper snapshot supplier.
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
// Update snapshot supplier pada Raw Material yang memang sudah memilih supplierId
// ini.
// FUNGSI: menjaga nama/link supplier di raw material tetap sama dengan master
// Supplier setelah user mengedit master Supplier.
// ALASAN: ini bukan pemasangan supplier otomatis; raw material yang disentuh hanya
// dokumen yang sudah memiliki supplierId sama hasil pilihan manual user.
// STATUS: aktif dipakai saat edit Supplier.
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
// Bersihkan snapshot supplier pada Raw Material yang masih menunjuk supplierId
// yang dihapus.
// FUNGSI: mencegah Raw Material menampilkan supplier yang sudah tidak ada di master
// Supplier.
// ALASAN: data supplier manual dihapus hanya jika supplierId dokumen cocok, sehingga
// tidak menyentuh bahan yang memilih supplier lain.
// STATUS: aktif dipakai saat hapus Supplier.
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
