import {
  createProductionRecord,
  generateProductionCode,
  getProductionRecordById,
  listProductionRecords,
  updateProductionRecord,
} from "../../data/adapters/sqlite/sqliteProductionAdapter";
import { listenProducts } from "../MasterData/productsService";
import { listenRawMaterials } from "../MasterData/rawMaterialsService";
import { getActiveSemiFinishedMaterials } from "./semiFinishedMaterialsService";

const safeTrim = (value) => String(value || "").trim();
const nowIso = () => new Date().toISOString();
const getActorName = (currentUser = null) => currentUser?.email
  || currentUser?.displayName
  || currentUser?.username
  || currentUser?.uid
  || "system";

const onceFromListener = (listener) => new Promise((resolve, reject) => {
  let unsubscribe = null;
  unsubscribe = listener((rows) => {
    if (unsubscribe) unsubscribe();
    resolve(rows || []);
  }, reject);
});

const resolveMaterialLines = (values = {}) => {
  if (Array.isArray(values.materialLines)) return values.materialLines;
  if (Array.isArray(values.materials)) return values.materials;
  return [];
};

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
  if (resolveMaterialLines(values).length === 0) errors.materialLines = "Material BOM wajib diisi";
  return errors;
};

const normalizePayload = (values = {}, currentUser = null, isEdit = false) => {
  const code = safeTrim(values.code || values.bomCode || values.referenceNumber).toUpperCase();
  const actorName = getActorName(currentUser);

  return {
    ...values,
    code,
    bomCode: code,
    referenceNumber: code,
    name: safeTrim(values.name || values.bomName || values.targetName || code),
    targetType: values.targetType || "product",
    materialLines: resolveMaterialLines(values),
    version: values.version || 1,
    isActive: values.isActive !== false,
    updatedAt: nowIso(),
    updatedBy: actorName,
    ...(!isEdit ? { createdAt: nowIso(), createdBy: actorName } : {}),
  };
};

export const getAllProductionBoms = async () => listProductionRecords("boms");

export const getActiveProductionBoms = async () => {
  const rows = await getAllProductionBoms();
  return rows.filter((item) => item.isActive !== false);
};

export const getProductionBomById = async (id) => getProductionRecordById("boms", id);

export const isProductionBomCodeExists = async (code, excludeId = null) => {
  const normalized = safeTrim(code).toUpperCase();
  const rows = await getAllProductionBoms();

  return rows.some(
    (item) => safeTrim(item.code || item.bomCode).toUpperCase() === normalized
      && String(item.id) !== String(excludeId || "")
  );
};

export const createProductionBom = async (values, currentUser = null) => createProductionRecord(
  "boms",
  normalizePayload(values, currentUser, false)
);

export const updateProductionBom = async (id, values, currentUser = null) => updateProductionRecord(
  "boms",
  id,
  normalizePayload(values, currentUser, true)
);

export const toggleProductionBomActive = async (
  id,
  isActive,
  currentUser = null,
  record = null
) => updateProductionBom(id, { ...(record || await getProductionBomById(id)), isActive }, currentUser);
