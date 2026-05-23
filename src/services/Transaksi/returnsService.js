import dayjs from "dayjs";
import { collection, doc, onSnapshot, runTransaction, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";
import {
  buildInventoryLogPayload,
  INVENTORY_LOG_COLLECTION,
} from "../Inventory/inventoryLogService";
import {
  generateDailySequenceCode,
  getDailyBusinessCodeSequence,
  prepareDailySequenceCodeInTransaction,
} from "../../utils/references/businessCodeGenerator";
import {
  applyStockMutationToItem,
  findVariantByKey,
  getItemStockSnapshot,
  inferHasVariants,
} from "../../utils/variants/variantStockHelpers";

const mapSnapshotDocs = (snapshot) => snapshot.docs.map((documentItem) => ({
  id: documentItem.id,
  ...documentItem.data(),
}));

export const listenReturnRecords = (onNext, onError) =>
  onSnapshot(
    collection(db, "returns"),
    (snapshot) => onNext(mapSnapshotDocs(snapshot)),
    onError,
  );

export const listenReturnProducts = (onNext, onError) =>
  onSnapshot(
    collection(db, "products"),
    (snapshot) => onNext(mapSnapshotDocs(snapshot)),
    onError,
  );

export const listenReturnRawMaterials = (onNext, onError) =>
  onSnapshot(
    collection(db, "raw_materials"),
    (snapshot) => onNext(mapSnapshotDocs(snapshot)),
    onError,
  );

// Rule aktif Return: stock-only correction.
// Transaction ini hanya menulis dokumen return, stok masuk, dan inventory log return_in.
// Jangan menambahkan income/expense/revenue/refund otomatis sebelum ada approval rule finance Return terpisah.
export const createReturnTransaction = async ({ values, allItems = [] }) => {
  const { type, itemId, quantity, date, note, variantKey } = values;
  const collectionName = type === "product" ? "products" : "raw_materials";
  const normalizedQuantity = Number(quantity || 0);
  const normalizedNote = String(note || "").trim();

  if (!type || !["product", "material"].includes(type)) {
    throw new Error("Jenis item retur tidak valid.");
  }

  if (!itemId) {
    throw new Error("Item retur wajib dipilih.");
  }

  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
    throw new Error("Jumlah retur harus lebih dari 0.");
  }

  if (!date?.toDate || !dayjs(date.toDate()).isValid()) {
    throw new Error("Tanggal retur tidak valid.");
  }

  const item = allItems.find((sourceItem) => sourceItem.id === itemId);

  if (!item) {
    throw new Error("Item tidak ditemukan");
  }

  if (inferHasVariants(item) && !variantKey) {
    throw new Error("Pilih varian item terlebih dahulu agar retur masuk ke stok varian yang benar.");
  }

  const returnTimestamp = Timestamp.fromDate(date.toDate());
  const baselineReturnNumber = await generateDailySequenceCode({
    db,
    collectionName: "returns",
    fieldNames: ["returnNumber", "code", "referenceNumber", "sourceRef"],
    prefix: "RET",
    date: date.toDate(),
  });
  const baselineSequence = getDailyBusinessCodeSequence({
    code: baselineReturnNumber,
    prefix: "RET",
    date: date.toDate(),
  });

  const itemReference = doc(db, collectionName, itemId);
  const inventoryLogReference = doc(collection(db, INVENTORY_LOG_COLLECTION));
  let returnNumber = "";
  let returnId = "";

  await runTransaction(db, async (transaction) => {
    const codeReservation = await prepareDailySequenceCodeInTransaction({
      transaction,
      db,
      collectionName: "returns",
      prefix: "RET",
      date: date.toDate(),
      minimumSequence: Math.max(baselineSequence - 1, 0),
    });
    returnNumber = codeReservation.code;
    const returnReference = doc(db, "returns", returnNumber);
    const returnSnapshot = await transaction.get(returnReference);
    const itemDocument = await transaction.get(itemReference);

    if (returnSnapshot.exists()) {
      throw new Error(`Nomor retur ${returnNumber} sudah dipakai. Muat ulang data lalu simpan kembali.`);
    }

    if (!itemDocument.exists()) {
      throw new Error("Item stok tidak ditemukan. Retur dibatalkan agar stok dan log tidak partial.");
    }

    const latestItem = {
      id: itemDocument.id,
      ...itemDocument.data(),
    };
    const latestItemName = latestItem?.name || item?.name || "Item tanpa nama";
    const latestItemHasVariants = inferHasVariants(latestItem);
    const selectedVariant = latestItemHasVariants
      ? findVariantByKey(latestItem, variantKey)
      : null;

    if (latestItemHasVariants && !variantKey) {
      throw new Error("Item memiliki varian. Pilih varian agar stok retur masuk ke sumber yang benar.");
    }

    if (latestItemHasVariants && !selectedVariant) {
      throw new Error("Varian item tidak ditemukan. Retur dibatalkan agar stok tidak masuk ke master/default.");
    }

    const stockSnapshotBefore = selectedVariant
      ? getItemStockSnapshot(selectedVariant)
      : getItemStockSnapshot(latestItem);
    const stockUpdatePayload = applyStockMutationToItem({
      item: latestItem,
      variantKey: selectedVariant?.variantKey || "",
      deltaCurrent: normalizedQuantity,
    });
    const currentStockAfter = stockSnapshotBefore.currentStock + normalizedQuantity;
    const availableStockAfter = currentStockAfter - stockSnapshotBefore.reservedStock;
    const variantPayload = {
      variantKey: selectedVariant?.variantKey || "",
      variantLabel: selectedVariant?.variantLabel || "",
      stockSourceType: selectedVariant ? "variant" : "master",
    };
    const stockUnit =
      latestItem.stockUnit ||
      latestItem.unit ||
      latestItem.baseUnit ||
      (collectionName === "products" ? "pcs" : "");

    codeReservation.commit();
    returnId = returnReference.id;
    transaction.set(returnReference, {
      returnNumber,
      code: returnNumber,
      referenceNumber: returnNumber,
      sourceRef: returnNumber,
      type,
      itemId,
      itemName: latestItemName,
      quantity: normalizedQuantity,
      unit: stockUnit,
      stockUnit,
      note: normalizedNote,
      date: returnTimestamp,
      ...variantPayload,
    });

    transaction.update(itemReference, stockUpdatePayload);

    transaction.set(
      inventoryLogReference,
      buildInventoryLogPayload({
        itemId,
        itemName: latestItemName,
        quantityChange: normalizedQuantity,
        type: "return_in",
        collectionName,
        timestamp: Timestamp.now(),
        extraData: {
          returnId: returnReference.id,
          returnNumber,
          referenceId: returnReference.id,
          referenceNumber: returnNumber,
          referenceCode: returnNumber,
          referenceType: "return",
          unit: stockUnit,
          stockUnit,
          note: normalizedNote,
          currentStockBefore: stockSnapshotBefore.currentStock,
          currentStockAfter,
          previousStock: stockSnapshotBefore.currentStock,
          newStock: currentStockAfter,
          reservedStockBefore: stockSnapshotBefore.reservedStock,
          reservedStockAfter: stockSnapshotBefore.reservedStock,
          availableStockBefore: stockSnapshotBefore.availableStock,
          availableStockAfter,
          ...variantPayload,
        },
      }),
    );
  });

  return {
    returnId,
    returnNumber,
  };
};
