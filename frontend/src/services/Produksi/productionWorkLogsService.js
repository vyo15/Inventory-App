// =====================================================
// Production Work Logs Service
// CRUD + helper generate dari BOM / Production Order
// Revisi:
// - Work Log dari PO tetap didukung
// - Start Production memotong stok bahan dari requirement PO
// - Complete Work Log hanya menambah stok output dan menutup PO
// =====================================================

import {
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
import {
  generateDailySequenceCode,
  getDailyBusinessCodeSequence,
  prepareDailySequenceCodeInTransaction,
} from "../../utils/references/businessCodeGenerator";
import {
  buildInventoryLogPayload,
  INVENTORY_LOG_COLLECTION,
} from "../Inventory/inventoryLogService";
import { setStockItemReadModelInTransaction } from "../Inventory/stockReadModelService";
import {
  calculateMaterialUsageLine,
  calculateOutputLine,
} from "../../constants/productionWorkLogOptions";
import { calculateWeightedAverage, normalizeStockSnapshot, toNumber } from "../../utils/stock/stockHelpers";
import {
  applyStockMutationToItem,
  inferHasVariants,
  resolveVariantSelection,
} from "../../utils/variants/variantStockHelpers";
import {
  PRODUCTION_STEPS_COLLECTION_NAME,
  assertResolvedVariantContract,
  buildProductionOutputAuditMetadata,
  buildWorkLogCostSummary,
  buildWorkLogDraftFromBom as buildWorkLogDraftFromBomPayload,
  buildWorkLogDraftFromProductionOrderData,
  buildWorkLogReservationMap,
  filterActiveLike,
  COST_RECONCILE_TOLERANCE,
  buildOutputHppReconcilePayload,
  calculateWeightedVariantUnitCost,
  getCollectionNameByItemType,
  getItemUnitCostSnapshot,
  getOutputTargetCostState,
  normalizeMaterialVariantStrategy,
  normalizeProductionWorkLogPayload as normalizePayload,
  needsOutputMasterCostSync,
  normalizeReferenceItem,
  resolveCompletedWorkLogAccruedLaborCost,
  safeTrim,
  shouldLineReadVariantStrictly,
  validateProductionWorkLogPayload,
} from "./helpers/productionWorkLogsServiceHelpers";
import {
  applyLockedWorkLogCoreFields,
  assertProductionOrderStartable,
  assertProductionWorkLogCompletable,
  isProductionOrderVisibleInWorkLogReference,
  isProductionWorkLogCompleted,
  sortProductionWorkLogsNewestFirst,
} from "../../utils/produksi/productionFlowGuards";

const COLLECTION_NAME = "production_work_logs";

// =====================================================
// Safe reader referensi produksi
// Catatan maintainability:
// - Menu Work Log tidak boleh ikut gagal total hanya karena 1 koleksi referensi
//   sedang error / index bermasalah / patch schema lain belum sinkron.
// - Jika satu referensi gagal dibaca, halaman tetap boleh terbuka dengan
//   data lainnya yang berhasil dimuat.
// =====================================================
const readCollectionDocsSafely = async (
  collectionName,
  fallbackItems = [],
  warningLabel = collectionName,
) => {
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    return {
      items: snapshot.docs.map((documentItem) => ({
        id: documentItem.id,
        ...documentItem.data(),
      })),
      warning: null,
    };
  } catch (error) {
    console.error(`Gagal memuat referensi ${collectionName}`, error);
    return {
      items: fallbackItems,
      warning: `${warningLabel} gagal dimuat. Halaman tetap dibuka dengan data yang tersedia.`,
    };
  }
};

// =====================================================
// Validasi dasar work log
// =====================================================
export const validateProductionWorkLog = validateProductionWorkLogPayload;

// =====================================================
// Reference data work log
// =====================================================
export const getWorkLogReferenceData = async () => {
  const [
    bomsResult,
    ordersResult,
    employeesResult,
    rawResult,
    semiResult,
    productsResult,
    stepsResult,
    profilesResult,
  ] = await Promise.all([
    readCollectionDocsSafely("production_boms", [], "Referensi BOM produksi"),
    readCollectionDocsSafely("production_orders", [], "Referensi Production Order"),
    readCollectionDocsSafely("production_employees", [], "Referensi karyawan produksi"),
    readCollectionDocsSafely("raw_materials", [], "Referensi bahan baku"),
    readCollectionDocsSafely("semi_finished_materials", [], "Referensi semi finished"),
    readCollectionDocsSafely("products", [], "Referensi produk"),
    readCollectionDocsSafely("production_steps", [], "Referensi step produksi"),
    readCollectionDocsSafely("production_profiles", [], "Referensi profil produksi"),
  ]);

  const productionOrders = (ordersResult.items || []).filter(
    isProductionOrderVisibleInWorkLogReference,
  );

  return {
    boms: filterActiveLike((bomsResult.items || []).map((item) => ({ ...item }))),
    productionOrders: productionOrders,
    employees: filterActiveLike(
      (employeesResult.items || []).map((item) =>
        normalizeReferenceItem({
          ...item,
        }),
      ),
    ),
    rawMaterials: filterActiveLike(
      (rawResult.items || []).map((item) =>
        normalizeReferenceItem({
          ...item,
        }),
      ),
    ),
    semiFinishedMaterials: filterActiveLike(
      (semiResult.items || []).map((item) =>
        normalizeReferenceItem({
          ...item,
        }),
      ),
    ),
    products: filterActiveLike(
      (productsResult.items || []).map((item) =>
        normalizeReferenceItem({
          ...item,
        }),
      ),
    ),
    productionSteps: filterActiveLike(
      (stepsResult.items || []).map((item) =>
        normalizeReferenceItem({
          ...item,
        }),
      ),
    ),
    productionProfiles: filterActiveLike(
      (profilesResult.items || []).map((item) => ({ ...item })),
    ),
    metaWarnings: [
      bomsResult.warning,
      ordersResult.warning,
      employeesResult.warning,
      rawResult.warning,
      semiResult.warning,
      productsResult.warning,
      stepsResult.warning,
      profilesResult.warning,
    ].filter(Boolean),
  };
};

/* =====================================================
SECTION: Work Log BOM Template Builder — CLEANUP CANDIDATE/GUARDED
Fungsi:
- Membentuk template nilai Work Log dari BOM tanpa menentukan status Draft baru.

Dipakai oleh:
- ProductionWorkLogs.jsx saat user memilih Ambil Data BOM.

Alasan perubahan:
- Nama fungsi dipertahankan karena masih di-import UI, tetapi flow utama Work Log tetap dari Production Order.

Catatan cleanup:
- Nama fungsi bisa diganti pada refactor non-fungsional terpisah setelah semua caller disesuaikan.

Risiko:
- Jika fungsi ini mulai mengisi status Draft lagi, Work Log baru bisa keluar dari lifecycle In Progress/Completed/Cancelled.
===================================================== */
export const buildWorkLogDraftFromBom = (...args) => buildWorkLogDraftFromBomPayload(...args);

/* =====================================================
SECTION: Work Log Production Order Template Builder — AKTIF/GUARDED
Fungsi:
- Membentuk template nilai Work Log dari Production Order/BOM tanpa membuat status Draft baru.

Dipakai oleh:
- createProductionWorkLogFromOrder dan ProductionWorkLogs.jsx saat Ambil Data PO.

Alasan perubahan:
- Helper ini membentuk template PO aktif, sedangkan status eksekusi tetap diatur caller sebagai In Progress.

Catatan cleanup:
- Nama helper dapat dirapikan saat refactor penamaan service produksi.

Risiko:
- Jika caller menganggap helper ini sebagai lifecycle Draft aktif, start production dan pemotongan stok PO bisa tidak konsisten.
===================================================== */


