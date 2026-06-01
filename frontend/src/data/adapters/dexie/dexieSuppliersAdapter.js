import { LOCAL_DB_TABLES } from "../../local/localDbSchema";
import { createDexieMasterDataAdapter } from "./dexieMasterDataAdapterFactory";

const adapter = createDexieMasterDataAdapter({
  tableName: LOCAL_DB_TABLES.SUPPLIERS,
  idFields: ["id", "code", "supplierCode"],
});

const unsupportedWrite = () => {
  throw new Error(
    "Supplier offline masih read-only. Pull Firebase → Offline hanya membuat snapshot local; create/update/delete supplier wajib tetap lewat flow SupplierPurchases Firebase sampai audit supplier runtime disetujui."
  );
};

export const listSuppliers = adapter.list;
export const getSupplierById = adapter.getById;
export const createSupplier = unsupportedWrite;
export const updateSupplier = unsupportedWrite;
export const deleteSupplier = unsupportedWrite;
