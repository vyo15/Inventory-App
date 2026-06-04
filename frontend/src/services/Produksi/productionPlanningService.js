import { createProductionRecord, generateProductionCode, getProductionRecordById, listProductionRecords, updateProductionRecord } from "../../data/adapters/sqlite/sqliteProductionAdapter";
import { getActiveProductionBoms } from "./productionBomsService";
import { createProductionOrder } from "./productionOrdersService";

const safeTrim = (value) => String(value || "").trim();
const nowIso = () => new Date().toISOString();

export const normalizeProductionPlanStatus = (status = "") => safeTrim(status || "draft").toLowerCase();
export const isProductionPlanPoAllowed = (plan = {}) => !plan.productionOrderId && !plan.orderId && normalizeProductionPlanStatus(plan.status) !== "cancelled";
export const getProductionPlanCancelBlockReason = (plan = {}) => isProductionPlanPoAllowed(plan) ? "" : "Plan sudah memiliki PO atau sudah dibatalkan.";
export const isProductionPlanCancelable = (plan = {}) => !plan.productionOrderId && !plan.orderId && normalizeProductionPlanStatus(plan.status) !== "cancelled";
export const generateProductionPlanCode = async () => generateProductionCode("planning");
export const getProductionPlanningReferenceData = async () => ({ boms: await getActiveProductionBoms().catch(() => []) });
export const calculateProductionPlanStatus = (plan = {}, progress = {}) => progress.status || plan.status || "draft";
export const getAllProductionPlans = async () => listProductionRecords("planning");
export const getProductionPlanById = async (id) => getProductionRecordById("planning", id);

const normalizePayload = (values = {}, currentUser = null, isEdit = false) => {
  const code = safeTrim(values.code || values.planCode || values.referenceNumber).toUpperCase();
  return {
    ...values,
    code,
    planCode: code,
    referenceNumber: code,
    name: values.name || values.description || code,
    status: values.status || "draft",
    planDate: values.planDate || values.date || nowIso(),
    transactionDate: values.planDate || values.date || nowIso(),
    targetQty: Number(values.targetQty || values.quantity || 0),
    updatedAt: nowIso(),
    updatedBy: currentUser?.email || currentUser?.displayName || currentUser?.username || currentUser?.uid || "system",
    ...(!isEdit ? { createdAt: nowIso(), createdBy: currentUser?.email || currentUser?.displayName || currentUser?.username || currentUser?.uid || "system" } : {}),
  };
};

export const createProductionPlan = async (values = {}, currentUser = null) => createProductionRecord("planning", normalizePayload(values, currentUser, false));
export const updateProductionPlan = async (id, values = {}, currentUser = null) => updateProductionRecord("planning", id, normalizePayload(values, currentUser, true));
export const cancelProductionPlan = async (id, currentUser = null) => {
  const current = await getProductionPlanById(id);
  if (!isProductionPlanCancelable(current)) throw new Error(getProductionPlanCancelBlockReason(current));
  return updateProductionPlan(id, { ...current, status: "cancelled", cancelledAt: nowIso() }, currentUser);
};
export const createProductionOrderFromPlan = async ({ planId = "", plan = null, currentUser = null, values = {} } = {}) => {
  const sourcePlan = plan || await getProductionPlanById(planId);
  const order = await createProductionOrder({ ...sourcePlan, ...values, sourcePlanId: sourcePlan.id, status: "draft" }, currentUser);
  await updateProductionPlan(sourcePlan.id, { ...sourcePlan, productionOrderId: order.id, orderId: order.id, status: "ordered" }, currentUser);
  return order;
};
export const getProductionPlanningDashboardSummary = async () => {
  const rows = await getAllProductionPlans();
  return { total: rows.length, draft: rows.filter((r) => r.status === "draft").length, ordered: rows.filter((r) => r.status === "ordered").length, cancelled: rows.filter((r) => r.status === "cancelled").length };
};
