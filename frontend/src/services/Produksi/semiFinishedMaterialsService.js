import * as sqliteSemiFinishedAdapter from "../../data/adapters/sqlite/sqliteSemiFinishedMaterialsAdapter";
import { stripGuardedInventoryUpdateFields } from "../../utils/variants/variantStockNormalizer";

const safeTrim = (value) => String(value || "").trim();
const SEMI_FINISHED_PROTECTED_FIELDS = [
  "averageCostPerUnit",
  "lastProductionCostPerUnit",
  "costPerUnit",
];

export const generateSemiFinishedMaterialCode = async () => sqliteSemiFinishedAdapter
  .generateSemiFinishedMaterialCode();

export const validateSemiFinishedMaterial = (values = {}) => {
  const errors = {};
  if (!safeTrim(values.name)) errors.name = "Nama semi finished wajib diisi";
  if (!safeTrim(values.code || values.itemCode)) errors.code = "Kode semi finished wajib diisi";
  return errors;
};

export const getAllSemiFinishedMaterials = async () => sqliteSemiFinishedAdapter
  .listSemiFinishedMaterials({ limit: 2000 });

export const getActiveSemiFinishedMaterials = async () => {
  const items = await getAllSemiFinishedMaterials();
  return items.filter((item) => item.isActive !== false);
};

export const getSemiFinishedMaterialById = async (id) => sqliteSemiFinishedAdapter
  .getSemiFinishedMaterialById(id);

export const isSemiFinishedMaterialCodeExists = async (code, excludeId = null) => {
  const normalized = safeTrim(code).toUpperCase();
  const items = await getAllSemiFinishedMaterials();

  return items.some(
    (item) => safeTrim(item.code || item.itemCode).toUpperCase() === normalized
      && String(item.id) !== String(excludeId || "")
  );
};

const normalizePayload = (values = {}) => {
  const code = safeTrim(values.code || values.itemCode).toUpperCase();
  return {
    ...values,
    code,
    itemCode: code,
    name: safeTrim(values.name),
    isActive: values.isActive !== false,
  };
};

const buildGuardedUpdatePayload = (values = {}, expectedVersion = "") => ({
  ...stripGuardedInventoryUpdateFields(normalizePayload(values), {
    protectedFields: SEMI_FINISHED_PROTECTED_FIELDS,
  }),
  expectedVersion,
});

export const createSemiFinishedMaterial = async (values = {}) => sqliteSemiFinishedAdapter
  .createSemiFinishedMaterial(normalizePayload(values));

export const updateSemiFinishedMaterial = async (
  id,
  values = {},
  { expectedVersion = "" } = {}
) => sqliteSemiFinishedAdapter.updateSemiFinishedMaterial(
  id,
  buildGuardedUpdatePayload(values, expectedVersion)
);

export const toggleSemiFinishedMaterialActive = async (id, isActive) => {
  const current = await getSemiFinishedMaterialById(id);
  if (!current) throw new Error("Semi finished tidak ditemukan atau sudah berubah.");
  return sqliteSemiFinishedAdapter.updateSemiFinishedMaterial(id, {
    isActive,
    expectedVersion: current.versionToken || current.updatedAt || "",
  });
};

export const deleteSemiFinishedMaterial = async (id) => sqliteSemiFinishedAdapter
  .deleteSemiFinishedMaterial(id);
