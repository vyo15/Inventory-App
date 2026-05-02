import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  calculateRawMaterialVariantTotals,
  enrichRawMaterialWithVariantTotals,
  normalizeRawMaterialVariants,
} from '../../utils/variants/rawMaterialVariantHelpers';
import { toNumber } from '../../utils/stock/stockHelpers';
import {
  getSupplierDisplayName,
  getSupplierLink,
  getSupplierReferenceId,
} from './suppliersService';

const COLLECTION_NAME = 'raw_materials';

// IMS NOTE [AKTIF | behavior-preserving]: default form tetap di service supaya
// halaman create/edit Raw Material memakai struktur awal yang sama.
export const RAW_MATERIAL_DEFAULT_FORM = {
  name: '',
  supplierId: null,
  stockUnit: 'pcs',
  stock: 0,
  minStock: 0,
  restockReferencePrice: 0,
  averageActualUnitCost: 0,
  sellingPrice: 0,
  pricingMode: 'rule',
  pricingRuleId: null,
  hasVariants: false,
  variantLabel: '',
  variants: [],
  isActive: true,
};

const enrichRawMaterial = (item = {}) =>
  enrichRawMaterialWithVariantTotals({
    ...item,
    isActive: item.isActive !== false,
  });

const inferHasVariants = (item = {}) =>
  item?.hasVariants === true
  || item?.hasVariantOptions === true
  || (Array.isArray(item?.variants) && item.variants.length > 0)
  || (Array.isArray(item?.variantOptions) && item.variantOptions.length > 0);

const toStockNumber = (value = 0) => Math.round(toNumber(value || 0));

const resolveSupplierSnapshot = (values = {}, suppliers = []) => {
  const selectedSupplier = (suppliers || []).find((item) => String(item.id) === String(values.supplierId));

  return {
    supplierId: getSupplierReferenceId(selectedSupplier, values.supplierId),
    supplierName: getSupplierDisplayName(selectedSupplier) || null,
    supplierLink: getSupplierLink(selectedSupplier) || null,
  };
};

const resolveRawMaterialMetadata = (values = {}, suppliers = [], existingMaterial = {}) => ({
  name: String(values.name || '').trim(),
  ...resolveSupplierSnapshot(values, suppliers),
  stockUnit: values.stockUnit || existingMaterial.stockUnit || 'pcs',
  pricingMode: values.pricingMode || 'rule',
  pricingRuleId: values.pricingMode === 'rule' ? values.pricingRuleId || null : null,
  minStock: toStockNumber(values.minStock || 0),
  restockReferencePrice: toStockNumber(values.restockReferencePrice || 0),
  averageActualUnitCost: toStockNumber(values.averageActualUnitCost || 0),
  sellingPrice: toStockNumber(values.sellingPrice || 0),
  isActive: values.isActive !== false,
  updatedAt: serverTimestamp(),
  lastPricingUpdatedAt: values.pricingMode === 'manual' ? serverTimestamp() : null,
});

const normalizeRawMaterialCreatePayload = (values = {}, suppliers = []) => {
  const hasVariants = values.hasVariants === true;
  const variants = hasVariants ? normalizeRawMaterialVariants(values.variants || []) : [];
  const variantTotals = calculateRawMaterialVariantTotals(variants);
  const stock = hasVariants ? toStockNumber(variantTotals.currentStock || 0) : toStockNumber(values.stock || 0);
  const reservedStock = hasVariants ? toStockNumber(variantTotals.reservedStock || 0) : toStockNumber(values.reservedStock || 0);

  // IMS NOTE [AKTIF | behavior-preserving]: jalur create masih menulis stok awal.
  // Hubungan flow: raw material baru boleh punya stok awal sebelum masuk purchase/adjustment resmi.
  return {
    ...resolveRawMaterialMetadata(values, suppliers),
    hasVariants,
    hasVariantOptions: hasVariants,
    variantLabel: hasVariants ? String(values.variantLabel || '').trim() : '',
    variants,
    variantOptions: variants,
    variantCount: hasVariants ? variantTotals.variantCount : 0,
    activeVariantCount: hasVariants ? variantTotals.activeVariantCount : 0,
    // IMS NOTE [LEGACY | behavior-preserving]: stock dipertahankan sebagai alias currentStock.
    stock,
    currentStock: stock,
    reservedStock,
    availableStock: Math.max(stock - reservedStock, 0),
    createdAt: serverTimestamp(),
  };
};

