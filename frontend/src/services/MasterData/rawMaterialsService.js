import * as sqliteRawMaterialsAdapter from "../../data/adapters/sqlite/sqliteRawMaterialsAdapter";
import { upsertStockItemReadModel, deleteStockItemReadModel } from "../Inventory/stockReadModelService";

const safeTrim = (value) => String(value || "").trim();
export const RAW_MATERIAL_DEFAULT_FORM = { name: "", code: "", categoryId: "", currentStock: 0, minStockAlert: 0, unit: "pcs", isActive: true, variants: [] };
export const validateRawMaterialPayload = async (values = {}, editingId = null) => {
  const errors = {};
  if (!safeTrim(values.name)) errors.name = "Nama bahan wajib diisi";
  const code = safeTrim(values.code || values.materialCode).toUpperCase();
  if (code) {
    const duplicate = (await sqliteRawMaterialsAdapter.listRawMaterials()).some((item) => safeTrim(item.code || item.materialCode).toUpperCase() === code && String(item.id) !== String(editingId || ""));
    if (duplicate) errors.code = "Kode bahan sudah digunakan";
  }
  return errors;
};
export const listenRawMaterials = (callback, onError) => sqliteRawMaterialsAdapter.subscribeRawMaterials(callback, onError, { limit: 2000 });
export const generateRawMaterialCode = async () => sqliteRawMaterialsAdapter.generateRawMaterialCode();
const normalizePayload = (values = {}, suppliers = []) => {
  const code = safeTrim(values.code || values.materialCode).toUpperCase();
  const supplier = suppliers.find((item) => String(item.id) === String(values.supplierId)) || {};
  return { ...values, code, materialCode: code, name: safeTrim(values.name), supplierName: values.supplierName || supplier.name || supplier.storeName || "", isActive: values.isActive !== false };
};
const syncStock = async (record) => upsertStockItemReadModel({ ...record, sourceType: "raw_material", sourceCollection: "raw_materials", sourceId: record.id }, { sourceType: "raw_material", sourceCollection: "raw_materials" }).catch(() => null);
export const createRawMaterial = async (values = {}, suppliers = []) => { const record = await sqliteRawMaterialsAdapter.createRawMaterial(normalizePayload(values, suppliers)); await syncStock(record); return record; };
export const updateRawMaterial = async (id, values = {}, suppliers = []) => { const record = await sqliteRawMaterialsAdapter.updateRawMaterial(id, normalizePayload(values, suppliers)); await syncStock(record); return record; };
export const removeRawMaterial = async (id) => { await deleteStockItemReadModel({ sourceType: "raw_material", sourceId: id }).catch(() => null); return sqliteRawMaterialsAdapter.deleteRawMaterial(id); };
export const toggleRawMaterialActive = async (id, isActive) => { const current = await sqliteRawMaterialsAdapter.getRawMaterialById(id); const record = await sqliteRawMaterialsAdapter.updateRawMaterial(id, { ...current, isActive }); await syncStock(record); return record; };