export const buildWorkLogDraftFromProductionOrder = async (
  productionOrder,
  selectedStepId = "",
) => {
  if (!productionOrder?.bomId) {
    throw new Error("BOM pada production order tidak ditemukan");
  }

  const bomRef = doc(db, "production_boms", productionOrder.bomId);
  const bomSnap = await getDoc(bomRef);

  if (!bomSnap.exists()) {
    throw new Error("BOM dari production order tidak ditemukan");
  }

  return buildWorkLogDraftFromProductionOrderData(
    productionOrder,
    { id: bomSnap.id, ...bomSnap.data() },
    selectedStepId,
  );
};

/* =====================================================
SECTION: Work Log number generator — GUARDED
Fungsi:
- Membuat nomor JOB-DDMMYYYY-001 untuk Work Log produksi.

Dipakai oleh:
- ProductionWorkLogs.jsx, createProductionWorkLog, createProductionWorkLogFromOrder, dan update lock fallback.

Alasan perubahan:
- Standar final IMS mengganti WL-0001 menjadi JOB-DDMMYYYY-001.

Catatan cleanup:
- Data lama WL tetap compatibility, tidak di-rename.

Risiko:
- Jangan mengubah complete flow, material snapshot, output stock, HPP update, atau payroll auto-create dari section ini.
===================================================== */
export const generateProductionWorkLogNumber = async (date = new Date()) =>
  generateDailySequenceCode({
    db,
    collectionName: COLLECTION_NAME,
    fieldNames: ["workNumber", "code", "referenceNumber", "sourceRef"],
    prefix: "JOB",
    date,
  });

// =====================================================
// Ambil semua work logs
// =====================================================
export const getAllProductionWorkLogs = async () => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("workDate", "desc"),
      orderBy("workNumber", "desc"),
    );

    const snapshot = await getDocs(q);

    return sortProductionWorkLogsNewestFirst(
      snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })),
    );
  } catch (error) {
    console.error("Query work log utama gagal, pakai fallback", error);
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return sortProductionWorkLogsNewestFirst(
      snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })),
    );
  }
};

export const getCompletedProductionWorkLogs = async () => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("status", "==", "completed"),
      orderBy("workDate", "desc"),
    );

    const snapshot = await getDocs(q);

    return sortProductionWorkLogsNewestFirst(
      snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })),
    );
  } catch (error) {
    console.error("Query work log completed gagal, pakai fallback", error);
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return sortProductionWorkLogsNewestFirst(
      snapshot.docs
        .map((item) => ({
          id: item.id,
          ...item.data(),
        }))
        .filter((item) => item.status === "completed"),
    );
  }
};

export const getProductionWorkLogById = async (id) => {
  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new Error("Data work log produksi tidak ditemukan");
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
};

