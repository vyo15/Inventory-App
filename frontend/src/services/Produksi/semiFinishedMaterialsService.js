import * as sqliteSemiFinishedAdapter from "../../data/adapters/sqlite/sqliteSemiFinishedMaterialsAdapter";
import { upsertStockItemReadModel, deleteStockItemReadModel } from "../Inventory/stockReadModelService";

const safeTrim = (value) => String(value || "").trim();

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

const syncStock = async (record) => upsertStockItemReadModel(
  {
    ...record,
    sourceType: "semi_finished",
    sourceCollection: "semi_finished_materials",
    sourceId: record.id,
  },
  {
    sourceType: "semi_finished",
    sourceCollection: "semi_finished_materials",
  }
).catch(() => null);

export const createSemiFinishedMaterial = async (values = {}) => {
  const record = await sqliteSemiFinishedAdapter.createSemiFinishedMaterial(normalizePayload(values));
  await syncStock(record);
  return record;
};

export const updateSemiFinishedMaterial = async (id, values = {}) => {
  const record = await sqliteSemiFinishedAdapter.updateSemiFinishedMaterial(
    id,
    normalizePayload(values)
  );
  await syncStock(record);
  return record;
};

export const toggleSemiFinishedMaterialActive = async (id, isActive) => {
  const current = await getSemiFinishedMaterialById(id);
  const record = await sqliteSemiFinishedAdapter.updateSemiFinishedMaterial(id, {
    ...current,
    isActive,
  });
  await syncStock(record);
  return record;
};

export const deleteSemiFinishedMaterial = async (id) => {
  await deleteStockItemReadModel({ sourceType: "semi_finished", sourceId: id }).catch(() => null);
  return sqliteSemiFinishedAdapter.deleteSemiFinishedMaterial(id);
};
