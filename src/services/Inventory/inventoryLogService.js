import { Timestamp } from "firebase/firestore";

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
    ...normalizedExtraData,
  };
};
