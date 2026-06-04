import { createProductionRecord, generateProductionCode, getProductionRecordById, listProductionRecords, updateProductionRecord } from "../../data/adapters/sqlite/sqliteProductionAdapter";
import { commitStockAdjustment } from "../../data/adapters/sqlite/sqliteStockAdjustmentsAdapter";
import { getProductionOrderById } from "./productionOrdersService";
import { validateProductionWorkLogPayload, buildWorkLogDraftFromBom as buildWorkLogDraftFromBomPayload, normalizeProductionWorkLogPayload } from "./helpers/productionWorkLogsServiceHelpers";

const safeTrim = (value) => String(value || "").trim();
const nowIso = () => new Date().toISOString();
export const validateProductionWorkLog = validateProductionWorkLogPayload;
export const getWorkLogReferenceData = async () => ({ productionOrders: [], boms: [], employees: [], steps: [] });
export const buildWorkLogDraftFromBom = (...args) => buildWorkLogDraftFromBomPayload(...args);
export const buildWorkLogDraftFromProductionOrder = async (orderIdOrOrder = {}) => {
  const order = typeof orderIdOrOrder === "string" ? await getProductionOrderById(orderIdOrOrder) : orderIdOrOrder;
  return {
    productionOrderId: order.id || "",
    productionOrderCode: order.code || order.orderCode || "",
    bomId: order.bomId || "",
    bomCode: order.bomCode || "",
    targetType: order.targetType || "product",
    targetId: order.targetId || "",
    targetCode: order.targetCode || "",
    targetName: order.targetName || "",
    plannedQty: Number(order.targetQty || order.quantity || 0),
    status: "in_progress",
    sourceType: "production_order",
  };
};
export const generateProductionWorkLogNumber = async () => generateProductionCode("workLogs");
export const getAllProductionWorkLogs = async () => listProductionRecords("workLogs");
export const getCompletedProductionWorkLogs = async () => (await getAllProductionWorkLogs()).filter((row) => row.status === "completed");
export const getProductionWorkLogById = async (id) => getProductionRecordById("workLogs", id);
export const isProductionWorkLogNumberExists = async (workNumber, excludeId = null) => {
  const normalized = safeTrim(workNumber).toUpperCase();
  return (await getAllProductionWorkLogs()).some((row) => safeTrim(row.workNumber || row.code).toUpperCase() === normalized && String(row.id) !== String(excludeId || ""));
};
export const createProductionWorkLog = async (values, currentUser = null) => createProductionRecord("workLogs", normalizeProductionWorkLogPayload(values, currentUser, false));
export const createProductionWorkLogFromOrder = async (orderIdOrOrder, currentUser = null) => {
  const draft = await buildWorkLogDraftFromProductionOrder(orderIdOrOrder);
  draft.workNumber = draft.workNumber || await generateProductionWorkLogNumber();
  return createProductionWorkLog(draft, currentUser);
};
export const updateProductionWorkLog = async (id, values, currentUser = null) => updateProductionRecord("workLogs", id, normalizeProductionWorkLogPayload(values, currentUser, true));
export const reconcileCompletedWorkLogOutputHpp = async (workLogId) => getProductionWorkLogById(workLogId);
const commitWorkLogStockSideEffects = async (workLog = {}) => {
  const results = [];
  for (const line of Array.isArray(workLog.materialUsages) ? workLog.materialUsages : []) {
    const qty = Number(line.actualQty || line.qty || 0);
    if (!line.itemId || qty <= 0) continue;
    results.push(await commitStockAdjustment({
      sourceType: line.itemType || line.sourceType || "raw_material",
      sourceId: line.itemId,
      variantKey: line.resolvedVariantKey || line.variantKey || "",
      quantity: -Math.abs(qty),
      deltaCurrent: -Math.abs(qty),
      reason: "production_material_usage",
      notes: workLog.workNumber || workLog.code || "Work log production usage",
      referenceNumber: `${workLog.workNumber || workLog.code || workLog.id}_${line.itemId}_usage`,
    }));
  }
  for (const line of Array.isArray(workLog.outputs) ? workLog.outputs : []) {
    const qty = Number(line.goodQty || line.actualQty || 0);
    if (!line.outputIdRef && !line.itemId) continue;
    if (qty <= 0) continue;
    results.push(await commitStockAdjustment({
      sourceType: line.outputType || line.sourceType || workLog.targetType || "semi_finished",
      sourceId: line.outputIdRef || line.itemId,
      variantKey: line.outputVariantKey || line.variantKey || "",
      quantity: Math.abs(qty),
      deltaCurrent: Math.abs(qty),
      reason: "production_output",
      notes: workLog.workNumber || workLog.code || "Work log production output",
      referenceNumber: `${workLog.workNumber || workLog.code || workLog.id}_${line.outputIdRef || line.itemId}_output`,
    }));
  }
  return results;
};
export const completeProductionWorkLog = async (id, currentUser = null) => {
  const current = await getProductionWorkLogById(id);
  const next = { ...current, status: "completed", completedAt: nowIso(), stockConsumptionStatus: "completed", stockOutputStatus: "completed" };
  const stockResults = await commitWorkLogStockSideEffects(next);
  return updateProductionWorkLog(id, { ...next, stockResults }, currentUser);
};
export const updateWorkLogStatus = async (id, status, currentUser = null) => updateProductionWorkLog(id, { ...(await getProductionWorkLogById(id)), status }, currentUser);
