import dayjs from "dayjs";
import {
  collection,
  doc,
  getDoc,
  getDocs,
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
  INVENTORY_LOG_COLLECTION,
} from "../Inventory/inventoryLogService";
import { setStockItemReadModelInTransaction } from "../Inventory/stockReadModelService";
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
import { formatNumberId } from "../../utils/formatters/numberId";

const ACTIVE_SALES_STATUSES = new Set(["Diproses", "Dikirim", "Selesai"]);

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

// IMS NOTE [AKTIF/GUARDED] - Preflight validasi stok Sales.
// Fungsi blok: membaca stok terbaru dari Firestore sebelum submit agar user mendapat feedback cepat.
// Hubungan flow: createSaleTransaction tetap melakukan validasi final di dalam transaction sebelum stok dipotong.
// Alasan logic: mencegah Sales.jsx mengimpor helper yang hilang akibat merge patch paralel tanpa mem-bypass guard stok.
export const validateSaleStockAvailability = async (saleItems = []) => {
  for (const item of aggregateSaleStockNeeds(saleItems).values()) {
    if (!item.collectionName || !item.itemId) {
      throw new Error("Item penjualan tidak lengkap. Penjualan belum disimpan agar stok tidak partial.");
    }

    const itemReference = doc(db, item.collectionName, item.itemId);
    const itemSnapshotDocument = await getDoc(itemReference);

    if (!itemSnapshotDocument.exists()) {
      throw new Error(`Item ${item.itemName || item.itemId} tidak ditemukan. Penjualan belum disimpan agar stok tidak partial.`);
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
      throw new Error(`Varian ${item.variantLabel || item.variantKey || "-"} tidak ditemukan. Penjualan belum disimpan agar stok tidak masuk ke master/default.`);
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
  const baselineSaleNumber = await generateDailySequenceCode({
    db,
    collectionName: "sales",
    fieldNames: ["saleNumber", "code", "referenceNumber", "sourceRef"],
    prefix: "ORD",
    date: saleDate.toDate(),
  });
  const baselineSequence = getDailyBusinessCodeSequence({
    code: baselineSaleNumber,
    prefix: "ORD",
    date: saleDate.toDate(),
  });
  const saleInventoryLogReferences = saleItems.map(() =>
    doc(collection(db, INVENTORY_LOG_COLLECTION)),
  );
  let saleNumber = "";
  let saleId = "";

  await runTransaction(db, async (transaction) => {
    const codeReservation = await prepareDailySequenceCodeInTransaction({
      transaction,
      db,
      collectionName: "sales",
      prefix: "ORD",
      date: saleDate.toDate(),
      minimumSequence: Math.max(baselineSequence - 1, 0),
    });
    saleNumber = codeReservation.code;
    const salesDocument = doc(db, "sales", saleNumber);
    const saleIncomeReference = finalSaleStatus === "Selesai"
      ? doc(db, "incomes", `income_${salesDocument.id}`)
      : null;
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

    const stockMutationPayloads = [];

    for (const item of aggregateSaleStockNeeds(newSalePayload.items).values()) {
      const itemReference = doc(db, item.collectionName, item.itemId);
      const itemSnapshotDocument = await transaction.get(itemReference);

      if (!itemSnapshotDocument.exists()) {
        throw new Error(`Item ${item.itemName || item.itemId} tidak ditemukan. Penjualan tidak disimpan agar stok tidak partial.`);
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
        throw new Error(`Varian ${item.variantLabel || item.variantKey || "-"} tidak ditemukan. Penjualan tidak disimpan agar stok tidak masuk ke master/default.`);
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

      const stockUpdatePayload = applyStockMutationToItem({
        item: latestItem,
        variantKey: latestVariant?.variantKey || "",
        deltaCurrent: -requestedQuantity,
      });

      stockMutationPayloads.push({
        itemReference,
        collectionName: item.collectionName,
        latestItem,
        stockUpdatePayload,
      });
    }

    codeReservation.commit();
    saleId = salesDocument.id;
    transaction.set(salesDocument, newSalePayload);

    stockMutationPayloads.forEach(({ itemReference, collectionName, latestItem, stockUpdatePayload }) => {
      const nextItem = { ...latestItem, ...stockUpdatePayload, updatedAt: Timestamp.now() };

      transaction.update(itemReference, {
        ...stockUpdatePayload,
        updatedAt: nextItem.updatedAt,
      });
      setStockItemReadModelInTransaction(transaction, nextItem, {
        sourceType: collectionName,
        sourceCollection: collectionName,
        lastSyncedFrom: "salesService.createSaleTransaction",
      });
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
            referenceId: salesDocument.id,
            referenceCode: newSalePayload.saleNumber || newSalePayload.referenceNumber || "",
            sourceRef: newSalePayload.saleNumber || newSalePayload.referenceNumber || "",
            note: `Penjualan via ${newSalePayload.salesChannel}`,
            subtotal: item.subtotal,
            referenceNumber: newSalePayload.saleNumber || newSalePayload.referenceNumber || "",
            unit: item.unit || "",
            stockUnit: item.unit || "",
            variantKey: item.variantKey || "",
            variantLabel: item.variantLabel || "",
            stockSourceType: item.stockSourceType || "master",
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
    saleId,
    saleNumber,
  };
};

export const updateSaleStatusTransaction = async ({ saleId, newStatus, selectedSale }) => {
  if (!ACTIVE_SALES_STATUSES.has(newStatus)) {
    throw new Error("Status Sales tidak valid. Gunakan menu Return untuk barang kembali.");
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
