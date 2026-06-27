import { requestSqliteApi } from "./sqliteApiClient";

const normalizeText = (value = "") => String(value || "").trim();
const normalizeCatalogOffer = (offer = {}) => ({
  ...offer,
  id: offer.id || offer.catalogOfferId || "",
  catalogOfferId: offer.catalogOfferId || offer.id || "",
  supplierId: offer.supplierId || "",
  itemType: offer.itemType === "product" ? "product" : "raw_material",
  itemId: offer.itemId || offer.materialId || offer.rawMaterialId || "",
  itemName: normalizeText(offer.itemName || offer.materialName),
  variantKey: offer.variantKey || "",
  variantLabel: offer.variantLabel || "",
  listingName: normalizeText(offer.listingName),
  channel: normalizeText(offer.channel || offer.marketplace),
  productLink: offer.productLink || offer.link || "",
  purchaseType: offer.purchaseType === "offline" ? "offline" : "online",
  purchaseUnit: offer.purchaseUnit || "",
  purchaseQty: Number(offer.purchaseQty || 1),
  conversionValue: Number(offer.conversionValue || 1),
  stockUnit: offer.stockUnit || "",
  supplierItemPrice: Number(offer.supplierItemPrice || 0),
  estimatedShippingCost: Number(offer.estimatedShippingCost || 0),
  serviceFee: Number(offer.serviceFee || 0),
  discount: Number(offer.discount || 0),
  totalStockQty: Number(offer.totalStockQty || 0),
  totalEstimatedSupplier: Number(offer.totalEstimatedSupplier || 0),
  estimatedUnitPrice: Number(offer.estimatedUnitPrice || offer.referencePrice || 0),
  referencePrice: Number(offer.referencePrice || offer.estimatedUnitPrice || 0),
  isPrimary: Boolean(offer.isPrimary),
  status: offer.status || (offer.isActive === false ? "inactive" : "active"),
  availabilityStatus: offer.availabilityStatus || "available",
  isActive: offer.isActive !== false && offer.status !== "inactive" && offer.status !== "deleted",
  note: offer.note || offer.notes || "",
  lastCheckedAt: offer.lastCheckedAt || null,
  priceUpdatedAt: offer.priceUpdatedAt || null,
});

export const normalizeSupplierRecord = (supplier = {}) => {
  const catalogOffers = Array.isArray(supplier.catalogOffers)
    ? supplier.catalogOffers.map(normalizeCatalogOffer)
    : Array.isArray(supplier.materialDetails)
      ? supplier.materialDetails.map((detail) => normalizeCatalogOffer({
          ...detail,
          itemType: "raw_material",
          itemId: detail.itemId || detail.materialId || detail.rawMaterialId,
          itemName: detail.itemName || detail.materialName,
        }))
      : [];

  return {
    ...supplier,
    id: supplier.id || supplier.code || supplier.supplierCode || "",
    code: supplier.code || supplier.supplierCode || "",
    supplierCode: supplier.supplierCode || supplier.code || "",
    name: normalizeText(supplier.name || supplier.storeName || supplier.supplierName),
    storeName: normalizeText(supplier.storeName || supplier.name || supplier.supplierName),
    storeLink: supplier.storeLink || supplier.link || supplier.url || "",
    phone: supplier.phone || supplier.contact || "",
    contact: supplier.contact || supplier.phone || "",
    address: supplier.address || "",
    notes: supplier.notes || supplier.note || supplier.description || "",
    catalogOffers,
    materialDetails: catalogOffers
      .filter((offer) => offer.itemType === "raw_material")
      .map((offer) => ({
        ...offer,
        materialId: offer.itemId,
        materialName: offer.itemName,
      })),
    supportedMaterialIds: Array.isArray(supplier.supportedMaterialIds) ? supplier.supportedMaterialIds : [],
    supportedMaterialNames: Array.isArray(supplier.supportedMaterialNames) ? supplier.supportedMaterialNames : [],
    supportedItemNames: Array.isArray(supplier.supportedItemNames)
      ? supplier.supportedItemNames
      : [...new Set(catalogOffers.filter((offer) => offer.isActive).map((offer) => offer.itemName).filter(Boolean))],
    isActive: supplier.isActive !== false && supplier.status !== "deleted",
  };
};

const normalizeSupplierPayload = (values = {}) => ({
  name: normalizeText(values.name || values.storeName || values.supplierName),
  storeName: normalizeText(values.storeName || values.name || values.supplierName),
  storeLink: values.storeLink || values.link || values.url || "",
  contact: values.contact || values.phone || "",
  phone: values.phone || values.contact || "",
  address: values.address || "",
  note: values.note || values.notes || values.description || "",
  notes: values.notes || values.note || values.description || "",
  catalogOffers: Array.isArray(values.catalogOffers)
    ? values.catalogOffers.map(normalizeCatalogOffer)
    : Array.isArray(values.materialDetails)
      ? values.materialDetails.map((detail) => normalizeCatalogOffer({
          ...detail,
          itemType: "raw_material",
          itemId: detail.itemId || detail.materialId || detail.rawMaterialId,
          itemName: detail.itemName || detail.materialName,
        }))
      : [],
  isActive: values.isActive !== false,
});

export const listSuppliers = async () => {
  const result = await requestSqliteApi("/api/suppliers");
  return (result?.data || []).map(normalizeSupplierRecord);
};

export const getSupplierById = async (supplierId) => {
  if (!supplierId) return null;
  const result = await requestSqliteApi(`/api/suppliers/${encodeURIComponent(supplierId)}`);
  return result?.data ? normalizeSupplierRecord(result.data) : null;
};

export const generateSupplierCode = async () => {
  const result = await requestSqliteApi("/api/suppliers/generate-code");
  return result?.data?.supplierCode || result?.data?.code || "";
};

export const createSupplier = async (values = {}) => {
  const result = await requestSqliteApi("/api/suppliers", {
    method: "POST",
    body: JSON.stringify(normalizeSupplierPayload(values)),
  });
  return result?.data ? normalizeSupplierRecord(result.data) : null;
};

export const updateSupplier = async (supplierId, values = {}) => {
  if (!supplierId) throw new Error("Supplier yang akan diubah tidak valid.");
  const result = await requestSqliteApi(`/api/suppliers/${encodeURIComponent(supplierId)}`, {
    method: "PUT",
    body: JSON.stringify(normalizeSupplierPayload(values)),
  });
  return result?.data ? normalizeSupplierRecord(result.data) : null;
};

export const deleteSupplier = async (supplierId) => {
  if (!supplierId) throw new Error("Supplier yang akan dihapus tidak valid.");
  const result = await requestSqliteApi(`/api/suppliers/${encodeURIComponent(supplierId)}`, { method: "DELETE" });
  return result?.data || { id: supplierId, deleted: true };
};

export const listSupplierHistory = async (supplierId, { limit = 100, offset = 0, eventType = "" } = {}) => {
  if (!supplierId) return [];
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (eventType) params.set("eventType", eventType);
  const result = await requestSqliteApi(`/api/suppliers/${encodeURIComponent(supplierId)}/history?${params.toString()}`);
  return result?.data || [];
};

export const verifySupplierCatalogOffer = async (supplierId, offerId, payload = {}) => {
  if (!supplierId || !offerId) throw new Error("Supplier atau katalog yang akan diperiksa tidak valid.");
  const result = await requestSqliteApi(
    `/api/suppliers/${encodeURIComponent(supplierId)}/catalog/${encodeURIComponent(offerId)}/verify`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  return result?.data || null;
};
