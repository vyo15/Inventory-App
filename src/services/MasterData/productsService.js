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
import { calculateVariantTotals, normalizeColorVariants } from '../../utils/variants/variantHelpers';

const COLLECTION_NAME = 'products';

export const PRODUCT_DEFAULT_FORM = {
  name: '',
  categoryId: null,
  price: 0,
  hppPerUnit: 0,
  pricingMode: 'rule',
  pricingRuleId: null,
  description: '',
  variants: [],
  isActive: true,
};

const enrichProduct = (item = {}) => {
  const totals = calculateVariantTotals(item.variants || []);

  return {
    ...item,
    variants: totals.variants,
    stock: totals.currentStock || Number(item.stock || 0),
    currentStock: totals.currentStock || Number(item.currentStock ?? item.stock ?? 0),
    reservedStock: totals.reservedStock || Number(item.reservedStock || 0),
    availableStock:
      totals.variants.length > 0
        ? totals.availableStock
        : Math.max(Number(item.stock || 0) - Number(item.reservedStock || 0), 0),
    minStockAlert: totals.minStockAlert || Number(item.minStockAlert || 0),
    variantCount: totals.variantCount,
    activeVariantCount: totals.activeVariantCount,
  };
};

const normalizePayload = (values = {}, categories = [], isEdit = false) => {
  const selectedCategory = (categories || []).find((item) => item.id === values.categoryId);
  const variantTotals = calculateVariantTotals(values.variants || []);

  const payload = {
    name: String(values.name || '').trim(),
    categoryId: values.categoryId || null,
    category: selectedCategory?.name || 'Produk Jadi',
    description: String(values.description || '').trim(),
    pricingMode: values.pricingMode || 'rule',
    pricingRuleId: values.pricingMode === 'rule' ? values.pricingRuleId || null : null,
    price: Math.round(Number(values.price || 0)),
    hppPerUnit: Math.round(Number(values.hppPerUnit || 0)),
    variants: normalizeColorVariants(values.variants || []),
    variantCount: variantTotals.variantCount,
    activeVariantCount: variantTotals.activeVariantCount,
    currentStock: variantTotals.currentStock,
    reservedStock: variantTotals.reservedStock,
    availableStock: variantTotals.availableStock,
    stock: variantTotals.currentStock,
    minStockAlert: variantTotals.minStockAlert,
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

  if (!productName) {
    errors.name = 'Nama produk wajib diisi';
  }

  if (Number(values.price || 0) < 0) {
    errors.price = 'Harga jual tidak boleh negatif';
  }

  if (Number(values.hppPerUnit || 0) < 0) {
    errors.hppPerUnit = 'HPP tidak boleh negatif';
  }

  const variants = normalizeColorVariants(values.variants || []);
  if (variants.length === 0) {
    errors.variants = 'Minimal harus ada 1 varian warna';
  }

  const colorSeen = new Set();
  variants.forEach((item, index) => {
    if (colorSeen.has(item.color)) {
      errors[`variants.${index}.color`] = 'Warna tidak boleh duplikat';
    }
    colorSeen.add(item.color);
  });

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
