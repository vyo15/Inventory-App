import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
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

const normalizePayload = (values = {}, categories = [], isEdit = false) => {
  const selectedCategory = (categories || []).find((item) => item.id === values.categoryId);
  const hasVariants = values.hasVariants === true;
  const normalizedVariants = hasVariants ? normalizeColorVariants(values.variants || []) : [];
  const variantTotals = calculateVariantTotals(normalizedVariants);
  const currentStock = hasVariants ? variantTotals.currentStock : Math.round(Number(values.currentStock || 0));
  const reservedStock = hasVariants ? variantTotals.reservedStock : Math.round(Number(values.reservedStock || 0));
  const minStockAlert = hasVariants ? variantTotals.minStockAlert : Math.round(Number(values.minStockAlert || 0));

  const payload = {
    name: String(values.name || '').trim(),
    categoryId: values.categoryId || null,
    category: selectedCategory?.name || 'Produk Jadi',
    description: String(values.description || '').trim(),
    pricingMode: values.pricingMode || 'rule',
    pricingRuleId: values.pricingMode === 'rule' ? values.pricingRuleId || null : null,
    price: Math.round(Number(values.price || 0)),
    hppPerUnit: Math.round(Number(values.hppPerUnit || 0)),
    hasVariants,
    variants: normalizedVariants,
    variantCount: hasVariants ? variantTotals.variantCount : 0,
    activeVariantCount: hasVariants ? variantTotals.activeVariantCount : 0,
    currentStock,
    reservedStock,
    availableStock: Math.max(currentStock - reservedStock, 0),
    stock: currentStock,
    minStockAlert,
    isActive: values.isActive !== false,
    updatedAt: serverTimestamp(),
    lastPricingUpdatedAt: values.pricingMode === 'manual' ? serverTimestamp() : null,
  };

  if (!isEdit) {
    payload.createdAt = serverTimestamp();
  }

  return payload;
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

  const payload = normalizePayload(values, categories, false);
  const result = await addDoc(collection(db, COLLECTION_NAME), payload);
  return result.id;
};

export const updateProduct = async (id, values = {}, categories = []) => {
  const errors = await validateProductPayload(values, id);
  if (Object.keys(errors).length > 0) {
    throw { type: 'validation', errors };
  }

  const payload = normalizePayload(values, categories, true);
  await updateDoc(doc(db, COLLECTION_NAME, id), payload);
  return id;
};

export const toggleProductActive = async (id, isActive) => {
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    isActive: Boolean(isActive),
    updatedAt: serverTimestamp(),
  });
  return id;
};
