import {
  addDoc,
  collection,
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
  calculateVariantTotals,
  normalizeColorVariants,
  validateDuplicateVariantColors,
} from '../../utils/variants/variantHelpers';

const COLLECTION_NAME = 'products';

export const PRODUCT_DEFAULT_FORM = {
  name: '',
  categoryId: null,
  price: 0,
  hppPerUnit: 0,
  pricingMode: 'rule',
  pricingRuleId: null,
  description: '',
  hasVariants: false,
  variants: [],
  currentStock: 0,
  reservedStock: 0,
  minStockAlert: 0,
  isActive: true,
};

const inferHasVariants = (item = {}) =>
  item?.hasVariants === true || (Array.isArray(item?.variants) && item.variants.length > 0);

const toStockNumber = (value = 0) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.round(number) : 0;
};

const enrichProduct = (item = {}) => {
  const hasVariants = inferHasVariants(item);
  const totals = calculateVariantTotals(item.variants || []);
  const currentStock = hasVariants ? totals.currentStock : Number(item.currentStock ?? item.stock ?? 0);
  const reservedStock = hasVariants ? totals.reservedStock : Number(item.reservedStock || 0);
  const minStockAlert = hasVariants ? totals.minStockAlert : Number(item.minStockAlert || 0);

  return {
    ...item,
    hasVariants,
    variants: hasVariants ? totals.variants : [],
    stock: currentStock,
    currentStock,
    reservedStock,
    availableStock: Math.max(currentStock - reservedStock, 0),
    minStockAlert,
    variantCount: hasVariants ? totals.variantCount : 0,
    activeVariantCount: hasVariants ? totals.activeVariantCount : 0,
  };
};

const resolveProductMetadata = (values = {}, categories = []) => {
  const selectedCategory = (categories || []).find((item) => item.id === values.categoryId);

  return {
    name: String(values.name || '').trim(),
    categoryId: values.categoryId || null,
    category: selectedCategory?.name || 'Produk Jadi',
    description: String(values.description || '').trim(),
    pricingMode: values.pricingMode || 'rule',
    pricingRuleId: values.pricingMode === 'rule' ? values.pricingRuleId || null : null,
    price: toStockNumber(values.price || 0),
    hppPerUnit: toStockNumber(values.hppPerUnit || 0),
    isActive: values.isActive !== false,
    updatedAt: serverTimestamp(),
    lastPricingUpdatedAt: values.pricingMode === 'manual' ? serverTimestamp() : null,
  };
};

const normalizeProductCreatePayload = (values = {}, categories = []) => {
  const hasVariants = values.hasVariants === true;
  const normalizedVariants = hasVariants ? normalizeColorVariants(values.variants || []) : [];
  const variantTotals = calculateVariantTotals(normalizedVariants);
  const currentStock = hasVariants ? variantTotals.currentStock : toStockNumber(values.currentStock || 0);
  const reservedStock = hasVariants ? variantTotals.reservedStock : toStockNumber(values.reservedStock || 0);
  const minStockAlert = hasVariants ? variantTotals.minStockAlert : toStockNumber(values.minStockAlert || 0);

  // IMS NOTE [AKTIF | behavior-preserving]: jalur create tetap menulis stok awal.
  // Hubungan flow: stok awal hanya boleh dibentuk saat master product pertama dibuat.
  return {
    ...resolveProductMetadata(values, categories),
    hasVariants,
    variants: normalizedVariants,
    variantCount: hasVariants ? variantTotals.variantCount : 0,
    activeVariantCount: hasVariants ? variantTotals.activeVariantCount : 0,
    currentStock,
    reservedStock,
    availableStock: Math.max(currentStock - reservedStock, 0),
    // IMS NOTE [LEGACY | behavior-preserving]: field stock tetap alias currentStock untuk data lama.
    stock: currentStock,
    minStockAlert,
    createdAt: serverTimestamp(),
  };
};

// IMS NOTE [GUARDED | behavior-preserving]: variant matching memakai key/kode/nama, bukan index.
// Alasan cleanup: index bisa salah memindahkan stok jika urutan varian berubah.
const buildProductVariantKeyCandidates = (variant = {}) => [
  variant.variantKey,
  variant.sku,
  variant.color,
  variant.name,
]
  .map((value) => String(value || '').trim().toLowerCase())
  .filter(Boolean);

const buildProductVariantLookup = (variants = []) => {
  const lookup = new Map();
  normalizeColorVariants(variants).forEach((variant, index) => {
    buildProductVariantKeyCandidates(variant, index).forEach((key) => {
      if (!lookup.has(key)) lookup.set(key, variant);
    });
  });
  return lookup;
};

const hasProtectedVariantStock = (variant = {}) =>
  toStockNumber(variant.currentStock ?? variant.stock ?? 0) > 0 || toStockNumber(variant.reservedStock || 0) > 0;

const assertNoProductVariantWithStockRemoved = (editedVariants = [], existingVariants = []) => {
  const editedLookup = buildProductVariantLookup(editedVariants);

  normalizeColorVariants(existingVariants).forEach((variant, index) => {
    const stillExists = buildProductVariantKeyCandidates(variant, index).some((key) => editedLookup.has(key));

    if (!stillExists && hasProtectedVariantStock(variant)) {
      throw {
        type: 'validation',
        errors: {
          variants: 'Varian yang masih punya stock/reserved tidak boleh dihapus dari master. Nolkan lewat flow resmi lebih dulu.',
        },
      };
    }
  });
};

