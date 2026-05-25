import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { formatCurrencyId as formatCurrencyIdr } from "../../utils/formatters/currencyId";
import { formatNumberId } from "../../utils/formatters/numberId";
import {
  generateDailySequenceCode,
  getDailyBusinessCodeSequence,
  prepareDailySequenceCodeInTransaction,
} from "../../utils/references/businessCodeGenerator";
import {
  applyPurchaseToRawMaterial,
  enrichRawMaterialWithVariantTotals,
} from "../../utils/variants/rawMaterialVariantHelpers";
import {
  applyStockMutationToItem,
  findVariantByKey,
  inferHasVariants,
} from "../../utils/variants/variantStockHelpers";
import {
  buildInventoryLogPayload,
  INVENTORY_LOG_COLLECTION,
} from "../Inventory/inventoryLogService";
import { setStockItemReadModelInTransaction } from "../Inventory/stockReadModelService";
import {
  getSupplierDisplayName,
  getSupplierReferenceId,
} from "../MasterData/suppliersService";
import { normalizePurchaseNoteText } from "../../utils/purchases/purchaseNoteDisplay";


const mapSnapshotDocs = (snapshot) =>
  snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data(),
  }));

export const listenPurchaseRecords = (onNext, onError) =>
  onSnapshot(
    query(collection(db, "purchases"), orderBy("createdAt", "desc")),
    (snapshot) => onNext(mapSnapshotDocs(snapshot)),
    onError,
  );

export const listenPurchaseProducts = (onNext, onError) =>
  onSnapshot(
    collection(db, "products"),
    (snapshot) => onNext(mapSnapshotDocs(snapshot)),
    onError,
  );

export const listenPurchaseRawMaterials = (onNext, onError) =>
  onSnapshot(
    collection(db, "raw_materials"),
    (snapshot) => onNext(mapSnapshotDocs(snapshot).map((item) => enrichRawMaterialWithVariantTotals(item))),
    onError,
  );

export const PURCHASE_EXPENSE_SOURCE_MODULE = "purchases";
export const PURCHASE_EXPENSE_SOURCE_TYPE = "auto_generated";

export const getPurchaseSavingMeta = (value) => {
  const amount = Math.round(Number(value || 0));

  if (amount > 0) {
    return {
      status: "hemat",
      label: `Hemat ${formatCurrencyIdr(amount)}`,
      color: "green",
    };
  }

  if (amount < 0) {
    return {
      status: "lebih_mahal",
      label: `Lebih Mahal ${formatCurrencyIdr(Math.abs(amount))}`,
      color: "red",
    };
  }

  return {
    status: "normal",
    label: "Sesuai Referensi",
    color: "default",
  };
};

export const getPurchaseStockUnit = (item = {}) => item?.stockUnit || item?.unit || item?.baseUnit || "pcs";

export const buildPurchaseExpenseDocumentId = (purchaseId) =>
  `${PURCHASE_EXPENSE_SOURCE_MODULE}__${String(purchaseId || "purchase").replace(/[^a-zA-Z0-9_-]/g, "_")}`;

export const buildPurchaseExpensePayload = ({
  date,
  itemId,
  itemName,
  itemType,
  purchaseId,
  purchasePayload,
  resolvedSupplierId,
  savingMeta,
  selectedSupplierName,
  totalActualPurchase,
  totalReferencePurchase,
  purchaseSaving,
  variantKey,
  variantLabel,
  stockSourceType,
}) => {
  const sourceRef = purchasePayload?.purchaseNumber || purchasePayload?.referenceNumber || purchaseId;

  return {
    date: Timestamp.fromDate(date.toDate()),
    type: "Pembelian Bahan/Barang",
    description: `Pembelian ${itemName} dari ${selectedSupplierName}`,
    amount: Math.round(Number(totalActualPurchase || 0)),
    totalReferenceAmount: Math.round(Number(totalReferencePurchase || 0)),
    savingAmount: Math.round(Number(purchaseSaving || 0)),
    savingStatus: savingMeta.status,
    savingLabel: savingMeta.label,
    supplierId: resolvedSupplierId || null,
    supplierName: selectedSupplierName || "",
    relatedItemId: itemId,
    relatedItemName: itemName,
    relatedPurchaseId: purchaseId,
    itemType,
    variantKey,
    variantLabel,
    stockSourceType,
    sourceModule: PURCHASE_EXPENSE_SOURCE_MODULE,
    sourceId: purchaseId,
    sourceRef,
    sourceType: PURCHASE_EXPENSE_SOURCE_TYPE,
    createdByAutomation: true,
    sourceCollection: "purchases",
    createdAt: Timestamp.now(),
  };
};