export const isProductionWorkLogNumberExists = async (
  workNumber,
  excludeId = null,
) => {
  const normalized = safeTrim(workNumber).toUpperCase();

  if (!normalized) return false;

  const directSnapshot = await getDoc(doc(db, COLLECTION_NAME, normalized));
  if (directSnapshot.exists() && directSnapshot.id !== excludeId) return true;

  const q = query(
    collection(db, COLLECTION_NAME),
    where("workNumber", "==", normalized),
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return false;

  const found = snapshot.docs.find((item) => item.id !== excludeId);
  return Boolean(found);
};

// =====================================================
// Create work log manual / planned
// =====================================================
export const createProductionWorkLog = async (values, currentUser = null) => {
  const errors = validateProductionWorkLog(values);

  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  const submittedWorkNumber = safeTrim(values.workNumber).toUpperCase();
  const baselineWorkNumber = submittedWorkNumber || (await generateProductionWorkLogNumber());
  const baselineSequence = getDailyBusinessCodeSequence({
    code: baselineWorkNumber,
    prefix: "JOB",
    date: values.workDate || new Date(),
  });
  let createdId = "";

  await runTransaction(db, async (transaction) => {
    const codeReservation = submittedWorkNumber
      ? { code: submittedWorkNumber, commit: () => {} }
      : await prepareDailySequenceCodeInTransaction({
          transaction,
          db,
          collectionName: COLLECTION_NAME,
          prefix: "JOB",
          date: values.workDate || new Date(),
          minimumSequence: Math.max(baselineSequence - 1, 0),
        });
    const workNumber = codeReservation.code;
    const resultRef = doc(db, COLLECTION_NAME, workNumber);
    const existingSnapshot = await transaction.get(resultRef);

    if (existingSnapshot.exists()) {
      throw {
        type: "validation",
        errors: {
          workNumber: "Nomor work log sudah digunakan",
        },
      };
    }

    const payload = normalizePayload({ ...values, workNumber }, currentUser, false);
    /* =====================================================
    SECTION: Manual Work Log document ID = business code — GUARDED
    Fungsi:
    - Menyimpan Work Log manual baru dengan document ID sama seperti nomor JOB.

    Dipakai oleh:
    - createProductionWorkLog.

    Alasan perubahan:
    - Work Log adalah guarded reference payroll/HPP sehingga data baru perlu ID audit-friendly.

    Catatan cleanup:
    - Data lama random/WL tetap compatibility.

    Risiko:
    - Jangan mengubah stock consumption/output/payroll dari section ini.
    ===================================================== */
    codeReservation.commit();
    transaction.set(resultRef, payload);
    createdId = resultRef.id;
  });

  return createdId;
};

// =====================================================
// Inventory log helper transaksi produksi
// Fungsi:
// - menulis audit trail stok produksi di dalam runTransaction yang sama dengan mutasi stok
// Hubungan flow aplikasi:
// - Start Production = material keluar
// - Complete Work Log = output masuk
// Status:
// - guarded/aktif karena produksi harus atomic
// - payload log memakai buildInventoryLogPayload agar schema transaksi umum dan produksi sama
// =====================================================
const addInventoryLogInTransaction = (transaction, {
  itemId = '',
  itemName = '',
  quantityChange = 0,
  type = '',
  collectionName = '',
  extraData = {},
} = {}) => {
  const logRef = doc(collection(db, INVENTORY_LOG_COLLECTION));
  transaction.set(
    logRef,
    buildInventoryLogPayload({
      itemId,
      itemName,
      quantityChange,
      type,
      collectionName,
      extraData,
    }),
  );
};

const STOCK_READ_MODEL_SOURCE_TYPE_BY_COLLECTION = {
  raw_materials: 'material',
  products: 'product',
  semi_finished_materials: 'semi_finished',
};

const syncProductionStockReadModelInTransaction = (
  transaction,
  stockItem = {},
  { collectionName = '', lastSyncedFrom = 'productionWorkLogsService' } = {},
) => {
  if (!stockItem?.id || !collectionName) return null;

  return setStockItemReadModelInTransaction(transaction, stockItem, {
    sourceType: STOCK_READ_MODEL_SOURCE_TYPE_BY_COLLECTION[collectionName] || stockItem.sourceType || stockItem.typeLabel,
    sourceCollection: collectionName,
    lastSyncedFrom,
  });
};

// =====================================================
// Helper metadata audit output produksi
// Fungsi:
// - membuat snapshot worker/operator untuk inventory log `production_output_in`;
// - menyimpan label manusiawi Work Log/PO/step/varian tanpa mengubah transaksi stok.
// Hubungan flow aplikasi:
// - Worker sudah dipilih dan disimpan di Work Log sebelum complete; helper ini hanya
//   menyalin snapshot tersebut ke inventory log output supaya Stock Management bisa audit.
// Alasan logic dipakai:
// - Stock Management tidak boleh fetch Work Log per row dan tidak boleh backfill log lama,
//   sehingga metadata audit harus ikut tersimpan saat log produksi baru dibuat.
// Status:
// - AKTIF untuk log produksi baru.
// - GUARDED karena tidak menyentuh quantityChange, stock mutation, HPP, payroll, atau guard complete.
// - Catatan: log yang belum membawa worker metadata tetap tidak boleh merusak audit tampilan.
// =====================================================
export const createProductionWorkLogFromOrder = async (
  orderId,
  extraValues = {},
  currentUser = null,
) => {
  const actor = currentUser?.email || currentUser?.displayName || currentUser?.uid || "system";
  const orderRef = doc(db, "production_orders", orderId);
  const submittedWorkNumber = safeTrim(extraValues.workNumber).toUpperCase();
  const baselineWorkNumber = submittedWorkNumber || (await generateProductionWorkLogNumber());
  const baselineSequence = getDailyBusinessCodeSequence({
    code: baselineWorkNumber,
    prefix: "JOB",
    date: extraValues.workDate || new Date(),
  });

  return await runTransaction(db, async (transaction) => {
    const codeReservation = submittedWorkNumber
      ? { code: submittedWorkNumber, commit: () => {} }
      : await prepareDailySequenceCodeInTransaction({
          transaction,
          db,
          collectionName: COLLECTION_NAME,
          prefix: "JOB",
          date: extraValues.workDate || new Date(),
          minimumSequence: Math.max(baselineSequence - 1, 0),
        });
    const workNumber = codeReservation.code;
    const workLogRef = doc(db, COLLECTION_NAME, workNumber);
    const workLogExistingSnap = await transaction.get(workLogRef);

    if (workLogExistingSnap.exists()) {
      throw { type: "validation", errors: { workNumber: "Nomor work log sudah digunakan" } };
    }

    // =====================================================
    // SECTION: Start Production transaction read-before-write — GUARDED
    // Fungsi:
    // - memulai produksi dari PO dengan membuat Work Log in_progress, memotong stok bahan, dan mengubah PO ke in_production;
    // - memastikan semua transaction.get selesai sebelum transaction.update/set pertama.
    //
    // Dipakai oleh:
    // - src/pages/Produksi/ProductionOrders.jsx melalui action Mulai Produksi.
    //
    // Alasan perubahan:
    // - Firestore menolak transaction yang membaca dokumen setelah write pertama.
    //
    // Catatan cleanup:
    // - complete Work Log punya transaksi berbeda dan perlu batch audit terpisah bila muncul error serupa.
    //
    // Risiko:
    // - jika urutan read/write diubah sembarangan, stok bisa berkurang tanpa Work Log/PO konsisten atau transaksi kembali gagal.
    // =====================================================
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) {
      throw new Error("Production order tidak ditemukan");
    }

    const order = { id: orderSnap.id, ...orderSnap.data() };
    assertProductionOrderStartable(order);

    if (!order.bomId) {
      throw new Error("BOM pada production order tidak ditemukan");
    }

    const bomRef = doc(db, "production_boms", order.bomId);
    const bomSnap = await transaction.get(bomRef);
    if (!bomSnap.exists()) {
      throw new Error("BOM dari production order tidak ditemukan");
    }

    const templateValues = buildWorkLogDraftFromProductionOrderData(
      order,
      { id: bomSnap.id, ...bomSnap.data() },
      extraValues.selectedStepId || "",
    );
    const payload = normalizePayload(
      {
        ...templateValues,
        ...extraValues,
        workNumber,
        workDate: extraValues.workDate || new Date(),
        sourceType: "production_order",
        status: "in_progress",
        stockConsumptionStatus: "applied",
        stockOutputStatus: "pending",
        startedAt: new Date(),
      },
      currentUser,
      false,
    );

    // SECTION: workLogRef memakai JOB sebagai document ID agar metadata inventory log tetap readable.
    const stockReadMap = new Map();

    for (const line of payload.materialUsages || []) {
      const collectionName = getCollectionNameByItemType(line.itemType);
      if (!collectionName || !line.itemId) continue;

      const stockKey = `${collectionName}/${line.itemId}`;
      if (!stockReadMap.has(stockKey)) {
        stockReadMap.set(stockKey, {
          collectionName,
          ref: doc(db, collectionName, line.itemId),
          itemName: line.itemName || "material",
          stockItem: null,
          nextStockItem: null,
          updatePayload: null,
        });
      }
    }

    for (const stockState of stockReadMap.values()) {
      const stockSnap = await transaction.get(stockState.ref);
      if (!stockSnap.exists()) {
        throw new Error(`Item material ${stockState.itemName || "-"} tidak ditemukan`);
      }

      const stockItem = normalizeReferenceItem({ id: stockSnap.id, ...stockSnap.data() });
      stockState.stockItem = stockItem;
      stockState.nextStockItem = stockItem;
    }

    const nextMaterialUsages = [];
    const inventoryLogPayloads = [];

    for (const line of payload.materialUsages || []) {
      const collectionName = getCollectionNameByItemType(line.itemType);
      if (!collectionName || !line.itemId) {
        nextMaterialUsages.push(line);
        continue;
      }

      const stockKey = `${collectionName}/${line.itemId}`;
      const stockState = stockReadMap.get(stockKey);
      if (!stockState?.nextStockItem) {
        throw new Error(`Item material ${line.itemName || "-"} tidak ditemukan`);
      }

      const stockItem = stockState.nextStockItem;
      const stockResolution = getResolvedMaterialStock({
        line,
        stockItem,
        strictVariant: payload.sourceType === "production_order",
      });
      const consumeQty = toNumber(line.actualQty || line.plannedQty || 0);
      if (toNumber(stockResolution.currentStock || 0) < consumeQty) {
        throw new Error(`Stok ${line.itemName || "material"} tidak cukup untuk mulai produksi`);
      }

      const costSnapshot = getItemUnitCostSnapshot({
        itemType: line.itemType,
        stockItem,
        stockResolution,
      });
      const unitCostSnapshot = costSnapshot.unitCost;

      if (consumeQty > 0) {
        const updatePayload = applyStockMutationToItem({
          item: stockItem,
          variantKey: stockResolution.resolvedVariantKey || "",
          deltaCurrent: -consumeQty,
        });
        stockState.updatePayload = updatePayload;
        stockState.nextStockItem = {
          ...stockItem,
          ...updatePayload,
        };

        inventoryLogPayloads.push({
          itemId: line.itemId,
          itemName: line.itemName || stockItem.name || '-',
          quantityChange: -consumeQty,
          type: 'production_material_out',
          collectionName,
          extraData: {
            workLogRefId: workLogRef.id,
            workNumber: payload.workNumber || '',
            productionOrderId: order.id,
            productionOrderCode: order.code || '',
            stepName: payload.stepName || order.stepName || '',
            movementSource: 'production',
            unit: safeTrim(line.unit) || safeTrim(stockItem.unit) || '',
            stockUnit: safeTrim(line.unit) || safeTrim(stockItem.unit) || '',
            variantKey: stockResolution.resolvedVariantKey || '',
            variantLabel: stockResolution.resolvedVariantLabel || '',
          },
        });
      }

      nextMaterialUsages.push(
        calculateMaterialUsageLine({
          ...line,
          actualQty: consumeQty,
          costPerUnitSnapshot: unitCostSnapshot,
          costSourceSnapshot: costSnapshot.costSource,
          stockDeducted: consumeQty > 0,
          stockDeductedAt: consumeQty > 0 ? new Date() : null,
          resolvedVariantKey: stockResolution.resolvedVariantKey || "",
          resolvedVariantLabel: stockResolution.resolvedVariantLabel || "",
          stockSourceType: stockResolution.stockSourceType || "master",
        }),
      );
    }

    const startedCostSummary = buildWorkLogCostSummary({
      materialUsages: nextMaterialUsages,
      laborCostActual: payload.laborCostActual,
      overheadCostActual: payload.overheadCostActual,
      goodQty: payload.goodQty,
    });

    codeReservation.commit();

    for (const stockState of stockReadMap.values()) {
      if (stockState.updatePayload) {
        transaction.update(stockState.ref, {
          ...stockState.updatePayload,
          updatedAt: serverTimestamp(),
        });
        syncProductionStockReadModelInTransaction(
          transaction,
          stockState.nextStockItem,
          {
            collectionName: stockState.collectionName,
            lastSyncedFrom: 'productionWorkLogsService.startProduction.materialOut',
          },
        );
      }
    }

    for (const logPayload of inventoryLogPayloads) {
      addInventoryLogInTransaction(transaction, logPayload);
    }

    transaction.set(workLogRef, {
      ...payload,
      ...startedCostSummary,
      materialUsages: nextMaterialUsages,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: actor,
      updatedBy: actor,
    });

    transaction.update(orderRef, {
      status: "in_production",
      workLogIds: [workLogRef.id],
      generatedWorkLogCount: 1,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    });

    return workLogRef.id;
  });
};

