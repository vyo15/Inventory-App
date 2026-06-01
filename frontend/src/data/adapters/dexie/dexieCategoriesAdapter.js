import { LOCAL_DB_TABLES } from "../../local/localDbSchema";
import { createDexieMasterDataAdapter } from "./dexieMasterDataAdapterFactory";

const adapter = createDexieMasterDataAdapter({
  tableName: LOCAL_DB_TABLES.CATEGORIES,
  idFields: ["id", "code", "categoryCode"],
  fallbackPrefix: "cat-local",
});

export const listCategories = adapter.list;
export const getCategoryById = adapter.getById;
export const createCategory = adapter.create;
export const updateCategory = adapter.update;
export const deleteCategory = adapter.remove;
