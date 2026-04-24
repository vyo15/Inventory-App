// =====================================================
// Production Orders Service
// Tujuan:
// - planning produksi untuk semi finished dan product
// - hitung kebutuhan material dari BOM master
// - dukung strategi varian material: inherit / fixed / none
// - flow aktif: BOM -> PO -> Start Production -> Work Log -> Complete
// - reserve/release lama dipertahankan hanya untuk kompatibilitas lama, bukan flow utama
// =====================================================

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import { calculateAvailableStock } from "../../utils/stock/stockHelpers";
import {
  applyStockMutationToItem,
  buildVariantOptionsFromItem,
  findVariantByKey,
  getItemStockSnapshot,
  inferHasVariants,
  resolveVariantSelection,
} from "../../utils/variants/variantStockHelpers";

const COLLECTION_NAME = "production_orders";

const safeTrim = (value) => String(value || "").trim();

const getCollectionNameByItemType = (itemType = "") => {
  if (itemType === "raw_material") return "raw_materials";
  if (itemType === "semi_finished_material") return "semi_finished_materials";
  if (itemType === "product") return "products";
  return "";
};


// =====================================================
// Helper sorting daftar production order
// Catatan maintainability:
// - Urutan list operasional harus konsisten: terbaru di paling atas.
// - Prioritas timestamp: updatedAt -> createdAt.
// - Jika timestamp sama / kosong, pakai nomor PO terbesar.
// =====================================================
const toComparableTime = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
};

const extractTrailingNumber = (value = "") => {
  const match = String(value || "").match(/(\d+)(?!.*\d)/);
  return match ? Number(match[1]) : 0;
};

const sortProductionOrdersNewestFirst = (items = []) =>
  [...items].sort((a, b) => {
    const aPrimary = Math.max(
      toComparableTime(a.updatedAt),
      toComparableTime(a.createdAt),
    );
    const bPrimary = Math.max(
      toComparableTime(b.updatedAt),
      toComparableTime(b.createdAt),
    );

    if (bPrimary !== aPrimary) {
      return bPrimary - aPrimary;
    }

    const byNumber = extractTrailingNumber(b.code) - extractTrailingNumber(a.code);
    if (byNumber !== 0) {
      return byNumber;
    }

    return String(b.code || "").localeCompare(String(a.code || ""));
  });

const normalizeReferenceItem = (snapshot) => {
  if (!snapshot?.exists()) return null;

  const raw = {
    id: snapshot.id,
    ...snapshot.data(),
  };

  return {
    ...raw,
    code:
      safeTrim(raw.code) ||
      safeTrim(raw.itemCode) ||
      safeTrim(raw.sku) ||
      safeTrim(raw.productCode),
    name:
      safeTrim(raw.name) ||
      safeTrim(raw.productName) ||
      safeTrim(raw.materialName) ||
      safeTrim(raw.title),
    unit:
      safeTrim(raw.unit) ||
      safeTrim(raw.stockUnit) ||
      safeTrim(raw.baseUnit) ||
      "pcs",
    currentStock: Number(raw.currentStock ?? raw.stock ?? 0),
    reservedStock: Number(raw.reservedStock || 0),
    hasVariants: inferHasVariants(raw),
  };
};

// =====================================================
// Ambil BOM aktif untuk dropdown PO
// Catatan maintainability:
// - Filter dilakukan lokal agar toleran terhadap variasi data lama targetType
// - Hindari query Firestore yang terlalu kaku / butuh index tambahan
// =====================================================
const normalizeBomTargetType = (value = "") => {
  const raw = safeTrim(value).toLowerCase().replace(/[_\-]+/g, " ");
  if (["semi finished", "semi finished material", "semifinished", "semi finishedmaterials"].includes(raw)) {
    return "semi_finished_material";
  }
  if (["product", "finished product"].includes(raw)) {
    return "product";
  }
  return raw || "product";
};

export const getActiveProductionBomOptions = async (targetType = "product") => {
  const normalizedTargetType = normalizeBomTargetType(targetType);
  const q = query(collection(db, "production_boms"), where("isActive", "==", true));
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => normalizeBomTargetType(item.targetType) === normalizedTargetType)
    .sort((a, b) => {
      const aName = safeTrim(a.targetName || a.name).toLowerCase();
      const bName = safeTrim(b.targetName || b.name).toLowerCase();
      return aName.localeCompare(bName);
    });
};