// =====================================================
// Update work log
// Catatan maintainability:
// - Data readonly dari PO tetap dipertahankan dari record lama
// - Summary qty (good/reject/rework) selalu disinkronkan ke output pertama
// =====================================================
export const updateProductionWorkLog = async (
  id,
  values,
  currentUser = null,
) => {
  const ref = doc(db, COLLECTION_NAME, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Work log tidak ditemukan");
  }

  const current = { id: snap.id, ...snap.data() };

  // =====================================================
  // Guard update work log produksi
  // Catatan maintainability:
  // - Work log completed dianggap locked agar stok output / payroll / HPP
  //   tidak berubah diam-diam oleh patch UI lain.
  // - Work log yang sudah linked ke PO tetap boleh update biaya/catatan/operator,
  //   tetapi field inti flow produksi dikunci oleh helper guard.
  // =====================================================
  if (isProductionWorkLogCompleted(current)) {
    throw new Error(
      "Work log completed sudah terkunci. Jika perlu perubahan, evaluasi khusus flow produksi harus dilakukan terlebih dahulu.",
    );
  }

  const mergedValues = {
    ...current,
    ...values,
    materialUsages:
      Array.isArray(values.materialUsages) && values.materialUsages.length > 0
        ? values.materialUsages
        : current.materialUsages || [],
    outputs:
      Array.isArray(values.outputs) && values.outputs.length > 0
        ? values.outputs
        : current.outputs || [],
  };

  if (Array.isArray(mergedValues.outputs) && mergedValues.outputs.length > 0) {
    mergedValues.outputs = mergedValues.outputs.map((line, index) =>
      index === 0
        ? {
            ...line,
            goodQty: toNumber(mergedValues.goodQty || 0),
            rejectQty: toNumber(mergedValues.rejectQty || 0),
            reworkQty: toNumber(mergedValues.reworkQty || 0),
          }
        : line,
    );
  }

  const guardedValues = applyLockedWorkLogCoreFields(current, mergedValues);
  if (!safeTrim(guardedValues.workNumber)) {
    guardedValues.workNumber = await generateProductionWorkLogNumber();
  }

  const errors = validateProductionWorkLog(guardedValues);
  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  const exists = await isProductionWorkLogNumberExists(guardedValues.workNumber, id);
  if (exists) {
    throw { type: "validation", errors: { workNumber: "Nomor work log sudah digunakan" } };
  }

  const payload = normalizePayload(guardedValues, currentUser, true);
  await updateDoc(ref, payload);
  return id;
};

// =====================================================
// Helper peta kebutuhan PO untuk referensi qty requirement
// Digunakan saat complete untuk membaca snapshot kebutuhan dari PO
// =====================================================
const getResolvedMaterialStock = ({ line = {}, stockItem = {}, strictVariant = false } = {}) => {
  const materialVariantStrategy = normalizeMaterialVariantStrategy({ line, stockItem });
  const shouldReadVariant = shouldLineReadVariantStrictly({ line, stockItem, strictVariant });

  if (shouldReadVariant && !safeTrim(line.resolvedVariantKey) && !safeTrim(line.resolvedVariantLabel)) {
    const itemName = safeTrim(line.itemName || stockItem?.name || stockItem?.code) || "material";
    throw new Error(
      `Material ${itemName} membutuhkan varian dari PO, tetapi resolvedVariantKey/resolvedVariantLabel kosong. Refresh Need/perbaiki BOM sebelum Start Production.`,
    );
  }

  // =====================================================
  // SECTION: Resolve stok material Start Production
  // Fungsi blok:
  // - memakai resolvedVariantKey/resolvedVariantLabel dari line PO final sebagai sumber utama;
  // - mengirim allowMasterFallback=false hanya saat Start Production dari PO membutuhkan variant.
  // Hubungan flow aplikasi:
  // - hasil resolver langsung dipakai untuk applyStockMutationToItem dan inventory log material keluar.
  // Alasan logic:
  // - preview PO, PO final, dan pemotongan stok Start Production harus membaca bucket variant yang sama.
  // Status: AKTIF/GUARDED untuk production_order start; caller internal non-PO tetap permissive saat strictVariant=false.
  // =====================================================
  const stockResolution = resolveVariantSelection({
    item: stockItem || {},
    materialVariantStrategy,
    targetVariantKey: line.resolvedVariantKey || "",
    targetVariantLabel: line.resolvedVariantLabel || "",
    fixedVariantKey: line.resolvedVariantKey || "",
    fixedVariantLabel: line.resolvedVariantLabel || "",
    allowMasterFallback: !shouldReadVariant,
    contextLabel: `Varian material ${safeTrim(line.itemName || stockItem?.name || "material")}`,
  });

  if (shouldReadVariant) {
    assertResolvedVariantContract({ line, stockItem, stockResolution });
  }

  return stockResolution;
};

const getOutputStockResolution = ({
  line = {},
  stockItem = {},
  fallbackVariantKey = '',
  fallbackVariantLabel = '',
}) => {
  const outputHasVariants =
    line.outputHasVariants === true || inferHasVariants(stockItem || {});
  const preferredVariantKey = line.outputVariantKey || fallbackVariantKey || '';
  const preferredVariantLabel = line.outputVariantLabel || fallbackVariantLabel || '';

  if (!outputHasVariants) {
    return {
      stockSourceType: 'master',
      materialHasVariants: false,
      resolvedVariantKey: '',
      resolvedVariantLabel: '',
    };
  }

  const resolution = resolveVariantSelection({
    item: stockItem || {},
    materialVariantStrategy: preferredVariantKey ? 'fixed' : 'inherit',
    targetVariantKey: preferredVariantKey,
    fixedVariantKey: preferredVariantKey,
  });

  // =====================================================
  // Guard output varian.
  // Untuk item semi finished / product yang punya beberapa varian,
  // stok tidak boleh jatuh ke master karena halaman stok semi finished
  // menghitung total dari variants. Jika dibiarkan masuk ke master,
  // inventory log akan terlihat masuk tetapi total stok list tetap 0.
  // =====================================================
  if (resolution.stockSourceType !== 'variant') {
    throw new Error(
      `Output ${line.outputName || stockItem.name || 'produksi'} wajib punya varian target yang jelas sebelum work log diselesaikan`,
    );
  }

  return {
    ...resolution,
    materialHasVariants: true,
    resolvedVariantKey: resolution.resolvedVariantKey || preferredVariantKey,
    resolvedVariantLabel: resolution.resolvedVariantLabel || preferredVariantLabel,
  };
};

