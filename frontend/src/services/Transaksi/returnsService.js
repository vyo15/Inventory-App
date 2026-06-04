import * as sqliteTransactionsAdapter from "../../data/adapters/sqlite/sqliteTransactionsAdapter";
import { listenProducts } from "../MasterData/productsService";
import { listenRawMaterials } from "../MasterData/rawMaterialsService";

export const listenReturnRecords = (onNext, onError) => sqliteTransactionsAdapter.subscribeReturns(onNext, onError, { limit: 500 });
export const listenReturnProducts = (onNext, onError) => listenProducts(onNext, onError);
export const listenReturnRawMaterials = (onNext, onError) => listenRawMaterials(onNext, onError);
export const createReturnTransaction = async ({ values, allItems = [] }) => {
  const { type, itemId, quantity, variantKey } = values;
  if (!type || !["product", "material", "raw_material"].includes(type)) throw new Error("Jenis item retur tidak valid.");
  if (!itemId) throw new Error("Item retur wajib dipilih.");
  const normalizedQuantity = Number(quantity || 0);
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) throw new Error("Jumlah retur harus lebih dari 0.");
  const item = allItems.find((sourceItem) => String(sourceItem.id) === String(itemId)) || {};
  return sqliteTransactionsAdapter.commitReturn({ ...values, sourceType: type === "product" ? "product" : "raw_material", sourceId: itemId, itemId, itemName: item.name || values.itemName || "", quantity: normalizedQuantity, variantKey: variantKey || "", status: values.status || "Selesai" });
};