export const getAllProductionOrders = async () => {
  const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  return sortProductionOrdersNewestFirst(
    snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })),
  );
};

export const getProductionOrderById = async (id) => {
  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new Error("Production order tidak ditemukan");
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
};

export const getProductionBomByIdForOrder = async (bomId) => {
  const ref = doc(db, "production_boms", bomId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new Error("BOM produksi tidak ditemukan");
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
};

const getReferenceItemByTypeAndId = async (itemType, itemId) => {
  const collectionName = getCollectionNameByItemType(itemType);
  if (!collectionName || !itemId) return null;

  const ref = doc(db, collectionName, itemId);
  const snapshot = await getDoc(ref);
  return normalizeReferenceItem(snapshot);
};

// =====================================================
// ACTIVE / FINAL - resolve variant target PO dari master target aktual.
// Source of truth awal varian produksi adalah pilihan user di Production Order,
// tetapi validasinya tetap dicek ke master item agar BOM snapshot lama tidak
// membuat `targetHasVariants` stale. Jika target bervarian, flow final tidak
// boleh lanjut tanpa varian yang bisa di-resolve jelas.
// =====================================================
const resolveProductionOrderTargetVariant = async ({
  bom = {},
  targetVariantKey = "",
  targetVariantLabel = "",
} = {}) => {
  const targetItem = await getReferenceItemByTypeAndId(
    bom.targetType || "product",
    bom.targetId || "",
  );
  const targetHasVariants = inferHasVariants(targetItem || {}) || bom.targetHasVariants === true;

  if (!targetHasVariants) {
    return {
      targetHasVariants: false,
      targetVariantKey: "",
      targetVariantLabel: "",
      targetItem,
    };
  }

  if (!targetItem) {
    throw new Error("Target item Production Order tidak ditemukan untuk validasi varian");
  }

  if (!safeTrim(targetVariantKey) && !safeTrim(targetVariantLabel)) {
    throw {
      type: "validation",
      errors: {
        targetVariantKey: "Target varian wajib dipilih karena target produksi memiliki varian",
      },
    };
  }

  const resolvedTarget = resolveVariantSelection({
    item: targetItem,
    materialVariantStrategy: "fixed",
    targetVariantKey,
    targetVariantLabel,
    fixedVariantKey: targetVariantKey,
    fixedVariantLabel: targetVariantLabel,
    allowMasterFallback: false,
    contextLabel: "Varian target Production Order",
  });

  return {
    targetHasVariants: true,
    targetVariantKey: resolvedTarget.resolvedVariantKey || safeTrim(targetVariantKey),
    targetVariantLabel: resolvedTarget.resolvedVariantLabel || safeTrim(targetVariantLabel),
    targetItem,
  };
};

const getDateCode = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

const buildOrderSequence = (orders = [], dateCode = "", prefix = "PO-PRD") => {
  const sameDayOrders = orders.filter((item) =>
    safeTrim(item.code).startsWith(`${prefix}-${dateCode}-`),
  );
  return String(sameDayOrders.length + 1).padStart(4, "0");
};

export const generateProductionOrderCode = async (targetType = "product") => {
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));
  const existingOrders = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const dateCode = getDateCode();
  const prefix = targetType === "semi_finished_material" ? "PO-SFP" : "PO-PRD";
  const nextSequence = buildOrderSequence(existingOrders, dateCode, prefix);
  return `${prefix}-${dateCode}-${nextSequence}`;
};

