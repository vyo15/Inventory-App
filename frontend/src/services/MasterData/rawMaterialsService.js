import * as sqliteRawMaterialsAdapter from "../../data/adapters/sqlite/sqliteRawMaterialsAdapter";
import { stripGuardedInventoryUpdateFields } from "../../utils/variants/variantStockNormalizer";

const safeTrim = (value) => String(value || "").trim();
const RAW_MATERIAL_PROTECTED_FIELDS = ["averageActualUnitCost"];

export const RAW_MATERIAL_DEFAULT_FORM = {
  name: "",
  code: "",
  categoryId: "",
  currentStock: 0,
  minStockAlert: 0,
  unit: "pcs",
  isActive: true,
  variants: [],
};

export const validateRawMaterialPayload = async (values = {}, editingId = null) => {
  const errors = {};
  if (!safeTrim(values.name)) errors.name = "Nama bahan wajib diisi";

  const code = safeTrim(values.code || values.materialCode).toUpperCase();
  if (code) {
    const duplicate = (await sqliteRawMaterialsAdapter.listRawMaterials()).some(
      (item) => safeTrim(item.code || item.materialCode).toUpperCase() === code
        && String(item.id) !== String(editingId || "")
    );
    if (duplicate) errors.code = "Kode bahan sudah digunakan";
  }

  return errors;
};

export const listenRawMaterials = (callback, onError) => sqliteRawMaterialsAdapter.subscribeRawMaterials(
  callback,
  onError,
  { limit: 2000 }
);

export const generateRawMaterialCode = async () => sqliteRawMaterialsAdapter.generateRawMaterialCode();

const normalizePayload = (values = {}, suppliers = []) => {
  const code = safeTrim(values.code || values.materialCode).toUpperCase();
  const supplier = suppliers.find((item) => String(item.id) === String(values.supplierId)) || {};

  return {
    ...values,
    code,
    materialCode: code,
    name: safeTrim(values.name),
    supplierName: values.supplierName || supplier.name || supplier.storeName || "",
    isActive: values.isActive !== false,
  };
};

const buildGuardedUpdatePayload = (values = {}, suppliers = [], expectedVersion = "") => ({
  ...stripGuardedInventoryUpdateFields(normalizePayload(values, suppliers), {
    protectedFields: RAW_MATERIAL_PROTECTED_FIELDS,
  }),
  expectedVersion,
});

export const createRawMaterial = async (values = {}, suppliers = []) => sqliteRawMaterialsAdapter
  .createRawMaterial(normalizePayload(values, suppliers));

export const updateRawMaterial = async (
  id,
  values = {},
  suppliers = [],
  { expectedVersion = "" } = {}
) => sqliteRawMaterialsAdapter.updateRawMaterial(
  id,
  buildGuardedUpdatePayload(values, suppliers, expectedVersion)
);

export const removeRawMaterial = async (id) => sqliteRawMaterialsAdapter.deleteRawMaterial(id);

export const toggleRawMaterialActive = async (id, isActive) => {
  const current = await sqliteRawMaterialsAdapter.getRawMaterialById(id);
  if (!current) throw new Error("Raw material tidak ditemukan atau sudah berubah.");
  return sqliteRawMaterialsAdapter.updateRawMaterial(id, {
    isActive,
    expectedVersion: current.versionToken || current.updatedAt || "",
  });
};
