import * as sqliteSuppliersAdapter from "../../data/adapters/sqlite/sqliteSuppliersAdapter";

const safeTrim = (value = "") => String(value || "").trim();
const SUPPLIER_CODE_PATTERN = /^SUP-[0-9]{8}-[0-9]{3}$/;
export const normalizeSupplierCode = (value = '') => safeTrim(value).toUpperCase();
export const isValidSupplierCodeFormat = (code = '') => SUPPLIER_CODE_PATTERN.test(normalizeSupplierCode(code));
export const formatSupplierCodeDate = (date = new Date()) => {
  const parsed = date instanceof Date ? date : new Date(date);
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return `${String(safeDate.getDate()).padStart(2, '0')}${String(safeDate.getMonth() + 1).padStart(2, '0')}${safeDate.getFullYear()}`;
};
export const generateSupplierCode = async () => sqliteSuppliersAdapter.generateSupplierCode();
export const assertSupplierCodeAvailable = async (code = '', editingId = null) => {
  const normalized = normalizeSupplierCode(code);
  const duplicate = (await sqliteSuppliersAdapter.listSuppliers()).some((item) => normalizeSupplierCode(item.supplierCode || item.code) === normalized && String(item.id) !== String(editingId || ''));
  if (duplicate) throw new Error('Kode supplier sudah digunakan.');
};
export const resolveSupplierCode = async (values = {}, excludeId = null) => {
  const code = normalizeSupplierCode(values.supplierCode || values.code) || await generateSupplierCode(values, excludeId);
  await assertSupplierCodeAvailable(code, excludeId);
  return code;
};
export const getSupplierDisplayName = (supplier = {}) => safeTrim(supplier.storeName || supplier.name || supplier.supplierName || supplier.code || supplier.id) || '-';
export const getSupplierLink = (supplier = {}) => safeTrim(supplier.storeLink || supplier.link || supplier.url);
export const getSupplierStoreLink = getSupplierLink;
export const buildSupplierDisplayLabel = (supplier = {}) => getSupplierDisplayName(supplier);
export const getSupplierOptionLabel = (supplier = {}) => buildSupplierDisplayLabel(supplier);
export const isManagedSupplierRecord = () => true;
export const isMasterSupplierRecord = isManagedSupplierRecord;
export const isArchivedMaterialSupplierRecord = () => false;
export const getSupplierReferenceId = (supplier = {}, fallbackId = null) => supplier.id || supplier.supplierId || supplier.code || fallbackId;
export const normalizeSupplierPurchaseType = (detail = {}) => detail.purchaseType || detail.type || 'unknown';
export const calculateSupplierMaterialRestockMetrics = (detail = {}) => ({ referencePrice: Number(detail.referencePrice || detail.price || 0), conversionValue: Number(detail.conversionValue || 1) });
export const getSupplierMaterialDetail = (supplier = {}, materialId = '') => (Array.isArray(supplier.materialDetails) ? supplier.materialDetails : []).find((item) => String(item.materialId || item.rawMaterialId || item.id) === String(materialId)) || null;
export const getSupplierProductLinkForMaterial = (supplier = {}, materialId = '') => getSupplierMaterialDetail(supplier, materialId)?.productLink || '';
export const getSupplierReferencePriceForMaterial = (supplier = {}, materialId = '') => Number(getSupplierMaterialDetail(supplier, materialId)?.referencePrice || 0);
export const getSupplierPurchaseUnitForMaterial = (supplier = {}, materialId = '') => getSupplierMaterialDetail(supplier, materialId)?.purchaseUnit || '';
export const getSupplierConversionValueForMaterial = (supplier = {}, materialId = '') => Number(getSupplierMaterialDetail(supplier, materialId)?.conversionValue || 1);
export const getSupplierStockUnitForMaterial = (supplier = {}, materialId = '') => getSupplierMaterialDetail(supplier, materialId)?.stockUnit || '';
export const getSupplierMaterialNoteForMaterial = (supplier = {}, materialId = '') => getSupplierMaterialDetail(supplier, materialId)?.note || '';
export const doesSupplierProvideMaterial = (supplier = {}, materialId = '') => Boolean(getSupplierMaterialDetail(supplier, materialId));
export const normalizeSupplierRecord = sqliteSuppliersAdapter.normalizeSupplierRecord;
export const mergeSupplierSnapshots = ({ masterGroups = {} } = {}) => Object.values(masterGroups || {}).flat();
export const buildSupplierSelectOptions = (suppliers = []) => suppliers.map((supplier) => ({ label: getSupplierOptionLabel(supplier), value: supplier.id, supplier }));
export const listenSuppliers = (callback, onError) => {
  let disposed = false;
  sqliteSuppliersAdapter.listSuppliers().then((rows) => { if (!disposed) callback(rows); }).catch((error) => { if (!disposed && onError) onError(error); });
  return () => { disposed = true; };
};
export const listenSupplierCatalog = listenSuppliers;
export const cascadeSupplierSnapshotToRawMaterials = async () => ({ skipped: true, reason: 'Supplier tidak melakukan cascade langsung ke raw material.' });
export const clearSupplierSnapshotFromRawMaterials = async () => ({ skipped: true, reason: 'Supplier tidak melakukan cascade langsung ke raw material.' });
