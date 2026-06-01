import * as firebaseCategoriesAdapter from "../adapters/firebase/firebaseCategoriesAdapter";
import * as sqliteCategoriesAdapter from "../adapters/sqlite/sqliteCategoriesAdapter";
import {
  REPOSITORY_MODES,
  resolveRepositoryMode,
} from "./repositoryMode";

const getCategoriesAdapter = (options = {}) => {
  const mode = resolveRepositoryMode(options);

  if (mode === REPOSITORY_MODES.FIREBASE_PRIMARY) {
    return firebaseCategoriesAdapter;
  }

  return sqliteCategoriesAdapter;
};

export const listCategories = (options = {}) =>
  getCategoriesAdapter(options).listCategories(options);

export const getCategoryById = (categoryId, options = {}) =>
  getCategoriesAdapter(options).getCategoryById(categoryId, options);

export const createCategory = (values = {}, options = {}) =>
  getCategoriesAdapter(options).createCategory(values, options);

export const updateCategory = (categoryId, values = {}, options = {}) =>
  getCategoriesAdapter(options).updateCategory(categoryId, values, options);

export const deleteCategory = (categoryId, options = {}) =>
  getCategoriesAdapter(options).deleteCategory(categoryId, options);
