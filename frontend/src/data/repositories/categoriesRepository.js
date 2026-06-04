import * as sqliteCategoriesAdapter from "../adapters/sqlite/sqliteCategoriesAdapter";

const getCategoriesAdapter = () => sqliteCategoriesAdapter;

export const listCategories = (options = {}) => getCategoriesAdapter().listCategories(options);
export const getCategoryById = (categoryId, options = {}) => getCategoriesAdapter().getCategoryById(categoryId, options);
export const createCategory = (values = {}, options = {}) => getCategoriesAdapter().createCategory(values, options);
export const updateCategory = (categoryId, values = {}, options = {}) => getCategoriesAdapter().updateCategory(categoryId, values, options);
export const deleteCategory = (categoryId, options = {}) => getCategoriesAdapter().deleteCategory(categoryId, options);
