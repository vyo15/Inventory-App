import { requestSqliteApi } from "./sqliteApiClient";

const normalizeCategoryPayload = (values = {}) => ({
  code: values.code || "",
  name: String(values.name || "").trim(),
  type: values.type || "product_form",
  parentId: values.parentId || null,
  sortOrder: Number(values.sortOrder || 0),
  description: values.description || values.notes || "",
  notes: values.notes || values.description || "",
  status: values.status || "active",
});

const buildCategoryQuery = ({ type = "", status = "" } = {}) => {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  const query = params.toString();
  return query ? `?${query}` : "";
};

export const listCategories = async (options = {}) => {
  const result = await requestSqliteApi(`/api/categories${buildCategoryQuery(options)}`);
  return result?.data || [];
};

export const getCategoryById = async (categoryId) => {
  if (!categoryId) return null;
  const result = await requestSqliteApi(`/api/categories/${encodeURIComponent(categoryId)}`);
  return result?.data || null;
};

export const createCategory = async (values = {}) => {
  const result = await requestSqliteApi("/api/categories", {
    method: "POST",
    body: JSON.stringify(normalizeCategoryPayload(values)),
  });
  return result?.data || null;
};

export const updateCategory = async (categoryId, values = {}) => {
  if (!categoryId) {
    throw new Error("Kategori yang akan diubah tidak valid.");
  }

  const result = await requestSqliteApi(`/api/categories/${encodeURIComponent(categoryId)}`, {
    method: "PUT",
    body: JSON.stringify(normalizeCategoryPayload(values)),
  });
  return result?.data || null;
};

export const deleteCategory = async (categoryId) => {
  if (!categoryId) {
    throw new Error("Kategori yang akan dinonaktifkan tidak valid.");
  }

  const result = await requestSqliteApi(`/api/categories/${encodeURIComponent(categoryId)}`, {
    method: "DELETE",
  });
  return result?.data || { id: categoryId, status: "inactive" };
};
