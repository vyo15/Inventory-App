const {
  fail,
  getRecord,
  listRecords,
  normalizeLower,
  normalizeText,
} = require("./production.shared");

const PRODUCTION_PROTECTED_WRITE_NOTE = [
  "Production database lokal final aktif untuk data runtime baru.",
  "Material usage, payroll paid, dan HPP wajib tetap lewat service/endpoint database lokal",
  "agar audit dan ledger konsisten.",
].join(" ");

const assertDirectUpdateAllowed = ({ entityType, currentPayload = {}, incomingPayload = {}, mergedPayload = {} } = {}) => {
  const currentStatus = normalizeLower(currentPayload.status);
  const nextStatus = normalizeLower(mergedPayload.status);

  if (entityType === "production_planning") {
    if (currentStatus === "cancelled") fail("Planning cancelled tidak dapat diedit.", "PRODUCTION_PLAN_LOCKED", 409);
    if (currentStatus !== nextStatus && ["ordered", "cancelled"].includes(nextStatus)) {
      fail("Perubahan status Planning wajib lewat endpoint create-order/cancel resmi.", "PRODUCTION_LIFECYCLE_WRITE_BLOCKED", 405);
    }
    const currentOrderRef = normalizeText(currentPayload.productionOrderId || currentPayload.orderId || "");
    const nextOrderRef = normalizeText(mergedPayload.productionOrderId || mergedPayload.orderId || "");
    if (currentOrderRef !== nextOrderRef) {
      fail("Relasi Production Order pada Planning wajib dikelola lewat endpoint create-order resmi.", "PRODUCTION_RELATION_WRITE_BLOCKED", 405);
    }
  }

  if (entityType === "production_order") {
    const relationFields = ["workLogId", "workNumber", "startedAt", "completedAt"];
    const relationChanged = relationFields.some(
      (field) => JSON.stringify(currentPayload[field] ?? null) !== JSON.stringify(mergedPayload[field] ?? null),
    );
    if (relationChanged) {
      fail("Relasi dan timestamp lifecycle Production Order wajib dikelola lewat endpoint Start/Complete resmi.", "PRODUCTION_RELATION_WRITE_BLOCKED", 405);
    }
    if (["in_production", "completed"].includes(currentStatus)) {
      const protectedFields = ["bomId", "targetId", "targetType", "orderQty", "targetQty", "requirementLines", "materialRequirementLines"];
      const changed = protectedFields.some((field) => JSON.stringify(currentPayload[field]) !== JSON.stringify(mergedPayload[field]));
      if (changed) fail("Production Order yang sudah berjalan/final tidak dapat mengubah field inti.", "PRODUCTION_ORDER_LOCKED", 409);
    }
    if (currentStatus !== nextStatus && ["in_production", "completed"].includes(nextStatus)) {
      fail("Status Production Order wajib berubah lewat Start/Complete Work Log resmi.", "PRODUCTION_LIFECYCLE_WRITE_BLOCKED", 405);
    }
  }

  if (entityType === "production_work_log") {
    if (currentStatus === "completed") fail("Work Log completed tidak dapat diedit langsung.", "PRODUCTION_WORK_LOG_LOCKED", 409);
    if (currentStatus !== nextStatus && nextStatus === "completed") {
      fail("Work Log wajib diselesaikan lewat endpoint complete resmi.", "PRODUCTION_LIFECYCLE_WRITE_BLOCKED", 405);
    }
    const guardedFields = ["stockConsumptionStatus", "stockOutputStatus", "payrollCalculated", "payrollCalculationStatus"];
    const guardedChanged = guardedFields.some((field) => currentPayload[field] !== mergedPayload[field]);
    if (guardedChanged) fail("Flag stok/payroll Work Log tidak boleh diubah langsung.", "PRODUCTION_LIFECYCLE_WRITE_BLOCKED", 405);

    if (currentPayload.productionOrderId) {
      const frozenFields = [
        "productionOrderId", "productionOrderCode", "bomId", "bomCode", "bomVersion",
        "targetType", "targetId", "targetCode", "targetName", "targetVariantKey",
        "stepId", "stepCode", "stepName", "plannedQty", "theoreticalOutputQty",
        "materialUsages", "outputs", "materialCostActual", "laborCostActual",
        "overheadCostActual", "totalCostActual", "costPerGoodUnit", "payrollIds",
      ];
      const frozenChanged = frozenFields.some(
        (field) => JSON.stringify(currentPayload[field] ?? null) !== JSON.stringify(mergedPayload[field] ?? null),
      );
      if (frozenChanged) {
        fail("Field inti Work Log dari Production Order sudah terkunci setelah Start Production.", "PRODUCTION_WORK_LOG_CORE_LOCKED", 409);
      }
    }
  }

  if (entityType === "production_payroll") {
    if (normalizeLower(currentPayload.paymentStatus) === "paid") {
      fail("Payroll paid tidak dapat diedit langsung.", "PRODUCTION_PAYROLL_LOCKED", 409);
    }
    if (["confirmed", "paid"].includes(nextStatus) || normalizeLower(mergedPayload.paymentStatus) === "paid") {
      if (currentStatus !== nextStatus || normalizeLower(currentPayload.paymentStatus) !== normalizeLower(mergedPayload.paymentStatus)) {
        fail("Payroll confirmed/paid wajib lewat endpoint finalize/mark-paid resmi.", "PRODUCTION_LIFECYCLE_WRITE_BLOCKED", 405);
      }
    }
    const financeFields = ["financeExpenseId", "expenseSyncStatus", "financeResult", "paidAt"];
    const financeChanged = financeFields.some(
      (field) => JSON.stringify(currentPayload[field] ?? null) !== JSON.stringify(mergedPayload[field] ?? null),
    );
    if (financeChanged) {
      fail("Field finance Payroll wajib dikelola lewat endpoint mark-paid resmi.", "PRODUCTION_PAYROLL_FINANCE_LOCKED", 405);
    }
  }

  void incomingPayload;
  return true;
};

