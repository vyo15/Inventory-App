import { formatCurrencyId as formatCurrencyIdr } from "../../utils/formatters/currencyId";
import * as sqliteTransactionsAdapter from "../../data/adapters/sqlite/sqliteTransactionsAdapter";
import { listenProducts } from "../MasterData/productsService";
import { listenRawMaterials } from "../MasterData/rawMaterialsService";
import { normalizePurchaseNoteText } from "../../utils/purchases/purchaseNoteDisplay";
import {
  getSupplierCatalogOffer,
  getSupplierDisplayName,
  getSupplierReferenceId,
} from "../MasterData/suppliersService";

export const listenPurchaseRecords = (onNext, onError) => {
  return sqliteTransactionsAdapter.subscribePurchases(onNext, onError, { limit: 500 });
};
export const listenPurchaseProducts = (onNext, onError) => listenProducts(onNext, onError);
export const listenPurchaseRawMaterials = (onNext, onError) => listenRawMaterials(onNext, onError);
export const PURCHASE_EXPENSE_SOURCE_MODULE = "purchases";
export const PURCHASE_EXPENSE_SOURCE_TYPE = "auto_generated";

export const getPurchaseSavingMeta = (value) => {
  const amount = Math.round(Number(value || 0));

  if (amount > 0) {
    return { status: "hemat", label: `Hemat ${formatCurrencyIdr(amount)}`, color: "green" };
  }

  if (amount < 0) {
    return {
      status: "lebih_mahal",
      label: `Lebih Mahal ${formatCurrencyIdr(Math.abs(amount))}`,
      color: "red",
    };
  }

  return { status: "normal", label: "Sesuai Referensi", color: "default" };
};

export const getPurchaseStockUnit = (item = {}) => {
  return item?.stockUnit || item?.unit || item?.baseUnit || "pcs";
};

export const buildPurchaseExpenseDocumentId = (purchaseId) => {
  const safePurchaseId = String(purchaseId || "purchase").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${PURCHASE_EXPENSE_SOURCE_MODULE}__${safePurchaseId}`;
};

export const buildPurchaseExpensePayload = ({
  date,
  itemName,
  purchaseId,
  purchasePayload,
  resolvedSupplierId,
  supplier = {},
  totalCost = 0,
} = {}) => {
  return {
    id: buildPurchaseExpenseDocumentId(purchaseId),
    referenceNumber: `CSH-OUT-${purchasePayload?.referenceNumber || purchaseId}`,
    date,
    type: "Pembelian",
    description: `Pembelian ${itemName || "barang"} dari ${getSupplierDisplayName(supplier)}`,
    amount: totalCost,
    relatedPurchaseId: purchaseId,
    supplierId: resolvedSupplierId || getSupplierReferenceId(supplier),
  };
};

const getVariantSnapshot = (values = {}, selectedItem = {}) => {
  const variantKey = values.type === "product"
    ? values.productVariantKey || ""
    : values.materialVariantId || "";
  if (!variantKey) return { variantKey: "", variantLabel: "" };

  const options = Array.isArray(selectedItem.variantOptions)
    ? selectedItem.variantOptions
    : Array.isArray(selectedItem.variants)
      ? selectedItem.variants
      : [];
  const matched = options.find((variant) => String(
    variant.id || variant.key || variant.value || variant.code || variant.name,
  ) === String(variantKey));

  return {
    variantKey: String(variantKey),
    variantLabel: matched?.label || matched?.name || matched?.value || String(variantKey),
  };
};

export const createPurchaseTransaction = async ({
  values = {},
  products = [],
  materials = [],
  suppliers = [],
} = {}) => {
  const isProduct = values.type === "product";
  const itemType = isProduct ? "product" : "raw_material";
  const selectedItem = (isProduct ? products : materials).find(
    (item) => String(item.id) === String(values.itemId),
  );
  const selectedSupplier = suppliers.find(
    (supplier) => String(supplier.id) === String(values.supplierId),
  );
  const selectedOffer = getSupplierCatalogOffer(selectedSupplier || {}, values.catalogOfferId);
  const purchaseQuantity = Math.round(Number(values.quantity || values.qty || 0));
  const stockQuantity = isProduct
    ? purchaseQuantity
    : Math.round(Number(values.totalStockIn || 0));
  const subtotalItems = Math.round(Number(values.subtotalItems || 0));
  const actualPackagePrice = purchaseQuantity > 0
    ? Math.round(subtotalItems / purchaseQuantity)
    : 0;
  const { variantKey, variantLabel } = getVariantSnapshot(values, selectedItem || {});

  if (!selectedItem?.id) throw new Error("Item pembelian wajib dipilih.");
  if (!selectedSupplier?.id) throw new Error("Supplier pembelian wajib dipilih.");
  if (!selectedOffer?.id) throw new Error("Pilih link atau paket katalog Supplier sebelum menyimpan Pembelian.");
  if (purchaseQuantity <= 0) throw new Error("Qty pembelian harus lebih dari 0.");
  if (stockQuantity <= 0) throw new Error("Jumlah stok masuk harus lebih dari 0.");
  if (values.priceVerified !== true) {
    throw new Error("Harga aktual wajib diperiksa dan dikonfirmasi sebelum menyimpan Pembelian.");
  }
  if (Math.round(Number(values.verifiedCatalogPrice || 0)) !== actualPackagePrice) {
    throw new Error("Harga berubah setelah diverifikasi. Verifikasi ulang harga sebelum menyimpan.");
  }

  const itemName = selectedItem.name || values.itemName || "";
  const supplierName = getSupplierDisplayName(selectedSupplier);
  const totalAmount = Math.round(Number(
    values.totalAmount ?? values.totalActualPurchase ?? values.totalCost ?? values.total ?? 0,
  ));

  return sqliteTransactionsAdapter.commitPurchase({
    ...values,
    type: isProduct ? "product" : "material",
    itemType,
    itemId: selectedItem.id,
    sourceId: selectedItem.id,
    sourceType: itemType,
    itemName,
    name: `Pembelian ${itemName}`,
    supplierId: selectedSupplier.id,
    supplierName,
    catalogOfferId: selectedOffer.id,
    catalogListingName: selectedOffer.listingName || "",
    catalogChannel: selectedOffer.channel || "",
    productLink: selectedOffer.productLink || values.productLink || "",
    purchaseUnit: selectedOffer.purchaseUnit || values.purchaseUnit || "",
    conversionValue: isProduct ? 1 : Number(values.conversionValue || selectedOffer.conversionValue || 1),
    stockUnit: values.stockUnit || selectedOffer.stockUnit || getPurchaseStockUnit(selectedItem),
    quantity: purchaseQuantity,
    qty: purchaseQuantity,
    totalStockIn: stockQuantity,
    subtotalItems,
    totalAmount,
    totalCost: totalAmount,
    total: totalAmount,
    variantKey,
    variantLabel,
    priceVerified: true,
    priceVerifiedAt: values.priceVerifiedAt || new Date().toISOString(),
    verifiedCatalogPrice: actualPackagePrice,
    items: [{
      sourceType: itemType,
      sourceId: selectedItem.id,
      quantity: stockQuantity,
      variantKey,
      variantLabel,
      itemName,
      unit: values.stockUnit || selectedOffer.stockUnit || getPurchaseStockUnit(selectedItem),
    }],
    notes: normalizePurchaseNoteText(values.notes || values.note || ""),
    note: normalizePurchaseNoteText(values.notes || values.note || ""),
    status: values.status || "Selesai",
  });
};
