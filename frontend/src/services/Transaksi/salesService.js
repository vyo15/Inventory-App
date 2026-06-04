import dayjs from "dayjs";
import * as sqliteTransactionsAdapter from "../../data/adapters/sqlite/sqliteTransactionsAdapter";
import * as sqliteProductsAdapter from "../../data/adapters/sqlite/sqliteProductsAdapter";
import * as sqliteRawMaterialsAdapter from "../../data/adapters/sqlite/sqliteRawMaterialsAdapter";

const ACTIVE_SALES_STATUSES = new Set(["Diproses", "Dikirim", "Selesai"]);
export const buildSaleStockBucketKey = (item) => `${item.collectionName}::${item.itemId}::${item.variantKey || "master"}`;
export const fetchSalesRecords = async () => (await sqliteTransactionsAdapter.listSales({ limit: 1000 })).map((item) => ({ ...item, date: item.transactionDate || item.date || item.createdAt || "Tanggal Tidak Tersedia" }));
export const fetchSalesProducts = async () => sqliteProductsAdapter.listProducts({ limit: 1000 });
export const fetchSalesRawMaterials = async () => sqliteRawMaterialsAdapter.listRawMaterials({ limit: 1000 });
export const hasExistingSaleIncome = async () => false;
export const buildSaleIncomePayload = ({ selectedSale, saleId, dateValue = new Date().toISOString() }) => ({ date: dateValue, type: "Penjualan", incomeNumber: selectedSale.saleNumber || selectedSale.code || selectedSale.referenceNumber || saleId, referenceNumber: selectedSale.saleNumber || selectedSale.code || selectedSale.referenceNumber || saleId, relatedId: saleId, description: `Penjualan: ${(selectedSale.items || []).map((item) => item.itemName).join(", ")}`, amount: selectedSale.total || selectedSale.totalAmount || 0 });
export const validateSaleStockAvailability = async (saleItems = []) => {
  const errors = [];
  for (const item of saleItems || []) {
    if (!item.itemId && !item.sourceId) errors.push("Item penjualan belum valid.");
    if (Number(item.quantity || 0) <= 0) errors.push(`Qty ${item.itemName || "item"} harus lebih dari 0.`);
  }
  return { isValid: errors.length === 0, errors };
};
export const createSaleTransaction = async ({ values, saleItems = [] } = {}) => {
  const items = (saleItems.length ? saleItems : values.items || []).map((item) => ({ ...item, sourceType: item.sourceType || (item.collectionName === "raw_materials" ? "raw_material" : "product"), sourceId: item.sourceId || item.itemId, quantity: Number(item.quantity || 0) }));
  const validation = await validateSaleStockAvailability(items);
  if (!validation.isValid) throw new Error(validation.errors.join("\n"));
  return sqliteTransactionsAdapter.commitSale({ ...values, items, status: values.status || "Diproses", transactionDate: values.date ? dayjs(values.date).format("YYYY-MM-DD") : new Date().toISOString(), totalAmount: Number(values.totalAmount ?? values.total ?? 0) });
};
export const updateSaleStatusTransaction = async ({ saleId, newStatus, selectedSale }) => {
  if (!ACTIVE_SALES_STATUSES.has(newStatus)) throw new Error("Status penjualan tidak valid.");
  return sqliteTransactionsAdapter.updateSaleStatus(saleId, { ...selectedSale, status: newStatus });
};
