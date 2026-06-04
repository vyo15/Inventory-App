import { getProductionStepPayrollClassification, shouldIncludeProductionStepPayrollInHpp } from "../../constants/productionStepOptions";
import { createProductionRecord, generateProductionCode, getProductionRecordById, listProductionRecords, updateProductionRecord } from "../../data/adapters/sqlite/sqliteProductionAdapter";

const safeTrim = (value) => String(value || "").trim();
const nowIso = () => new Date().toISOString();

export const generateProductionStepCode = async () => generateProductionCode("steps");

const normalizePayload = (values = {}, currentUser = null, isEdit = false) => {
  const processType = ["raw_to_semi", "semi_to_semi", "semi_to_product", "support_process"].includes(values.processType)
    ? values.processType
    : "raw_to_semi";
  const payrollMode = values.payrollMode === "per_batch" ? "per_batch" : "per_qty";
  const payrollClassification = getProductionStepPayrollClassification(processType);
  const code = safeTrim(values.code).toUpperCase();
  return {
    ...values,
    code,
    referenceNumber: code,
    name: safeTrim(values.name),
    description: safeTrim(values.description),
    processType,
    sequenceNo: Number(values.sequenceNo || 1),
    inputPolicy: values.inputPolicy || (processType === "raw_to_semi" ? "raw_only" : processType === "support_process" ? "mixed" : "semi_only"),
    outputType: values.outputType || (processType === "semi_to_product" ? "product" : processType === "support_process" ? "none" : "semi_finished_material"),
    outputUnit: values.outputType === "none" ? "" : safeTrim(values.outputUnit) || "pcs",
    payrollMode,
    payrollRate: Number(values.payrollRate || 0),
    payrollOutputBasis: payrollMode === "per_qty" ? values.payrollOutputBasis || "good_qty" : "good_qty",
    payrollClassification,
    includePayrollInHpp: shouldIncludeProductionStepPayrollInHpp(processType),
    isActive: values.isActive !== false,
    updatedAt: nowIso(),
    updatedBy: currentUser?.email || currentUser?.displayName || currentUser?.username || currentUser?.uid || "system",
    ...(!isEdit ? { createdAt: nowIso(), createdBy: currentUser?.email || currentUser?.displayName || currentUser?.username || currentUser?.uid || "system" } : {}),
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
export const getActiveProductionSteps = async () => (await getAllProductionSteps()).filter((item) => item.isActive !== false);
export const getProductionStepById = async (id) => getProductionRecordById("steps", id);
export const isProductionStepCodeExists = async (code, excludeId = null) => {
  const normalized = safeTrim(code).toUpperCase();
  if (!normalized) return false;
  return (await getAllProductionSteps()).some((item) => safeTrim(item.code).toUpperCase() === normalized && String(item.id) !== String(excludeId || ""));
};
export const createProductionStep = async (values, currentUser = null) => createProductionRecord("steps", normalizePayload(values, currentUser, false));
export const updateProductionStep = async (id, values, currentUser = null) => updateProductionRecord("steps", id, normalizePayload(values, currentUser, true));
export const toggleProductionStepActive = async (id, isActive, currentUser = null, record = null) => {
  const current = record || await getProductionStepById(id);
  return updateProductionStep(id, { ...current, isActive }, currentUser);
};
