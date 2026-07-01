import * as sqliteCategoriesAdapter from "../adapters/sqlite/sqliteCategoriesAdapter";


export const listCategories = (options = {}) => sqliteCategoriesAdapter.listCategories(options);
export const getCategoryById = (categoryId, options = {}) => sqliteCategoriesAdapter.getCategoryById(categoryId, options);
export const createCategory = (values = {}, options = {}) => sqliteCategoriesAdapter.createCategory(values, options);
export const updateCategory = (categoryId, values = {}, options = {}) => sqliteCategoriesAdapter.updateCategory(categoryId, values, options);
export const deleteCategory = (categoryId, options = {}) => sqliteCategoriesAdapter.deleteCategory(categoryId, options);
