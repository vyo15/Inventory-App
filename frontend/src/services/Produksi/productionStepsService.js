import { normalizeTruthyText as safeTrim } from "../../utils/text/textNormalization";
import { getCurrentIsoTimestamp, getProductionActorName } from "./helpers/productionAuditMetadata";
import {
  getProductionStepPayrollClassification,
  shouldIncludeProductionStepPayrollInHpp,
} from "../../constants/productionStepOptions";
import {
  createProductionRecord,
  generateProductionCode,
  getProductionRecordById,
  listProductionRecords,
  updateProductionRecord,
} from "../../data/adapters/sqlite/sqliteProductionAdapter";


const isSupportedProcessType = (processType = "") => [
  "raw_to_semi",
  "semi_to_semi",
  "semi_to_product",
  "support_process",
].includes(processType);

const resolveInputPolicy = (processType = "") => {
  if (processType === "raw_to_semi") return "raw_only";
  if (processType === "support_process") return "mixed";
  return "semi_only";
};

const resolveOutputType = (processType = "") => {
  if (processType === "semi_to_product") return "product";
  if (processType === "support_process") return "none";
  return "semi_finished_material";
};

export const generateProductionStepCode = async () => generateProductionCode("steps");

const normalizePayload = (values = {}, currentUser = null, isEdit = false) => {
  const processType = isSupportedProcessType(values.processType) ? values.processType : "raw_to_semi";
  const payrollMode = values.payrollMode === "per_batch" ? "per_batch" : "per_qty";
  const monitoringMetric = ["petal", "leaf", "stem"].includes(values.monitoringMetric)
    ? values.monitoringMetric
    : "none";
  const payrollClassification = getProductionStepPayrollClassification(processType);
  const code = safeTrim(values.code).toUpperCase();
  const actorName = getProductionActorName(currentUser);

  return {
    ...values,
    code,
    referenceNumber: code,
    name: safeTrim(values.name),
    description: safeTrim(values.description),
    processType,
    sequenceNo: Number(values.sequenceNo || 1),
    inputPolicy: values.inputPolicy || resolveInputPolicy(processType),
    outputType: values.outputType || resolveOutputType(processType),
    outputUnit: values.outputType === "none" ? "" : safeTrim(values.outputUnit) || "pcs",
    monitoringMetric,
    payrollMode,
    payrollRate: Number(values.payrollRate || 0),
    payrollOutputBasis: payrollMode === "per_qty" ? values.payrollOutputBasis || "good_qty" : "good_qty",
    payrollClassification,
    includePayrollInHpp: shouldIncludeProductionStepPayrollInHpp(processType),
    isActive: values.isActive !== false,
    updatedAt: getCurrentIsoTimestamp(),
    updatedBy: actorName,
    ...(!isEdit ? { createdAt: getCurrentIsoTimestamp(), createdBy: actorName } : {}),
  };
};

export const validateProductionStep = (values = {}) => {
  const errors = {};
  if (!safeTrim(values.name)) errors.name = "Nama tahapan wajib diisi";
  if (!safeTrim(values.code)) errors.code = "Kode tahapan wajib diisi";
  if (Number(values.payrollRate || 0) < 0) errors.payrollRate = "Rate payroll tidak boleh negatif";
  return errors;
};

export const getAllProductionSteps = async () => listProductionRecords("steps");

export const getActiveProductionSteps = async () => {
  const rows = await getAllProductionSteps();
  return rows.filter((item) => item.isActive !== false);
};

export const getProductionStepById = async (id) => getProductionRecordById("steps", id);

export const isProductionStepCodeExists = async (code, excludeId = null) => {
  const normalized = safeTrim(code).toUpperCase();
  if (!normalized) return false;

  const rows = await getAllProductionSteps();
  return rows.some(
    (item) => safeTrim(item.code).toUpperCase() === normalized
      && String(item.id) !== String(excludeId || "")
  );
};

export const createProductionStep = async (values, currentUser = null) => createProductionRecord(
  "steps",
  normalizePayload(values, currentUser, false)
);

export const updateProductionStep = async (id, values, currentUser = null) => updateProductionRecord(
  "steps",
  id,
  normalizePayload(values, currentUser, true)
);

export const toggleProductionStepActive = async (id, isActive, currentUser = null, record = null) => {
  const current = record || await getProductionStepById(id);
  return updateProductionStep(id, { ...current, isActive }, currentUser);
};