export const createPurchaseTransaction = async ({
  values,
  products = [],
  materials = [],
  suppliers = [],
}) => {
  const {
    type,
    itemId,
    materialVariantId,
    productVariantKey,
    quantity,
    date,
    note,
    supplierId,
    productLink,
    purchaseUnit,
    stockUnit,
    conversionValue,
    subtotalItems,
    shippingCost,
    shippingDiscount,
    voucherDiscount,
    serviceFee,
    purchaseType,
    restockReferencePrice,
    totalReferencePurchase,
    purchaseSaving,
  } = values;

  const normalizedType = type === "product" ? "product" : type === "material" ? "material" : "";
  if (!normalizedType) {
    throw new Error("Jenis item pembelian tidak valid.");
  }

  if (!itemId) {
    throw new Error("Pilih item yang akan dibeli terlebih dahulu.");
  }

  if (!date?.toDate) {
    throw new Error("Tanggal pembelian wajib diisi.");
  }

  const normalizedQuantity = Number(quantity || 0);
  if (normalizedQuantity <= 0) {
    throw new Error("Qty Beli harus lebih dari 0.");
  }

  const selectedSupplier = suppliers.find(
    (supplier) => String(supplier.id) === String(supplierId),
  );
  const resolvedSupplierId = getSupplierReferenceId(selectedSupplier, supplierId);

  if (!selectedSupplier || !resolvedSupplierId) {
    throw new Error("Supplier tidak valid. Pilih supplier dari katalog yang tersedia.");
  }

  const collectionName = normalizedType === "product" ? "products" : "raw_materials";
  const selectedItemFromState =
    normalizedType === "product"
      ? products.find((item) => item.id === itemId)
      : enrichRawMaterialWithVariantTotals(
          materials.find((item) => item.id === itemId) || {},
        );

  if (!selectedItemFromState?.id) {
    throw new Error("Item pembelian tidak ditemukan. Muat ulang data lalu pilih item kembali.");
  }

  const normalizedConversionValue = normalizedType === "material" ? Number(conversionValue || 0) : 1;
  const finalQuantity =
    normalizedType === "product"
      ? normalizedQuantity
      : normalizedQuantity * normalizedConversionValue;
  const normalizedFinalQuantity = Math.round(Number(finalQuantity || 0));

  if (normalizedType === "material" && normalizedConversionValue <= 0) {
    throw new Error("Konversi Supplier belum valid. Lengkapi katalog Supplier atau pilih supplier yang punya konversi.");
  }

  if (normalizedFinalQuantity <= 0) {
    throw new Error("Stok Masuk harus lebih dari 0 sebelum pembelian disimpan.");
  }

  const normalizedPurchaseType = purchaseType === "offline" ? "offline" : "online";
  const normalizedSubtotalItems = Math.round(Number(subtotalItems || 0));
  const normalizedShippingCost = normalizedPurchaseType === "offline" ? 0 : Math.round(Number(shippingCost || 0));
  const normalizedShippingDiscount = normalizedPurchaseType === "offline" ? 0 : Math.round(Number(shippingDiscount || 0));
  const normalizedVoucherDiscount = normalizedPurchaseType === "offline" ? 0 : Math.round(Number(voucherDiscount || 0));
  const normalizedServiceFee = normalizedPurchaseType === "offline" ? 0 : Math.round(Number(serviceFee || 0));
  const normalizedTotalActualPurchase = Math.round(
    normalizedSubtotalItems +
      normalizedShippingCost +
      normalizedServiceFee -
      normalizedShippingDiscount -
      normalizedVoucherDiscount,
  );
  const normalizedActualUnitCost =
    normalizedFinalQuantity > 0
      ? Math.round(normalizedTotalActualPurchase / normalizedFinalQuantity)
      : 0;
  const normalizedRestockReferencePrice = Math.round(Number(restockReferencePrice || 0));
  const normalizedTotalReferencePurchase = Math.round(Number(totalReferencePurchase || 0));
  const normalizedPurchaseSaving = Math.round(Number(purchaseSaving || 0));

  if (normalizedSubtotalItems < 0 || normalizedTotalActualPurchase < 0) {
    throw new Error("Total Aktual Pembelian tidak valid. Cek subtotal, ongkir, diskon, voucher/koin, dan biaya layanan.");
  }

  const savingMeta = getPurchaseSavingMeta(normalizedPurchaseSaving);
  const baselinePurchaseNumber = await generateDailySequenceCode({
    db,
    collectionName: "purchases",
    fieldNames: ["purchaseNumber", "code", "referenceNumber", "sourceRef"],
    prefix: "PUR",
    date: date.toDate(),
  });
  const baselineSequence = getDailyBusinessCodeSequence({
    code: baselinePurchaseNumber,
    prefix: "PUR",
    date: date.toDate(),
  });
  const inventoryLogReference = doc(collection(db, INVENTORY_LOG_COLLECTION));
  const itemReference = doc(db, collectionName, itemId);
  let purchaseNumber = "";
  let purchaseId = "";

  await runTransaction(db, async (transaction) => {
    const codeReservation = await prepareDailySequenceCodeInTransaction({
      transaction,
      db,
      collectionName: "purchases",
      prefix: "PUR",
      date: date.toDate(),
      minimumSequence: Math.max(baselineSequence - 1, 0),
    });
    purchaseNumber = codeReservation.code;
    const purchaseReference = doc(db, "purchases", purchaseNumber);
    const expenseReference = doc(db, "expenses", buildPurchaseExpenseDocumentId(purchaseReference.id));
    const purchaseSnapshot = await transaction.get(purchaseReference);
    const expenseSnapshot = await transaction.get(expenseReference);
    const itemSnapshot = await transaction.get(itemReference);

    if (purchaseSnapshot.exists()) {
      throw new Error(`Nomor pembelian ${purchaseNumber} sudah dipakai. Muat ulang data lalu simpan kembali.`);
    }

    if (expenseSnapshot.exists()) {
      throw new Error(`Expense untuk pembelian ${purchaseNumber} sudah ada. Muat ulang data lalu simpan kembali.`);
    }

    if (!itemSnapshot.exists()) {
      throw new Error("Item stok tidak ditemukan di database.");
    }

    const latestItem =
      normalizedType === "material"
        ? enrichRawMaterialWithVariantTotals({
            id: itemSnapshot.id,
            ...itemSnapshot.data(),
          })
        : {
            id: itemSnapshot.id,
            ...itemSnapshot.data(),
          };

    const latestSelectedVariant =
      normalizedType === "material" && (latestItem?.hasVariantOptions || latestItem?.hasVariants)
        ? (latestItem.variants || []).find(
            (item) => String(item.variantKey) === String(materialVariantId),
          )
        : normalizedType === "product" && inferHasVariants(latestItem || {})
          ? findVariantByKey(latestItem, productVariantKey)
          : null;

    if (normalizedType === "material" && (latestItem?.hasVariantOptions || latestItem?.hasVariants) && !latestSelectedVariant) {
      throw new Error("Pilih varian bahan baku terlebih dahulu agar stok tidak masuk master/default.");
    }

    if (normalizedType === "product" && inferHasVariants(latestItem || {}) && !latestSelectedVariant) {
      throw new Error("Pilih varian produk terlebih dahulu agar stok tidak masuk master/default.");
    }

    const variantLabel =
      normalizedType === "material"
        ? latestSelectedVariant?.variantName || latestSelectedVariant?.name || ""
        : latestSelectedVariant?.variantLabel || latestSelectedVariant?.color || latestSelectedVariant?.name || "";
    const variantKey = latestSelectedVariant?.variantKey || "";
    const variantPayload = {
      variantKey,
      variantLabel,
      stockSourceType: latestSelectedVariant ? "variant" : "master",
    };
    const resolvedStockUnit =
      normalizedType === "material"
        ? stockUnit || getPurchaseStockUnit(latestItem)
        : getPurchaseStockUnit(latestItem);
    const itemName = latestSelectedVariant
      ? `${latestItem?.name || "Item"} - ${variantLabel}`
      : latestItem?.name || "Item tidak ditemukan";

    const purchasePayload = {
      purchaseNumber,
      code: purchaseNumber,
      referenceNumber: purchaseNumber,
      sourceRef: purchaseNumber,
      type: normalizedType,
      itemId,
      itemName,
      ...variantPayload,
      materialVariantId: normalizedType === "material" ? materialVariantId || null : null,
      materialVariantName:
        normalizedType === "material" && latestSelectedVariant
          ? variantLabel
          : "",
      supplierId: resolvedSupplierId || null,
      supplierName: getSupplierDisplayName(selectedSupplier) || "Supplier tidak ditemukan",
      productLink: String(productLink || "").trim(),
      purchaseProductLink: String(productLink || "").trim(),
      restockProductLink: String(productLink || "").trim(),
      quantity: normalizedQuantity,
      date: Timestamp.fromDate(date.toDate()),
      note: note || "",
      subtotalItems: normalizedSubtotalItems,
      purchaseType: normalizedPurchaseType,
      shippingCost: normalizedShippingCost,
      shippingDiscount: normalizedShippingDiscount,
      voucherDiscount: normalizedVoucherDiscount,
      serviceFee: normalizedServiceFee,
      totalActualPurchase: normalizedTotalActualPurchase,
      actualUnitCost: normalizedActualUnitCost,
      restockReferencePrice: normalizedRestockReferencePrice,
      totalReferencePurchase: normalizedTotalReferencePurchase,
      purchaseSaving: normalizedPurchaseSaving,
      purchaseSavingStatus: savingMeta.status,
      purchaseSavingLabel: savingMeta.label,
      purchaseTransactionStatus: "committed",
    };

    if (normalizedType === "material") {
      Object.assign(purchasePayload, {
        purchaseUnit: purchaseUnit || "",
        stockUnit: stockUnit || "",
        conversionValue: normalizedConversionValue,
        totalStockIn: normalizedFinalQuantity,
      });
    } else {
      Object.assign(purchasePayload, {
        totalStockIn: normalizedFinalQuantity,
      });
    }

    codeReservation.commit();
    purchaseId = purchaseReference.id;

    if (normalizedType === "material") {
      const nextMaterialPayload = applyPurchaseToRawMaterial(latestItem, {
        qty: normalizedFinalQuantity,
        unitCost: normalizedActualUnitCost,
        variantKey: (latestItem?.hasVariantOptions || latestItem?.hasVariants) && latestSelectedVariant
          ? latestSelectedVariant.variantKey
          : undefined,
        variantName: (latestItem?.hasVariantOptions || latestItem?.hasVariants) && latestSelectedVariant
          ? variantLabel
          : undefined,
        restockReferencePrice: normalizedRestockReferencePrice,
      });
      const nextMaterialItem = {
        ...latestItem,
        ...nextMaterialPayload,
        updatedAt: Timestamp.now(),
      };

      transaction.update(itemReference, {
        ...nextMaterialPayload,
        updatedAt: nextMaterialItem.updatedAt,
      });
      setStockItemReadModelInTransaction(transaction, {
        ...nextMaterialItem,
        // AKTIF / DERIVED READ MODEL: metadata restock terakhir hanya untuk Dashboard/Report.
        // Tidak ditulis ke master raw_materials agar business source of truth stok tetap tidak berubah.
        lastPurchaseAt: purchasePayload.date,
        lastPurchasePrice: normalizedActualUnitCost,
        lastPurchaseUnitPrice: normalizedActualUnitCost,
        restockSupplierId: purchasePayload.supplierId || "",
        restockSupplierName: purchasePayload.supplierName || "",
        restockProductLink: purchasePayload.restockProductLink || purchasePayload.productLink || "",
      }, {
        sourceType: collectionName,
        sourceCollection: collectionName,
        lastSyncedFrom: "purchasesService.createPurchase.material",
      });
    } else {
      const stockUpdatePayload = applyStockMutationToItem({
        item: latestItem,
        variantKey: productVariantKey || "",
        deltaCurrent: normalizedFinalQuantity,
      });
      const nextProductItem = {
        ...latestItem,
        ...stockUpdatePayload,
        updatedAt: Timestamp.now(),
      };

      transaction.update(itemReference, {
        ...stockUpdatePayload,
        updatedAt: nextProductItem.updatedAt,
      });
      setStockItemReadModelInTransaction(transaction, {
        ...nextProductItem,
        // AKTIF / DERIVED READ MODEL: metadata pembelian terakhir untuk audit/report; tidak mengubah master product.
        lastPurchaseAt: purchasePayload.date,
        lastPurchasePrice: normalizedActualUnitCost,
        lastPurchaseUnitPrice: normalizedActualUnitCost,
        restockSupplierId: purchasePayload.supplierId || "",
        restockSupplierName: purchasePayload.supplierName || "",
        restockProductLink: purchasePayload.restockProductLink || purchasePayload.productLink || "",
      }, {
        sourceType: collectionName,
        sourceCollection: collectionName,
        lastSyncedFrom: "purchasesService.createPurchase.product",
      });
    }

    transaction.set(purchaseReference, purchasePayload);

    transaction.set(
      inventoryLogReference,
      buildInventoryLogPayload({
        itemId,
        itemName,
        quantityChange: normalizedFinalQuantity,
        type: "purchase_in",
        collectionName,
        extraData: {
          purchaseId: purchaseReference.id,
          purchaseNumber: purchasePayload.purchaseNumber || "",
          referenceId: purchaseReference.id,
          referenceNumber: purchasePayload.purchaseNumber || "",
          referenceCode: purchasePayload.purchaseNumber || "",
          sourceRef: purchasePayload.purchaseNumber || "",
          referenceType: "purchase",
          supplierName: purchasePayload.supplierName || "",
          unit: resolvedStockUnit || "",
          stockUnit: resolvedStockUnit || "",
          purchaseUnit: normalizedType === "material" ? purchaseUnit || "" : "",
          ...variantPayload,
          materialVariantId: normalizedType === "material" ? materialVariantId || null : null,
          materialVariantName:
            normalizedType === "material" && latestSelectedVariant
              ? variantLabel
              : "",
          totalActualPurchase: normalizedTotalActualPurchase,
          actualUnitCost: normalizedActualUnitCost,
          totalReferencePurchase: normalizedTotalReferencePurchase,
          purchaseSaving: normalizedPurchaseSaving,
          purchaseSavingStatus: savingMeta.status,
          note:
            normalizedType === "material"
              ? normalizePurchaseNoteText(
                  [
                    note || "",
                    `Pembelian ${formatNumberId(normalizedQuantity)} ${purchaseUnit || ""} = ${formatNumberId(
                      normalizedFinalQuantity,
                    )} ${stockUnit || ""}${latestSelectedVariant ? ` | Varian ${variantLabel}` : ""}`,
                  ]
                    .filter(Boolean)
                    .join("\n"),
                )
              : note || "",
        },
      }),
    );

    const purchaseExpensePayload = buildPurchaseExpensePayload({
      date,
      itemId,
      itemName,
      itemType: normalizedType,
      purchaseId: purchaseReference.id,
      purchasePayload,
      resolvedSupplierId,
      savingMeta,
      selectedSupplierName: purchasePayload.supplierName,
      totalActualPurchase: normalizedTotalActualPurchase,
      totalReferencePurchase: normalizedTotalReferencePurchase,
      purchaseSaving: normalizedPurchaseSaving,
      variantKey,
      variantLabel,
      stockSourceType: variantPayload.stockSourceType,
    });

    transaction.set(expenseReference, purchaseExpensePayload);
  });

  return {
    purchaseId,
    purchaseNumber,
  };
};
