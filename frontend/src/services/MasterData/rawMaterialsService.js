import * as sqliteRawMaterialsAdapter from "../../data/adapters/sqlite/sqliteRawMaterialsAdapter";
import { stripGuardedInventoryUpdateFields } from "../../utils/variants/variantStockNormalizer";

const safeTrim = (value) => String(value || "").trim();
const toNonNegativeInteger = (value = 0) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric) : 0;
};
const RAW_MATERIAL_PROTECTED_FIELDS = ["averageActualUnitCost"];

const createValidationError = (errors = {}) => {
  const error = new Error("Periksa kembali data bahan baku.");
  error.type = "validation";
  error.errors = errors;
  return error;
};

export const RAW_MATERIAL_DEFAULT_FORM = {
  name: "",
  code: "",
  categoryId: "",
  stock: 0,
  currentStock: 0,
  minStock: 0,
  stockUnit: "pcs",
  restockReferencePrice: 0,
  averageActualUnitCost: 0,
  sellingPrice: 0,
  pricingMode: "manual",
  pricingRuleId: null,
  hasVariants: false,
  variantLabel: "Varian",
  variants: [],
  specifications: "",
  notes: "",
  isActive: true,
};

export const validateRawMaterialPayload = async (values = {}, editingId = null) => {
  const errors = {};
  if (!safeTrim(values.name)) errors.name = "Nama bahan wajib diisi";
  if (!safeTrim(values.categoryId)) errors.categoryId = "Kelompok bahan wajib dipilih";
  if (!safeTrim(values.stockUnit)) errors.stockUnit = "Satuan stok wajib dipilih";

  const code = safeTrim(values.code || values.materialCode).toUpperCase();
  const rows = await sqliteRawMaterialsAdapter.listRawMaterials();
  if (code) {
    const duplicateCode = rows.some(
      (item) => safeTrim(item.code || item.materialCode).toUpperCase() === code
        && String(item.id) !== String(editingId || "")
    );
    if (duplicateCode) errors.code = "Kode bahan sudah digunakan";
  }

  const duplicateName = rows.some(
    (item) => safeTrim(item.name).toLowerCase() === safeTrim(values.name).toLowerCase()
      && String(item.id) !== String(editingId || "")
  );
  if (duplicateName) errors.name = "Nama bahan baku sudah digunakan";

  const openingStock = values.hasVariants
    ? (values.variants || []).reduce((sum, variant) => sum + toNonNegativeInteger(variant.currentStock), 0)
    : toNonNegativeInteger(values.stock ?? values.currentStock);
  if (!editingId && openingStock > 0 && toNonNegativeInteger(values.averageActualUnitCost) <= 0) {
    errors.averageActualUnitCost = "Modal stok awal wajib diisi jika stok awal lebih dari 0";
  }

  const seenVariants = new Set();
  (values.variants || []).forEach((variant, index) => {
    const name = safeTrim(variant.name || variant.variantName);
    const key = name.toLowerCase();
    if (!name) errors[`variants.${index}.name`] = "Nama varian wajib diisi";
    if (key && seenVariants.has(key)) errors[`variants.${index}.name`] = "Nama varian tidak boleh duplikat";
    if (key) seenVariants.add(key);
    if (Number(variant.minStockAlert ?? variant.minStock ?? 0) < 0) {
      errors[`variants.${index}.minStockAlert`] = "Minimum stok varian tidak boleh negatif";
    }
  });

  return errors;
};

export const listenRawMaterials = (callback, onError) => sqliteRawMaterialsAdapter.subscribeRawMaterials(
  callback,
  onError,
  { limit: 2000 }
);

export const generateRawMaterialCode = async () => sqliteRawMaterialsAdapter.generateRawMaterialCode();

const normalizePayload = (values = {}, categories = []) => {
  const code = safeTrim(values.code || values.materialCode).toUpperCase();
  const category = categories.find((item) => String(item.id) === String(values.categoryId)) || {};
  const categoryName = safeTrim(category.name || values.category || values.categoryName) || "Belum Dikategorikan";
  const variants = Array.isArray(values.variants)
    ? values.variants.map((variant) => ({
        ...variant,
        minStockAlert: toNonNegativeInteger(variant.minStockAlert ?? variant.minStock ?? 0),
      }))
    : [];

  return {
    ...values,
    code,
    materialCode: code,
    name: safeTrim(values.name),
    categoryId: values.categoryId || "",
    category: categoryName,
    categoryName,
    stockUnit: safeTrim(values.stockUnit || values.unit) || "pcs",
    minStock: values.hasVariants ? 0 : toNonNegativeInteger(values.minStock),
    minStockAlert: values.hasVariants ? 0 : toNonNegativeInteger(values.minStock),
    restockReferencePrice: toNonNegativeInteger(values.restockReferencePrice),
    averageActualUnitCost: toNonNegativeInteger(values.averageActualUnitCost),
    sellingPrice: toNonNegativeInteger(values.sellingPrice),
    specifications: safeTrim(values.specifications),
    notes: safeTrim(values.notes),
    variants,
    isActive: values.isActive !== false,
  };
};

const buildGuardedUpdatePayload = (values = {}, categories = [], expectedVersion = "") => ({
  ...stripGuardedInventoryUpdateFields(normalizePayload(values, categories), {
    protectedFields: RAW_MATERIAL_PROTECTED_FIELDS,
  }),
  expectedVersion,
});

export const createRawMaterial = async (values = {}, categories = []) => {
  const errors = await validateRawMaterialPayload(values);
  if (Object.keys(errors).length > 0) throw createValidationError(errors);
  return sqliteRawMaterialsAdapter.createRawMaterial(normalizePayload(values, categories));
};

export const updateRawMaterial = async (
  id,
  values = {},
  categories = [],
  { expectedVersion = "" } = {}
) => {
  const errors = await validateRawMaterialPayload(values, id);
  if (Object.keys(errors).length > 0) throw createValidationError(errors);
  return sqliteRawMaterialsAdapter.updateRawMaterial(
    id,
    buildGuardedUpdatePayload(values, categories, expectedVersion)
  );
};

export const removeRawMaterial = async (id) => sqliteRawMaterialsAdapter.deleteRawMaterial(id);

export const toggleRawMaterialActive = async (id, isActive) => {
  const current = await sqliteRawMaterialsAdapter.getRawMaterialById(id);
  if (!current) throw new Error("Raw material tidak ditemukan atau sudah berubah.");
  return sqliteRawMaterialsAdapter.updateRawMaterial(id, {
    isActive,
    expectedVersion: current.versionToken || current.updatedAt || "",
  });
};
