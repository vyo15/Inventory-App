import { LOCAL_DB_TABLES } from "../../local/localDbSchema";
import { createDexieMasterDataAdapter } from "./dexieMasterDataAdapterFactory";

const adapter = createDexieMasterDataAdapter({
  tableName: LOCAL_DB_TABLES.SUPPLIERS,
  idFields: ["id", "code", "supplierCode"],
});

export const listSuppliers = adapter.list;
export const getSupplierById = adapter.getById;
export const createSupplier = adapter.create;
export const updateSupplier = adapter.update;
export const deleteSupplier = adapter.remove;
