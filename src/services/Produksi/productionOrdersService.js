// =====================================================
// Production Orders Service
// Tujuan:
// - planning produksi untuk semi finished dan product
// - hitung kebutuhan material dari BOM
// - cek shortage
// - reserve stock input
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

const COLLECTION_NAME = "production_orders";

// =====================================================
// Helper umum
// =====================================================
const safeTrim = (value) => String(value || "").trim();

const calculateAvailableStock = (currentStock, reservedStock) => {
  const current = Number(currentStock || 0);
  const reserved = Number(reservedStock || 0);
  return Math.max(current - reserved, 0);
};

const normalizeStockItem = (item = {}) => {
  const currentStock = Number(item.currentStock ?? item.stock ?? 0);
  const reservedStock = Number(item.reservedStock || 0);
  const availableStock = calculateAvailableStock(currentStock, reservedStock);

  return {
    ...item,
    currentStock,
    reservedStock,
    availableStock,
  };
};

// =====================================================
// Ambil BOM aktif untuk target type tertentu
// targetType:
// - semi_finished_material
// - product
// =====================================================
export const getActiveProductionBomOptions = async (targetType = "product") => {
  const q = query(
    collection(db, "production_boms"),
    where("isActive", "==", true),
    where("targetType", "==", targetType),
    orderBy("targetName", "asc"),
    orderBy("version", "desc"),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
};

// =====================================================
// Ambil semua Production Orders
// =====================================================
export const getAllProductionOrders = async () => {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy("createdAt", "desc"),
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
};

// =====================================================
// Ambil Production Order by id
// =====================================================
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

// =====================================================
// Ambil BOM by id
// =====================================================
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

// =====================================================
// Ambil item map berdasarkan target type material
// raw_material -> raw_materials
// semi_finished_material -> semi_finished_materials
// =====================================================
const getMaterialItemByTypeAndId = async (itemType, itemId) => {
  if (!itemId) return null;

  let collectionName = "";

  if (itemType === "raw_material") {
    collectionName = "raw_materials";
  } else if (itemType === "semi_finished_material") {
    collectionName = "semi_finished_materials";
  } else {
    return null;
  }

  const ref = doc(db, collectionName, itemId);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return null;

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
};

// =====================================================
// Hitung requirement lines dari BOM
// Rule:
// - BOM product: input hanya semi_finished_material
// - BOM semi_finished: input boleh raw_material / semi_finished_material
// =====================================================
export const buildProductionOrderRequirementLines = async ({
  bomId,
  orderQty,
}) => {
  const bom = await getProductionBomByIdForOrder(bomId);

  const batchOutputQty = Number(bom.batchOutputQty || 1);
  const multiplier =
    batchOutputQty > 0 ? Number(orderQty || 0) / batchOutputQty : 0;

  const bomMaterialLines = Array.isArray(bom.materialLines)
    ? bom.materialLines
    : [];

  const requirementLines = await Promise.all(
    bomMaterialLines.map(async (line, index) => {
      const itemType = line.itemType || "raw_material";
      const stockItemRaw = await getMaterialItemByTypeAndId(
        itemType,
        line.itemId,
      );
      const stockItem = normalizeStockItem(stockItemRaw || {});

      const qtyPerBatch = Number(line.qtyPerBatch || 0);
      const wastageQty = Number(line.wastageQty || 0);
      const qtyRequired = Math.ceil((qtyPerBatch + wastageQty) * multiplier);

      const currentStockSnapshot = Number(stockItem.currentStock || 0);
      const reservedStockSnapshot = Number(stockItem.reservedStock || 0);
      const availableStockSnapshot = calculateAvailableStock(
        currentStockSnapshot,
        reservedStockSnapshot,
      );

      const shortageQty = Math.max(qtyRequired - availableStockSnapshot, 0);
      const isSufficient = shortageQty <= 0;

      return {
        id: `req-${Date.now()}-${index}`,
        itemType,
        itemId: line.itemId || "",
        itemCode: safeTrim(line.itemCode),
        itemName: safeTrim(line.itemName),
        unit: safeTrim(line.unit) || "pcs",

        qtyPerBatch,
        wastageQty,
        qtyRequired,

        currentStockSnapshot,
        reservedStockSnapshot,
        availableStockSnapshot,

        shortageQty,
        isSufficient,
      };
    }),
  );

  const shortageLines = requirementLines.filter(
    (line) => !line.isSufficient,
  ).length;
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
  };
};

// =====================================================
// Generate kode Production Order
// =====================================================
export const generateProductionOrderCode = async (targetType = "product") => {
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));
  const nextNumber = snapshot.size + 1;

  const prefix = targetType === "semi_finished_material" ? "PO-SFM" : "PO-PRD";

  return `${prefix}-${String(nextNumber).padStart(4, "0")}`;
};

