import { Timestamp } from "firebase/firestore";
import { resolveDisplayReference } from "../../utils/references/displayReferenceResolver";

// =========================
// SECTION: Collection inventory log final
// Fungsi:
// - menetapkan satu collection audit trail stok yang dipakai transaksi dan produksi
// Hubungan flow aplikasi:
// - dibaca Stock Management sebagai riwayat mutasi lintas modul
// Status:
// - aktif/final
// =========================
export const INVENTORY_LOG_COLLECTION = "inventory_logs";

// =========================
// SECTION: Resolve reference log stok
// Fungsi:
// - menyatukan referenceId/referenceType dari transaksi umum dan produksi
// Hubungan flow aplikasi:
// - membuat log purchase, sale, return, adjustment, dan production punya metadata standar
// Status:
// - aktif/final
// - fallback field lama tetap dibaca agar log legacy tidak putus di UI
// =========================
export const resolveInventoryLogReference = (type = "", extraData = {}) => {
  const referenceId =
    extraData.referenceId ||
    extraData.saleId ||
    extraData.purchaseId ||
    extraData.returnId ||
    extraData.adjustmentId ||
    extraData.productionOrderId ||
    extraData.workLogId ||
    extraData.workLogRefId ||
    "";

  const normalizedType = String(type || "").toLowerCase();
  const referenceType =
    extraData.referenceType ||
    (normalizedType.includes("sale")
      ? "sale"
      : normalizedType.includes("purchase")
        ? "purchase"
        : normalizedType.includes("return")
          ? "return"
          : normalizedType.includes("adjustment")
            ? "stock_adjustment"
            : normalizedType.includes("production") || normalizedType.includes("work_log")
              ? "production"
              : "inventory_log");

  return { referenceId, referenceType };
};

/*
=====================================================
SECTION: Display reference inventory log — AKTIF / LEGACY-COMPAT
Fungsi:
- Menentukan kode referensi manusiawi untuk tampilan inventory log tanpa mengganti referenceId internal.

Dipakai oleh:
- StockManagement.jsx pada kolom Referensi.

Alasan perubahan:
- Log stok lama/baru bisa tetap menyimpan ID internal, tetapi UI mengutamakan sourceRef/referenceCode/workNumber/code jika tersedia.

Catatan cleanup:
- Data test lama yang hanya punya referenceId random bisa dibuat ulang setelah format kode baru aktif.

Risiko:
- Jangan memakai nilai display ini untuk relasi transaksi karena hanya label UI.
=====================================================
*/
export const resolveInventoryLogDisplayReference = (record = {}) =>
  resolveDisplayReference(record, {
    fallback: "",
    extraFields: ["sourceRef", "referenceCode", "referenceNumber", "purchaseNumber", "returnNumber", "workNumber", "productionOrderCode"],
  });

// =========================
// SECTION: Helper metadata inventory log transaksi
// Fungsi:
// - menstandarkan field reference, variant, dan unit untuk writer inventory log baru;
// - menjaga field lama tetap ada tanpa mengubah schema inventory_logs.
// Hubungan flow aplikasi:
// - dipakai Sales, Returns, dan Purchases agar metadata audit tidak disusun berulang di tiap service.
// Status:
// - AKTIF / LEGACY-COMPAT; helper pure, tidak akses Firestore, tidak mengubah stock mutation.
// =========================
export const buildInventoryLogReferenceFields = ({
  referenceId = "",
  referenceNumber = "",
  referenceCode = "",
  sourceRef = "",
  referenceType = "",
} = {}) => {
  const normalizedDisplayReference = referenceNumber || referenceCode || sourceRef || "";

  return {
    referenceId: referenceId || "",
    referenceNumber: normalizedDisplayReference,
    referenceCode: referenceCode || normalizedDisplayReference,
    sourceRef: sourceRef || normalizedDisplayReference,
    referenceType: referenceType || "inventory_log",
  };
};

export const buildInventoryLogVariantFields = ({
  selectedVariant = null,
  variantKey = "",
  variantLabel = "",
  stockSourceType = "",
} = {}) => {
  const normalizedVariantKey = variantKey || selectedVariant?.variantKey || "";
  const normalizedVariantLabel =
    variantLabel ||
    selectedVariant?.variantLabel ||
    selectedVariant?.variantName ||
    selectedVariant?.color ||
    selectedVariant?.name ||
    "";

  return {
    variantKey: normalizedVariantKey,
    variantLabel: normalizedVariantLabel,
    stockSourceType: stockSourceType || (selectedVariant ? "variant" : "master"),
  };
};

export const resolveInventoryStockUnit = ({
  item = null,
  unit = "",
  stockUnit = "",
  fallbackUnit = "",
  collectionName = "",
} = {}) => {
  const normalizedFallbackUnit = fallbackUnit || (collectionName === "products" ? "pcs" : "");

  return stockUnit || unit || item?.stockUnit || item?.unit || item?.baseUnit || normalizedFallbackUnit || "";
};

export const buildInventoryLogUnitFields = ({
  item = null,
  unit = "",
  stockUnit = "",
  fallbackUnit = "",
  collectionName = "",
} = {}) => {
  const normalizedUnit = resolveInventoryStockUnit({
    item,
    unit,
    stockUnit,
    fallbackUnit,
    collectionName,
  });

  return {
    unit: unit || normalizedUnit,
    stockUnit: stockUnit || normalizedUnit,
  };
};

// =========================
// SECTION: Build payload inventory log final
// Fungsi:
// - membuat bentuk dokumen inventory_logs konsisten untuk writer non-transaction dan transaction
// Hubungan flow aplikasi:
// - dipakai inventoryService.addInventoryLog dan productionWorkLogsService transaction helper
// Status:
// - aktif/final
// - top-level extraData tetap dipertahankan sebagai compatibility legacy reader
// =========================
export const buildInventoryLogPayload = ({
  itemId = "",
  itemName = "",
  quantityChange = 0,
  type = "",
  collectionName = "",
  extraData = {},
  timestamp = Timestamp.now(),
} = {}) => {
  const normalizedExtraData = extraData && typeof extraData === "object" ? extraData : {};
  const referenceMeta = resolveInventoryLogReference(type, normalizedExtraData);

  return {
    // IMS NOTE [GUARDED] - extraData legacy disimpan lebih dulu, lalu canonical reference ditulis ulang.
    // Tujuan: caller lama tetap kompatibel, tetapi referenceId/referenceType hasil resolver tidak bisa tertimpa payload tambahan.
    ...normalizedExtraData,
    itemId,
    itemName,
    quantityChange: Number(quantityChange || 0),
    type,
    collectionName,
    timestamp,
    referenceId: referenceMeta.referenceId,
    referenceType: referenceMeta.referenceType,
    details: {
      ...normalizedExtraData,
      referenceId: referenceMeta.referenceId,
      referenceType: referenceMeta.referenceType,
    },
  };
};