// =====================================================
// Bentuk 1 requirement line dari BOM
// Catatan maintainability:
// - Qty PO sekarang dibaca sebagai jumlah batch, bukan jumlah output final
// - Kebutuhan bahan = (qtyPerBatch + wastage) x qtyBatch
// =====================================================
const buildRequirementLine = ({
  line = {},
  stockItem = null,
  batchCount = 0,
  index = 0,
  targetVariantKey = "",
  targetVariantLabel = "",
}) => {
  const qtyPerBatch = Number(line.qtyPerBatch || 0);
  const wastageQty = Number(line.wastageQty || 0);
  const qtyRequired = Math.ceil((qtyPerBatch + wastageQty) * Number(batchCount || 0));

  // =====================================================
  // Tentukan apakah material sebenarnya punya varian.
  // Penting untuk kasus BOM line lama/stale yang metadata variannya
  // belum terisi benar, tetapi item stok aktual sudah pakai varian.
  // =====================================================
  const effectiveMaterialHasVariants =
    line.materialHasVariants === true || inferHasVariants(stockItem || {});

  // =====================================================
  // Resolve sumber stok requirement.
  // Flow baru tidak hanya kirim targetVariantKey, tapi juga label target
  // supaya inherit antar item bisa match by label seperti "ungu".
  // =====================================================
  const effectiveStrategy = effectiveMaterialHasVariants
    ? line.materialVariantStrategy || "inherit"
    : "none";

  const stockResolution = resolveVariantSelection({
    item: stockItem || {},
    materialVariantStrategy: effectiveStrategy,
    targetVariantKey,
    targetVariantLabel,
    fixedVariantKey: line.fixedVariantKey || "",
    fixedVariantLabel: line.fixedVariantLabel || "",
    // ACTIVE / FINAL: requirement PO tidak boleh fallback ke master jika
    // material bervarian dan strategi BOM memang meminta inherit/fixed.
    // Jika varian tidak match, proses PO diblok agar source of truth PO tetap tunggal.
    allowMasterFallback: !(effectiveMaterialHasVariants && effectiveStrategy !== "none"),
    contextLabel: `Varian material requirement ${line.itemName || stockItem?.name || "produksi"}`,
  });

  const shortageQty = Math.max(qtyRequired - Number(stockResolution.availableStock || 0), 0);

  return {
    id: line.id || `req-${Date.now()}-${index}`,
    itemType: line.itemType || "raw_material",
    itemId: line.itemId || "",
    itemCode: safeTrim(line.itemCode),
    itemName: safeTrim(line.itemName),
    unit: safeTrim(line.unit) || "pcs",
    qtyPerBatch,
    wastageQty,
    qtyRequired,
    materialHasVariants: effectiveMaterialHasVariants,
    materialVariantStrategy: stockResolution.materialVariantStrategy,
    fixedVariantKey: safeTrim(line.fixedVariantKey),
    fixedVariantLabel: safeTrim(line.fixedVariantLabel),
    stockSourceType: stockResolution.stockSourceType,
    resolvedVariantKey: stockResolution.resolvedVariantKey || "",
    resolvedVariantLabel: stockResolution.resolvedVariantLabel || "",
    currentStockSnapshot: Number(stockResolution.currentStock || 0),
    reservedStockSnapshot: Number(stockResolution.reservedStock || 0),
    availableStockSnapshot: Number(stockResolution.availableStock || 0),
    shortageQty,
    isSufficient: shortageQty <= 0,
  };
};

export const buildProductionOrderRequirementLines = async ({
  bomId,
  orderQty,
  targetVariantKey = "",
  targetVariantLabel = "",
}) => {
  const bom = await getProductionBomByIdForOrder(bomId);
  const batchOutputQty = Number(bom.batchOutputQty || 1);
  const bomMaterialLines = Array.isArray(bom.materialLines) ? bom.materialLines : [];

  const requirementLines = await Promise.all(
    bomMaterialLines.map(async (line, index) => {
      const stockItem = await getReferenceItemByTypeAndId(line.itemType || "raw_material", line.itemId);
      return buildRequirementLine({
        line,
        stockItem,
        batchCount: orderQty,
        index,
        targetVariantKey,
        targetVariantLabel,
      });
    }),
  );

  const shortageLines = requirementLines.filter((line) => !line.isSufficient).length;
  const sufficientLines = requirementLines.length - shortageLines;

  return {
    bom,
    requirementLines,
    reservationSummary: {
      totalLines: requirementLines.length,
      sufficientLines,
      shortageLines,
      canReserveFully: shortageLines === 0,
    },
    targetVariantKey: safeTrim(targetVariantKey),
    targetVariantLabel: safeTrim(targetVariantLabel),
  };
};