// IMS NOTE [GUARDED | behavior-preserving]: variant matching memakai key/kode/nama, bukan index.
// Alasan cleanup: index bisa salah memindahkan stok jika urutan varian berubah.
const buildRawVariantKeyCandidates = (variant = {}) => [
  variant.variantKey,
  variant.variantCode,
  variant.sku,
  variant.variantName,
  variant.name,
]
  .map((value) => String(value || '').trim().toLowerCase())
  .filter(Boolean);

const buildRawVariantLookup = (variants = []) => {
  const lookup = new Map();
  normalizeRawMaterialVariants(variants).forEach((variant, index) => {
    buildRawVariantKeyCandidates(variant, index).forEach((key) => {
      if (!lookup.has(key)) lookup.set(key, variant);
    });
  });
  return lookup;
};

const hasProtectedVariantStock = (variant = {}) =>
  toStockNumber(variant.currentStock ?? variant.stock ?? 0) > 0 || toStockNumber(variant.reservedStock || 0) > 0;

const assertNoRawVariantWithStockRemoved = (editedVariants = [], existingVariants = []) => {
  const editedLookup = buildRawVariantLookup(editedVariants);

  normalizeRawMaterialVariants(existingVariants).forEach((variant, index) => {
    const stillExists = buildRawVariantKeyCandidates(variant, index).some((key) => editedLookup.has(key));

    if (!stillExists && hasProtectedVariantStock(variant)) {
      throw {
        type: 'validation',
        errors: {
          variants: 'Varian yang masih punya stock/reserved tidak boleh dihapus dari master. Nolkan lewat purchase/adjustment resmi lebih dulu.',
        },
      };
    }
  });
};

const validateDuplicateRawVariantNames = (variants = []) => {
  const errors = {};
  const seen = new Set();

  normalizeRawMaterialVariants(variants).forEach((item, index) => {
    const key = String(item.name || '').toLowerCase();
    if (seen.has(key)) {
      errors[`variants.${index}.name`] = 'Nama varian tidak boleh duplikat';
    }
    seen.add(key);
  });

  return errors;
};

const mergeRawVariantMetadataWithExistingStock = (editedVariants = [], existingVariants = []) => {
  const normalizedEdited = normalizeRawMaterialVariants(editedVariants);
  const normalizedExisting = normalizeRawMaterialVariants(existingVariants);

  if (normalizedEdited.length === 0) {
    throw { type: 'validation', errors: { variants: 'Minimal harus ada 1 varian' } };
  }

  const duplicateErrors = validateDuplicateRawVariantNames(normalizedEdited);
  if (Object.keys(duplicateErrors).length > 0) {
    throw { type: 'validation', errors: duplicateErrors };
  }

  assertNoRawVariantWithStockRemoved(normalizedEdited, normalizedExisting);

  const existingLookup = buildRawVariantLookup(normalizedExisting);

  return normalizedEdited.map((variant, index) => {
    const existingVariant = buildRawVariantKeyCandidates(variant, index)
      .map((key) => existingLookup.get(key))
      .find(Boolean);
    const currentStock = toStockNumber(existingVariant?.currentStock ?? existingVariant?.stock ?? 0);
    const reservedStock = toStockNumber(existingVariant?.reservedStock || 0);

    // IMS NOTE [GUARDED | behavior-preserving]: metadata varian bahan boleh berubah,
    // tetapi stok varian wajib diambil dari dokumen latest di transaction.
    return {
      ...variant,
      currentStock,
      stock: currentStock,
      reservedStock,
      availableStock: Math.max(currentStock - reservedStock, 0),
    };
  });
};

