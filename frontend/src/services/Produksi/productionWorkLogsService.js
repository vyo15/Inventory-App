import {
  commitProductionOrderStart,
  commitProductionWorkLogComplete,
  generateProductionCode,
  getProductionRecordById,
  listProductionRecords,
  updateProductionRecord,
} from "../../data/adapters/sqlite/sqliteProductionAdapter";
import {
  getAllProductionOrders,
  getProductionOrderById,
  getProductionOrderReferenceData,
} from "./productionOrdersService";
import { getActiveProductionEmployees } from "./productionEmployeesService";
import { getActiveProductionProfiles } from "./productionProfilesService";
import { getActiveProductionSteps } from "./productionStepsService";
import {
  buildWorkLogDraftFromBom as buildWorkLogDraftFromBomPayload,
  normalizeProductionWorkLogPayload,
  validateProductionWorkLogPayload,
} from "./helpers/productionWorkLogsServiceHelpers";

const safeTrim = (value) => String(value || "").trim();

export const validateProductionWorkLog = validateProductionWorkLogPayload;

export const getWorkLogReferenceData = async () => {
  const loaders = [
    ["inventory", getProductionOrderReferenceData],
    ["productionOrders", getAllProductionOrders],
    ["employees", getActiveProductionEmployees],
    ["productionSteps", getActiveProductionSteps],
    ["productionProfiles", getActiveProductionProfiles],
  ];
  const settled = await Promise.allSettled(loaders.map(([, loader]) => loader()));
  const values = {};
  const metaWarnings = [];

  settled.forEach((result, index) => {
    const [key] = loaders[index];
    if (result.status === "fulfilled") {
      values[key] = result.value;
      return;
    }
    values[key] = key === "inventory" ? {} : [];
    metaWarnings.push(`Referensi ${key} gagal dimuat. Muat ulang sebelum menyelesaikan Work Log.`);
  });

  const inventory = values.inventory || {};
  return {
    boms: Array.isArray(inventory.boms) ? inventory.boms : [],
    productionOrders: Array.isArray(values.productionOrders) ? values.productionOrders : [],
    employees: Array.isArray(values.employees) ? values.employees : [],
    rawMaterials: Array.isArray(inventory.rawMaterials) ? inventory.rawMaterials : [],
    semiFinishedMaterials: Array.isArray(inventory.semiFinishedMaterials) ? inventory.semiFinishedMaterials : [],
    products: Array.isArray(inventory.products) ? inventory.products : [],
    productionSteps: Array.isArray(values.productionSteps) ? values.productionSteps : [],
    productionProfiles: Array.isArray(values.productionProfiles) ? values.productionProfiles : [],
    metaWarnings,
  };
};

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
  return commitProductionWorkLogComplete(id, payload);
};

export const updateWorkLogStatus = async (id, status, currentUser = null) => updateProductionWorkLog(
  id,
  { ...(await getProductionWorkLogById(id)), status },
  currentUser,
);