const assertDirectCreateAllowed = async ({ db = null, entityType, payload = {} } = {}) => {
  if (entityType === "production_planning") {
    const status = normalizeLower(payload.status || "draft");
    if (status !== "draft") {
      fail("Planning baru wajib dibuat sebagai Draft. Status lifecycle berikutnya dikelola oleh flow resmi.", "PRODUCTION_LIFECYCLE_WRITE_BLOCKED", 405);
    }
    if (payload.productionOrderId || payload.orderId) {
      fail("Planning baru tidak boleh membawa relasi Production Order langsung.", "PRODUCTION_RELATION_WRITE_BLOCKED", 405);
    }
  }

  if (entityType === "production_payroll") {
    const status = normalizeLower(payload.status || "draft");
    const paymentStatus = normalizeLower(payload.paymentStatus || "unpaid");
    if (status !== "draft" || paymentStatus !== "unpaid") {
      fail("Payroll baru wajib dibuat sebagai Draft/Unpaid. Gunakan endpoint finalize/mark-paid untuk lifecycle berikutnya.", "PRODUCTION_LIFECYCLE_WRITE_BLOCKED", 405);
    }
    const forbiddenFinanceFields = ["financeExpenseId", "expenseSyncStatus", "financeResult", "paidAt"];
    if (forbiddenFinanceFields.some((field) => payload[field] != null && payload[field] !== "")) {
      fail("Payroll baru tidak boleh membawa field finance/paid langsung.", "PRODUCTION_PAYROLL_FINANCE_LOCKED", 405);
    }

    const workLogId = normalizeText(payload.workLogId || "");
    const workerId = normalizeText(payload.workerId || "");
    const workerName = normalizeLower(payload.workerName || "");
    const stepId = normalizeText(payload.stepId || "");
    if (!workLogId) fail("Payroll baru wajib terkait Work Log completed.", "PRODUCTION_PAYROLL_WORK_LOG_REQUIRED");
    if (!workerId && !workerName) fail("Payroll baru wajib memiliki operator/karyawan.", "PRODUCTION_PAYROLL_WORKER_REQUIRED");

    if (db) {
      const workLog = await getRecord(db, "production_work_logs", workLogId, "Work Log produksi");
      if (normalizeLower(workLog.status) !== "completed") {
        fail("Payroll hanya dapat dibuat dari Work Log completed.", "PRODUCTION_WORK_LOG_NOT_COMPLETED", 409);
      }
      const duplicate = (await listRecords(db, "production_payrolls")).find((row) => (
        normalizeText(row.workLogId) === workLogId
        && normalizeText(row.stepId || "") === stepId
        && (
          (workerId && normalizeText(row.workerId) === workerId)
          || (!workerId && workerName && normalizeLower(row.workerName) === workerName)
        )
      ));
      if (duplicate) {
        fail("Payroll untuk Work Log, Tahapan, dan Operator yang sama sudah ada.", "PRODUCTION_PAYROLL_DUPLICATE", 409);
      }
    }
  }
  return true;
};

