import { normalizeTruthyText as safeTrim } from "../../utils/text/textNormalization";
import * as sqliteProductsAdapter from "../../data/adapters/sqlite/sqliteProductsAdapter";
import { stripGuardedInventoryUpdateFields } from "../../utils/variants/variantStockNormalizer";

const PRODUCT_PROTECTED_FIELDS = ["hppPerUnit", "averageCostPerUnit", "costPerUnit"];

export const PRODUCT_DEFAULT_FORM = {
  name: "",
  code: "",
  categoryId: "",
  flowerTypeId: "",
  currentStock: 0,
  minStockAlert: 0,
  isActive: true,
  variants: [],
};

export const validateProductPayload = async (values = {}, editingId = null) => {
  const errors = {};
  if (!safeTrim(values.name)) errors.name = "Nama produk wajib diisi";

  const code = safeTrim(values.code || values.productCode).toUpperCase();
  if (code) {
    const duplicate = (await sqliteProductsAdapter.listProducts()).some(
      (item) => safeTrim(item.code || item.productCode).toUpperCase() === code
        && String(item.id) !== String(editingId || "")
    );
    if (duplicate) errors.code = "Kode produk sudah digunakan";
  }

  return errors;
};

export const listenProducts = (callback, onError) => sqliteProductsAdapter.subscribeProducts(
  callback,
  onError,
  { limit: 2000 }
);

export const generateProductCode = async () => sqliteProductsAdapter.generateProductCode();

const normalizePayload = (values = {}, categories = [], flowerTypes = []) => {
  const code = safeTrim(values.code || values.productCode).toUpperCase();
  const category = categories.find((item) => String(item.id) === String(values.categoryId)) || {};
  const flowerType = flowerTypes.find((item) => String(item.id) === String(values.flowerTypeId)) || {};
  const categoryName = safeTrim(category.name || values.category || values.categoryName) || "Belum Dikategorikan";
  const flowerTypeName = safeTrim(flowerType.name || values.flowerType || values.flowerTypeName);

  return {
    ...values,
    code,
    productCode: code,
    name: safeTrim(values.name),
    categoryId: values.categoryId || "",
    category: categoryName,
    categoryName,
    flowerTypeId: values.flowerTypeId || "",
    flowerType: flowerTypeName,
    flowerTypeName,
    isActive: values.isActive !== false,
  };
};

const buildGuardedUpdatePayload = (values = {}, categories = [], flowerTypes = [], expectedVersion = "") => ({
  ...stripGuardedInventoryUpdateFields(normalizePayload(values, categories, flowerTypes), {
    protectedFields: PRODUCT_PROTECTED_FIELDS,
  }),
  expectedVersion,
});

export const createProduct = async (values = {}, categories = [], flowerTypes = []) => sqliteProductsAdapter
  .createProduct(normalizePayload(values, categories, flowerTypes));

export const updateProduct = async (
  id,
  values = {},
  categories = [],
  flowerTypes = [],
  { expectedVersion = "" } = {}
) => sqliteProductsAdapter.updateProduct(
  id,
  buildGuardedUpdatePayload(values, categories, flowerTypes, expectedVersion)
);

export const toggleProductActive = async (id, isActive) => {
  const current = await sqliteProductsAdapter.getProductById(id);
  if (!current) throw new Error("Produk tidak ditemukan atau sudah berubah.");
  return sqliteProductsAdapter.updateProduct(id, {
    isActive,
    expectedVersion: current.versionToken || current.updatedAt || "",
  });
};

export const deleteProduct = async (id) => sqliteProductsAdapter.deleteProduct(id);
