import { createProductionRecord, generateProductionCode, getProductionRecordById, listProductionRecords, updateProductionRecord } from "../../data/adapters/sqlite/sqliteProductionAdapter";
import { listenProducts } from "../MasterData/productsService";
import { listenRawMaterials } from "../MasterData/rawMaterialsService";
import { getActiveSemiFinishedMaterials } from "./semiFinishedMaterialsService";

const safeTrim = (value) => String(value || "").trim();
const nowIso = () => new Date().toISOString();
const onceFromListener = (listener) => new Promise((resolve, reject) => {
  let unsubscribe = null;
  unsubscribe = listener((rows) => {
    if (unsubscribe) unsubscribe();
    resolve(rows || []);
  }, reject);
});

export const generateProductionBomCode = async () => generateProductionCode("boms");
export const getActiveBomReferenceData = async () => {
  const [products, rawMaterials, semiFinishedMaterials] = await Promise.all([
    onceFromListener(listenProducts).catch(() => []),
    onceFromListener(listenRawMaterials).catch(() => []),
    getActiveSemiFinishedMaterials().catch(() => []),
  ]);
  return { products, rawMaterials, semiFinishedMaterials };
};
export const validateProductionBom = (values = {}) => {
  const errors = {};
  if (!safeTrim(values.code || values.bomCode)) errors.code = "Kode BOM wajib diisi";
  if (!safeTrim(values.targetId)) errors.targetId = "Target BOM wajib dipilih";
  const lines = Array.isArray(values.materialLines) ? values.materialLines : Array.isArray(values.materials) ? values.materials : [];
  if (lines.length === 0) errors.materialLines = "Material BOM wajib diisi";
  return errors;
};
const normalizePayload = (values = {}, currentUser = null, isEdit = false) => {
  const code = safeTrim(values.code || values.bomCode || values.referenceNumber).toUpperCase();
  return {
    ...values,
    code,
    bomCode: code,
    referenceNumber: code,
    name: safeTrim(values.name || values.bomName || values.targetName || code),
    targetType: values.targetType || "product",
    materialLines: Array.isArray(values.materialLines) ? values.materialLines : Array.isArray(values.materials) ? values.materials : [],
    version: values.version || 1,
    isActive: values.isActive !== false,
    updatedAt: nowIso(),
    updatedBy: currentUser?.email || currentUser?.displayName || currentUser?.username || currentUser?.uid || "system",
    ...(!isEdit ? { createdAt: nowIso(), createdBy: currentUser?.email || currentUser?.displayName || currentUser?.username || currentUser?.uid || "system" } : {}),
  };
};
export const getAllProductionBoms = async () => listProductionRecords("boms");
export const getActiveProductionBoms = async () => (await getAllProductionBoms()).filter((item) => item.isActive !== false);
export const getProductionBomById = async (id) => getProductionRecordById("boms", id);
export const isProductionBomCodeExists = async (code, excludeId = null) => {
  const normalized = safeTrim(code).toUpperCase();
  return (await getAllProductionBoms()).some((item) => safeTrim(item.code || item.bomCode).toUpperCase() === normalized && String(item.id) !== String(excludeId || ""));
};
export const createProductionBom = async (values, currentUser = null) => createProductionRecord("boms", normalizePayload(values, currentUser, false));
export const updateProductionBom = async (id, values, currentUser = null) => updateProductionRecord("boms", id, normalizePayload(values, currentUser, true));
export const toggleProductionBomActive = async (id, isActive, currentUser = null, record = null) => updateProductionBom(id, { ...(record || await getProductionBomById(id)), isActive }, currentUser);
