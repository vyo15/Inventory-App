import { normalizeSupplierRecord } from "../../../services/MasterData/suppliersService";
import { requestSqliteApi } from "./sqliteApiClient";

const normalizeSupplierPayload = (values = {}) => ({
  code: values.code || values.supplierCode || "",
  supplierCode: values.supplierCode || values.code || "",
  name: String(values.name || values.storeName || values.supplierName || "").trim(),
  storeName: String(values.storeName || values.name || values.supplierName || "").trim(),
  storeLink: values.storeLink || values.link || values.url || "",
  contact: values.contact || values.phone || "",
  phone: values.phone || values.contact || "",
  address: values.address || "",
  note: values.note || values.notes || values.description || "",
  notes: values.notes || values.note || values.description || "",
  // C1 master-only: katalog material disimpan sebagai data pasif bila backend sudah mendukung,
  // tetapi tidak boleh memutasi raw material/purchase/stock dari adapter ini.
  materialDetails: Array.isArray(values.materialDetails) ? values.materialDetails : [],
  supportedMaterialIds: Array.isArray(values.supportedMaterialIds) ? values.supportedMaterialIds : [],
  supportedMaterialNames: Array.isArray(values.supportedMaterialNames) ? values.supportedMaterialNames : [],
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
  const result = await requestSqliteApi("/api/suppliers", {
    method: "POST",
    body: JSON.stringify(normalizeSupplierPayload(values)),
  });
  return result?.data ? normalizeSupplierRecord(result.data) : null;
};

export const updateSupplier = async (supplierId, values = {}) => {
  if (!supplierId) {
    throw new Error("Supplier yang akan diubah tidak valid.");
  }

  const result = await requestSqliteApi(`/api/suppliers/${encodeURIComponent(supplierId)}`, {
    method: "PUT",
    body: JSON.stringify(normalizeSupplierPayload(values)),
  });
  return result?.data ? normalizeSupplierRecord(result.data) : null;
};

export const deleteSupplier = async (supplierId) => {
  if (!supplierId) {
    throw new Error("Supplier yang akan dihapus tidak valid.");
  }

  const result = await requestSqliteApi(`/api/suppliers/${encodeURIComponent(supplierId)}`, {
    method: "DELETE",
  });
  return result?.data || { id: supplierId, deleted: true };
};
