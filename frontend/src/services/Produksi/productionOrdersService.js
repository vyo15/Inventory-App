import { createProductionRecord, generateProductionCode, getProductionRecordById, listProductionRecords, updateProductionRecord } from "../../data/adapters/sqlite/sqliteProductionAdapter";
import { getActiveProductionBoms, getProductionBomById } from "./productionBomsService";
import { getActiveSemiFinishedMaterials } from "./semiFinishedMaterialsService";
import { listenProducts } from "../MasterData/productsService";
import { listenRawMaterials } from "../MasterData/rawMaterialsService";

const safeTrim = (value) => String(value || "").trim();
const nowIso = () => new Date().toISOString();
const onceFromListener = (listener) => new Promise((resolve, reject) => {
  let unsubscribe = null;
  unsubscribe = listener((rows) => { if (unsubscribe) unsubscribe(); resolve(rows || []); }, reject);
});

export const getActiveProductionBomOptions = async (targetType = "product") => (await getActiveProductionBoms()).filter((bom) => !targetType || bom.targetType === targetType);
export const getAllProductionOrders = async () => listProductionRecords("orders");
export const getProductionOrderById = async (id) => getProductionRecordById("orders", id);
export const getProductionBomByIdForOrder = (bomId) => getProductionBomById(bomId);
export const generateProductionOrderCode = async () => generateProductionCode("orders");

export const buildProductionOrderRequirementLines = async ({ bom = {}, targetQty = 0 } = {}) => {
  const lines = Array.isArray(bom.materialLines) ? bom.materialLines : Array.isArray(bom.materials) ? bom.materials : [];
  return lines.map((line, index) => ({
    ...line,
    id: line.id || `req-${index}`,
    requiredQty: Number(line.qtyPerUnit || line.quantityPerUnit || line.qty || 0) * Number(targetQty || 0),
    status: "ready_check_required",
  }));
};

const normalizePayload = (values = {}, currentUser = null, isEdit = false) => {
  const code = safeTrim(values.code || values.orderCode || values.referenceNumber).toUpperCase();
  return {
    ...values,
    code,
    orderCode: code,
    referenceNumber: code,
    name: values.name || values.description || code,
    status: values.status || "draft",
    orderDate: values.orderDate || values.date || nowIso(),
    transactionDate: values.orderDate || values.date || nowIso(),
    targetQty: Number(values.targetQty || values.quantity || 0),
    requirementLines: Array.isArray(values.requirementLines) ? values.requirementLines : [],
    updatedAt: nowIso(),
    updatedBy: currentUser?.email || currentUser?.displayName || currentUser?.username || currentUser?.uid || "system",
    ...(!isEdit ? { createdAt: nowIso(), createdBy: currentUser?.email || currentUser?.displayName || currentUser?.username || currentUser?.uid || "system" } : {}),
  };
};

export const createProductionOrder = async (values = {}, currentUser = null) => {
  let payload = normalizePayload(values, currentUser, false);
  if (!payload.requirementLines.length && payload.bomId) {
    const bom = await getProductionBomById(payload.bomId).catch(() => null);
    if (bom) payload = { ...payload, requirementLines: await buildProductionOrderRequirementLines({ bom, targetQty: payload.targetQty }) };
  }
  return createProductionRecord("orders", payload);
};
export const refreshProductionOrderRequirements = async (orderId, currentUser = null) => {
  const order = await getProductionOrderById(orderId);
  const bom = order.bomId ? await getProductionBomById(order.bomId).catch(() => null) : null;
  const requirementLines = bom ? await buildProductionOrderRequirementLines({ bom, targetQty: order.targetQty }) : order.requirementLines || [];
  return updateProductionRecord("orders", orderId, { ...order, requirementLines, updatedAt: nowIso(), updatedBy: currentUser?.email || currentUser?.username || "system" });
};
export const reserveProductionOrder = async (orderId, currentUser = null) => updateProductionRecord("orders", orderId, { ...(await getProductionOrderById(orderId)), status: "reserved", reservedAt: nowIso(), updatedBy: currentUser?.email || currentUser?.username || "system" });
export const releaseProductionOrderReservation = async (orderId, currentUser = null) => updateProductionRecord("orders", orderId, { ...(await getProductionOrderById(orderId)), status: "draft", reservationReleasedAt: nowIso(), updatedBy: currentUser?.email || currentUser?.username || "system" });
export const markProductionOrderInProduction = async (orderId, currentUser = null) => updateProductionRecord("orders", orderId, { ...(await getProductionOrderById(orderId)), status: "in_production", startedAt: nowIso(), updatedBy: currentUser?.email || currentUser?.username || "system" });
export const getProductionOrderTargetVariantOptions = async () => [];
export const getProductionOrderRequirementPreview = async ({ bomId = "", targetQty = 0 } = {}) => {
  const bom = bomId ? await getProductionBomById(bomId).catch(() => null) : null;
  return { requirementLines: bom ? await buildProductionOrderRequirementLines({ bom, targetQty }) : [] };
};
export const getProductionOrderReferenceData = async () => ({
  boms: await getActiveProductionBoms().catch(() => []),
  products: await onceFromListener(listenProducts).catch(() => []),
  rawMaterials: await onceFromListener(listenRawMaterials).catch(() => []),
  semiFinishedMaterials: await getActiveSemiFinishedMaterials().catch(() => []),
});
