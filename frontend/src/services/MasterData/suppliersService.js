import * as sqliteSuppliersAdapter from "../../data/adapters/sqlite/sqliteSuppliersAdapter";

const safeTrim = (value = "") => String(value || "").trim();
const SUPPLIER_CODE_PATTERN = /^SUP-[0-9]{8}-[0-9]{3,}$/;

export const normalizeSupplierCode = (value = "") => safeTrim(value).toUpperCase();
export const isValidSupplierCodeFormat = (code = "") => SUPPLIER_CODE_PATTERN.test(
  normalizeSupplierCode(code),
);

export const formatSupplierCodeDate = (date = new Date()) => {
  const parsed = date instanceof Date ? date : new Date(date);
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return `${String(safeDate.getDate()).padStart(2, "0")}${String(
    safeDate.getMonth() + 1,
  ).padStart(2, "0")}${safeDate.getFullYear()}`;
};

export const generateSupplierCode = async () => sqliteSuppliersAdapter.generateSupplierCode();

export const assertSupplierCodeAvailable = async (code = "", editingId = null) => {
  const normalized = normalizeSupplierCode(code);
  const duplicate = (await sqliteSuppliersAdapter.listSuppliers()).some(
    (item) => normalizeSupplierCode(item.supplierCode || item.code) === normalized
      && String(item.id) !== String(editingId || ""),
  );
  if (duplicate) throw new Error("Kode supplier sudah digunakan.");
};

export const resolveSupplierCode = async (values = {}, excludeId = null) => {
  const code = normalizeSupplierCode(values.supplierCode || values.code)
    || await generateSupplierCode(values, excludeId);
  await assertSupplierCodeAvailable(code, excludeId);
  return code;
};

export const getSupplierDisplayName = (supplier = {}) => safeTrim(
  supplier.storeName
    || supplier.name
    || supplier.supplierName,
) || "Supplier tanpa nama";

export const getSupplierLink = (supplier = {}) => safeTrim(supplier.storeLink || supplier.link || supplier.url);
export const getSupplierStoreLink = getSupplierLink;
export const buildSupplierDisplayLabel = (supplier = {}) => getSupplierDisplayName(supplier);
export const getSupplierOptionLabel = (supplier = {}) => buildSupplierDisplayLabel(supplier);
export const isManagedSupplierRecord = () => true;
export const isMasterSupplierRecord = isManagedSupplierRecord;
export const isArchivedMaterialSupplierRecord = () => false;

export const getSupplierReferenceId = (supplier = {}, fallbackId = null) => supplier.id
  || supplier.supplierId
  || supplier.code
  || fallbackId;

export const normalizeSupplierPurchaseType = (detail = {}) => detail.purchaseType
  || detail.type
  || "unknown";

export const normalizeSupplierCatalogItemType = (value = "") => {
  const normalized = safeTrim(value).toLowerCase();
  if (["product", "products"].includes(normalized)) return "product";
  if (["material", "raw", "raw_material", "raw_materials"].includes(normalized)) return "raw_material";
  return normalized;
};

export const calculateSupplierMaterialRestockMetrics = (detail = {}) => {
  const purchaseType = detail.purchaseType === "offline" ? "offline" : "online";
  const purchaseQty = Math.max(1, Math.round(Number(detail.purchaseQty || 1)));
  const conversionValue = Math.max(1, Math.round(Number(detail.conversionValue || 1)));
  const supplierItemPrice = Math.max(0, Math.round(Number(detail.supplierItemPrice || 0)));
  const estimatedShippingCost = purchaseType === "offline"
    ? 0
    : Math.max(0, Math.round(Number(detail.estimatedShippingCost || 0)));
  const serviceFee = purchaseType === "offline"
    ? 0
    : Math.max(0, Math.round(Number(detail.serviceFee || 0)));
  const discount = purchaseType === "offline"
    ? 0
    : Math.max(0, Math.round(Number(detail.discount || 0)));
  const totalStockQty = purchaseQty * conversionValue;
  const totalEstimatedSupplier = Math.max(
    0,
    (purchaseQty * supplierItemPrice) + estimatedShippingCost + serviceFee - discount,
  );
  const estimatedUnitPrice = totalStockQty > 0
    ? Math.round(totalEstimatedSupplier / totalStockQty)
    : 0;

  return {
    purchaseType,
    purchaseQty,
    conversionValue,
    supplierItemPrice,
    estimatedShippingCost,
    serviceFee,
    discount,
    totalStockQty,
    totalEstimatedSupplier,
    estimatedUnitPrice,
    referencePrice: estimatedUnitPrice,
  };
};