export const createProductionOrder = async (values = {}, currentUser = null) => {
  const orderQty = Number(values.orderQty || 0);
  const targetType = values.targetType || "product";

  if (!targetType) {
    throw { type: "validation", errors: { targetType: "Target type wajib dipilih" } };
  }

  if (!values.bomId) {
    throw { type: "validation", errors: { bomId: "BOM wajib dipilih" } };
  }

  if (orderQty <= 0) {
    throw { type: "validation", errors: { orderQty: "Qty order harus lebih dari 0" } };
  }

  const bom = await getProductionBomByIdForOrder(values.bomId);
  const targetVariant = await resolveProductionOrderTargetVariant({
    bom,
    targetVariantKey: values.targetVariantKey || "",
    targetVariantLabel: values.targetVariantLabel || "",
  });

  const { requirementLines, reservationSummary } = await buildProductionOrderRequirementLines({
    bomId: values.bomId,
    orderQty,
    targetVariantKey: targetVariant.targetVariantKey,
    targetVariantLabel: targetVariant.targetVariantLabel,
  });

  const code = safeTrim(values.code) || (await generateProductionOrderCode(targetType));

  const payload = {
    code,
    targetType: bom.targetType,
    bomId: bom.id,
    bomCode: safeTrim(bom.code),
    bomName: safeTrim(bom.name),
    targetId: bom.targetId || "",
    targetCode: safeTrim(bom.targetCode),
    targetName: safeTrim(bom.targetName),
    targetUnit: safeTrim(bom.targetUnit) || "pcs",
    // ACTIVE / FINAL: target variant di PO adalah source of truth awal.
    // Nilai disimpan dari hasil resolve master target aktual, bukan hanya snapshot BOM,
    // agar BOM lama tidak membuat PO kembali ke master/default.
    targetHasVariants: targetVariant.targetHasVariants === true,
    targetVariantKey: safeTrim(targetVariant.targetVariantKey),
    targetVariantLabel: safeTrim(targetVariant.targetVariantLabel),
    // orderQty dipertahankan untuk kompatibilitas data lama, namun maknanya = qty batch produksi
    orderQty,
    batchCount: orderQty,
    batchOutputQty: Number(bom.batchOutputQty || 1),
    expectedOutputQty: Number(bom.batchOutputQty || 1) * orderQty,
    plannedStartDate: values.plannedStartDate || null,
    plannedEndDate: values.plannedEndDate || null,
    priority: values.priority || "normal",
    status: reservationSummary.canReserveFully ? "ready" : "shortage",
    materialRequirementLines: requirementLines,
    reservationSummary,
    generatedWorkLogCount: 0,
    workLogIds: [],
    notes: safeTrim(values.notes),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy:
      currentUser?.email ||
      currentUser?.displayName ||
      currentUser?.uid ||
      "system",
    updatedBy:
      currentUser?.email ||
      currentUser?.displayName ||
      currentUser?.uid ||
      "system",
  };

  const result = await addDoc(collection(db, COLLECTION_NAME), payload);
  return result.id;
};

export const refreshProductionOrderRequirements = async (orderId, currentUser = null) => {
  const order = await getProductionOrderById(orderId);

  if (!order?.bomId) {
    throw new Error("BOM order tidak ditemukan");
  }

  const bom = await getProductionBomByIdForOrder(order.bomId);
  const targetVariant = await resolveProductionOrderTargetVariant({
    bom,
    targetVariantKey: order.targetVariantKey || "",
    targetVariantLabel: order.targetVariantLabel || "",
  });

  const { requirementLines, reservationSummary } = await buildProductionOrderRequirementLines({
    bomId: order.bomId,
    orderQty: Number(order.orderQty || 0),
    targetVariantKey: targetVariant.targetVariantKey,
    targetVariantLabel: targetVariant.targetVariantLabel,
  });

  const ref = doc(db, COLLECTION_NAME, orderId);
  await updateDoc(ref, {
    materialRequirementLines: requirementLines,
    reservationSummary,
    targetHasVariants: targetVariant.targetHasVariants === true,
    targetVariantKey: safeTrim(targetVariant.targetVariantKey),
    targetVariantLabel: safeTrim(targetVariant.targetVariantLabel),
    status: reservationSummary.canReserveFully ? "ready" : "shortage",
    updatedAt: serverTimestamp(),
    updatedBy:
      currentUser?.email ||
      currentUser?.displayName ||
      currentUser?.uid ||
      "system",
  });

  return orderId;
};

