import { requestSqliteApi } from "./sqliteApiClient";

const normalizeCategoryPayload = (values = {}) => ({
  code: values.code || "",
  name: String(values.name || "").trim(),
  type: values.type || "general",
  description: values.description || values.notes || "",
  notes: values.notes || values.description || "",
});

export const listCategories = async () => {
  const result = await requestSqliteApi("/api/categories");
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
    throw new Error("Kategori yang akan dihapus tidak valid.");
  }

  const result = await requestSqliteApi(`/api/categories/${encodeURIComponent(categoryId)}`, {
    method: "DELETE",
  });
  return result?.data || { id: categoryId, deleted: true };
};
