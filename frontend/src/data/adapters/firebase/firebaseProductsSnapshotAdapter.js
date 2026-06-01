import {
  collection,
  getDoc,
  getDocs,
  doc,
} from "firebase/firestore";

import { db } from "../../../firebase";

const PRODUCTS_COLLECTION = "products";

const compareByName = (first = {}, second = {}) =>
  String(first.name || first.productCode || first.code || first.id || "").localeCompare(
    String(second.name || second.productCode || second.code || second.id || ""),
    "id-ID",
  );

const toProductSnapshotRecord = (productDocument) => ({
  id: productDocument.id,
  ...productDocument.data(),
});

export const listProductSnapshots = async () => {
  const snapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));
  return snapshot.docs.map(toProductSnapshotRecord).sort(compareByName);
};

export const getProductSnapshotById = async (productId) => {
  if (!productId) return null;

  const snapshot = await getDoc(doc(db, PRODUCTS_COLLECTION, productId));
  return snapshot.exists() ? toProductSnapshotRecord(snapshot) : null;
};
