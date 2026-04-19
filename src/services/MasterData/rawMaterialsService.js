import {
  addDoc,
  collection,
  deleteDoc,
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
  calculateRawMaterialVariantTotals,
  enrichRawMaterialWithVariantTotals,
  normalizeRawMaterialVariants,
} from '../../utils/variants/rawMaterialVariantHelpers';
import { toNumber } from '../../utils/stock/stockHelpers';

const COLLECTION_NAME = 'raw_materials';

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

const enrichRawMaterial = (item = {}) => enrichRawMaterialWithVariantTotals({
  ...item,
  isActive: item.isActive !== false,
});

const normalizePayload = (values = {}, suppliers = [], isEdit = false) => {
  const selectedSupplier = (suppliers || []).find((item) => item.id === values.supplierId);
  const hasVariants = values.hasVariants === true;
  const variants = normalizeRawMaterialVariants(values.variants || []);
  const variantTotals = calculateRawMaterialVariantTotals(variants);
  const stock = hasVariants
    ? Math.round(toNumber(variantTotals.currentStock || 0))
    : Math.round(toNumber(values.stock || 0));
  const reservedStock = hasVariants
    ? Math.round(toNumber(variantTotals.reservedStock || 0))
    : Math.round(toNumber(values.reservedStock || 0));

  const payload = {
    name: String(values.name || '').trim(),
    supplierId: values.supplierId || null,
    supplierName: selectedSupplier?.storeName || null,
    supplierLink: selectedSupplier?.storeLink || null,
    stockUnit: values.stockUnit || 'pcs',
    pricingMode: values.pricingMode || 'rule',
    pricingRuleId: values.pricingMode === 'rule' ? values.pricingRuleId || null : null,
    hasVariants,
    hasVariantOptions: hasVariants,
    variantLabel: hasVariants ? String(values.variantLabel || '').trim() : '',
    variants: hasVariants ? variants : [],
    variantCount: hasVariants ? variantTotals.variantCount : 0,
    activeVariantCount: hasVariants ? variantTotals.activeVariantCount : 0,
    minStock: Math.round(toNumber(values.minStock || 0)),
    restockReferencePrice: Math.round(toNumber(values.restockReferencePrice || 0)),
    averageActualUnitCost: Math.round(toNumber(values.averageActualUnitCost || 0)),
    sellingPrice: Math.round(toNumber(values.sellingPrice || 0)),
    stock,
    currentStock: stock,
    reservedStock,
    availableStock: Math.max(stock - reservedStock, 0),
    isActive: values.isActive !== false,
    updatedAt: serverTimestamp(),
    lastPricingUpdatedAt: values.pricingMode === 'manual' ? serverTimestamp() : null,
  };

  if (!isEdit) {
    payload.createdAt = serverTimestamp();
  }

  return payload;
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

    const seen = new Set();
    variants.forEach((item, index) => {
      const key = item.name.toLowerCase();
      if (seen.has(key)) {
        errors[`variants.${index}.name`] = 'Nama varian tidak boleh duplikat';
      }
      seen.add(key);
    });
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
    const snapshot = await getDocs(
      query(collection(db, COLLECTION_NAME), where('name', '==', materialName)),
    );
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

  const payload = normalizePayload(values, suppliers, false);
  const result = await addDoc(collection(db, COLLECTION_NAME), payload);
  return result.id;
};

export const updateRawMaterial = async (id, values = {}, suppliers = []) => {
  const errors = await validateRawMaterialPayload(values, id);
  if (Object.keys(errors).length > 0) {
    throw { type: 'validation', errors };
  }

  const payload = normalizePayload(values, suppliers, true);
  await updateDoc(doc(db, COLLECTION_NAME, id), payload);
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