export const getSupplierCatalogOffers = (
  supplier = {},
  {
    itemType = "",
    itemId = "",
    variantKey = undefined,
    activeOnly = true,
    availableOnly = false,
  } = {},
) => {
  const sourceOffers = Array.isArray(supplier.catalogOffers)
    ? supplier.catalogOffers
    : Array.isArray(supplier.materialDetails)
      ? supplier.materialDetails.map((detail) => ({
          ...detail,
          itemType: "raw_material",
          itemId: detail.itemId || detail.materialId || detail.rawMaterialId,
          itemName: detail.itemName || detail.materialName,
        }))
      : [];
  const normalizedType = normalizeSupplierCatalogItemType(itemType);

  return sourceOffers
    .filter((offer) => !activeOnly || (offer.isActive !== false && offer.status !== "inactive" && offer.status !== "deleted"))
    .filter((offer) => !availableOnly || (offer.availabilityStatus || "available") === "available")
    .filter((offer) => !normalizedType || normalizeSupplierCatalogItemType(offer.itemType) === normalizedType)
    .filter((offer) => !itemId || String(offer.itemId || offer.materialId || offer.rawMaterialId) === String(itemId))
    .filter((offer) => variantKey === undefined || !offer.variantKey || String(offer.variantKey) === String(variantKey || ""))
    .sort((left, right) => {
      if (Boolean(left.isPrimary) !== Boolean(right.isPrimary)) return left.isPrimary ? -1 : 1;
      const leftPrice = calculateSupplierMaterialRestockMetrics(left).estimatedUnitPrice || Number.MAX_SAFE_INTEGER;
      const rightPrice = calculateSupplierMaterialRestockMetrics(right).estimatedUnitPrice || Number.MAX_SAFE_INTEGER;
      return leftPrice - rightPrice;
    });
};

export const getSupplierCatalogOffer = (supplier = {}, offerId = "") => getSupplierCatalogOffers(
  supplier,
  { activeOnly: false },
).find((offer) => String(offer.id || offer.catalogOfferId) === String(offerId)) || null;

export const getSupplierMaterialDetail = (supplier = {}, materialId = "") => getSupplierCatalogOffers(
  supplier,
  { itemType: "raw_material", itemId: materialId },
)[0] || null;

export const getSupplierProductLinkForMaterial = (supplier = {}, materialId = "") => getSupplierMaterialDetail(
  supplier,
  materialId,
)?.productLink || "";

export const getSupplierReferencePriceForMaterial = (supplier = {}, materialId = "") => Number(
  getSupplierMaterialDetail(supplier, materialId)?.referencePrice || 0,
);

export const getSupplierPurchaseUnitForMaterial = (supplier = {}, materialId = "") => getSupplierMaterialDetail(
  supplier,
  materialId,
)?.purchaseUnit || "";

export const getSupplierConversionValueForMaterial = (supplier = {}, materialId = "") => Number(
  getSupplierMaterialDetail(supplier, materialId)?.conversionValue || 1,
);

export const getSupplierStockUnitForMaterial = (supplier = {}, materialId = "") => getSupplierMaterialDetail(
  supplier,
  materialId,
)?.stockUnit || "";

export const getSupplierMaterialNoteForMaterial = (supplier = {}, materialId = "") => getSupplierMaterialDetail(
  supplier,
  materialId,
)?.note || "";

export const doesSupplierProvideItem = (supplier = {}, itemType = "", itemId = "", variantKey = undefined) => (
  getSupplierCatalogOffers(supplier, {
    itemType,
    itemId,
    variantKey,
    availableOnly: true,
  }).length > 0
);

export const doesSupplierProvideMaterial = (supplier = {}, materialId = "") => doesSupplierProvideItem(
  supplier,
  "raw_material",
  materialId,
);

export const normalizeSupplierRecord = sqliteSuppliersAdapter.normalizeSupplierRecord;
export const mergeSupplierSnapshots = ({ masterGroups = {} } = {}) => Object.values(masterGroups || {}).flat();

export const buildSupplierSelectOptions = (suppliers = []) => suppliers.map((supplier) => ({
  label: getSupplierOptionLabel(supplier),
  value: supplier.id,
  supplier,
}));

export const listenSuppliers = (callback, onError) => {
  let disposed = false;
  sqliteSuppliersAdapter.listSuppliers()
    .then((rows) => {
      if (!disposed) callback(rows);
    })
    .catch((error) => {
      if (!disposed && onError) onError(error);
    });
  return () => {
    disposed = true;
  };
};

export const listenSupplierCatalog = listenSuppliers;

export const cascadeSupplierSnapshotToRawMaterials = async () => ({
  skipped: true,
  reason: "Supplier tidak melakukan cascade langsung ke raw material.",
});

export const clearSupplierSnapshotFromRawMaterials = async () => ({
  skipped: true,
  reason: "Supplier tidak melakukan cascade langsung ke raw material.",
});
