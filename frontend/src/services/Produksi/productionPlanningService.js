import {
  commitProductionOrderFromPlan,
  commitProductionPlanCancel,
  createProductionRecord,
  generateProductionCode,
  getProductionRecordById,
  listProductionRecords,
  updateProductionRecord,
} from "../../data/adapters/sqlite/sqliteProductionAdapter";
import { getActiveProductionBoms } from "./productionBomsService";

const safeTrim = (value) => String(value || "").trim();
const nowIso = () => new Date().toISOString();
const getActorName = (currentUser = null) => currentUser?.email
  || currentUser?.displayName
  || currentUser?.username
  || currentUser?.uid
  || "system";

export const normalizeProductionPlanStatus = (status = "") => safeTrim(status || "draft").toLowerCase();

export const isProductionPlanPoAllowed = (plan = {}) => !plan.productionOrderId
  && !plan.orderId
  && normalizeProductionPlanStatus(plan.status) !== "cancelled";

export const getProductionPlanCancelBlockReason = (plan = {}) => isProductionPlanPoAllowed(plan)
  ? ""
  : "Plan sudah memiliki PO atau sudah dibatalkan.";

export const isProductionPlanCancelable = (plan = {}) => !plan.productionOrderId
  && !plan.orderId
  && normalizeProductionPlanStatus(plan.status) !== "cancelled";

export const generateProductionPlanCode = async () => generateProductionCode("planning");

export const getProductionPlanningReferenceData = async () => ({
  boms: await getActiveProductionBoms().catch(() => []),
});

export const calculateProductionPlanStatus = (plan = {}, progress = {}) => progress.status
  || plan.status
  || "draft";

export const getAllProductionPlans = async () => listProductionRecords("planning");
export const getProductionPlanById = async (id) => getProductionRecordById("planning", id);

const normalizePayload = (values = {}, currentUser = null, isEdit = false) => {
  const code = safeTrim(values.code || values.planCode || values.referenceNumber).toUpperCase();
  const actorName = getActorName(currentUser);

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
    updatedBy: actorName,
    ...(!isEdit ? { createdAt: nowIso(), createdBy: actorName } : {}),
  };
};

export const createProductionPlan = async (values = {}, currentUser = null) => createProductionRecord(
  "planning",
  normalizePayload(values, currentUser, false)
);

export const updateProductionPlan = async (id, values = {}, currentUser = null) => updateProductionRecord(
  "planning",
  id,
  normalizePayload(values, currentUser, true)
);

export const cancelProductionPlan = async (id) => {
  const current = await getProductionPlanById(id);
  if (!isProductionPlanCancelable(current)) throw new Error(getProductionPlanCancelBlockReason(current));
  return commitProductionPlanCancel(id);
};

export const createProductionOrderFromPlan = async (input = {}) => {
  const planId = input.planId || input.plan?.id || "";
  if (!planId) throw new Error("Planning produksi tidak valid.");

  const { plan, currentUser, values, ...directValues } = input;
  void plan;
  void currentUser;
  const result = await commitProductionOrderFromPlan(planId, {
    ...(values || {}),
    ...directValues,
  });
  return result?.order || result;
};

export const getProductionPlanningDashboardSummary = async () => {
  const rows = await getAllProductionPlans();
  return {
    total: rows.length,
    draft: rows.filter((row) => row.status === "draft").length,
    ordered: rows.filter((row) => row.status === "ordered").length,
    cancelled: rows.filter((row) => row.status === "cancelled").length,
  };
};
