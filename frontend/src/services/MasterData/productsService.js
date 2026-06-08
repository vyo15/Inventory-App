import * as sqliteProductsAdapter from "../../data/adapters/sqlite/sqliteProductsAdapter";
import { upsertStockItemReadModel, deleteStockItemReadModel } from "../Inventory/stockReadModelService";

const safeTrim = (value) => String(value || "").trim();

export const PRODUCT_DEFAULT_FORM = {
  name: "",
  code: "",
  categoryId: "",
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

const normalizePayload = (values = {}, categories = []) => {
  const code = safeTrim(values.code || values.productCode).toUpperCase();
  const category = categories.find((item) => String(item.id) === String(values.categoryId)) || {};

  return {
    ...values,
    code,
    productCode: code,
    name: safeTrim(values.name),
    categoryName: values.categoryName || category.name || "",
    isActive: values.isActive !== false,
  };
};

const syncStock = async (record) => upsertStockItemReadModel(
  {
    ...record,
    sourceType: "product",
    sourceCollection: "products",
    sourceId: record.id,
  },
  {
    sourceType: "product",
    sourceCollection: "products",
  }
).catch(() => null);

export const createProduct = async (values = {}, categories = []) => {
  const record = await sqliteProductsAdapter.createProduct(normalizePayload(values, categories));
  await syncStock(record);
  return record;
};

export const updateProduct = async (id, values = {}, categories = []) => {
  const record = await sqliteProductsAdapter.updateProduct(id, normalizePayload(values, categories));
  await syncStock(record);
  return record;
};

export const toggleProductActive = async (id, isActive) => {
  const current = await sqliteProductsAdapter.getProductById(id);
  const record = await sqliteProductsAdapter.updateProduct(id, { ...current, isActive });
  await syncStock(record);
  return record;
};

export const deleteProduct = async (id) => {
  await deleteStockItemReadModel({ sourceType: "product", sourceId: id }).catch(() => null);
  return sqliteProductsAdapter.deleteProduct(id);
};
