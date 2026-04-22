// =====================================================
// Production Flow Guards
// Catatan maintainability:
// - File ini menjadi boundary logic produksi aktif.
// - Patch UI / refactor halaman lain tidak boleh mengubah contract di sini
//   tanpa evaluasi khusus modul produksi.
// =====================================================

export const ACTIVE_PRODUCTION_FLOW = Object.freeze([
  "BOM",
  "Production Order",
  "Work Log",
  "Payroll",
  "HPP Analysis",
]);

export const PRODUCTION_ORDER_STATUSES_ALLOWED_FOR_WORK_LOG_START = Object.freeze([
  "ready",
  "shortage",
]);

export const PRODUCTION_ORDER_STATUSES_VISIBLE_IN_WORK_LOG_REFERENCE = Object.freeze([
  "ready",
  "shortage",
]);

export const LOCKED_PRODUCTION_WORK_LOG_FIELDS = Object.freeze([
  "bomId",
  "bomCode",
  "bomName",
  "bomVersion",
  "productionOrderId",
  "productionOrderCode",
  "productionOrderStatusSnapshot",
  "targetType",
  "targetId",
  "targetCode",
  "targetName",
  "targetUnit",
  "targetHasVariants",
  "targetVariantKey",
  "targetVariantLabel",
  "stepId",
  "stepCode",
  "stepName",
  "sequenceNo",
  "sourceType",
  "startedAt",
]);

const normalizeStatus = (value = "") => String(value || "").trim().toLowerCase();

const safeNumber = (value = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export const hasExistingProductionWorkLog = (order = {}) => {
  const workLogIds = Array.isArray(order?.workLogIds) ? order.workLogIds : [];
  return workLogIds.length > 0 || safeNumber(order?.generatedWorkLogCount || 0) > 0;
};

export const isProductionOrderStartable = (order = {}) =>
  PRODUCTION_ORDER_STATUSES_ALLOWED_FOR_WORK_LOG_START.includes(
    normalizeStatus(order?.status),
  );

export const isProductionOrderVisibleInWorkLogReference = (order = {}) =>
  PRODUCTION_ORDER_STATUSES_VISIBLE_IN_WORK_LOG_REFERENCE.includes(
    normalizeStatus(order?.status),
  ) && !hasExistingProductionWorkLog(order);

export const assertProductionOrderStartable = (order = {}) => {
  if (!isProductionOrderStartable(order)) {
    throw new Error("Hanya PO status Ready/Shortage yang bisa mulai produksi");
  }

  if (hasExistingProductionWorkLog(order)) {
    throw new Error("PO ini sudah punya Work Log");
  }
};

export const isProductionWorkLogCompleted = (workLog = {}) =>
  normalizeStatus(workLog?.status) === "completed" ||
  normalizeStatus(workLog?.stockOutputStatus) === "applied";

export const isProductionWorkLogCoreLocked = (workLog = {}) =>
  Boolean(workLog?.productionOrderId) ||
  normalizeStatus(workLog?.stockConsumptionStatus) === "applied" ||
  normalizeStatus(workLog?.stockOutputStatus) === "applied" ||
  normalizeStatus(workLog?.status) === "completed";

export const assertProductionWorkLogCompletable = (workLog = {}) => {
  if (normalizeStatus(workLog?.status) === "cancelled") {
    throw new Error("Work log dibatalkan dan tidak bisa diselesaikan");
  }

  if (isProductionWorkLogCompleted(workLog)) {
    throw new Error("Work log ini sudah pernah diselesaikan");
  }
};

export const applyLockedWorkLogCoreFields = (current = {}, next = {}) => {
  if (!isProductionWorkLogCoreLocked(current)) {
    return next;
  }

  const result = { ...next };

  LOCKED_PRODUCTION_WORK_LOG_FIELDS.forEach((fieldName) => {
    result[fieldName] = current?.[fieldName];
  });

  if (normalizeStatus(current?.stockConsumptionStatus) === "applied") {
    result.stockConsumptionStatus = "applied";
    result.materialUsages = Array.isArray(current?.materialUsages)
      ? current.materialUsages
      : [];
  }

  if (
    normalizeStatus(current?.stockOutputStatus) === "applied" ||
    normalizeStatus(current?.status) === "completed"
  ) {
    result.status = "completed";
    result.stockOutputStatus = "applied";
    result.outputs = Array.isArray(current?.outputs) ? current.outputs : [];
    result.goodQty = safeNumber(current?.goodQty || 0);
    result.rejectQty = safeNumber(current?.rejectQty || 0);
    result.reworkQty = safeNumber(current?.reworkQty || 0);
    result.scrapQty = safeNumber(current?.scrapQty || 0);
    result.completedAt = current?.completedAt || result.completedAt;
  }

  return result;
};

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

export const sortProductionWorkLogsNewestFirst = (items = []) =>
  [...items].sort((a, b) => {
    const aPrimary = Math.max(
      toComparableTime(a?.workDate),
      toComparableTime(a?.updatedAt),
      toComparableTime(a?.createdAt),
    );
    const bPrimary = Math.max(
      toComparableTime(b?.workDate),
      toComparableTime(b?.updatedAt),
      toComparableTime(b?.createdAt),
    );

    if (bPrimary !== aPrimary) {
      return bPrimary - aPrimary;
    }

    const byNumber =
      extractTrailingNumber(b?.workNumber) - extractTrailingNumber(a?.workNumber);
    if (byNumber !== 0) {
      return byNumber;
    }

    return String(b?.workNumber || "").localeCompare(String(a?.workNumber || ""));
  });
