import { normalizeTruthyText as safeTrim } from "../../utils/text/textNormalization";
import { getCurrentIsoTimestamp, getProductionActorName } from "./helpers/productionAuditMetadata";
import {
  createProductionRecord,
  generateProductionCode,
  getProductionRecordById,
  listProductionRecords,
  updateProductionRecord,
} from "../../data/adapters/sqlite/sqliteProductionAdapter";


export const formatProductionEmployeeCodePrefix = () => "EMP";
export const getNextProductionEmployeeCodePreview = async () => generateProductionCode("employees");

const normalizePayload = (values = {}, currentUser = null, isEdit = false) => {
  const code = safeTrim(values.code || values.employeeCode).toUpperCase();
  const actorName = getProductionActorName(currentUser);

  return {
    ...values,
    code,
    employeeCode: code,
    referenceNumber: code,
    name: safeTrim(values.name),
    phone: safeTrim(values.phone),
    role: safeTrim(values.role || values.position),
    isActive: values.isActive !== false,
    updatedAt: getCurrentIsoTimestamp(),
    updatedBy: actorName,
    ...(!isEdit ? { createdAt: getCurrentIsoTimestamp(), createdBy: actorName } : {}),
  };
};

export const validateProductionEmployee = (values = {}) => {
  const errors = {};
  if (!safeTrim(values.name)) errors.name = "Nama karyawan wajib diisi";
  if (!safeTrim(values.code || values.employeeCode)) errors.code = "Kode karyawan wajib diisi";
  return errors;
};

export const getAllProductionEmployees = async () => listProductionRecords("employees");

export const getActiveProductionEmployees = async () => {
  const rows = await getAllProductionEmployees();
  return rows.filter((item) => item.isActive !== false);
};

export const getProductionEmployeeById = async (id) => getProductionRecordById("employees", id);

export const isProductionEmployeeCodeExists = async (code, excludeId = null) => {
  const normalized = safeTrim(code).toUpperCase();
  const rows = await getAllProductionEmployees();

  return rows.some(
    (item) => safeTrim(item.code || item.employeeCode).toUpperCase() === normalized
      && String(item.id) !== String(excludeId || "")
  );
};

export const createProductionEmployee = async (values, currentUser = null) => createProductionRecord(
  "employees",
  normalizePayload(values, currentUser, false)
);

export const updateProductionEmployee = async (id, values, currentUser = null) => updateProductionRecord(
  "employees",
  id,
  normalizePayload(values, currentUser, true)
);

export const toggleProductionEmployeeActive = async (
  id,
  isActive,
  currentUser = null,
  record = null
) => updateProductionEmployee(
  id,
  { ...(record || await getProductionEmployeeById(id)), isActive },
  currentUser
);
