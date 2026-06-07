import dayjs from "dayjs";
import * as sqliteTransactionsAdapter from "../../data/adapters/sqlite/sqliteTransactionsAdapter";
import { listenProducts } from "../MasterData/productsService";
import { listenRawMaterials } from "../MasterData/rawMaterialsService";

export const listenReturnRecords = (onNext, onError) => sqliteTransactionsAdapter.subscribeReturns(onNext, onError, { limit: 500 });
export const listenReturnSales = (onNext, onError) => sqliteTransactionsAdapter.subscribeSales(onNext, onError, { limit: 1000 });
export const listenReturnProducts = (onNext, onError) => listenProducts(onNext, onError);
export const listenReturnRawMaterials = (onNext, onError) => listenRawMaterials(onNext, onError);

export const createReturnTransaction = async ({ values, returnableItems = [], selectedSale = null }) => {
  const relatedSaleId = values.relatedSaleId || selectedSale?.id;
  if (!relatedSaleId) throw new Error("Transaksi Sales wajib dipilih.");

  const selectedReturnItem = returnableItems.find((item) => item.key === values.saleItemKey);
  if (!selectedReturnItem) throw new Error("Item retur wajib dipilih dari transaksi Sales.");

  const normalizedQuantity = Number(values.quantity || 0);
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) throw new Error("Jumlah retur harus lebih dari 0.");
  if (normalizedQuantity > Number(selectedReturnItem.remainingQuantity || 0)) {
    throw new Error(`Jumlah retur melebihi sisa item Sales. Maksimal: ${selectedReturnItem.remainingQuantity}.`);
  }

  const transactionDate = values.date ? dayjs(values.date).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
  const itemPayload = {
    sourceType: selectedReturnItem.sourceType,
    sourceId: selectedReturnItem.sourceId,
    itemId: selectedReturnItem.sourceId,
    itemName: selectedReturnItem.itemName,
    quantity: normalizedQuantity,
    variantKey: selectedReturnItem.variantKey || "",
    variantLabel: selectedReturnItem.variantLabel || "",
    unit: selectedReturnItem.unit || "",
    pricePerUnit: Number(selectedReturnItem.pricePerUnit || 0),
  };

  return sqliteTransactionsAdapter.commitReturn({
    relatedSaleId,
    saleId: relatedSaleId,
    saleReference: selectedSale?.referenceNumber || selectedSale?.saleNumber || selectedSale?.code || relatedSaleId,
    saleStatus: selectedSale?.status || "",
    customerName: selectedSale?.customerName || "",
    salesChannel: selectedSale?.salesChannel || "",
    date: transactionDate,
    transactionDate,
    status: "Selesai",
    note: values.note || "",
    notes: values.note || "",
    sourceType: itemPayload.sourceType,
    sourceId: itemPayload.sourceId,
    itemId: itemPayload.itemId,
    itemName: itemPayload.itemName,
    quantity: normalizedQuantity,
    variantKey: itemPayload.variantKey,
    variantLabel: itemPayload.variantLabel,
    unit: itemPayload.unit,
    items: [itemPayload],
  });
};