const applyReservationMutation = async ({ transaction, line, mode = "reserve" }) => {
  const collectionName = getCollectionNameByItemType(line.itemType);
  if (!collectionName || !line.itemId) return;

  const stockRef = doc(db, collectionName, line.itemId);
  const stockSnap = await transaction.get(stockRef);

  if (!stockSnap.exists()) {
    throw new Error(`Item ${line.itemName || "-"} tidak ditemukan`);
  }

  const stockItem = normalizeReferenceItem(stockSnap);
  const mutationQty = Number(line.qtyRequired || 0);
  const reservationStrategy = line.materialHasVariants === true
    ? line.materialVariantStrategy || "inherit"
    : "none";

  const stockResolution = resolveVariantSelection({
    item: stockItem,
    materialVariantStrategy: reservationStrategy,
    targetVariantKey: line.resolvedVariantKey || "",
    targetVariantLabel: line.resolvedVariantLabel || "",
    fixedVariantKey: line.fixedVariantKey || line.resolvedVariantKey || "",
    fixedVariantLabel: line.fixedVariantLabel || line.resolvedVariantLabel || "",
    // LEGACY RESERVE masih tersedia, tetapi requirement bervarian tetap tidak
    // boleh silent fallback ke master agar tidak menghidupkan pola lama.
    allowMasterFallback: !(line.materialHasVariants === true && reservationStrategy !== "none"),
    contextLabel: `Varian reserve material ${line.itemName || "produksi"}`,
  });

  if (mode === "reserve" && Number(stockResolution.availableStock || 0) < mutationQty) {
    throw new Error(`Stok ${line.itemName || "material"} sudah tidak cukup untuk reserve`);
  }

  const deltaReserved = mode === "reserve" ? mutationQty : -mutationQty;
  const nextPayload = applyStockMutationToItem({
    item: stockItem,
    variantKey: line.resolvedVariantKey || "",
    deltaReserved,
  });

  transaction.update(stockRef, {
    ...nextPayload,
    updatedAt: serverTimestamp(),
  });
};

// =====================================================
// LEGACY FLOW - RESERVE / RELEASE
// Catatan maintainability:
// - Flow aktif IMS Bunga Flanel TIDAK lagi memakai reserve sebagai jalur utama.
// - Function di bawah masih dipertahankan sementara untuk kompatibilitas
//   data lama / migrasi bertahap.
// - Flow produksi aktif yang dipakai UI sekarang adalah:
//   Ready -> Start Production -> In Production -> Complete.
// =====================================================
export const reserveProductionOrder = async (orderId, currentUser = null) => {
  const orderRef = doc(db, COLLECTION_NAME, orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    throw new Error("Production order tidak ditemukan");
  }

  const order = { id: orderSnap.id, ...orderSnap.data() };
  const requirementLines = Array.isArray(order.materialRequirementLines) ? order.materialRequirementLines : [];
  const shortageLines = requirementLines.filter((line) => !line.isSufficient);

  if (shortageLines.length > 0) {
    throw new Error("Order masih shortage dan tidak bisa di-reserve");
  }

  await runTransaction(db, async (transaction) => {
    for (const line of requirementLines) {
      await applyReservationMutation({ transaction, line, mode: "reserve" });
    }

    transaction.update(orderRef, {
      status: "reserved",
      reservedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy:
        currentUser?.email ||
        currentUser?.displayName ||
        currentUser?.uid ||
        "system",
    });
  });

  return orderId;
};

export const releaseProductionOrderReservation = async (orderId, currentUser = null) => {
  const orderRef = doc(db, COLLECTION_NAME, orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    throw new Error("Production order tidak ditemukan");
  }

  const order = { id: orderSnap.id, ...orderSnap.data() };

  if (order.status !== "reserved") {
    throw new Error("Hanya order reserved yang bisa dilepas reservasinya");
  }

  const requirementLines = Array.isArray(order.materialRequirementLines) ? order.materialRequirementLines : [];

  await runTransaction(db, async (transaction) => {
    for (const line of requirementLines) {
      await applyReservationMutation({ transaction, line, mode: "release" });
    }

    transaction.update(orderRef, {
      status: "released",
      releasedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy:
        currentUser?.email ||
        currentUser?.displayName ||
        currentUser?.uid ||
        "system",
    });
  });

  return orderId;
};

