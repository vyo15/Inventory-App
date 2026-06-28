import dayjs from "dayjs";
import * as sqliteTransactionsAdapter from "../../data/adapters/sqlite/sqliteTransactionsAdapter";
import { listenProducts } from "../MasterData/productsService";
import { listenRawMaterials } from "../MasterData/rawMaterialsService";

export const listenReturnRecords = (onNext, onError) => sqliteTransactionsAdapter.subscribeReturns(onNext, onError, { limit: 500 });
export const listenReturnSales = (onNext, onError) => sqliteTransactionsAdapter.subscribeSales(onNext, onError, { limit: 1000 });
export const listenReturnProducts = (onNext, onError) => listenProducts(onNext, onError);
export const listenReturnRawMaterials = (onNext, onError) => listenRawMaterials(onNext, onError);

const normalizeText = (value = "") => String(value || "").trim();
const normalizeSourceType = (item = {}) => {
  const sourceType = normalizeText(item.sourceType || item.itemType || item.type).toLowerCase();
  if (["raw_material", "raw_materials", "material"].includes(sourceType) || item.collectionName === "raw_materials") {
    return "raw_material";
  }
  if (["semi_finished", "semi_finished_material", "semi_finished_materials"].includes(sourceType)) {
    return "semi_finished";
  }
  return "product";
};
const getSourceId = (item = {}) => normalizeText(item.sourceId || item.itemId || item.id);
const getVariantKey = (item = {}) => normalizeText(item.variantKey || item.productVariantKey || item.materialVariantId || "");
const getLineKey = (item = {}) => [normalizeSourceType(item), getSourceId(item), getVariantKey(item) || "master"].join("::");
const getTransactionItems = (record = {}) => (
  Array.isArray(record.items) && record.items.length > 0 ? record.items : [record]
);

export const buildReturnableItemsForSale = ({ sale = null, returnRecords = [] } = {}) => {
  if (!sale?.id || String(sale.status || "").toLowerCase() === "deleted") return [];

  const soldByKey = new Map();
  for (const line of getTransactionItems(sale)) {
    const sourceId = getSourceId(line);
    const quantity = Math.abs(Number(line.quantity || line.qty || 0));
    if (!sourceId || !Number.isFinite(quantity) || quantity <= 0) continue;
    const key = getLineKey(line);
    const existing = soldByKey.get(key) || {
      ...line,
      key,
      sourceType: normalizeSourceType(line),
      sourceId,
      itemId: sourceId,
      itemName: line.itemName || line.name || sourceId,
      variantKey: getVariantKey(line),
      variantLabel: line.variantLabel || "",
      unit: line.unit || line.stockUnit || "",
      pricePerUnit: Number(line.pricePerUnit || 0),
      soldQuantity: 0,
    };
    existing.soldQuantity += quantity;
    soldByKey.set(key, existing);
  }

  const returnedByKey = new Map();
  for (const record of returnRecords || []) {
    if (String(record.status || "").toLowerCase() === "deleted") continue;
    const relatedSaleId = normalizeText(record.relatedSaleId || record.saleId);
    if (relatedSaleId !== normalizeText(sale.id)) continue;
    for (const line of getTransactionItems(record)) {
      const sourceId = getSourceId(line);
      const quantity = Math.abs(Number(line.quantity || line.qty || 0));
      if (!sourceId || !Number.isFinite(quantity) || quantity <= 0) continue;
      const key = getLineKey(line);
      returnedByKey.set(key, (returnedByKey.get(key) || 0) + quantity);
    }
  }

  return [...soldByKey.values()]
    .map((line) => {
      const returnedQuantity = returnedByKey.get(line.key) || 0;
      return {
        ...line,
        returnedQuantity,
        remainingQuantity: Math.max(line.soldQuantity - returnedQuantity, 0),
      };
    })
    .filter((line) => line.remainingQuantity > 0);
};

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