// =====================================================
// Create Production Order
// =====================================================
export const createProductionOrder = async (
  values = {},
  currentUser = null,
) => {
  const orderQty = Number(values.orderQty || 0);
  const targetType = values.targetType || "product";

  if (!targetType) {
    throw {
      type: "validation",
      errors: {
        targetType: "Target type wajib dipilih",
      },
    };
  }

  if (!values.bomId) {
    throw {
      type: "validation",
      errors: {
        bomId: "BOM wajib dipilih",
      },
    };
  }

  if (orderQty <= 0) {
    throw {
      type: "validation",
      errors: {
        orderQty: "Qty order harus lebih dari 0",
      },
    };
  }

  const { bom, requirementLines, reservationSummary } =
    await buildProductionOrderRequirementLines({
      bomId: values.bomId,
      orderQty,
    });

  const code =
    safeTrim(values.code) || (await generateProductionOrderCode(targetType));

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

    orderQty,
    batchOutputQty: Number(bom.batchOutputQty || 1),
    batchMultiplier:
      Number(bom.batchOutputQty || 1) > 0
        ? orderQty / Number(bom.batchOutputQty || 1)
        : 0,

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

// =====================================================
// Refresh requirement lines
// Berguna kalau stok berubah atau BOM direvisi
// =====================================================
export const refreshProductionOrderRequirements = async (
  orderId,
  currentUser = null,
) => {
  const order = await getProductionOrderById(orderId);

  if (!order?.bomId) {
    throw new Error("BOM order tidak ditemukan");
  }

  const { requirementLines, reservationSummary } =
    await buildProductionOrderRequirementLines({
      bomId: order.bomId,
      orderQty: Number(order.orderQty || 0),
    });

  const ref = doc(db, COLLECTION_NAME, orderId);

  await updateDoc(ref, {
    materialRequirementLines: requirementLines,
    reservationSummary,
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

// =====================================================
// Reserve stock dari production order
// semi_finished_material target:
// - reserve raw_material / semi_finished_material sesuai BOM
// product target:
// - reserve semi_finished_material
// =====================================================
export const reserveProductionOrder = async (orderId, currentUser = null) => {
  const orderRef = doc(db, COLLECTION_NAME, orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    throw new Error("Production order tidak ditemukan");
  }

  const order = {
    id: orderSnap.id,
    ...orderSnap.data(),
  };

  const requirementLines = Array.isArray(order.materialRequirementLines)
    ? order.materialRequirementLines
    : [];

  const shortageLines = requirementLines.filter((line) => !line.isSufficient);

  if (shortageLines.length > 0) {
    throw new Error("Order masih shortage dan tidak bisa di-reserve");
  }

  await runTransaction(db, async (transaction) => {
    for (const line of requirementLines) {
      let collectionName = "";

      if (line.itemType === "raw_material") {
        collectionName = "raw_materials";
      } else if (line.itemType === "semi_finished_material") {
        collectionName = "semi_finished_materials";
      } else {
        continue;
      }

      const stockRef = doc(db, collectionName, line.itemId);
      const stockSnap = await transaction.get(stockRef);

      if (!stockSnap.exists()) {
        throw new Error(`Item ${line.itemName} tidak ditemukan`);
      }

      const stockData = normalizeStockItem(stockSnap.data());

      const availableNow = calculateAvailableStock(
        stockData.currentStock,
        stockData.reservedStock,
      );

      if (availableNow < Number(line.qtyRequired || 0)) {
        throw new Error(
          `Stok ${line.itemName} sudah tidak cukup untuk reserve`,
        );
      }

      const nextReserved =
        Number(stockData.reservedStock || 0) + Number(line.qtyRequired || 0);
      const nextAvailable = calculateAvailableStock(
        stockData.currentStock,
        nextReserved,
      );

      transaction.update(stockRef, {
        reservedStock: nextReserved,
        availableStock: nextAvailable,
        updatedAt: serverTimestamp(),
      });
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

// =====================================================
// Release reservasi order
// =====================================================
export const releaseProductionOrderReservation = async (
  orderId,
  currentUser = null,
) => {
  const orderRef = doc(db, COLLECTION_NAME, orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    throw new Error("Production order tidak ditemukan");
  }

  const order = {
    id: orderSnap.id,
    ...orderSnap.data(),
  };

  if (order.status !== "reserved") {
    throw new Error("Hanya order reserved yang bisa dilepas reservasinya");
  }

  const requirementLines = Array.isArray(order.materialRequirementLines)
    ? order.materialRequirementLines
    : [];

  await runTransaction(db, async (transaction) => {
    for (const line of requirementLines) {
      let collectionName = "";

      if (line.itemType === "raw_material") {
        collectionName = "raw_materials";
      } else if (line.itemType === "semi_finished_material") {
        collectionName = "semi_finished_materials";
      } else {
        continue;
      }

      const stockRef = doc(db, collectionName, line.itemId);
      const stockSnap = await transaction.get(stockRef);

      if (!stockSnap.exists()) continue;

      const stockData = normalizeStockItem(stockSnap.data());

      const nextReserved = Math.max(
        Number(stockData.reservedStock || 0) - Number(line.qtyRequired || 0),
        0,
      );

      const nextAvailable = calculateAvailableStock(
        stockData.currentStock,
        nextReserved,
      );

      transaction.update(stockRef, {
        reservedStock: nextReserved,
        availableStock: nextAvailable,
        updatedAt: serverTimestamp(),
      });
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
// Tandai order masuk ke produksi
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
// Complete order
// =====================================================
export const completeProductionOrder = async (orderId, currentUser = null) => {
  const ref = doc(db, COLLECTION_NAME, orderId);

  await updateDoc(ref, {
    status: "completed",
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy:
      currentUser?.email ||
      currentUser?.displayName ||
      currentUser?.uid ||
      "system",
  });

  return orderId;
};