// =====================================================
// SECTION: Reconcile HPP output setelah payroll final — GUARDED
// Fungsi:
// - menyelaraskan costPerUnit output Work Log dan master HPP/average cost setelah payroll final berubah;
// - memakai delta cost, bukan menambah qty stok ulang, sehingga stock movement tetap idempotent.
//
// Dipakai oleh:
// - productionPayrollsService.syncWorkLogPayrollSummary setelah payroll confirmed/paid/manual update.
//
// Alasan perubahan:
// - Complete Work Log mem-posting output sebelum payroll final, sehingga HPP master bisa tertinggal material-only.
// - Tanpa reconcile ini BOM bertingkat yang membaca Semi Finished `averageCostPerUnit` akan memakai harga bahan yang miss.
//
// Catatan cleanup:
// - Ini bukan backfill histori lama lintas collection. Data lama yang belum pernah tersentuh tetap perlu audit/backfill terpisah.
//
// Risiko:
// - Jangan mengubah qty/stockAdded di fungsi ini; yang boleh berubah hanya cost snapshot output dan field HPP/average cost master.
// =====================================================
export const reconcileCompletedWorkLogOutputHpp = async (workLogId, options = {}) => {
  if (!workLogId) return { status: 'skipped_no_work_log' };

  let reconcileResult = { status: 'skipped' };
  const actor = safeTrim(options.actor) || 'system';
  // options.source dipertahankan untuk compatibility caller, tetapi tidak ditulis ke schema agar patch ini tidak menambah field baru.

  await runTransaction(db, async (transaction) => {
    const workLogRef = doc(db, COLLECTION_NAME, workLogId);
    const workLogSnap = await transaction.get(workLogRef);

    if (!workLogSnap.exists()) {
      reconcileResult = { status: 'skipped_missing_work_log' };
      return;
    }

    const workLog = {
      id: workLogSnap.id,
      ...workLogSnap.data(),
    };

    if (workLog.status !== 'completed') {
      reconcileResult = { status: 'skipped_not_completed' };
      return;
    }

    const outputs = Array.isArray(workLog.outputs) ? workLog.outputs : [];
    const goodQty = toNumber(workLog.goodQty || 0);
    const costSummary = buildWorkLogCostSummary({
      materialUsages: workLog.materialUsages || [],
      laborCostActual: workLog.laborCostActual,
      overheadCostActual: workLog.overheadCostActual,
      goodQty,
    });
    const nextUnitCost = toNumber(costSummary.costPerGoodUnit || 0);

    if (goodQty <= 0 || nextUnitCost <= 0 || outputs.length === 0) {
      reconcileResult = { status: 'skipped_invalid_cost_or_output' };
      return;
    }

    const eligibleOutputs = outputs
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => (
        line?.stockAdded === true &&
        toNumber(line.goodQty || 0) > 0 &&
        getCollectionNameByItemType(line.outputType) &&
        line.outputIdRef
      ));

    if (eligibleOutputs.length === 0) {
      reconcileResult = { status: 'skipped_no_posted_output' };
      return;
    }

    const outputStockReadMap = new Map();
    for (const { line } of eligibleOutputs) {
      const collectionName = getCollectionNameByItemType(line.outputType);
      const outputStockKey = `${collectionName}/${line.outputIdRef}`;
      if (outputStockReadMap.has(outputStockKey)) continue;

      const stockRef = doc(db, collectionName, line.outputIdRef);
      const stockSnap = await transaction.get(stockRef);
      if (!stockSnap.exists()) {
        throw new Error(`Item output ${line.outputName || '-'} tidak ditemukan saat reconcile HPP`);
      }

      const stockItem = normalizeReferenceItem({
        id: stockSnap.id,
        ...stockSnap.data(),
      });

      outputStockReadMap.set(outputStockKey, {
        ref: stockRef,
        collectionName,
        stockDataRaw: stockSnap.data(),
        stockItem,
        nextStockItem: stockItem,
        updatePayload: null,
      });
    }

    const nextOutputs = [...outputs];
    let changedOutputCount = 0;
    let changedStockCount = 0;

    for (const { line, index } of eligibleOutputs) {
      const collectionName = getCollectionNameByItemType(line.outputType);
      const outputStockKey = `${collectionName}/${line.outputIdRef}`;
      const outputStockState = outputStockReadMap.get(outputStockKey);
      const lineGoodQty = toNumber(line.goodQty || 0);
      const previousUnitCost = toNumber(line.costPerUnit || 0);
      const outputResolution = getOutputStockResolution({
        line,
        stockItem: outputStockState.stockItem,
        fallbackVariantKey: workLog.targetVariantKey || '',
        fallbackVariantLabel: workLog.targetVariantLabel || '',
      });
      const needsOutputLineCostUpdate = Math.abs(previousUnitCost - nextUnitCost) > COST_RECONCILE_TOLERANCE;
      const costState = getOutputTargetCostState({
        collectionName,
        stockItem: outputStockState.stockItem,
        stockDataRaw: outputStockState.stockDataRaw || {},
        outputResolution,
      });
      const needsStockCostUpdate = needsOutputLineCostUpdate || needsOutputMasterCostSync({
        costState,
        lineGoodQty,
        nextUnitCost,
      });

      if (needsStockCostUpdate) {
        const costPayload = buildOutputHppReconcilePayload({
          collectionName,
          stockItem: outputStockState.stockItem,
          stockDataRaw: outputStockState.stockDataRaw || {},
          outputResolution,
          goodQty: lineGoodQty,
          previousUnitCost,
          nextUnitCost,
        });

        if (Object.keys(costPayload).length > 0) {
          transaction.update(outputStockState.ref, {
            ...costPayload,
            updatedAt: serverTimestamp(),
          });
          changedStockCount += 1;
        }
      }

      nextOutputs[index] = calculateOutputLine({
        ...line,
        outputHasVariants: outputResolution.materialHasVariants === true || line.outputHasVariants === true,
        outputVariantKey: outputResolution.resolvedVariantKey || line.outputVariantKey || '',
        outputVariantLabel: outputResolution.resolvedVariantLabel || line.outputVariantLabel || '',
        stockSourceType: outputResolution.stockSourceType || line.stockSourceType || 'master',
        costPerUnit: nextUnitCost,
      });
      changedOutputCount += 1;
    }

    transaction.update(workLogRef, {
      outputs: nextOutputs,
      materialCostActual: costSummary.materialCostActual,
      laborCostActual: costSummary.laborCostActual,
      overheadCostActual: costSummary.overheadCostActual,
      totalCostActual: costSummary.totalCostActual,
      costPerGoodUnit: costSummary.costPerGoodUnit,
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    });

    reconcileResult = {
      status: changedStockCount > 0 ? 'reconciled' : 'already_synced',
      changedOutputCount,
      changedStockCount,
    };
  });

  return reconcileResult;
};

