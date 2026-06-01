import {
  collection,
  getDoc,
  getDocs,
  doc,
} from "firebase/firestore";

import { db } from "../../../firebase";
import { enrichRawMaterialWithVariantTotals } from "../../../utils/variants/rawMaterialVariantHelpers";

const RAW_MATERIALS_COLLECTION = "raw_materials";

const compareByName = (first = {}, second = {}) =>
  String(first.name || first.materialCode || first.code || first.id || "").localeCompare(
    String(second.name || second.materialCode || second.code || second.id || ""),
    "id-ID",
  );

const toRawMaterialSnapshotRecord = (rawMaterialDocument) =>
  enrichRawMaterialWithVariantTotals({
    id: rawMaterialDocument.id,
    ...rawMaterialDocument.data(),
  });

export const listRawMaterialSnapshots = async () => {
  const snapshot = await getDocs(collection(db, RAW_MATERIALS_COLLECTION));
  return snapshot.docs.map(toRawMaterialSnapshotRecord).sort(compareByName);
};

export const getRawMaterialSnapshotById = async (rawMaterialId) => {
  if (!rawMaterialId) return null;

  const snapshot = await getDoc(doc(db, RAW_MATERIALS_COLLECTION, rawMaterialId));
  return snapshot.exists() ? toRawMaterialSnapshotRecord(snapshot) : null;
};
