import {
  commitProductionOrderStart,
  commitProductionWorkLogComplete,
  generateProductionCode,
  getProductionRecordById,
  listProductionRecords,
  updateProductionRecord,
} from "../../data/adapters/sqlite/sqliteProductionAdapter";
import { getProductionOrderById } from "./productionOrdersService";
import {
  buildWorkLogDraftFromBom as buildWorkLogDraftFromBomPayload,
  normalizeProductionWorkLogPayload,
  validateProductionWorkLogPayload,
} from "./helpers/productionWorkLogsServiceHelpers";

const safeTrim = (value) => String(value || "").trim();

export const validateProductionWorkLog = validateProductionWorkLogPayload;
export const getWorkLogReferenceData = async () => ({ productionOrders: [], boms: [], employees: [], steps: [] });
export const buildWorkLogDraftFromBom = (...args) => buildWorkLogDraftFromBomPayload(...args);

export const buildWorkLogDraftFromProductionOrder = async (orderIdOrOrder = {}) => {
  const order = typeof orderIdOrOrder === "string"
    ? await getProductionOrderById(orderIdOrOrder)
    : orderIdOrOrder;

  return {
    productionOrderId: order.id || "",
    productionOrderCode: order.code || order.orderCode || "",
    bomId: order.bomId || "",
    bomCode: order.bomCode || "",
    targetType: order.targetType || "product",
    targetId: order.targetId || "",
    targetCode: order.targetCode || "",
    targetName: order.targetName || "",
    plannedQty: Number(order.targetQty || order.orderQty || order.quantity || 0),
    status: "in_progress",
    sourceType: "production_order",
  };
};

export const generateProductionWorkLogNumber = async () => generateProductionCode("workLogs");
export const getAllProductionWorkLogs = async () => listProductionRecords("workLogs");

export const getCompletedProductionWorkLogs = async () => {
  const rows = await getAllProductionWorkLogs();
  return rows.filter((row) => row.status === "completed");
};

export const getProductionWorkLogById = async (id) => getProductionRecordById("workLogs", id);

export const isProductionWorkLogNumberExists = async (workNumber, excludeId = null) => {
  const normalized = safeTrim(workNumber).toUpperCase();
  const rows = await getAllProductionWorkLogs();

  return rows.some(
    (row) => safeTrim(row.workNumber || row.code).toUpperCase() === normalized
      && String(row.id) !== String(excludeId || ""),
  );
};

export const createProductionWorkLog = async (values = {}) => {
  const orderId = values.productionOrderId || values.orderId || "";
  if (!orderId) {
    throw new Error("Work Log baru wajib dibuat dari Production Order melalui aksi Mulai Produksi.");
  }
  const result = await commitProductionOrderStart(orderId, values);
  return result?.workLog || result;
};

export const createProductionWorkLogFromOrder = async (
  orderIdOrOrder,
  values = {},
  currentUser = null,
) => {
  const orderId = typeof orderIdOrOrder === "string" ? orderIdOrOrder : orderIdOrOrder?.id;
  if (!orderId) throw new Error("Production Order tidak valid.");
  void currentUser;
  const result = await commitProductionOrderStart(orderId, values || {});
  return result?.workLog || result;
};

export const updateProductionWorkLog = async (id, values, currentUser = null) => updateProductionRecord(
  "workLogs",
  id,
  normalizeProductionWorkLogPayload(values, currentUser, true),
);

export const reconcileCompletedWorkLogOutputHpp = async (workLogId) => getProductionWorkLogById(workLogId);

export const completeProductionWorkLog = async (id, payloadOrUser = {}, currentUser = null) => {
  const looksLikeUser = payloadOrUser && (
    payloadOrUser.email
    || payloadOrUser.displayName
    || payloadOrUser.username
    || payloadOrUser.uid
  ) && !(
    Object.prototype.hasOwnProperty.call(payloadOrUser, "goodQty")
    || Object.prototype.hasOwnProperty.call(payloadOrUser, "outputs")
    || Object.prototype.hasOwnProperty.call(payloadOrUser, "workerIds")
  );
  void currentUser;
  const payload = looksLikeUser ? {} : (payloadOrUser || {});
  const result = await commitProductionWorkLogComplete(id, payload);
  return result?.workLog || result;
};

export const updateWorkLogStatus = async (id, status, currentUser = null) => updateProductionWorkLog(
  id,
  { ...(await getProductionWorkLogById(id)), status },
  currentUser,
);
