import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebase';

// -----------------------------------------------------------------------------
// Collection master supplier yang dipakai operasional harian.
// Kita sederhanakan lagi: supplier aktif hanya datang dari supplierPurchases.
// -----------------------------------------------------------------------------
const SUPPLIER_MASTER_COLLECTION = 'supplierPurchases';
const RAW_MATERIAL_COLLECTION = 'raw_materials';

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
// Ambil supplierId aman untuk disimpan ke bahan baku / transaksi.
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
// Builder payload supplier master yang rapi.
// Dipakai untuk create, edit, dan sinkron ulang bahan baku.
// -----------------------------------------------------------------------------
const buildMasterSupplierPayload = (supplier = {}) => {
  const materialDetails = uniqueMaterialDetails(supplier.materialDetails || []).map((item) => ({
    materialId: item.materialId || '',
    materialName: item.materialName || '',
    productLink: item.productLink || '',
    referencePrice: Math.round(Number(item.referencePrice || 0)),
    note: item.note || '',
  }));

  return {
    category: supplier.category || '',
    storeName: getSupplierDisplayName(supplier),
    storeLink: getSupplierLink(supplier),
    supportedMaterialIds: uniqueStrings([
      ...(supplier.supportedMaterialIds || []),
      ...materialDetails.map((item) => item.materialId),
    ]),
    supportedMaterialNames: uniqueStrings([
      ...(supplier.supportedMaterialNames || []),
      ...materialDetails.map((item) => item.materialName),
    ]),
    materialDetails,
    updatedAt: serverTimestamp(),
  };
};

// -----------------------------------------------------------------------------
// Sinkronkan supplier ke bahan baku yang dipilih di master supplier.
// Ini inti versi sederhana: user cukup buat supplier baru lalu pilih bahan terkait.
// -----------------------------------------------------------------------------
export const syncRawMaterialsWithSupplier = async (supplier = {}, previousSupplier = null) => {
  const supplierId = getSupplierReferenceId(supplier);
  if (!supplierId) {
    return { attachedCount: 0, detachedCount: 0, updatedCount: 0 };
  }

  const selectedMaterialIds = new Set(
    uniqueStrings([
      ...(supplier.supportedMaterialIds || []),
      ...((supplier.materialDetails || []).map((item) => item.materialId)),
    ]),
  );

  const previousMaterialIds = new Set(uniqueStrings(previousSupplier?.supportedMaterialIds || []));
  const removedMaterialIds = [...previousMaterialIds].filter((materialId) => !selectedMaterialIds.has(materialId));

  const batch = writeBatch(db);
  let attachedCount = 0;
  let detachedCount = 0;

  // ---------------------------------------------------------------------------
  // Pasang supplier ke semua bahan yang sekarang dipilih di master supplier.
  // ---------------------------------------------------------------------------
  selectedMaterialIds.forEach((materialId) => {
    batch.update(doc(db, RAW_MATERIAL_COLLECTION, materialId), {
      supplierId,
      supplierName: getSupplierDisplayName(supplier),
      supplierLink: getSupplierLink(supplier),
      updatedAt: serverTimestamp(),
    });
    attachedCount += 1;
  });

  // ---------------------------------------------------------------------------
  // Lepaskan supplier dari bahan yang dulu terhubung tetapi sekarang tidak dipilih.
  // Hanya dibersihkan jika supplierId pada bahan memang milik supplier yang sedang diedit.
  // ---------------------------------------------------------------------------
  if (removedMaterialIds.length > 0) {
    const rawMaterialsSnapshot = await getDocs(collection(db, RAW_MATERIAL_COLLECTION));
    const rawMaterials = rawMaterialsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

    removedMaterialIds.forEach((materialId) => {
      const currentMaterial = rawMaterials.find((item) => item.id === materialId);
      if (!currentMaterial) return;
      if (safeTrim(currentMaterial.supplierId) !== supplierId) return;

      batch.update(doc(db, RAW_MATERIAL_COLLECTION, materialId), {
        supplierId: '',
        supplierName: '',
        supplierLink: '',
        updatedAt: serverTimestamp(),
      });
      detachedCount += 1;
    });
  }

  await batch.commit();

  return {
    attachedCount,
    detachedCount,
    updatedCount: attachedCount + detachedCount,
  };
};

// -----------------------------------------------------------------------------
// Alias lama tetap disediakan agar halaman lain tidak perlu diubah banyak.
// -----------------------------------------------------------------------------
export const relinkRawMaterialsToSupplier = async (supplier = {}, supplierId = null, previousSupplier = null) => {
  return syncRawMaterialsWithSupplier(
    {
      ...supplier,
      id: supplierId || supplier.id,
      masterSupplierId: supplierId || supplier.masterSupplierId || supplier.id,
    },
    previousSupplier,
  );
};

// -----------------------------------------------------------------------------
// Restore helper dipertahankan untuk kompatibilitas,
// tapi sekarang arahnya sederhana: create/update ke master lalu sinkron bahan.
// -----------------------------------------------------------------------------
export const restoreLegacySupplierToMaster = async (supplier = {}) => {
  const payload = buildMasterSupplierPayload(supplier);
  const supplierId = getSupplierReferenceId(supplier);

  if (supplierId) {
    await updateDoc(doc(db, SUPPLIER_MASTER_COLLECTION, supplierId), payload);
    return { supplierId, isCreated: false };
  }

  const createdDoc = await addDoc(collection(db, SUPPLIER_MASTER_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
  });

  return { supplierId: createdDoc.id, isCreated: true };
};

// -----------------------------------------------------------------------------
// Wrapper kompatibilitas lama.
// -----------------------------------------------------------------------------
export const restoreAndRelinkSupplier = async (supplier = {}) => {
  const restoreResult = await restoreLegacySupplierToMaster(supplier);
  const syncResult = await syncRawMaterialsWithSupplier(
    {
      ...supplier,
      id: restoreResult.supplierId,
      masterSupplierId: restoreResult.supplierId,
      sourceCollection: SUPPLIER_MASTER_COLLECTION,
    },
    null,
  );

  return {
    supplierId: restoreResult.supplierId,
    isCreated: restoreResult.isCreated,
    updatedCount: syncResult.updatedCount,
  };
};

// -----------------------------------------------------------------------------
// Wrapper kompatibilitas lama untuk aksi massal.
// Tidak dipakai di mode sederhana, tetapi tetap ada agar import aman.
// -----------------------------------------------------------------------------
export const bulkRestoreAndRelinkLegacySuppliers = async (suppliers = []) => {
  let restoredCount = 0;
  let relinkedMaterialsCount = 0;

  for (const supplier of suppliers || []) {
    const result = await restoreAndRelinkSupplier(supplier);
    restoredCount += 1;
    relinkedMaterialsCount += Number(result.updatedCount || 0);
  }

  return {
    restoredCount,
    relinkedMaterialsCount,
  };
};
