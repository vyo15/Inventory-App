import { createProductionRecord, getProductionRecordById, listProductionRecords, updateProductionRecord } from "../../data/adapters/sqlite/sqliteProductionAdapter";

const safeTrim = (value) => String(value || "").trim();
const nowIso = () => new Date().toISOString();

export const validateProductionProfile = async (values = {}, editingId = null) => {
  const errors = {};
  if (!safeTrim(values.name)) errors.name = "Nama profil wajib diisi";
  if (!safeTrim(values.targetId) && !safeTrim(values.productId)) errors.targetId = "Target produk/semi wajib dipilih";
  const duplicate = (await getAllProductionProfiles()).some((item) =>
    safeTrim(item.name).toLowerCase() === safeTrim(values.name).toLowerCase() && String(item.id) !== String(editingId || "")
  );
  if (duplicate) errors.name = "Nama profil produksi sudah digunakan";
  return errors;
};

const normalizePayload = (values = {}, currentUser = null, isEdit = false) => ({
  ...values,
  code: safeTrim(values.code || values.profileCode || values.name).toUpperCase(),
  referenceNumber: safeTrim(values.code || values.profileCode || values.name).toUpperCase(),
  name: safeTrim(values.name || values.profileName),
  targetId: values.targetId || values.productId || values.semiFinishedMaterialId || "",
  targetType: values.targetType || (values.semiFinishedMaterialId ? "semi_finished_material" : "product"),
  isActive: values.isActive !== false,
  updatedAt: nowIso(),
  updatedBy: currentUser?.email || currentUser?.displayName || currentUser?.username || currentUser?.uid || "system",
  ...(!isEdit ? { createdAt: nowIso(), createdBy: currentUser?.email || currentUser?.displayName || currentUser?.username || currentUser?.uid || "system" } : {}),
});

export const getAllProductionProfiles = async () => listProductionRecords("profiles");
export const getActiveProductionProfiles = async () => (await getAllProductionProfiles()).filter((item) => item.isActive !== false);
export const createProductionProfile = async (values = {}, currentUser = null) => createProductionRecord("profiles", normalizePayload(values, currentUser, false));
export const updateProductionProfile = async (id, values = {}, currentUser = null) => updateProductionRecord("profiles", id, normalizePayload(values, currentUser, true));
export const toggleProductionProfileActive = async (id, isActive, currentUser = null, record = null) => {
  const current = record || await getProductionRecordById("profiles", id);
  return updateProductionProfile(id, { ...current, isActive }, currentUser);
};
