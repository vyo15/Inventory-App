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

const findCategoryById = (categories = [], categoryId = '') => (
  (categories || []).find((item) => String(item.id) === String(categoryId)) || null
);

const readLegacySelection = (value = '') => {
  const normalized = safeTrim(value);
  return normalized.startsWith('legacy:') ? normalized.slice(7) : '';
};

const normalizePayload = (values = {}, flowerTypes = [], componentGroups = []) => {
  const code = safeTrim(values.code || values.itemCode).toUpperCase();
  const flowerType = findCategoryById(flowerTypes, values.flowerTypeId);
  const componentGroup = findCategoryById(componentGroups, values.categoryId);
  const flowerTypeName = safeTrim(
    flowerType?.name
      || readLegacySelection(values.flowerTypeId)
      || values.flowerType
      || values.flowerTypeName
      || values.flowerGroup,
  );
  const componentGroupName = safeTrim(
    componentGroup?.name
      || readLegacySelection(values.categoryId)
      || values.componentGroup
      || values.componentGroupName,
  );

  return {
    ...values,
    code,
    itemCode: code,
    name: safeTrim(values.name),
    flowerTypeId: flowerType?.id || '',
    flowerType: flowerTypeName,
    flowerTypeName,
    // Compatibility: grouped list dan data historis lama masih membaca flowerGroup.
    flowerGroup: flowerTypeName,
    categoryId: componentGroup?.id || '',
    componentGroup: componentGroupName,
    componentGroupName,
    isActive: values.isActive !== false,
  };
};

const buildGuardedUpdatePayload = (
  values = {},
  flowerTypes = [],
  componentGroups = [],
  expectedVersion = '',
) => ({
  ...stripGuardedInventoryUpdateFields(normalizePayload(values, flowerTypes, componentGroups), {
    protectedFields: SEMI_FINISHED_PROTECTED_FIELDS,
  }),
  expectedVersion,
});

export const createSemiFinishedMaterial = async (
  values = {},
  flowerTypes = [],
  componentGroups = [],
) => sqliteSemiFinishedAdapter.createSemiFinishedMaterial(
  normalizePayload(values, flowerTypes, componentGroups),
);

export const updateSemiFinishedMaterial = async (
  id,
  values = {},
  flowerTypes = [],
  componentGroups = [],
  { expectedVersion = '' } = {},
) => sqliteSemiFinishedAdapter.updateSemiFinishedMaterial(
  id,
  buildGuardedUpdatePayload(values, flowerTypes, componentGroups, expectedVersion),
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
