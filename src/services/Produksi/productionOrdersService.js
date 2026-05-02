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
// SECTION: Variant strategy guard Production Order
// Fungsi blok:
// - menormalisasi strategi material inherit/fixed/none sebelum resolver stok dipanggil;
// - memastikan material bervarian yang wajib variant tidak fallback ke master/default.
// Hubungan flow aplikasi:
// - dipakai oleh preview PO, create PO final, dan Refresh Need karena ketiganya lewat builder requirement yang sama.
// Alasan logic:
// - default global resolveVariantSelection tetap permissive untuk legacy/manual, sehingga caller aktif PO harus mengirim strict flag sendiri.
// Status: AKTIF untuk requirement PO, GUARDED karena memengaruhi status ready/shortage dan Start Production downstream.
// =====================================================
const normalizeMaterialVariantStrategy = ({ hasVariants = false, strategy = "" } = {}) => {
  if (!hasVariants) return "none";
  const normalized = safeTrim(strategy).toLowerCase();
  if (["inherit", "fixed", "none"].includes(normalized)) return normalized;
  return "inherit";
};

const shouldReadMaterialVariantStrictly = ({
  hasVariants = false,
  strategy = "",
  targetHasVariants = false,
} = {}) => {
  const normalizedStrategy = normalizeMaterialVariantStrategy({ hasVariants, strategy });
  if (!hasVariants || normalizedStrategy === "none") return false;
  if (normalizedStrategy === "fixed") return true;
  return normalizedStrategy === "inherit" && targetHasVariants === true;
};

const getMaterialLineLabel = (line = {}, stockItem = {}) =>
  safeTrim(line.itemName || stockItem?.name || stockItem?.code || line.itemCode) || "material";

const assertRequiredVariantReference = ({
  line = {},
  stockItem = {},
  strategy = "inherit",
  targetVariantKey = "",
  targetVariantLabel = "",
} = {}) => {
  const materialName = getMaterialLineLabel(line, stockItem);

  if (strategy === "inherit" && !safeTrim(targetVariantKey) && !safeTrim(targetVariantLabel)) {
    throw new Error(
      `Material ${materialName} memakai strategy inherit, tetapi varian target PO belum dipilih. Proses dihentikan agar stok tidak fallback ke master/default.`,
    );
  }

  if (strategy === "fixed" && !safeTrim(line.fixedVariantKey) && !safeTrim(line.fixedVariantLabel)) {
    throw new Error(
      `Material ${materialName} memakai strategy fixed, tetapi fixed variant BOM belum tersimpan. Proses dihentikan agar stok tidak fallback ke master/default.`,
    );
  }
};

