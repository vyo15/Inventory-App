import {
  collection,
  getDoc,
  getDocs,
  orderBy,
  query,
  doc,
} from "firebase/firestore";

import { db } from "../../../firebase";
import {
  generateSupplierCode as generateFirebaseSupplierCode,
  normalizeSupplierRecord,
} from "../../../services/MasterData/suppliersService";

const SUPPLIERS_COLLECTION = "supplierPurchases";

const toSupplierRecord = (supplierDocument) =>
  normalizeSupplierRecord({
    id: supplierDocument.id,
    ...supplierDocument.data(),
  });

const unsupportedWrite = () => {
  throw new Error(
    "Supplier write repository belum diaktifkan. Audit flow SupplierPurchases terlebih dahulu sebelum memindahkan create/update/delete ke repository."
  );
};

export const listSuppliers = async () => {
  const suppliersQuery = query(
    collection(db, SUPPLIERS_COLLECTION),
    orderBy("name", "asc")
  );
  const snapshot = await getDocs(suppliersQuery);
  return snapshot.docs.map(toSupplierRecord);
};

export const getSupplierById = async (supplierId) => {
  if (!supplierId) return null;

  const snapshot = await getDoc(doc(db, SUPPLIERS_COLLECTION, supplierId));
  return snapshot.exists() ? toSupplierRecord(snapshot) : null;
};

export const generateSupplierCode = () => generateFirebaseSupplierCode();

export const createSupplier = unsupportedWrite;
export const updateSupplier = unsupportedWrite;
export const deleteSupplier = unsupportedWrite;
