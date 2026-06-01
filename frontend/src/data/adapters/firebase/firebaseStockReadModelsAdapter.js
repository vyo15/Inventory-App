import {
  collection,
  getDocs,
  limit as firestoreLimit,
  query,
} from "firebase/firestore";

import { db } from "../../../firebase";
import { STOCK_ITEM_READ_MODELS_COLLECTION } from "../../../services/Inventory/stockReadModelService";

const DEFAULT_STOCK_SNAPSHOT_LIMIT = 1000;

const toStockSnapshotRecord = (snapshotDocument) => ({
  id: snapshotDocument.id,
  readModelId: snapshotDocument.id,
  ...snapshotDocument.data(),
});

const unsupportedStockSnapshotWrite = () => {
  throw new Error(
    "Stock snapshot offline bersifat read-only. Mutasi stok, adjustment, transaksi, dan sync Offline → Firebase wajib tetap lewat Firebase runtime."
  );
};

export const listStockReadModelSnapshots = async ({
  maxResults = DEFAULT_STOCK_SNAPSHOT_LIMIT,
} = {}) => {
  const normalizedLimit = Math.max(1, Number(maxResults || DEFAULT_STOCK_SNAPSHOT_LIMIT));
  const snapshotQuery = query(
    collection(db, STOCK_ITEM_READ_MODELS_COLLECTION),
    firestoreLimit(normalizedLimit)
  );
  const snapshot = await getDocs(snapshotQuery);

  return snapshot.docs.map(toStockSnapshotRecord).sort((left, right) => {
    const sourceCompare = String(left?.sourceType || "").localeCompare(String(right?.sourceType || ""));
    if (sourceCompare !== 0) return sourceCompare;
    return String(left?.name || "").localeCompare(String(right?.name || ""), "id", {
      sensitivity: "base",
    });
  });
};

export const createStockReadModelSnapshot = unsupportedStockSnapshotWrite;
export const updateStockReadModelSnapshot = unsupportedStockSnapshotWrite;
export const deleteStockReadModelSnapshot = unsupportedStockSnapshotWrite;