const mergeProductVariantMetadataWithExistingStock = (editedVariants = [], existingVariants = []) => {
  const normalizedEdited = normalizeColorVariants(editedVariants);
  const normalizedExisting = normalizeColorVariants(existingVariants);

  if (normalizedEdited.length === 0) {
    throw { type: 'validation', errors: { variants: 'Minimal harus ada 1 varian' } };
  }

  const duplicateErrors = validateDuplicateVariantColors(normalizedEdited);
  if (Object.keys(duplicateErrors).length > 0) {
    throw { type: 'validation', errors: duplicateErrors };
  }

  assertNoProductVariantWithStockRemoved(normalizedEdited, normalizedExisting);

  const existingLookup = buildProductVariantLookup(normalizedExisting);

  return normalizedEdited.map((variant, index) => {
    const existingVariant = buildProductVariantKeyCandidates(variant, index)
      .map((key) => existingLookup.get(key))
      .find(Boolean);
    const currentStock = toStockNumber(existingVariant?.currentStock ?? existingVariant?.stock ?? 0);
    const reservedStock = toStockNumber(existingVariant?.reservedStock || 0);

    // IMS NOTE [GUARDED | behavior-preserving]: metadata varian boleh berubah,
    // tetapi stok varian selalu dipreserve dari dokumen latest di transaction.
    return {
      ...variant,
      currentStock,
      stock: currentStock,
      reservedStock,
      availableStock: Math.max(currentStock - reservedStock, 0),
      minStockAlert: toStockNumber(variant.minStockAlert || 0),
    };
  });
};

const normalizeProductMetadataPayload = (values = {}, categories = [], existingProduct = {}) => {
  const hasVariants = inferHasVariants(existingProduct);
  const payload = {
    ...resolveProductMetadata(values, categories),
    hasVariants,
  };

  if (!hasVariants) {
    // IMS NOTE [GUARDED | behavior-preserving terhadap stok]: update non-varian
    // sengaja tidak mengirim stock/currentStock/reservedStock/availableStock.
    // Hubungan flow: stok setelah create hanya boleh berubah lewat adjustment/transaksi resmi.
    return {
      ...payload,
      variants: [],
      variantCount: 0,
      activeVariantCount: 0,
      minStockAlert: toStockNumber(values.minStockAlert || 0),
    };
  }

  const mergedVariants = mergeProductVariantMetadataWithExistingStock(
    values.variants || [],
    existingProduct.variants || [],
  );
  const variantTotals = calculateVariantTotals(mergedVariants);

  // IMS NOTE [GUARDED | behavior-preserving terhadap stok]: array variants harus
  // ditulis ulang untuk metadata, jadi total master dihitung dari stok existing/latest.
  return {
    ...payload,
    variants: variantTotals.variants,
    variantCount: variantTotals.variantCount,
    activeVariantCount: variantTotals.activeVariantCount,
    currentStock: variantTotals.currentStock,
    reservedStock: variantTotals.reservedStock,
    availableStock: variantTotals.availableStock,
    stock: variantTotals.currentStock,
    minStockAlert: variantTotals.minStockAlert,
  };
};

export const validateProductPayload = async (values = {}, editingId = null) => {
  const errors = {};
  const productName = String(values.name || '').trim();
  const hasVariants = values.hasVariants === true;

  if (!productName) {
    errors.name = 'Nama produk wajib diisi';
  }

  if (Number(values.price || 0) < 0) {
    errors.price = 'Harga jual tidak boleh negatif';
  }

  if (Number(values.hppPerUnit || 0) < 0) {
    errors.hppPerUnit = 'HPP tidak boleh negatif';
  }

  if (hasVariants) {
    const variants = normalizeColorVariants(values.variants || []);
    if (variants.length === 0) {
      errors.variants = 'Minimal harus ada 1 varian';
    }
    Object.assign(errors, validateDuplicateVariantColors(variants));
  } else {
    if (Number(values.currentStock || 0) < 0) {
      errors.currentStock = 'Stok tidak boleh negatif';
    }
    if (Number(values.reservedStock || 0) < 0) {
      errors.reservedStock = 'Reserved stock tidak boleh negatif';
    }
    if (Number(values.minStockAlert || 0) < 0) {
      errors.minStockAlert = 'Minimum stok tidak boleh negatif';
    }
  }

  if (productName) {
    const q = query(collection(db, COLLECTION_NAME), where('name', '==', productName));
    const snapshot = await getDocs(q);
    const duplicate = snapshot.docs.find((item) => item.id !== editingId);
    if (duplicate) {
      errors.name = 'Nama produk sudah digunakan';
    }
  }

  return errors;
};

export const listenProducts = (callback, onError) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((item) => enrichProduct({ id: item.id, ...item.data() })));
    },
    onError,
  );
};

export const createProduct = async (values = {}, categories = []) => {
  const errors = await validateProductPayload(values, null);
  if (Object.keys(errors).length > 0) {
    throw { type: 'validation', errors };
  }

  const payload = normalizeProductCreatePayload(values, categories);
  const result = await addDoc(collection(db, COLLECTION_NAME), payload);
  return result.id;
};

export const updateProduct = async (id, values = {}, categories = []) => {
  const errors = await validateProductPayload(values, id);
  if (Object.keys(errors).length > 0) {
    throw { type: 'validation', errors };
  }

  const ref = doc(db, COLLECTION_NAME, id);

  // IMS NOTE [GUARDED | behavior-preserving terhadap stok]: update metadata
  // memakai transaction supaya merge variant tidak menimpa Stock Adjustment terbaru.
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) {
      throw new Error('Produk tidak ditemukan.');
    }

    const existingProduct = enrichProduct({ id: snapshot.id, ...snapshot.data() });
    const payload = normalizeProductMetadataPayload(values, categories, existingProduct);
    transaction.update(ref, payload);
  });

  return id;
};

export const toggleProductActive = async (id, isActive) => {
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    isActive: Boolean(isActive),
    updatedAt: serverTimestamp(),
  });
  return id;
};