const getProductionRouterDefinitions = () => [
  {
    path: "/steps",
    config: {
      tableName: "production_steps",
      moduleKey: "production",
      entityType: "production_step",
      codePrefix: "STP",
      requiredName: true,
      protectedWriteNote: PRODUCTION_PROTECTED_WRITE_NOTE,
    },
  },
  {
    path: "/employees",
    config: {
      tableName: "production_employees",
      moduleKey: "production",
      entityType: "production_employee",
      codePrefix: "EMP",
      requiredName: true,
      protectedWriteNote: PRODUCTION_PROTECTED_WRITE_NOTE,
    },
  },
  {
    path: "/profiles",
    config: {
      tableName: "production_profiles",
      moduleKey: "production",
      entityType: "production_profile",
      codePrefix: "PRF",
      requiredName: true,
      protectedWriteNote: PRODUCTION_PROTECTED_WRITE_NOTE,
    },
  },
  {
    path: "/boms",
    config: {
      tableName: "production_boms",
      moduleKey: "production",
      entityType: "production_bom",
      codePrefix: "BOM",
      requiredName: false,
      protectedWriteNote: PRODUCTION_PROTECTED_WRITE_NOTE,
    },
  },
  {
    path: "/planning",
    requiresOperationalWriteUser: true,
    config: {
      tableName: "production_planning",
      moduleKey: "production",
      entityType: "production_planning",
      codePrefix: "PLN",
      requiredName: false,
      orderBy: "transaction_date DESC, updated_at DESC",
      protectedWriteNote: PRODUCTION_PROTECTED_WRITE_NOTE,
      allowDirectDelete: false,
      blockedWriteMessage: "Planning produksi tidak boleh dihapus langsung. Gunakan cancel resmi agar histori tetap terjaga.",
      validateDirectCreate: assertDirectCreateAllowed,
      validateDirectUpdate: assertDirectUpdateAllowed,
    },
  },
  {
    path: "/orders",
    requiresOperationalWriteUser: true,
    config: {
      tableName: "production_orders",
      moduleKey: "production",
      entityType: "production_order",
      codePrefix: "PO",
      requiredName: false,
      orderBy: "transaction_date DESC, updated_at DESC",
      protectedWriteNote: PRODUCTION_PROTECTED_WRITE_NOTE,
      allowDirectCreate: false,
      allowDirectDelete: false,
      blockedWriteMessage: "Lifecycle Production Order wajib lewat endpoint commit/start/complete resmi agar BOM, requirement, Planning, stok, dan audit tetap konsisten.",
      validateDirectUpdate: assertDirectUpdateAllowed,
    },
  },
  {
    path: "/work-logs",
    requiresOperationalWriteUser: true,
    config: {
      tableName: "production_work_logs",
      moduleKey: "production",
      entityType: "production_work_log",
      codePrefix: "JOB",
      requiredName: false,
      orderBy: "transaction_date DESC, updated_at DESC",
      protectedWriteNote: PRODUCTION_PROTECTED_WRITE_NOTE,
      allowDirectCreate: false,
      allowDirectDelete: false,
      blockedWriteMessage: "Work Log wajib lewat Start/Complete Production resmi dan tidak boleh dihapus langsung agar histori stok, payroll, dan HPP tetap utuh.",
      validateDirectUpdate: assertDirectUpdateAllowed,
    },
  },
  {
    path: "/payrolls",
    requiresAdministratorRead: true,
    config: {
      tableName: "production_payrolls",
      moduleKey: "production",
      entityType: "production_payroll",
      codePrefix: "PAY",
      requiredName: false,
      orderBy: "transaction_date DESC, updated_at DESC",
      protectedWriteNote: PRODUCTION_PROTECTED_WRITE_NOTE,
      allowDirectDelete: false,
      blockedWriteMessage: "Payroll produksi tidak boleh dihapus langsung. Gunakan lifecycle finalize/mark-paid resmi dan pertahankan histori finance/HPP.",
      validateDirectCreate: assertDirectCreateAllowed,
      validateDirectUpdate: assertDirectUpdateAllowed,
    },
  },
];


module.exports = {
  assertDirectCreateAllowed,
  assertDirectUpdateAllowed,
  getProductionRouterDefinitions,
};