// =====================================================
// Helper status PO aktif
// Catatan maintainability:
// - Dipakai untuk memastikan 1 PO bisa ditandai sedang diproduksi.
// - Walau createProductionWorkLogFromOrder saat ini update PO langsung
//   dalam transaction yang sama, helper ini tetap disimpan untuk reuse
//   di flow lain yang memang butuh ubah status terpisah.
// =====================================================
export const markProductionOrderInProduction = async (
  orderId,
  workLogId = null,
  currentUser = null,
) => {
  const order = await getProductionOrderById(orderId);
  const workLogIds = Array.isArray(order.workLogIds) ? order.workLogIds : [];

  const nextWorkLogIds = workLogId
    ? [...new Set([...workLogIds, workLogId])]
    : workLogIds;

  const ref = doc(db, COLLECTION_NAME, orderId);

  await updateDoc(ref, {
    status: "in_production",
    workLogIds: nextWorkLogIds,
    generatedWorkLogCount: nextWorkLogIds.length,
    updatedAt: serverTimestamp(),
    updatedBy:
      currentUser?.email ||
      currentUser?.displayName ||
      currentUser?.uid ||
      "system",
  });

  return orderId;
};

// =====================================================
// ACTIVE / FINAL - snapshot stok target untuk form Buat PO.
// Blok ini hanya informational/read-only dan tidak dipakai untuk mutasi stok.
// Source of truth tetap master target terbaru: currentStock untuk non-varian
// dan variants[].currentStock untuk target bervarian yang dipilih user.
// =====================================================
export const getProductionOrderTargetStockInfo = async ({
  bomId = "",
  targetVariantKey = "",
} = {}) => {
  if (!bomId) return null;

  const bom = await getProductionBomByIdForOrder(bomId);
  const targetItem = await getReferenceItemByTypeAndId(
    bom.targetType || "product",
    bom.targetId || "",
  );

  if (!targetItem) {
    return {
      hasTarget: false,
      warning: "Target item BOM tidak ditemukan",
    };
  }

  const targetHasVariants = inferHasVariants(targetItem);

  if (!targetHasVariants) {
    const stock = getItemStockSnapshot(targetItem);
    return {
      hasTarget: true,
      hasVariants: false,
      stockSourceType: "master",
      targetName: targetItem.name || bom.targetName || "-",
      targetCode: targetItem.code || bom.targetCode || "",
      unit: targetItem.unit || bom.targetUnit || "pcs",
      currentStock: stock.currentStock,
      reservedStock: stock.reservedStock,
      availableStock: stock.availableStock,
    };
  }

  if (!safeTrim(targetVariantKey)) {
    return {
      hasTarget: true,
      hasVariants: true,
      requiresVariant: true,
      stockSourceType: "variant",
      targetName: targetItem.name || bom.targetName || "-",
      targetCode: targetItem.code || bom.targetCode || "",
      unit: targetItem.unit || bom.targetUnit || "pcs",
      warning: "Pilih varian target untuk melihat stok aktual varian",
    };
  }

  const selectedVariant = findVariantByKey(targetItem, targetVariantKey);

  if (!selectedVariant) {
    return {
      hasTarget: true,
      hasVariants: true,
      requiresVariant: true,
      stockSourceType: "variant",
      targetName: targetItem.name || bom.targetName || "-",
      targetCode: targetItem.code || bom.targetCode || "",
      unit: targetItem.unit || bom.targetUnit || "pcs",
      warning: "Variant target tidak ditemukan pada master item terbaru",
    };
  }

  return {
    hasTarget: true,
    hasVariants: true,
    stockSourceType: "variant",
    targetName: targetItem.name || bom.targetName || "-",
    targetCode: targetItem.code || bom.targetCode || "",
    unit: targetItem.unit || bom.targetUnit || "pcs",
    variantKey: selectedVariant.variantKey,
    variantLabel: selectedVariant.variantLabel,
    currentStock: Number(selectedVariant.currentStock || 0),
    reservedStock: Number(selectedVariant.reservedStock || 0),
    availableStock: calculateAvailableStock(
      Number(selectedVariant.currentStock || 0),
      Number(selectedVariant.reservedStock || 0),
    ),
  };
};


export const getProductionOrderTargetVariantOptions = async (bomId = "") => {
  if (!bomId) return [];
  const bom = await getProductionBomByIdForOrder(bomId);
  const targetCollectionName = getCollectionNameByItemType(bom.targetType || "product");
  if (!targetCollectionName || !bom.targetId) return [];

  const targetRef = doc(db, targetCollectionName, bom.targetId);
  const targetSnap = await getDoc(targetRef);
  const targetItem = normalizeReferenceItem(targetSnap);
  return buildVariantOptionsFromItem(targetItem || {});
};
