import dayjs from "dayjs";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  orderBy,
  query,
  runTransaction,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  buildInventoryLogPayload,
  buildInventoryLogReferenceFields,
  buildInventoryLogUnitFields,
  buildInventoryLogVariantFields,
  INVENTORY_LOG_COLLECTION,
} from "../Inventory/inventoryLogService";
import { generateDailySequenceCode } from "../../utils/references/businessCodeGenerator";
import {
  applyStockMutationToItem,
  findVariantByKey,
  getItemStockSnapshot,
  inferHasVariants,
} from "../../utils/variants/variantStockHelpers";
import { formatNumberId } from "../../utils/formatters/numberId";

export const buildSaleStockBucketKey = (item) =>
  `${item.collectionName}::${item.itemId}::${item.variantKey || "master"}`;

export const fetchSalesRecords = async () => {
  const salesSnapshot = await getDocs(
    query(collection(db, "sales"), orderBy("createdAt", "desc")),
  );

  return salesSnapshot.docs.map((documentItem) => {
    const salesData = documentItem.data();
    const dateValue = salesData.date;

    return {
      id: documentItem.id,
      ...salesData,
      date: dateValue?.toDate
        ? dayjs(dateValue.toDate()).format("YYYY-MM-DD")
        : "Tanggal Tidak Tersedia",
    };
  });
};

export const fetchSalesProducts = async () => {
  const productsSnapshot = await getDocs(collection(db, "products"));

  return productsSnapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data(),
  }));
};

export const fetchSalesRawMaterials = async () => {
  const rawMaterialsSnapshot = await getDocs(collection(db, "raw_materials"));

  return rawMaterialsSnapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data(),
  }));
};

export const hasExistingSaleIncome = async (saleId) => {
  const incomeSnapshot = await getDocs(
    query(collection(db, "incomes"), where("relatedId", "==", saleId)),
  );

  return !incomeSnapshot.empty;
};

export const buildSaleIncomePayload = ({ selectedSale, saleId, dateValue = Timestamp.now() }) => {
  const itemNames = (selectedSale.items || [])
    .map((item) => `${item.itemName}${item.variantLabel ? ` - ${item.variantLabel}` : ""} (${item.quantity})`)
    .join(", ");
  const saleReferenceNumber = selectedSale.saleNumber || selectedSale.code || selectedSale.referenceNumber || saleId;

  return {
    date: dateValue,
    type: "Penjualan",
    incomeNumber: saleReferenceNumber,
    code: saleReferenceNumber,
    sourceRef: saleReferenceNumber,
    referenceNumber: saleReferenceNumber,
    relatedId: saleId,
    description: `Penjualan: ${itemNames}`,
    amount: selectedSale.total,
    salesChannel: selectedSale.salesChannel || "",
    sourceModule: "sales",
    createdAt: Timestamp.now(),
  };
};

const aggregateSaleStockNeeds = (saleItems = []) => {
  const stockNeedsByBucket = new Map();

  saleItems.forEach((item) => {
    const bucketKey = buildSaleStockBucketKey(item);
    const existingNeed = stockNeedsByBucket.get(bucketKey);

    stockNeedsByBucket.set(bucketKey, {
      ...item,
      quantity: Number(existingNeed?.quantity || 0) + Number(item.quantity || 0),
    });
  });

  return stockNeedsByBucket;
};

