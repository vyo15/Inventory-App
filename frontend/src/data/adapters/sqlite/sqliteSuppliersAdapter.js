import { requestSqliteApi } from "./sqliteApiClient";

const normalizeText = (value = "") => String(value || "").trim();
export const normalizeSupplierRecord = (supplier = {}) => ({
  ...supplier,
  id: supplier.id || supplier.code || supplier.supplierCode || "",
  code: supplier.code || supplier.supplierCode || "",
  supplierCode: supplier.supplierCode || supplier.code || "",
  name: normalizeText(supplier.name || supplier.storeName || supplier.supplierName),
  storeName: normalizeText(supplier.storeName || supplier.name || supplier.supplierName),
  storeLink: supplier.storeLink || supplier.link || supplier.url || "",
  phone: supplier.phone || supplier.contact || "",
  contact: supplier.contact || supplier.phone || "",
  address: supplier.address || "",
  notes: supplier.notes || supplier.note || supplier.description || "",
  materialDetails: Array.isArray(supplier.materialDetails) ? supplier.materialDetails : [],
  supportedMaterialIds: Array.isArray(supplier.supportedMaterialIds) ? supplier.supportedMaterialIds : [],
  supportedMaterialNames: Array.isArray(supplier.supportedMaterialNames) ? supplier.supportedMaterialNames : [],
  isActive: supplier.isActive !== false,
});

const normalizeSupplierPayload = (values = {}) => ({
  code: values.code || values.supplierCode || "",
  supplierCode: values.supplierCode || values.code || "",
  name: normalizeText(values.name || values.storeName || values.supplierName),
  storeName: normalizeText(values.storeName || values.name || values.supplierName),
  storeLink: values.storeLink || values.link || values.url || "",
  contact: values.contact || values.phone || "",
  phone: values.phone || values.contact || "",
  address: values.address || "",
  note: values.note || values.notes || values.description || "",
  notes: values.notes || values.note || values.description || "",
  materialDetails: Array.isArray(values.materialDetails) ? values.materialDetails : [],
  supportedMaterialIds: Array.isArray(values.supportedMaterialIds) ? values.supportedMaterialIds : [],
  supportedMaterialNames: Array.isArray(values.supportedMaterialNames) ? values.supportedMaterialNames : [],
  isActive: values.isActive !== false,
});

export const listSuppliers = async () => {
  const result = await requestSqliteApi("/api/suppliers");
  return (result?.data || []).map(normalizeSupplierRecord);
};
export const getSupplierById = async (supplierId) => {
  if (!supplierId) return null;
  const result = await requestSqliteApi(`/api/suppliers/${encodeURIComponent(supplierId)}`);
  return result?.data ? normalizeSupplierRecord(result.data) : null;
};
export const generateSupplierCode = async () => {
  const result = await requestSqliteApi("/api/suppliers/generate-code");
  return result?.data?.supplierCode || result?.data?.code || "";
};
export const createSupplier = async (values = {}) => {
  const result = await requestSqliteApi("/api/suppliers", { method: "POST", body: JSON.stringify(normalizeSupplierPayload(values)) });
  return result?.data ? normalizeSupplierRecord(result.data) : null;
};
export const updateSupplier = async (supplierId, values = {}) => {
  if (!supplierId) throw new Error("Supplier yang akan diubah tidak valid.");
  const result = await requestSqliteApi(`/api/suppliers/${encodeURIComponent(supplierId)}`, { method: "PUT", body: JSON.stringify(normalizeSupplierPayload(values)) });
  return result?.data ? normalizeSupplierRecord(result.data) : null;
};
export const deleteSupplier = async (supplierId) => {
  if (!supplierId) throw new Error("Supplier yang akan dihapus tidak valid.");
  const result = await requestSqliteApi(`/api/suppliers/${encodeURIComponent(supplierId)}`, { method: "DELETE" });
  return result?.data || { id: supplierId, deleted: true };
};