// =====================================================
// Complete work log + apply stock mutation
// =====================================================
export const completeProductionWorkLog = async (id, currentUser = null) => {
  const workLogRef = doc(db, COLLECTION_NAME, id);
  const actor =
    currentUser?.email ||
    currentUser?.displayName ||
    currentUser?.uid ||
    "system";

  await runTransaction(db, async (transaction) => {
    const workLogSnap = await transaction.get(workLogRef);

    if (!workLogSnap.exists()) {
      throw new Error("Data work log produksi tidak ditemukan");
    }

    const workLog = {
      id: workLogSnap.id,
      ...workLogSnap.data(),
    };

    assertProductionWorkLogCompletable(workLog);

    const materialUsages = Array.isArray(workLog.materialUsages)
      ? workLog.materialUsages
      : [];
    const outputs = Array.isArray(workLog.outputs) ? workLog.outputs : [];

    // Sinkronkan output pertama dari summary qty agar sumber data hasil produksi tunggal
    const synchronizedOutputs = outputs.map((line, index) =>
      index === 0
        ? {
            ...line,
            goodQty: toNumber(workLog.goodQty || 0),
            rejectQty: toNumber(workLog.rejectQty || 0),
            reworkQty: toNumber(workLog.reworkQty || 0),
          }
        : line,
    );

    const productionOrderRef = workLog.productionOrderId
      ? doc(db, "production_orders", workLog.productionOrderId)
      : null;
    let productionOrder = null;

    if (productionOrderRef) {
      const productionOrderSnap = await transaction.get(productionOrderRef);
      if (productionOrderSnap.exists()) {
        productionOrder = {
          id: productionOrderSnap.id,
          ...productionOrderSnap.data(),
        };
      }
    }

    let productionStep = null;
    if (workLog.stepId) {
      const productionStepRef = doc(db, PRODUCTION_STEPS_COLLECTION_NAME, workLog.stepId);
      const productionStepSnap = await transaction.get(productionStepRef);
      if (productionStepSnap.exists()) {
        productionStep = {
          id: productionStepSnap.id,
          ...productionStepSnap.data(),
        };
      }
    }

    const reservedQtyMap = buildWorkLogReservationMap(productionOrder);

    const completedAtValue = new Date();

    const nextMaterialUsages = [];
    const materialStockUpdateMap = new Map();
    const materialInventoryLogPayloads = [];
    for (const line of materialUsages) {
      const actualQty = toNumber(line.actualQty || 0);
      const collectionName = getCollectionNameByItemType(line.itemType);

      if (workLog.stockConsumptionStatus === "applied" || line.stockDeducted === true) {
        // =====================================================
        // ACTIVE / GUARDED - freeze material cost yang sudah dipotong saat Start Production.
        // Fungsi:
        // - memakai snapshot cost dari Start Production bila sudah ada agar HPP actual tidak berubah karena master cost berubah setelah stok bahan dipotong;
        // - hanya fallback membaca master jika data legacy belum punya snapshot cost valid.
        // Alasan blok ini dipakai:
        // - material yang sudah stockDeducted=true tidak boleh dipotong ulang dan tidak boleh membuat biaya complete berubah hanya karena harga master terbaru berubah sesudah bahan keluar.
        // Status:
        // - aktif dipakai; guarded karena menjadi dasar material cost dan HPP Work Log.
        // =====================================================
        const existingUnitCost = toNumber(line.costPerUnitSnapshot || 0);
        if (existingUnitCost > 0 || !collectionName || !line.itemId) {
          nextMaterialUsages.push(
            calculateMaterialUsageLine({
              ...line,
              actualQty,
              costPerUnitSnapshot: existingUnitCost,
              costSourceSnapshot: line.costSourceSnapshot || (existingUnitCost > 0 ? 'work_log.start_snapshot' : 'missing_master_cost_snapshot'),
              stockDeducted: true,
              stockDeductedAt: line.stockDeductedAt || completedAtValue,
            }),
          );
          continue;
        }

        const stockRef = doc(db, collectionName, line.itemId);
        const stockSnap = await transaction.get(stockRef);

        if (!stockSnap.exists()) {
          throw new Error(`Item material ${line.itemName || "-"} tidak ditemukan saat fallback cost complete`);
        }

        const stockItem = normalizeReferenceItem({
          id: stockSnap.id,
          ...stockSnap.data(),
        });
        const stockResolution = getResolvedMaterialStock({ line, stockItem });
        const costSnapshot = getItemUnitCostSnapshot({
          itemType: line.itemType,
          stockItem,
          stockResolution,
        });

        nextMaterialUsages.push(
          calculateMaterialUsageLine({
            ...line,
            actualQty,
            materialHasVariants: stockResolution.materialHasVariants === true,
            materialVariantStrategy: stockResolution.materialVariantStrategy || line.materialVariantStrategy || 'none',
            resolvedVariantKey: stockResolution.resolvedVariantKey || line.resolvedVariantKey || '',
            resolvedVariantLabel: stockResolution.resolvedVariantLabel || line.resolvedVariantLabel || '',
            stockSourceType: stockResolution.stockSourceType || line.stockSourceType || 'master',
            costPerUnitSnapshot: costSnapshot.unitCost,
            costSourceSnapshot: costSnapshot.costSource,
            stockDeducted: true,
            stockDeductedAt: line.stockDeductedAt || completedAtValue,
          }),
        );
        continue;
      }

      if (!collectionName || !line.itemId) {
        nextMaterialUsages.push({
          ...line,
          stockDeducted: false,
          stockDeductedAt: null,
        });
        continue;
      }

      const materialStockKey = `${collectionName}/${line.itemId}`;
      if (!materialStockUpdateMap.has(materialStockKey)) {
        const stockRef = doc(db, collectionName, line.itemId);
        const stockSnap = await transaction.get(stockRef);

        if (!stockSnap.exists()) {
          throw new Error(`Item material ${line.itemName || "-"} tidak ditemukan`);
        }

        const stockItem = normalizeReferenceItem({
          id: stockSnap.id,
          ...stockSnap.data(),
        });

        materialStockUpdateMap.set(materialStockKey, {
          ref: stockRef,
          collectionName,
          itemName: line.itemName || stockItem.name || 'material',
          stockItem,
          nextStockItem: stockItem,
          updatePayload: null,
        });
      }

      const materialStockState = materialStockUpdateMap.get(materialStockKey);
      const stockItem = materialStockState.nextStockItem;
      const stockResolution = getResolvedMaterialStock({
        line,
        stockItem,
      });
      const reservationKey = [
        line.itemType || '',
        line.itemId || '',
        stockResolution.resolvedVariantKey || '',
      ].join('::');
      const reservedReleaseQty = Math.min(
        toNumber(reservedQtyMap.get(reservationKey) || 0),
        toNumber(stockResolution.reservedStock || 0),
      );

      if (toNumber(stockResolution.currentStock || 0) < actualQty) {
        throw new Error(
          `Stok ${line.itemName || "material"} tidak cukup untuk diselesaikan`,
        );
      }

      const updatePayload = applyStockMutationToItem({
        item: stockItem,
        variantKey: stockResolution.resolvedVariantKey || '',
        deltaCurrent: -actualQty,
        deltaReserved: -reservedReleaseQty,
      });

      materialStockState.updatePayload = updatePayload;
      materialStockState.nextStockItem = {
        ...stockItem,
        ...updatePayload,
      };

      if (actualQty > 0) {
        materialInventoryLogPayloads.push({
          itemId: line.itemId,
          itemName: line.itemName || stockItem.name || '-',
          quantityChange: -actualQty,
          type: 'production_material_out',
          collectionName,
          extraData: {
            workLogRefId: workLog.id || workLogRef.id,
            workNumber: workLog.workNumber || workLog.code || workLog.id || '',
            productionOrderId: productionOrder?.id || workLog.productionOrderId || '',
            productionOrderCode: productionOrder?.code || workLog.productionOrderCode || '',
            stepName: workLog.stepName || productionOrder?.stepName || '',
            movementSource: 'production_legacy_complete',
            unit: safeTrim(line.unit) || safeTrim(stockItem.unit) || '',
            stockUnit: safeTrim(line.unit) || safeTrim(stockItem.unit) || '',
            variantKey: stockResolution.resolvedVariantKey || '',
            variantLabel: stockResolution.resolvedVariantLabel || '',
            reservedReleaseQty,
          },
        });
      }

      // =====================================================
      // ACTIVE / GUARDED - snapshot cost material saat Complete Work Log.
      // Fungsi:
      // - mengisi biaya aktual dari dokumen material/output cost source yang valid;
      // - tidak memakai harga jual dan tidak menambah overhead tanpa business rule.
      // Alasan blok ini dipakai:
      // - material usage yang belum punya cost snapshot saat form dibuat tetap dihydrate dari master cost aktif.
      // Status:
      // - aktif dipakai; guarded karena menjadi dasar material cost dan HPP.
      // =====================================================
      const costSnapshot = getItemUnitCostSnapshot({
        itemType: line.itemType,
        stockItem,
        stockResolution,
      });
      const unitCostSnapshot = costSnapshot.unitCost;

      nextMaterialUsages.push(
        calculateMaterialUsageLine({
          ...line,
          materialHasVariants: stockResolution.materialHasVariants === true,
          materialVariantStrategy: stockResolution.materialVariantStrategy || line.materialVariantStrategy || 'none',
          resolvedVariantKey: stockResolution.resolvedVariantKey || '',
          resolvedVariantLabel: stockResolution.resolvedVariantLabel || '',
          stockSourceType: stockResolution.stockSourceType || 'master',
          costPerUnitSnapshot: unitCostSnapshot,
          costSourceSnapshot: costSnapshot.costSource,
          stockDeducted: actualQty > 0,
          stockDeductedAt: actualQty > 0 ? completedAtValue : null,
        }),
      );
    }

    const totalGoodQty = synchronizedOutputs.reduce((sum, line) => sum + toNumber(line.goodQty || 0), 0);
    if (totalGoodQty <= 0) {
      throw new Error("Good Qty hasil produksi harus lebih dari 0 sebelum work log diselesaikan");
    }

    /*
    =====================================================
    SECTION: Complete Work Log cost calculation — GUARDED
    Fungsi:
    - Menghitung ulang summary costing final dari material usage snapshot, labor, overhead, dan good qty.

    Dipakai oleh:
    - completeProductionWorkLog sebelum output HPP/average cost diposting.

    Alasan perubahan:
    - Summary Work Log tidak boleh tetap 0 jika materialUsages sudah punya snapshot cost valid.

    Catatan cleanup:
    - Labor final masih disinkronkan oleh payroll service setelah payroll dibuat/diupdate.

    Risiko:
    - Jangan update HPP output jika total cost atau good qty tidak valid; itu akan menyebarkan HPP 0 ke master produk/semi finished.
    =====================================================
    */
    const accruedLaborCost = resolveCompletedWorkLogAccruedLaborCost({
      workLog: {
        ...workLog,
        goodQty: totalGoodQty,
        actualOutputQty: totalGoodQty,
      },
      productionStep,
      totalGoodQty,
    });

    const recalculatedCostSummary = buildWorkLogCostSummary({
      materialUsages: nextMaterialUsages,
      laborCostActual: accruedLaborCost.amount,
      overheadCostActual: workLog.overheadCostActual,
      goodQty: totalGoodQty,
    });
    const recalculatedMaterialCost = recalculatedCostSummary.materialCostActual;
    const recalculatedLaborCost = recalculatedCostSummary.laborCostActual;
    const recalculatedOverheadCost = recalculatedCostSummary.overheadCostActual;
    const recalculatedTotalCost = recalculatedCostSummary.totalCostActual;
    const recalculatedCostPerGoodUnit = recalculatedCostSummary.costPerGoodUnit;

    const canUpdateOutputHpp = totalGoodQty > 0 && recalculatedTotalCost > 0;
    const fallbackUnitCost = canUpdateOutputHpp
      ? (recalculatedCostPerGoodUnit || toNumber(workLog.costPerGoodUnit || 0))
      : 0;
    const nextOutputs = [];
    const outputStockReadMap = new Map();

    /*
    =====================================================
    SECTION: Complete Work Log transaction read-before-write safety — GUARDED
    Fungsi:
    - Membaca seluruh output stock document sebelum transaction.update/set pertama dijalankan.

    Dipakai oleh:
    - completeProductionWorkLog ketika mem-posting output produksi dan inventory log.

    Alasan perubahan:
    - Firestore transaction mewajibkan semua read dilakukan sebelum write; sebelumnya output read bisa terjadi setelah material update.

    Catatan cleanup:
    - Jika nanti material/output mutation digabung per item, tetap pertahankan fase READ+VALIDATE sebelum WRITE.

    Risiko:
    - Jika fase read/write dicampur lagi, complete Work Log dapat gagal atau menghasilkan mutasi stok tidak atomic.
    =====================================================
    */
    for (const line of synchronizedOutputs) {
      const collectionName = getCollectionNameByItemType(line.outputType);
      if (!collectionName || !line.outputIdRef) continue;

      const outputStockKey = `${collectionName}/${line.outputIdRef}`;
      if (outputStockReadMap.has(outputStockKey)) continue;

      const stockRef = doc(db, collectionName, line.outputIdRef);
      const stockSnap = await transaction.get(stockRef);

      if (!stockSnap.exists()) {
        throw new Error(`Item output ${line.outputName || "-"} tidak ditemukan`);
      }

      const stockItem = normalizeReferenceItem({
        id: stockSnap.id,
        ...stockSnap.data(),
      });

      outputStockReadMap.set(outputStockKey, {
        ref: stockRef,
        collectionName,
        stockDataRaw: stockSnap.data(),
        stockItem,
        nextStockItem: stockItem,
        updatePayload: null,
      });
    }

    for (const materialStockState of materialStockUpdateMap.values()) {
      if (!materialStockState.updatePayload) continue;

      transaction.update(materialStockState.ref, {
        ...materialStockState.updatePayload,
        updatedAt: serverTimestamp(),
      });
      syncProductionStockReadModelInTransaction(
        transaction,
        materialStockState.nextStockItem,
        {
          collectionName: materialStockState.collectionName,
          lastSyncedFrom: 'productionWorkLogsService.complete.materialOut',
        },
      );
    }

    for (const logPayload of materialInventoryLogPayloads) {
      addInventoryLogInTransaction(transaction, logPayload);
    }

    for (const line of synchronizedOutputs) {
      const goodQty = toNumber(line.goodQty || 0);
      const collectionName = getCollectionNameByItemType(line.outputType);

      if (!collectionName || !line.outputIdRef) {
        nextOutputs.push(
          calculateOutputLine({
            ...line,
            costPerUnit: toNumber(line.costPerUnit || 0) || fallbackUnitCost,
            stockAdded: false,
            stockAddedAt: null,
          }),
        );
        continue;
      }

      const outputStockKey = `${collectionName}/${line.outputIdRef}`;
      const outputStockState = outputStockReadMap.get(outputStockKey);

      if (!outputStockState?.stockItem) {
        throw new Error(`Item output ${line.outputName || "-"} tidak ditemukan`);
      }

      const stockItem = outputStockState.nextStockItem || outputStockState.stockItem;
      const stockData = normalizeStockSnapshot(stockItem || outputStockState.stockDataRaw || {});
      const outputResolution = getOutputStockResolution({
        line,
        stockItem,
        fallbackVariantKey: workLog.targetVariantKey || '',
        fallbackVariantLabel: workLog.targetVariantLabel || '',
      });
      const unitCost = canUpdateOutputHpp ? (toNumber(line.costPerUnit || 0) || fallbackUnitCost) : 0;
      const updatePayload = applyStockMutationToItem({
        item: stockItem,
        variantKey: outputResolution.resolvedVariantKey || '',
        deltaCurrent: goodQty,
      });

      if (canUpdateOutputHpp && collectionName === "semi_finished_materials") {
        const baseCurrentStock =
          outputResolution.stockSourceType === 'variant'
            ? toNumber(outputResolution.currentStock || 0)
            : stockData.currentStock;
        const baseAverageCost =
          outputResolution.stockSourceType === 'variant'
            ? toNumber(
                (stockItem.variants || []).find(
                  (variant) => (variant.variantKey || variant.id || variant.name || variant.color || '').toString().trim().toLowerCase() === (outputResolution.resolvedVariantKey || '').toString().trim().toLowerCase(),
                )?.averageCostPerUnit || 0,
              )
            : toNumber(stockData.averageCostPerUnit || 0);
        const nextAverageCost = calculateWeightedAverage(
          baseCurrentStock,
          baseAverageCost,
          goodQty,
          unitCost,
        );

        updatePayload.lastProductionCostPerUnit = unitCost;
        updatePayload.averageCostPerUnit =
          outputResolution.stockSourceType === 'variant'
            ? toNumber(stockData.averageCostPerUnit || 0)
            : nextAverageCost;
        if (outputResolution.stockSourceType === 'variant') {
          updatePayload.variants = (updatePayload.variants || []).map((variant) => {
            const key = (variant.variantKey || variant.id || variant.name || variant.color || '').toString().trim().toLowerCase();
            if (key !== (outputResolution.resolvedVariantKey || '').toString().trim().toLowerCase()) {
              return variant;
            }
            return {
              ...variant,
              averageCostPerUnit: nextAverageCost,
            };
          });
          updatePayload.averageCostPerUnit = calculateWeightedVariantUnitCost(
            updatePayload.variants,
            'averageCostPerUnit',
          );
        }
      } else if (canUpdateOutputHpp && collectionName === "products") {
        const baseCurrentStock =
          outputResolution.stockSourceType === 'variant'
            ? toNumber(outputResolution.currentStock || 0)
            : toNumber(stockItem.stock ?? stockData.currentStock);
        const currentHpp =
          outputResolution.stockSourceType === 'variant'
            ? toNumber(
                (stockItem.variants || []).find(
                  (variant) => (variant.variantKey || variant.id || variant.name || variant.color || '').toString().trim().toLowerCase() === (outputResolution.resolvedVariantKey || '').toString().trim().toLowerCase(),
                )?.hppPerUnit || 0,
              )
            : toNumber(stockItem.hppPerUnit || 0);
        const nextHpp = calculateWeightedAverage(
          baseCurrentStock,
          currentHpp,
          goodQty,
          unitCost,
        );

        if (outputResolution.stockSourceType === 'variant') {
          updatePayload.variants = (updatePayload.variants || []).map((variant) => {
            const key = (variant.variantKey || variant.id || variant.name || variant.color || '').toString().trim().toLowerCase();
            if (key !== (outputResolution.resolvedVariantKey || '').toString().trim().toLowerCase()) {
              return variant;
            }
            return {
              ...variant,
              hppPerUnit: nextHpp,
            };
          });
          updatePayload.hppPerUnit = calculateWeightedVariantUnitCost(
            updatePayload.variants,
            'hppPerUnit',
          );
        } else {
          updatePayload.hppPerUnit = nextHpp;
        }
      }

      outputStockState.updatePayload = updatePayload;
      outputStockState.nextStockItem = {
        ...stockItem,
        ...updatePayload,
      };

      // SECTION: tulis log mutasi output masuk saat produksi selesai
      // Catatan maintainability:
      // - Log output wajib menyimpan referensi yang sama dengan log bahan keluar
      //   agar audit trial-error bisa melihat siklus produksi secara utuh.
      if (goodQty > 0) {
        addInventoryLogInTransaction(transaction, {
          itemId: line.outputIdRef,
          itemName: line.outputName || stockItem.name || '-',
          quantityChange: goodQty,
          type: 'production_output_in',
          collectionName,
          extraData: {
            ...buildProductionOutputAuditMetadata({
              workLog,
              productionOrder,
              outputResolution,
            }),
            unit: safeTrim(line.unit) || safeTrim(stockItem.unit) || '',
            stockUnit: safeTrim(line.unit) || safeTrim(stockItem.unit) || '',
          },
        });
      }

      nextOutputs.push(
        calculateOutputLine({
          ...line,
          outputHasVariants: outputResolution.materialHasVariants === true || line.outputHasVariants === true,
          outputVariantKey: outputResolution.resolvedVariantKey || '',
          outputVariantLabel: outputResolution.resolvedVariantLabel || '',
          stockSourceType: outputResolution.stockSourceType || 'master',
          costPerUnit: unitCost,
          stockAdded: goodQty > 0,
          stockAddedAt: goodQty > 0 ? completedAtValue : null,
        }),
      );
    }

    for (const outputStockState of outputStockReadMap.values()) {
      if (!outputStockState.updatePayload) continue;

      transaction.update(outputStockState.ref, {
        ...outputStockState.updatePayload,
        updatedAt: serverTimestamp(),
      });
      syncProductionStockReadModelInTransaction(
        transaction,
        outputStockState.nextStockItem,
        {
          collectionName: outputStockState.collectionName,
          lastSyncedFrom: 'productionWorkLogsService.complete.outputIn',
        },
      );
    }

    transaction.update(workLogRef, {
      status: "completed",
      completedAt: workLog.completedAt || completedAtValue,
      materialUsages: nextMaterialUsages,
      outputs: nextOutputs,
      materialCostActual: recalculatedMaterialCost,
      laborCostActual: recalculatedLaborCost,
      overheadCostActual: recalculatedOverheadCost,
      totalCostActual: recalculatedTotalCost,
      costPerGoodUnit: recalculatedCostPerGoodUnit,
      payrollAccruedAmount: accruedLaborCost.amount,
      payrollAccruedPerWorkerAmount: accruedLaborCost.perWorkerAmount,
      payrollAccruedWorkerCount: accruedLaborCost.workerCount,
      payrollAccruedSource: accruedLaborCost.payrollRule.source,
      payrollCostStatus: accruedLaborCost.status,
      stepProcessType: accruedLaborCost.payrollRule.stepProcessType || workLog.stepProcessType || "",
      stepPayrollMode: accruedLaborCost.payrollRule.payrollMode,
      stepPayrollRate: accruedLaborCost.payrollRule.payrollRate,
      stepPayrollQtyBase: accruedLaborCost.payrollRule.payrollQtyBase,
      stepPayrollOutputBasis: accruedLaborCost.payrollRule.payrollOutputBasis,
      stepPayrollClassification: accruedLaborCost.payrollRule.payrollClassification,
      stepPayrollIncludeInHpp: accruedLaborCost.payrollRule.includePayrollInHpp,
      stepPayrollRuleSource: accruedLaborCost.payrollRule.source,
      stockConsumptionStatus: "applied",
      stockOutputStatus: "applied",
      payrollCalculated: false,
      payrollCalculationStatus: "pending",
      productionOrderStatusSnapshot: productionOrder ? "completed" : workLog.productionOrderStatusSnapshot || "",
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    });

    if (productionOrderRef && productionOrder) {
      const currentWorkLogIds = Array.isArray(productionOrder.workLogIds)
        ? productionOrder.workLogIds
        : [];
      const nextWorkLogIds = [...new Set([...currentWorkLogIds, workLog.id])];

      transaction.update(productionOrderRef, {
        status: "completed",
        workLogIds: nextWorkLogIds,
        generatedWorkLogCount: nextWorkLogIds.length,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: actor,
      });
    }
  });

  return id;
};

export const updateWorkLogStatus = async (
  id,
  status,
  currentUser = null,
  extra = {},
) => {
  const ref = doc(db, COLLECTION_NAME, id);

  await updateDoc(ref, {
    status,
    ...extra,
    updatedAt: serverTimestamp(),
    updatedBy:
      currentUser?.email ||
      currentUser?.displayName ||
      currentUser?.uid ||
      "system",
  });

  return id;
};
