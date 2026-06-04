import { formatCurrencyId as formatCurrencyIdr } from "../../utils/formatters/currencyId";
import * as sqliteTransactionsAdapter from "../../data/adapters/sqlite/sqliteTransactionsAdapter";
import { listenProducts } from "../MasterData/productsService";
import { listenRawMaterials } from "../MasterData/rawMaterialsService";
import { normalizePurchaseNoteText } from "../../utils/purchases/purchaseNoteDisplay";
import { getSupplierDisplayName, getSupplierReferenceId } from "../MasterData/suppliersService";

export const listenPurchaseRecords = (onNext, onError) => sqliteTransactionsAdapter.subscribePurchases(onNext, onError, { limit: 500 });
export const listenPurchaseProducts = (onNext, onError) => listenProducts(onNext, onError);
export const listenPurchaseRawMaterials = (onNext, onError) => listenRawMaterials(onNext, onError);
export const PURCHASE_EXPENSE_SOURCE_MODULE = "purchases";
export const PURCHASE_EXPENSE_SOURCE_TYPE = "auto_generated";
export const getPurchaseSavingMeta = (value) => {
  const amount = Math.round(Number(value || 0));
  if (amount > 0) return { status: "hemat", label: `Hemat ${formatCurrencyIdr(amount)}`, color: "green" };
  if (amount < 0) return { status: "lebih_mahal", label: `Lebih Mahal ${formatCurrencyIdr(Math.abs(amount))}`, color: "red" };
  return { status: "normal", label: "Sesuai Referensi", color: "default" };
};
export const getPurchaseStockUnit = (item = {}) => item?.stockUnit || item?.unit || item?.baseUnit || "pcs";
export const buildPurchaseExpenseDocumentId = (purchaseId) => `${PURCHASE_EXPENSE_SOURCE_MODULE}__${String(purchaseId || "purchase").replace(/[^a-zA-Z0-9_-]/g, "_")}`;
export const buildPurchaseExpensePayload = ({ date, itemName, purchaseId, purchasePayload, resolvedSupplierId, supplier = {}, totalCost = 0 } = {}) => ({ id: buildPurchaseExpenseDocumentId(purchaseId), referenceNumber: `CSH-OUT-${purchasePayload?.referenceNumber || purchaseId}`, date, type: "Pembelian", description: `Pembelian ${itemName || "barang"} dari ${getSupplierDisplayName(supplier)}`, amount: totalCost, relatedPurchaseId: purchaseId, supplierId: resolvedSupplierId || getSupplierReferenceId(supplier) });
export const createPurchaseTransaction = async ({ values, selectedItem, selectedSupplier } = {}) => {
  const quantity = Number(values?.quantity || values?.qty || 0);
  if (!selectedItem?.id && !values?.itemId) throw new Error("Item pembelian wajib dipilih.");
  if (quantity <= 0) throw new Error("Qty pembelian harus lebih dari 0.");
  return sqliteTransactionsAdapter.commitPurchase({
    ...values,
    itemId: values.itemId || selectedItem.id,
    sourceId: values.itemId || selectedItem.id,
    sourceType: values.itemType === "product" ? "product" : "raw_material",
    itemName: selectedItem?.name || values.itemName || "",
    supplierId: selectedSupplier?.id || values.supplierId || "",
    supplierName: getSupplierDisplayName(selectedSupplier || {}),
    quantity,
    qty: quantity,
    totalAmount: Number(values.totalAmount ?? values.totalCost ?? values.total ?? 0),
    notes: normalizePurchaseNoteText(values.notes || values.note || ""),
    status: values.status || "Selesai",
  });
};