export const validateSaleStockAvailability = async (saleItems = []) => {
  for (const item of aggregateSaleStockNeeds(saleItems).values()) {
    const itemReference = doc(db, item.collectionName, item.itemId);
    const itemSnapshotDocument = await getDoc(itemReference);

    if (!itemSnapshotDocument.exists()) {
      throw new Error(`Item ${item.itemName || item.itemId} tidak ditemukan. Penjualan dibatalkan agar stok tidak salah.`);
    }

    const latestItem = {
      id: itemSnapshotDocument.id,
      ...itemSnapshotDocument.data(),
    };
    const hasVariants = inferHasVariants(latestItem);
    const latestVariant = hasVariants && item.variantKey
      ? findVariantByKey(latestItem, item.variantKey)
      : null;

    if (hasVariants && !latestVariant) {
      throw new Error(`Varian ${item.variantLabel || item.variantKey || "item"} untuk ${item.itemName} tidak ditemukan. Penjualan dibatalkan agar stok tidak masuk ke master/default.`);
    }

    const stockSnapshot = latestVariant
      ? getItemStockSnapshot(latestVariant)
      : getItemStockSnapshot(latestItem);
    const availableStock = Number(stockSnapshot.availableStock || 0);
    const requestedQuantity = Number(item.quantity || 0);

    if (availableStock < requestedQuantity) {
      throw new Error(
        `Stok tersedia ${item.itemName}${latestVariant ? ` - ${latestVariant.variantLabel || latestVariant.color || latestVariant.name || item.variantLabel || ""}` : ""} tidak mencukupi. Dibutuhkan: ${formatNumberId(requestedQuantity)}, tersedia: ${formatNumberId(availableStock)}. Penjualan belum disimpan.`,
      );
    }
  }
};

export const createSaleTransaction = async ({
  saleItems = [],
  salesChannel,
  finalSaleStatus,
  saleDate,
  referenceNumber,
  note,
  selectedCustomer,
  totalSaleValue,
}) => {
  const saleNumber = await generateDailySequenceCode({
    db,
    collectionName: "sales",
    fieldNames: ["saleNumber", "code", "referenceNumber", "sourceRef"],
    prefix: "ORD",
    date: saleDate.toDate(),
  });

  const salesDocument = doc(db, "sales", saleNumber);
  const saleIncomeReference = finalSaleStatus === "Selesai"
    ? doc(db, "incomes", `income_${salesDocument.id}`)
    : null;
  const saleInventoryLogReferences = saleItems.map(() =>
    doc(collection(db, INVENTORY_LOG_COLLECTION)),
  );

  const newSalePayload = {
    saleNumber,
    code: saleNumber,
    customerId: selectedCustomer?.id || null,
    customerName: selectedCustomer?.name || "",
    items: saleItems,
    salesChannel,
    status: finalSaleStatus,
    date: Timestamp.fromDate(saleDate.toDate()),
    referenceNumber: saleNumber,
    sourceRef: saleNumber,
    externalReferenceNumber: referenceNumber || null,
    total: totalSaleValue,
    note: note || "",
    createdAt: Timestamp.now(),
  };

  await runTransaction(db, async (transaction) => {
    const saleSnapshot = await transaction.get(salesDocument);
    const incomeSnapshot = saleIncomeReference
      ? await transaction.get(saleIncomeReference)
      : null;

    if (saleSnapshot.exists()) {
      throw new Error(`Nomor penjualan ${saleNumber} sudah dipakai. Muat ulang data lalu simpan kembali.`);
    }

    if (incomeSnapshot?.exists()) {
      throw new Error(`Income untuk penjualan ${saleNumber} sudah ada. Muat ulang data lalu simpan kembali.`);
    }

    const stockMutationPayloads = [];

    for (const item of aggregateSaleStockNeeds(newSalePayload.items).values()) {
      const itemReference = doc(db, item.collectionName, item.itemId);
      const itemSnapshotDocument = await transaction.get(itemReference);

      if (!itemSnapshotDocument.exists()) {
        throw new Error(`Item ${item.itemName || item.itemId} tidak ditemukan. Penjualan dibatalkan agar stok tidak partial.`);
      }

      const latestItem = {
        id: itemSnapshotDocument.id,
        ...itemSnapshotDocument.data(),
      };
      const hasVariants = inferHasVariants(latestItem);
      const latestVariant = hasVariants && item.variantKey
        ? findVariantByKey(latestItem, item.variantKey)
        : null;

      if (hasVariants && !latestVariant) {
        throw new Error(`Varian ${item.variantLabel || item.variantKey || "-"} tidak ditemukan. Penjualan dibatalkan agar stok tidak masuk ke master/default.`);
      }

      const stockSnapshot = latestVariant
        ? getItemStockSnapshot(latestVariant)
        : getItemStockSnapshot(latestItem);
      const requestedQuantity = Number(item.quantity || 0);

      if (stockSnapshot.availableStock < requestedQuantity) {
        throw new Error(
          `Stok tersedia ${item.itemName}${latestVariant ? ` - ${latestVariant.variantLabel || latestVariant.color || latestVariant.name || item.variantLabel || ""}` : ""} tidak mencukupi. Tersisa: ${formatNumberId(stockSnapshot.availableStock)}. Penjualan belum disimpan.`,
        );
      }

      stockMutationPayloads.push({
        itemReference,
        stockUpdatePayload: applyStockMutationToItem({
          item: latestItem,
          variantKey: latestVariant?.variantKey || "",
          deltaCurrent: -requestedQuantity,
        }),
      });
    }

    transaction.set(salesDocument, newSalePayload);

    stockMutationPayloads.forEach(({ itemReference, stockUpdatePayload }) => {
      transaction.update(itemReference, stockUpdatePayload);
    });

    newSalePayload.items.forEach((item, index) => {
      transaction.set(
        saleInventoryLogReferences[index],
        buildInventoryLogPayload({
          itemId: item.itemId,
          itemName: item.itemName,
          quantityChange: -item.quantity,
          type: "sale",
          collectionName: item.collectionName,
          timestamp: Timestamp.now(),
          extraData: {
            customerName: newSalePayload.customerName || "",
            saleId: salesDocument.id,
            saleNumber: newSalePayload.saleNumber || "",
            ...buildInventoryLogReferenceFields({
              referenceId: salesDocument.id,
              referenceNumber: newSalePayload.saleNumber || newSalePayload.referenceNumber || "",
              referenceType: "sale",
            }),
            note: `Penjualan via ${newSalePayload.salesChannel}`,
            subtotal: item.subtotal,
            ...buildInventoryLogUnitFields({
              unit: item.unit || "",
              stockUnit: item.unit || "",
            }),
            ...buildInventoryLogVariantFields({
              variantKey: item.variantKey || "",
              variantLabel: item.variantLabel || "",
              stockSourceType: item.stockSourceType || "master",
            }),
          },
        }),
      );
    });

    if (saleIncomeReference) {
      transaction.set(
        saleIncomeReference,
        buildSaleIncomePayload({
          selectedSale: newSalePayload,
          saleId: salesDocument.id,
          dateValue: Timestamp.fromDate(saleDate.toDate()),
        }),
      );
    }
  });

  return {
    saleId: salesDocument.id,
    saleNumber,
  };
};