const assertNoMasterFallbackForRequiredVariant = ({ line = {}, stockItem = {}, stockResolution = {} } = {}) => {
  if (stockResolution.stockSourceType === "variant") return;

  const materialName = getMaterialLineLabel(line, stockItem);
  throw new Error(
    `Material ${materialName} wajib membaca stok varian, tetapi resolver menghasilkan ${stockResolution.stockSourceType || "master"}. Proses dihentikan agar stok tidak fallback ke master/default.`,
  );
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
// SECTION: Target context PO
// Fungsi blok:
// - membaca master target agar targetHasVariants tidak hanya bergantung pada snapshot BOM lama;
// - dipakai validasi final dan preview stok target.
// Hubungan flow aplikasi:
// - menjaga PO target variant tetap sama antara drawer preview, create final, dan refresh requirement.
// Alasan logic:
// - BOM lama bisa menyimpan targetHasVariants=false walaupun master target sudah punya variants.
// Status: AKTIF/GUARDED untuk validasi target PO tanpa mengubah schema Firestore.
// =====================================================
const getProductionOrderTargetContext = async (bom = {}) => {
  const targetItem = await getReferenceItemByTypeAndId(bom.targetType || "product", bom.targetId || "");
  const targetHasVariants = bom?.targetHasVariants === true || inferHasVariants(targetItem || {});

  return {
    targetItem,
    targetHasVariants,
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

const validateOrderVariantInputs = ({ targetHasVariants = false, targetVariantKey = "" }) => {
  const errors = {};

  if (targetHasVariants === true && !safeTrim(targetVariantKey)) {
    errors.targetVariantKey = "Target varian wajib dipilih untuk BOM ini";
  }

  return errors;
};

// =====================================================
// Bentuk 1 requirement line dari BOM
// Catatan maintainability:
// - Qty PO sekarang dibaca sebagai jumlah batch, bukan jumlah output final
// - Kebutuhan bahan = (qtyPerBatch + wastage) x qtyBatch
// =====================================================
// =====================================================
// ACTIVE / FINAL - snapshot stok target untuk preview Buat PO.
// Fungsi:
// - menampilkan stok produk/semi finished yang akan dibuat tanpa mengubah stok;
// - memakai dokumen target yang sama dengan BOM agar UI preview tidak membuat
//   source of truth baru.
// Alasan perubahan:
// - user perlu melihat stok target saat ini di drawer Buat Production Order;
// - data ini read-only dan tidak dipakai sebagai sumber simpan PO final.
// Status:
// - aktif dipakai oleh ProductionOrders.jsx sebagai preview UI;
// - kandidat cleanup hanya jika nanti snapshot target dipindah ke helper shared.
// =====================================================
const buildTargetStockPreview = async ({
  bom = {},
  orderQty = 0,
  targetVariantKey = "",
  targetVariantLabel = "",
  throwOnVariantError = true,
} = {}) => {
  const { targetItem, targetHasVariants } = await getProductionOrderTargetContext(bom);
  const batchOutputQty = Number(bom.batchOutputQty || 1);
  const expectedOutputQty = batchOutputQty * Number(orderQty || 0);
  const targetUnit = safeTrim(bom.targetUnit || targetItem?.unit) || "pcs";

  if (!targetItem) {
    return {
      targetName: safeTrim(bom.targetName),
      targetUnit,
      targetHasVariants,
      targetVariantLabel: safeTrim(targetVariantLabel),
      batchOutputQty,
      expectedOutputQty,
      currentStockSnapshot: 0,
      availableStockSnapshot: 0,
      stockSourceType: "missing",
      note: "Target belum ditemukan",
    };
  }

  if (targetHasVariants && !safeTrim(targetVariantKey)) {
    return {
      targetName: safeTrim(bom.targetName || targetItem.name),
      targetUnit,
      targetHasVariants: true,
      targetVariantLabel: "",
      batchOutputQty,
      expectedOutputQty,
      currentStockSnapshot: null,
      availableStockSnapshot: null,
      stockSourceType: "variant_pending",
      note: "Pilih varian target untuk melihat stok target",
    };
  }

  try {
    const stockResolution = targetHasVariants
      ? resolveVariantSelection({
          item: targetItem,
          materialVariantStrategy: "fixed",
          fixedVariantKey: targetVariantKey,
          fixedVariantLabel: targetVariantLabel,
          allowMasterFallback: false,
          contextLabel: "Varian target PO",
        })
      : resolveVariantSelection({
          item: targetItem,
          materialVariantStrategy: "none",
        });

    return {
      targetName: safeTrim(bom.targetName || targetItem.name),
      targetUnit,
      targetHasVariants,
      targetVariantKey: stockResolution.resolvedVariantKey || safeTrim(targetVariantKey),
      targetVariantLabel: stockResolution.resolvedVariantLabel || safeTrim(targetVariantLabel),
      batchOutputQty,
      expectedOutputQty,
      currentStockSnapshot: Number(stockResolution.currentStock || 0),
      availableStockSnapshot: Number(stockResolution.availableStock || 0),
      stockSourceType: stockResolution.stockSourceType || (targetHasVariants ? "variant" : "master"),
      resolutionMatchType: stockResolution.resolutionMatchType || "",
    };
  } catch (error) {
    if (throwOnVariantError) {
      throw error;
    }

    return {
      targetName: safeTrim(bom.targetName || targetItem.name),
      targetUnit,
      targetHasVariants,
      targetVariantLabel: safeTrim(targetVariantLabel),
      batchOutputQty,
      expectedOutputQty,
      currentStockSnapshot: null,
      availableStockSnapshot: null,
      stockSourceType: "variant_missing",
      note: error?.message || "Varian target belum terbaca",
    };
  }
};

const buildRequirementLine = ({
  line = {},
  stockItem = null,
  batchCount = 0,
  index = 0,
  targetVariantKey = "",
  targetVariantLabel = "",
  targetHasVariants = false,
}) => {
  const qtyPerBatch = Number(line.qtyPerBatch || 0);
  const wastageQty = Number(line.wastageQty || 0);
  const qtyRequired = Math.ceil((qtyPerBatch + wastageQty) * Number(batchCount || 0));

  // =====================================================
  // SECTION: Strict variant requirement material PO
  // Fungsi blok:
  // - menentukan apakah material wajib membaca stok varian atau boleh master;
  // - mengirim allowMasterFallback=false hanya untuk strategy inherit/fixed yang wajib variant.
  // Hubungan flow aplikasi:
  // - line yang dihasilkan disimpan ke materialRequirementLines dan menjadi contract Start Production.
  // Alasan logic:
  // - status cukup/kurang harus berdasarkan bucket varian yang benar, bukan stok master gabungan.
  // Status: AKTIF untuk preview/create/refresh PO, GUARDED karena memengaruhi stock deduction downstream.
  // =====================================================
  const effectiveMaterialHasVariants =
    line.materialHasVariants === true || inferHasVariants(stockItem || {});
  const materialVariantStrategy = normalizeMaterialVariantStrategy({
    hasVariants: effectiveMaterialHasVariants,
    strategy: line.materialVariantStrategy,
  });
  const shouldReadVariant = shouldReadMaterialVariantStrictly({
    hasVariants: effectiveMaterialHasVariants,
    strategy: materialVariantStrategy,
    targetHasVariants,
  });
  const resolverVariantStrategy = shouldReadVariant ? materialVariantStrategy : "none";

  if (shouldReadVariant) {
    assertRequiredVariantReference({
      line,
      stockItem,
      strategy: materialVariantStrategy,
      targetVariantKey,
      targetVariantLabel,
    });
  }

  const stockResolution = resolveVariantSelection({
    item: stockItem || {},
    materialVariantStrategy: resolverVariantStrategy,
    targetVariantKey,
    targetVariantLabel,
    fixedVariantKey: line.fixedVariantKey || "",
    fixedVariantLabel: line.fixedVariantLabel || "",
    allowMasterFallback: !shouldReadVariant,
    contextLabel: `Varian material ${getMaterialLineLabel(line, stockItem)} (${materialVariantStrategy})`,
  });

  if (shouldReadVariant) {
    assertNoMasterFallbackForRequiredVariant({ line, stockItem, stockResolution });
  }

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
    materialVariantStrategy: stockResolution.materialVariantStrategy || resolverVariantStrategy,
    fixedVariantKey: safeTrim(line.fixedVariantKey),
    fixedVariantLabel: safeTrim(line.fixedVariantLabel),
    stockSourceType: stockResolution.stockSourceType,
    resolvedVariantKey: stockResolution.resolvedVariantKey || "",
    resolvedVariantLabel: stockResolution.resolvedVariantLabel || "",
    resolutionMatchType: stockResolution.resolutionMatchType || "",
    resolutionFallback: stockResolution.resolutionFallback || "",
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
  allowPendingTargetVariant = true,
}) => {
  const bom = await getProductionBomByIdForOrder(bomId);
  const batchOutputQty = Number(bom.batchOutputQty || 1);
  const bomMaterialLines = Array.isArray(bom.materialLines) ? bom.materialLines : [];

  // =====================================================
  // SECTION: Strict target preview + pending variant boundary
  // Fungsi blok:
  // - mengambil snapshot target yang sama untuk preview/create/refresh;
  // - mengizinkan state pending hanya untuk UI preview, bukan simpan final.
  // Hubungan flow aplikasi:
  // - create PO dan Refresh Need mengirim allowPendingTargetVariant=false agar PO salah tidak tersimpan.
  // Alasan logic:
  // - target item bisa punya variants walaupun snapshot BOM lama belum sinkron.
  // Status: AKTIF untuk drawer preview, GUARDED untuk create final dan refresh requirement.
  // =====================================================
  const targetStockPreview = await buildTargetStockPreview({
    bom,
    orderQty,
    targetVariantKey,
    targetVariantLabel,
  });
  const targetHasVariants = targetStockPreview?.targetHasVariants === true;

  if (targetStockPreview.stockSourceType === "variant_pending") {
    if (!allowPendingTargetVariant) {
      throw new Error("Varian target PO wajib dipilih sebelum requirement final disimpan atau di-refresh.");
    }

    return {
      bom,
      targetStockPreview,
      requirementLines: [],
      reservationSummary: {
        totalLines: 0,
        sufficientLines: 0,
        shortageLines: 0,
        canReserveFully: false,
      },
      targetHasVariants,
      targetVariantKey: "",
      targetVariantLabel: "",
    };
  }

  const requirementLines = await Promise.all(
    bomMaterialLines.map(async (line, index) => {
      const stockItem = await getReferenceItemByTypeAndId(line.itemType || "raw_material", line.itemId);
      return buildRequirementLine({
        line,
        stockItem,
        batchCount: orderQty,
        index,
        targetVariantKey: targetStockPreview?.targetVariantKey || targetVariantKey,
        targetVariantLabel: targetStockPreview?.targetVariantLabel || targetVariantLabel,
        targetHasVariants,
      });
    }),
  );

  const shortageLines = requirementLines.filter((line) => !line.isSufficient).length;
  const sufficientLines = requirementLines.length - shortageLines;

  return {
    bom,
    batchOutputQty,
    targetStockPreview,
    requirementLines,
    reservationSummary: {
      totalLines: requirementLines.length,
      sufficientLines,
      shortageLines,
      canReserveFully: shortageLines === 0,
    },
    targetHasVariants,
    targetVariantKey: targetStockPreview?.targetVariantKey || safeTrim(targetVariantKey),
    targetVariantLabel: targetStockPreview?.targetVariantLabel || safeTrim(targetVariantLabel),
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
  const { targetHasVariants: inferredTargetHasVariants } = await getProductionOrderTargetContext(bom);
  const variantErrors = validateOrderVariantInputs({
    targetHasVariants: inferredTargetHasVariants,
    targetVariantKey: values.targetVariantKey,
  });

  if (Object.keys(variantErrors).length > 0) {
    throw { type: "validation", errors: variantErrors };
  }

  const {
    requirementLines,
    reservationSummary,
    targetHasVariants,
    targetVariantKey,
    targetVariantLabel,
  } = await buildProductionOrderRequirementLines({
    bomId: values.bomId,
    orderQty,
    targetVariantKey: values.targetVariantKey || "",
    targetVariantLabel: values.targetVariantLabel || "",
    allowPendingTargetVariant: false,
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
    // =====================================================
    // SECTION: Snapshot target variant final
    // Fungsi blok:
    // - menyimpan status targetHasVariants dan variant hasil resolver strict final;
    // - tidak mengubah schema collection, hanya mengisi field PO existing dengan nilai yang lebih akurat.
    // Hubungan flow aplikasi:
    // - Work Log output dan Planning progress membaca target variant dari PO final.
    // Alasan logic:
    // - BOM snapshot lama bisa stale, sedangkan resolver target membaca master item terbaru.
    // Status: AKTIF/GUARDED untuk create PO final.
    // =====================================================
    targetHasVariants: targetHasVariants === true,
    targetVariantKey: safeTrim(targetVariantKey || values.targetVariantKey),
    targetVariantLabel: safeTrim(targetVariantLabel || values.targetVariantLabel),
    // orderQty dipertahankan untuk kompatibilitas data lama, namun maknanya = qty batch produksi
    orderQty,
    batchCount: orderQty,
    batchOutputQty: Number(bom.batchOutputQty || 1),
    expectedOutputQty: Number(bom.batchOutputQty || 1) * orderQty,
    plannedStartDate: values.plannedStartDate || null,
    plannedEndDate: values.plannedEndDate || null,
    // =====================================================
    // ACTIVE - reference Production Planning.
    // Fungsi:
    // - menghubungkan PO ke planning yang membuatnya;
    // - field ini hanya referensi monitoring, bukan trigger stok/payroll/HPP.
    // Status:
    // - aktif untuk flow Planning -> PO; PO manual lama tetap valid tanpa field ini.
    // =====================================================
    planningId: safeTrim(values.planningId),
    planningCode: safeTrim(values.planningCode),
    planningTitle: safeTrim(values.planningTitle),
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

  const {
    requirementLines,
    reservationSummary,
    targetHasVariants,
    targetVariantKey,
    targetVariantLabel,
  } = await buildProductionOrderRequirementLines({
    bomId: order.bomId,
    orderQty: Number(order.orderQty || 0),
    targetVariantKey: order.targetVariantKey || "",
    targetVariantLabel: order.targetVariantLabel || "",
    allowPendingTargetVariant: false,
  });

  const ref = doc(db, COLLECTION_NAME, orderId);
  await updateDoc(ref, {
    materialRequirementLines: requirementLines,
    reservationSummary,
    status: reservationSummary.canReserveFully ? "ready" : "shortage",
    targetHasVariants: targetHasVariants === true,
    targetVariantKey: safeTrim(targetVariantKey || order.targetVariantKey),
    targetVariantLabel: safeTrim(targetVariantLabel || order.targetVariantLabel),
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

  const stockResolution = resolveVariantSelection({
    item: stockItem,
    materialVariantStrategy:
      line.materialHasVariants === true
        ? line.materialVariantStrategy || "inherit"
        : "none",
    targetVariantKey: line.resolvedVariantKey || "",
    targetVariantLabel: line.resolvedVariantLabel || "",
    fixedVariantKey: line.fixedVariantKey || line.resolvedVariantKey || "",
    fixedVariantLabel: line.fixedVariantLabel || line.resolvedVariantLabel || "",
  });

  if (mode === "reserve" && Number(stockResolution.availableStock || 0) < mutationQty) {
    throw new Error(`Stok ${line.itemName || "material"} sudah tidak cukup untuk reserve`);
  }

  const deltaReserved = mode === "reserve" ? mutationQty : -mutationQty;

  // =====================================================
  // SECTION: Payload reserve/release stok produksi
  // Fungsi:
  // - menyinkronkan reservedStock, availableStock, currentStock, stock, dan variants[]
  // Hubungan flow aplikasi:
  // - tetap berada di transaction PO karena reserve/release produksi adalah guarded area
  // Status:
  // - guarded/aktif untuk flow legacy reserve-release
  // - memakai resolved key dari helper final agar varian tidak jatuh ke master/default
  // =====================================================
  const nextPayload = applyStockMutationToItem({
    item: stockItem,
    variantKey: stockResolution.resolvedVariantKey || "",
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


// =====================================================
// ACTIVE / FINAL - preview requirement material pada form Buat PO.
// Fungsi:
// - memberi gambaran ringkas shortage/cukup sebelum PO disimpan;
// - tidak mengubah contract BOM -> PO -> Work Log karena hanya membaca hasil
//   helper requirement final yang sama dengan create/update PO.
// =====================================================
export const getProductionOrderRequirementPreview = async ({
  bomId = "",
  orderQty = 0,
  targetVariantKey = "",
  targetVariantLabel = "",
} = {}) => {
  if (!bomId || Number(orderQty || 0) <= 0) {
    return null;
  }

  const { requirementLines = [], reservationSummary = {} } = await buildProductionOrderRequirementLines({
    bomId,
    orderQty: Number(orderQty || 0),
    targetVariantKey,
    targetVariantLabel,
  });

  const totalRequiredQty = requirementLines.reduce((sum, line) => sum + Number(line.qtyRequired || 0), 0);
  const totalAvailableQty = requirementLines.reduce((sum, line) => sum + Number(line.availableStockSnapshot || 0), 0);
  const totalShortageQty = requirementLines.reduce((sum, line) => sum + Number(line.shortageQty || 0), 0);
  const shortageLines = requirementLines.filter((line) => Number(line.shortageQty || 0) > 0);

  return {
    totalLines: Number(reservationSummary.totalLines || requirementLines.length),
    sufficientLines: Number(reservationSummary.sufficientLines || 0),
    shortageLines: Number(reservationSummary.shortageLines || 0),
    canReserveFully: Boolean(reservationSummary.canReserveFully),
    totalRequiredQty,
    totalAvailableQty,
    totalShortageQty,
    topShortages: shortageLines
      .sort((left, right) => Number(right.shortageQty || 0) - Number(left.shortageQty || 0))
      .slice(0, 3)
      .map((line) => ({
        itemName: line.itemName || '-',
        shortageQty: Number(line.shortageQty || 0),
        unit: line.unit || 'pcs',
        variantLabel: line.resolvedVariantLabel || line.fixedVariantLabel || '',
      })),
  };
};
