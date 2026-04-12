import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  DEFAULT_PRODUCTION_PROFILE_FORM,
  calculateProductionProfileMetrics,
  toNumber,
} from '../../constants/productionProfileOptions';

const COLLECTION_NAME = 'production_profiles';

const safeTrim = (value) => String(value || '').trim();

const normalizePayload = (values = {}, currentUser = null, isEdit = false, productLookup = {}) => {
  const merged = { ...DEFAULT_PRODUCTION_PROFILE_FORM, ...values };
  const metrics = calculateProductionProfileMetrics(merged);
  const product = productLookup[merged.productId] || {};

  const payload = {
    productId: merged.productId || '',
    productName: safeTrim(product.name || merged.productName),
    productCode: safeTrim(product.code || merged.productCode),
    profileName: safeTrim(merged.profileName || product.name || 'Profil Produksi'),
    profileType: merged.profileType || 'flower',
    notes: safeTrim(merged.notes),
    isDefault: merged.isDefault !== false,
    isActive: merged.isActive !== false,

    petalsPerUnit: metrics.petalsPerUnit,
    leavesPerUnit: metrics.leavesPerUnit,
    stemsPerUnit: metrics.stemsPerUnit,
    petalYieldPerMeter: metrics.petalYieldPerMeter,
    leafYieldPerMeter: metrics.leafYieldPerMeter,
    stemYieldPerRod40cm: metrics.stemYieldPerRod40cm,

    assemblyPetalPackCount: metrics.assemblyPetalPackCount,
    assemblyLeafPackCount: metrics.assemblyLeafPackCount,
    assemblyStemBundleCount: metrics.assemblyStemBundleCount,
    assemblyStemExtraQty: metrics.assemblyStemExtraQty,
    assemblyStemQty: metrics.assemblyStemQty,
    assemblyTargetOutput: Math.max(0, toNumber(merged.assemblyTargetOutput, 0)),

    missYellowPercent: Math.max(0, toNumber(merged.missYellowPercent, 2)),
    missRedPercent: Math.max(0, toNumber(merged.missRedPercent, 5)),

    flowerEquivalentPerPetalMeter: metrics.flowerEquivalentPerPetalMeter,
    flowerEquivalentPerLeafMeter: metrics.flowerEquivalentPerLeafMeter,
    flowerEquivalentPerRod40cm: metrics.flowerEquivalentPerRod40cm,
    assemblyFlowerEquivalentFromPetal: metrics.assemblyFlowerEquivalentFromPetal,
    assemblyFlowerEquivalentFromLeaf: metrics.assemblyFlowerEquivalentFromLeaf,
    assemblyFlowerEquivalentFromStem: metrics.assemblyFlowerEquivalentFromStem,
    assemblyLeafTheoreticalLeftover: metrics.assemblyLeafTheoreticalLeftover,

    updatedAt: serverTimestamp(),
    updatedBy:
      currentUser?.email || currentUser?.displayName || currentUser?.uid || 'system',
  };

  if (!isEdit) {
    payload.createdAt = serverTimestamp();
    payload.createdBy =
      currentUser?.email || currentUser?.displayName || currentUser?.uid || 'system';
  }

  return payload;
};

export const validateProductionProfile = async (values = {}, editingId = null) => {
  const errors = {};
  if (!values.productId) errors.productId = 'Produk wajib dipilih';
  if (!safeTrim(values.profileName)) errors.profileName = 'Nama profil wajib diisi';
  if (toNumber(values.petalsPerUnit, 0) <= 0) errors.petalsPerUnit = 'Kelopak per unit harus lebih dari 0';
  if (toNumber(values.leavesPerUnit, 0) <= 0) errors.leavesPerUnit = 'Daun per unit harus lebih dari 0';
  if (toNumber(values.stemsPerUnit, 0) <= 0) errors.stemsPerUnit = 'Tangkai per unit harus lebih dari 0';
  if (toNumber(values.petalYieldPerMeter, 0) <= 0) errors.petalYieldPerMeter = 'Yield kelopak per meter harus lebih dari 0';
  if (toNumber(values.leafYieldPerMeter, 0) <= 0) errors.leafYieldPerMeter = 'Yield daun per meter harus lebih dari 0';
  if (toNumber(values.stemYieldPerRod40cm, 0) <= 0) errors.stemYieldPerRod40cm = 'Yield kawat harus lebih dari 0';
  if (toNumber(values.missRedPercent, 0) <= toNumber(values.missYellowPercent, 0)) errors.missRedPercent = 'Alert merah harus lebih besar dari alert kuning';

  const productId = values.productId || '';
  const profileName = safeTrim(values.profileName);
  if (productId && profileName) {
    const q = query(collection(db, COLLECTION_NAME), where('productId', '==', productId), where('profileName', '==', profileName));
    const snapshot = await getDocs(q);
    const duplicate = snapshot.docs.find((item) => item.id !== editingId);
    if (duplicate) errors.profileName = 'Nama profil sudah dipakai untuk produk ini';
  }

  return errors;
};

export const getAllProductionProfiles = async () => {
  const snapshot = await getDocs(query(collection(db, COLLECTION_NAME), orderBy('productName', 'asc')));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
};

export const getActiveProductionProfiles = async () => {
  const items = await getAllProductionProfiles();
  return items.filter((item) => item.isActive !== false);
};

export const createProductionProfile = async (values = {}, currentUser = null, productLookup = {}) => {
  const errors = await validateProductionProfile(values, null);
  if (Object.keys(errors).length > 0) throw { type: 'validation', errors };
  const payload = normalizePayload(values, currentUser, false, productLookup);
  const result = await addDoc(collection(db, COLLECTION_NAME), payload);
  return result.id;
};

export const updateProductionProfile = async (id, values = {}, currentUser = null, productLookup = {}) => {
  const errors = await validateProductionProfile(values, id);
  if (Object.keys(errors).length > 0) throw { type: 'validation', errors };
  const payload = normalizePayload(values, currentUser, true, productLookup);
  await updateDoc(doc(db, COLLECTION_NAME, id), payload);
  return id;
};

export const toggleProductionProfileActive = async (id, isActive, currentUser = null) => {
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    isActive: Boolean(isActive),
    updatedAt: serverTimestamp(),
    updatedBy:
      currentUser?.email || currentUser?.displayName || currentUser?.uid || 'system',
  });
  return id;
};