export const updateSaleStatusTransaction = async ({ saleId, newStatus, selectedSale }) => {
  if (newStatus === "Dibatalkan") {
    throw new Error("Sales tidak bisa dibatalkan. Gunakan menu Return untuk barang kembali.");
  }

  const saleReference = doc(db, "sales", saleId);

  if (newStatus === "Selesai" && selectedSale && selectedSale.total > 0) {
    const incomeExists = await hasExistingSaleIncome(saleId);
    const incomeReference = doc(db, "incomes", `income_${saleId}`);

    await runTransaction(db, async (transaction) => {
      const saleSnapshot = await transaction.get(saleReference);
      const incomeSnapshot = await transaction.get(incomeReference);

      if (!saleSnapshot.exists()) {
        throw new Error("Data penjualan tidak ditemukan. Status belum diubah.");
      }

      const latestSale = {
        id: saleSnapshot.id,
        ...saleSnapshot.data(),
      };

      transaction.update(saleReference, { status: newStatus });

      if (!incomeExists && !incomeSnapshot.exists()) {
        transaction.set(
          incomeReference,
          buildSaleIncomePayload({
            selectedSale: latestSale,
            saleId,
            dateValue: Timestamp.now(),
          }),
        );
      }
    });

    return;
  }

  await updateDoc(saleReference, { status: newStatus });
};