const normalizeRawMaterialMetadataPayload = (values = {}, suppliers = [], existingMaterial = {}) => {
  const hasVariants = inferHasVariants(existingMaterial);
  const payload = {
    ...resolveRawMaterialMetadata(values, suppliers, existingMaterial),
    hasVariants,
    hasVariantOptions: hasVariants,
    variantLabel: hasVariants ? String(values.variantLabel || existingMaterial.variantLabel || '').trim() : '',
  };

  if (!hasVariants) {
    // IMS NOTE [GUARDED | behavior-preserving terhadap stok]: update metadata
    // non-varian tidak mengirim stock/currentStock/reservedStock/availableStock.
    return {
      ...payload,
      variants: [],
      variantOptions: [],
      variantCount: 0,
      activeVariantCount: 0,
    };
  }

  const mergedVariants = mergeRawVariantMetadataWithExistingStock(
    values.variants || [],
    existingMaterial.variants || existingMaterial.variantOptions || [],
  );
  const totals = calculateRawMaterialVariantTotals(mergedVariants);

  // IMS NOTE [GUARDED | behavior-preserving terhadap stok]: update varian menulis
  // array metadata + stok existing supaya adjustment/purchase terbaru tidak tertimpa.
  return {
    ...payload,
    variants: totals.variants,
    variantOptions: totals.variants,
    variantCount: totals.variantCount,
    activeVariantCount: totals.activeVariantCount,
    stock: totals.currentStock,
    currentStock: totals.currentStock,
    reservedStock: totals.reservedStock,
    availableStock: totals.availableStock,
  };
};

export const validateRawMaterialPayload = async (values = {}, editingId = null) => {
  const errors = {};
  const materialName = String(values.name || '').trim();
  const hasVariants = values.hasVariants === true;

  if (!materialName) {
    errors.name = 'Nama bahan baku wajib diisi';
  }

  if (!values.stockUnit) {
    errors.stockUnit = 'Satuan stok wajib dipilih';
  }

  if (hasVariants) {
    const variants = normalizeRawMaterialVariants(values.variants || []);
    if (variants.length === 0) {
      errors.variants = 'Minimal harus ada 1 varian';
    }
    Object.assign(errors, validateDuplicateRawVariantNames(variants));
  } else if (toNumber(values.stock || 0) < 0) {
    errors.stock = 'Stok tidak boleh negatif';
  }

  if (toNumber(values.minStock || 0) < 0) {
    errors.minStock = 'Minimum stok tidak boleh negatif';
  }

  if (toNumber(values.restockReferencePrice || 0) < 0) {
    errors.restockReferencePrice = 'Harga referensi restock tidak boleh negatif';
  }

  if (toNumber(values.averageActualUnitCost || 0) < 0) {
    errors.averageActualUnitCost = 'Modal aktual rata-rata tidak boleh negatif';
  }

  if (toNumber(values.sellingPrice || 0) < 0) {
    errors.sellingPrice = 'Harga jual tidak boleh negatif';
  }

  if (materialName) {
    const snapshot = await getDocs(query(collection(db, COLLECTION_NAME), where('name', '==', materialName)));
    const duplicate = snapshot.docs.find((item) => item.id !== editingId);
    if (duplicate) {
      errors.name = 'Nama bahan baku sudah digunakan';
    }
  }

  return errors;
};

export const listenRawMaterials = (callback, onError) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((item) => enrichRawMaterial({ id: item.id, ...item.data() })));
    },
    onError,
  );
};

export const createRawMaterial = async (values = {}, suppliers = []) => {
  const errors = await validateRawMaterialPayload(values, null);
  if (Object.keys(errors).length > 0) {
    throw { type: 'validation', errors };
  }

  const payload = normalizeRawMaterialCreatePayload(values, suppliers);
  const result = await addDoc(collection(db, COLLECTION_NAME), payload);
  return result.id;
};

export const updateRawMaterial = async (id, values = {}, suppliers = []) => {
  const errors = await validateRawMaterialPayload(values, id);
  if (Object.keys(errors).length > 0) {
    throw { type: 'validation', errors };
  }

  const ref = doc(db, COLLECTION_NAME, id);

  // IMS NOTE [GUARDED | behavior-preserving terhadap stok]: update raw material
  // memakai transaction agar merge variant tidak menimpa purchase/adjustment terbaru.
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) {
      throw new Error('Bahan baku tidak ditemukan.');
    }

    const existingMaterial = enrichRawMaterial({ id: snapshot.id, ...snapshot.data() });
    const payload = normalizeRawMaterialMetadataPayload(values, suppliers, existingMaterial);
    transaction.update(ref, payload);
  });

  return id;
};

export const removeRawMaterial = async (id) => {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
  return id;
};

export const toggleRawMaterialActive = async (id, isActive) => {
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    isActive: Boolean(isActive),
    updatedAt: serverTimestamp(),
  });
  return id;
};
