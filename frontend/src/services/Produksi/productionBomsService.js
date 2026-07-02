import { normalizeTruthyText as safeTrim } from "../../utils/text/textNormalization";
import { getCurrentIsoTimestamp, getProductionActorName } from "./helpers/productionAuditMetadata";
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
import { getActiveProductionSteps } from "./productionStepsService";


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
  const [products, rawMaterials, semiFinishedMaterials, productionSteps] = await Promise.all([
    onceFromListener(listenProducts).catch(() => []),
    onceFromListener(listenRawMaterials).catch(() => []),
    getActiveSemiFinishedMaterials().catch(() => []),
    getActiveProductionSteps().catch(() => []),
  ]);
  return { products, rawMaterials, semiFinishedMaterials, productionSteps };
};

export const validateProductionBom = (values = {}) => {
  const errors = {};
  if (!safeTrim(values.code || values.bomCode)) errors.code = "Kode BOM wajib diisi";
  if (!safeTrim(values.targetId)) errors.targetId = "Target BOM wajib dipilih";
  if (resolveMaterialLines(values).length === 0) errors.materialLines = "Material BOM wajib diisi";
  const stepLines = Array.isArray(values.stepLines) ? values.stepLines : [];
  if (stepLines.length !== 1 || !safeTrim(stepLines[0]?.stepId)) {
    errors.stepLines = "BOM wajib memiliki tepat 1 Tahapan Produksi aktif";
  }
  return errors;
};

const normalizePayload = (values = {}, currentUser = null, isEdit = false) => {
  const code = safeTrim(values.code || values.bomCode || values.referenceNumber).toUpperCase();
  const actorName = getProductionActorName(currentUser);

  return {
    ...values,
    code,
    bomCode: code,
    referenceNumber: code,
    name: safeTrim(values.name || values.bomName || values.targetName || code),
    targetType: values.targetType || "product",
    materialLines: resolveMaterialLines(values),
    stepLines: Array.isArray(values.stepLines) ? values.stepLines : [],
    routingMode: "single_step",
    version: values.version || 1,
    isActive: values.isActive !== false,
    updatedAt: getCurrentIsoTimestamp(),
    updatedBy: actorName,
    ...(!isEdit ? { createdAt: getCurrentIsoTimestamp(), createdBy: actorName } : {}),
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

const assertValidProductionBom = (values = {}) => {
  const errors = validateProductionBom(values);
  const firstError = Object.values(errors)[0];
  if (firstError) throw new Error(firstError);
};

export const createProductionBom = async (values, currentUser = null) => {
  assertValidProductionBom(values);
  return createProductionRecord(
    "boms",
    normalizePayload(values, currentUser, false),
  );
};

export const updateProductionBom = async (id, values, currentUser = null) => {
  assertValidProductionBom(values);
  return updateProductionRecord(
    "boms",
    id,
    normalizePayload(values, currentUser, true),
  );
};

export const toggleProductionBomActive = async (
  id,
  isActive,
  currentUser = null,
  record = null
) => updateProductionBom(id, { ...(record || await getProductionBomById(id)), isActive }, currentUser);
