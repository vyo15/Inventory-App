import { LOCAL_DB_TABLES } from "../../local/localDbSchema";
import { createDexieMasterDataAdapter } from "./dexieMasterDataAdapterFactory";

const adapter = createDexieMasterDataAdapter({
  tableName: LOCAL_DB_TABLES.CUSTOMERS,
  idFields: ["id", "code", "customerCode"],
});

export const listCustomers = adapter.list;
export const getCustomerById = adapter.getById;
export const createCustomer = adapter.create;
export const updateCustomer = adapter.update;
export const deleteCustomer = adapter.remove;
