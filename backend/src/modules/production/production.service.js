const crypto = require("crypto");
const { getDb } = require("../../db/connection");
const { createAuditLog } = require("../../utils/auditLog");
const { safeJsonParse } = require("../../utils/jsonUtils");
const {
  commitStockMutation,
  loadSourceItem,
  matchesVariantReference,
  resolveInventoryVariantCollection,
  upsertJsonRecord,
  upsertStockReadModel,
} = require("../../utils/sqliteStockEngine");
const { createFinanceMovement } = require("../../utils/sqliteFinanceEngine");

const PRODUCTION_PROTECTED_WRITE_NOTE = [
  "Production database lokal final aktif untuk data runtime baru.",
  "Material usage, payroll paid, dan HPP wajib tetap lewat service/endpoint database lokal",
  "agar audit dan ledger konsisten.",
].join(" ");

const normalizeText = (value = "") => String(value ?? "").trim();
const normalizeLower = (value = "") => normalizeText(value).toLowerCase();
const normalizeUpper = (value = "") => normalizeText(value).toUpperCase();
const nowIso = () => new Date().toISOString();
const toNumber = (value = 0) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const toPositiveNumber = (value = 0) => Math.max(0, toNumber(value));
const toPositiveInteger = (value = 0) => Math.max(0, Math.round(toNumber(value)));

class ProductionError extends Error {
  constructor(publicMessage, errorCode = "PRODUCTION_VALIDATION_ERROR", statusCode = 400) {
    super(publicMessage);
    this.publicMessage = publicMessage;
    this.errorCode = errorCode;
    this.statusCode = statusCode;
  }
}

const fail = (message, code = "PRODUCTION_VALIDATION_ERROR", status = 400) => {
  throw new ProductionError(message, code, status);
};

const runProductionTransaction = async (callback) => {
  const db = await getDb();
  try {
    await db.run("BEGIN IMMEDIATE TRANSACTION");
    const result = await callback(db);
    await db.run("COMMIT");
    return result;
  } catch (error) {
    await db.run("ROLLBACK").catch(() => {});
    throw error;
  }
};

const toRecord = (row = {}) => ({
  ...safeJsonParse(row.payload_json, {}),
  id: row.id,
  code: row.code || "",
  name: row.name || "",
  status: row.status || "active",
  isActive: row.is_active === 0 ? false : true,
  currentStock: row.current_stock ?? 0,
  stock: row.current_stock ?? 0,
  reservedStock: row.reserved_stock ?? 0,
  availableStock: row.available_stock ?? 0,
  totalAmount: row.total_amount ?? 0,
  transactionDate: row.transaction_date || null,
  sourceType: row.source_type || null,
  sourceId: row.source_id || null,
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const getRecord = async (db, tableName, id, label) => {
  const row = await db.get(
    `SELECT * FROM ${tableName} WHERE id = ? AND status != 'deleted'`,
    [id],
  );
  if (!row) fail(`${label} database lokal tidak ditemukan.`, "NOT_FOUND", 404);
  return toRecord(row);
};

const listRecords = async (db, tableName) => {
  const rows = await db.all(`SELECT * FROM ${tableName} WHERE status != 'deleted'`);
  return rows.map(toRecord);
};

const getNumericSequenceFromCode = (code = "", prefix = "") => {
  const normalizedCode = normalizeUpper(code);
  const match = normalizedCode.match(new RegExp(`^${normalizeUpper(prefix)}-(\\d+)$`));
  return match ? Number(match[1]) : 0;
};

const generateNextCode = async (db, tableName, prefix) => {
  const rows = await db.all(`SELECT code FROM ${tableName} WHERE code LIKE ?`, [`${normalizeUpper(prefix)}-%`]);
  const maxSequence = rows.reduce(
    (max, row) => Math.max(max, getNumericSequenceFromCode(row.code, prefix)),
    0,
  );
  return `${normalizeUpper(prefix)}-${String(maxSequence + 1).padStart(3, "0")}`;
};

const normalizeSourceType = (value = "") => {
  const normalized = normalizeLower(value);
  if (["raw_material", "raw_materials", "material", "raw"].includes(normalized)) return "raw_material";
  if (["semi_finished", "semi_finished_material", "semi_finished_materials"].includes(normalized)) return "semi_finished";
  if (["product", "products"].includes(normalized)) return "product";
  return normalized || "raw_material";
};

const getSourceTable = (sourceType = "") => {
  const normalized = normalizeSourceType(sourceType);
  if (normalized === "raw_material") return "raw_materials";
  if (normalized === "semi_finished") return "semi_finished_materials";
  if (normalized === "product") return "products";
  fail("Tipe item produksi tidak didukung oleh stock engine.", "PRODUCTION_SOURCE_TYPE_INVALID");
};

const findVariant = (item = {}, variantKey = "") => {
  const normalizedKey = normalizeLower(variantKey);
  if (!normalizedKey) return null;
  const variants = resolveInventoryVariantCollection(item).variants;
  return variants.find((variant) => matchesVariantReference(variant, normalizedKey)) || null;
};

const getMaterialUnitCost = ({ sourceType, item, variantKey = "" } = {}) => {
  const normalizedType = normalizeSourceType(sourceType);
  const variant = findVariant(item, variantKey);
  const candidatesByType = {
    raw_material: ["averageActualUnitCost", "restockReferencePrice"],
    semi_finished: ["averageCostPerUnit", "lastProductionCostPerUnit"],
    product: ["hppPerUnit", "averageCostPerUnit", "costPerUnit"],
  };
  const candidates = candidatesByType[normalizedType] || [];

  for (const source of [variant, item]) {
    if (!source) continue;
    for (const key of candidates) {
      const amount = toPositiveNumber(source[key]);
      if (amount > 0) return { unitCost: amount, costSource: source === variant ? `variant.${key}` : `master.${key}` };
    }
  }

  return { unitCost: 0, costSource: "missing_cost_snapshot" };
};

const calculateRequirementLines = (bom = {}, targetQty = 0) => {
  const lines = Array.isArray(bom.materialLines)
    ? bom.materialLines
    : Array.isArray(bom.materials)
      ? bom.materials
      : [];
  const quantity = toPositiveNumber(targetQty);

  return lines.map((line, index) => {
    const qtyPerUnit = toPositiveNumber(
      line.qtyPerUnit ?? line.quantityPerUnit ?? line.qtyPerBatch ?? line.qty ?? 0,
    );
    const requiredQty = toPositiveNumber(
      line.requiredQty ?? line.qtyRequired ?? line.totalRequiredQty ?? (qtyPerUnit * quantity),
    );
    return {
      ...line,
      id: line.id || `req-${index + 1}`,
      itemType: normalizeSourceType(line.itemType || line.sourceType || "raw_material"),
      itemId: line.itemId || line.sourceId || "",
      itemCode: line.itemCode || line.code || "",
      itemName: line.itemName || line.name || "",
      requiredQty,
      qtyRequired: requiredQty,
      totalRequiredQty: requiredQty,
      status: line.status || "ready_check_required",
    };
  });
};

const buildOrderPayload = async (db, {
  values = {},
  sourcePlan = null,
  actor = "system",
} = {}) => {
  const merged = { ...(sourcePlan || {}), ...(values || {}) };
  const bomId = normalizeText(values.bomId || sourcePlan?.bomId || merged.bomId);
  if (!bomId) fail("Resep Produksi/BOM wajib dipilih sebelum membuat Production Order.", "PRODUCTION_BOM_REQUIRED");
  const bom = await getRecord(db, "production_boms", bomId, "BOM produksi");

  const requestedTargetId = normalizeText(values.targetId || values.targetItemId || "");
  const requestedTargetType = normalizeSourceType(values.targetType || "");
  const bomTargetId = normalizeText(bom.targetId || "");
  const bomTargetType = normalizeSourceType(bom.targetType || "product");
  if (requestedTargetId && bomTargetId && requestedTargetId !== bomTargetId) {
    fail("Target Production Order harus mengikuti target Resep Produksi/BOM yang dipilih.", "PRODUCTION_ORDER_TARGET_MISMATCH", 409);
  }
  if (values.targetType && requestedTargetType !== bomTargetType) {
    fail("Jenis target Production Order harus mengikuti Resep Produksi/BOM yang dipilih.", "PRODUCTION_ORDER_TARGET_TYPE_MISMATCH", 409);
  }

  const orderQty = toPositiveNumber(
    values.orderQty ?? values.targetQty ?? values.quantity ?? sourcePlan?.targetQty ?? sourcePlan?.quantity ?? 0,
  );
  if (orderQty <= 0) fail("Qty Production Order wajib lebih dari 0.", "PRODUCTION_ORDER_QTY_INVALID");

  const code = normalizeUpper(values.code || values.orderCode || values.referenceNumber)
    || await generateNextCode(db, "production_orders", "PO");
  const id = normalizeText(values.id || code || crypto.randomUUID());
  const requirementLines = calculateRequirementLines(bom, orderQty);
  const transactionDate = values.orderDate || values.transactionDate || values.date || nowIso();

  return {
    ...merged,
    id,
    code,
    orderCode: code,
    referenceNumber: code,
    name: values.name || values.description || `Production Order ${code}`,
    status: "draft",
    orderDate: transactionDate,
    transactionDate,
    sourcePlanId: sourcePlan?.id || values.sourcePlanId || "",
    bomId: bom.id,
    bomCode: bom.code || "",
    bomName: bom.name || "",
    bomVersion: bom.version ?? null,
    targetType: bom.targetType || sourcePlan?.targetType || values.targetType || "product",
    targetId: bom.targetId || sourcePlan?.targetId || values.targetId || "",
    targetCode: bom.targetCode || sourcePlan?.targetCode || values.targetCode || "",
    targetName: bom.targetName || sourcePlan?.targetName || values.targetName || "",
    targetUnit: bom.targetUnit || sourcePlan?.targetUnit || values.targetUnit || "pcs",
    targetHasVariants: bom.targetHasVariants === true || sourcePlan?.targetHasVariants === true || values.targetHasVariants === true,
    targetVariantKey: values.targetVariantKey || sourcePlan?.targetVariantKey || "",
    targetVariantLabel: values.targetVariantLabel || sourcePlan?.targetVariantLabel || "",
    orderQty,
    targetQty: orderQty,
    batchCount: toPositiveNumber(values.batchCount || orderQty),
    batchOutputQty: toPositiveNumber(values.batchOutputQty || bom.batchOutputQty || 0),
    expectedOutputQty: toPositiveNumber(values.expectedOutputQty || (toPositiveNumber(bom.batchOutputQty || 0) * orderQty)),
    requirementLines,
    materialRequirementLines: requirementLines,
    priority: values.priority || sourcePlan?.priority || "normal",
    plannedStartDate: values.plannedStartDate || sourcePlan?.plannedStartDate || null,
    plannedEndDate: values.plannedEndDate || sourcePlan?.plannedEndDate || null,
    notes: values.notes || sourcePlan?.notes || "",
    createdAt: values.createdAt || nowIso(),
    createdBy: actor,
    updatedAt: nowIso(),
    updatedBy: actor,
  };
};

const createOrderCommit = async ({ payload = {}, actor = "system" } = {}) => runProductionTransaction(async (db) => {
  const order = await buildOrderPayload(db, { values: payload, actor });
  const duplicate = await db.get("SELECT id FROM production_orders WHERE code = ? AND status != 'deleted'", [order.code]);
  if (duplicate) fail("Kode Production Order sudah digunakan.", "DUPLICATE_CODE", 409);
  const saved = await upsertJsonRecord(db, "production_orders", order);
  await createAuditLog({
    module: "production",
    action: "create_order",
    entityType: "production_order",
    entityId: saved.id,
    actor,
    description: `Production Order ${saved.code || saved.id} dibuat secara atomic`,
    metadata: { bomId: saved.bomId, sourcePlanId: saved.sourcePlanId || null },
  });
  return saved;
});

const createOrderFromPlan = async ({ planId, payload = {}, actor = "system" } = {}) => runProductionTransaction(async (db) => {
  const plan = await getRecord(db, "production_planning", planId, "Planning produksi");
  if (normalizeLower(plan.status) === "cancelled") {
    fail("Planning yang sudah dibatalkan tidak dapat dibuatkan Production Order.", "PRODUCTION_PLAN_CANCELLED", 409);
  }
  if (plan.productionOrderId || plan.orderId) {
    fail("Planning ini sudah memiliki Production Order.", "PRODUCTION_PLAN_ALREADY_ORDERED", 409);
  }

  const order = await buildOrderPayload(db, { values: payload, sourcePlan: plan, actor });
  const duplicate = await db.get("SELECT id FROM production_orders WHERE code = ? AND status != 'deleted'", [order.code]);
  if (duplicate) fail("Kode Production Order sudah digunakan.", "DUPLICATE_CODE", 409);

  const savedOrder = await upsertJsonRecord(db, "production_orders", order);
  const savedPlan = await upsertJsonRecord(db, "production_planning", {
    ...plan,
    productionOrderId: savedOrder.id,
    orderId: savedOrder.id,
    status: "ordered",
    orderedAt: nowIso(),
    updatedAt: nowIso(),
    updatedBy: actor,
  });

  await createAuditLog({
    module: "production",
    action: "create_order_from_plan",
    entityType: "production_planning",
    entityId: plan.id,
    actor,
    description: `Planning ${plan.code || plan.id} dikonversi menjadi Production Order ${savedOrder.code || savedOrder.id}`,
    metadata: { planId: plan.id, productionOrderId: savedOrder.id },
  });

  return { plan: savedPlan, order: savedOrder };
});

const cancelProductionPlan = async ({ planId, actor = "system" } = {}) => runProductionTransaction(async (db) => {
  const plan = await getRecord(db, "production_planning", planId, "Planning produksi");
  if (plan.productionOrderId || plan.orderId) {
    fail("Planning yang sudah memiliki Production Order tidak dapat dibatalkan.", "PRODUCTION_PLAN_HAS_ORDER", 409);
  }
  if (normalizeLower(plan.status) === "cancelled") return plan;

  const saved = await upsertJsonRecord(db, "production_planning", {
    ...plan,
    status: "cancelled",
    cancelledAt: nowIso(),
    updatedAt: nowIso(),
    updatedBy: actor,
  });
  await createAuditLog({
    module: "production",
    action: "cancel_plan",
    entityType: "production_planning",
    entityId: plan.id,
    actor,
    description: `Planning ${plan.code || plan.id} dibatalkan`,
    metadata: { planId: plan.id },
  });
  return saved;
});

const refreshOrderRequirements = async ({ orderId, actor = "system" } = {}) => runProductionTransaction(async (db) => {
  const order = await getRecord(db, "production_orders", orderId, "Production Order");
  if (["in_production", "completed"].includes(normalizeLower(order.status))) {
    fail("Requirement Production Order yang sudah berjalan/final tidak dapat dihitung ulang.", "PRODUCTION_ORDER_LOCKED", 409);
  }
  const bom = await getRecord(db, "production_boms", order.bomId, "BOM produksi");
  const requirementLines = calculateRequirementLines(bom, order.orderQty || order.targetQty || 0);
  const saved = await upsertJsonRecord(db, "production_orders", {
    ...order,
    requirementLines,
    materialRequirementLines: requirementLines,
    requirementRefreshedAt: nowIso(),
    updatedAt: nowIso(),
    updatedBy: actor,
  });
  await createAuditLog({
    module: "production",
    action: "refresh_order_requirements",
    entityType: "production_order",
    entityId: order.id,
    actor,
    description: `Requirement Production Order ${order.code || order.id} dihitung ulang`,
    metadata: { lineCount: requirementLines.length },
  });
  return saved;
});

const buildWorkLogMaterialUsages = async (db, order, actor, workNumber) => {
  const requirementLines = Array.isArray(order.materialRequirementLines) && order.materialRequirementLines.length
    ? order.materialRequirementLines
    : Array.isArray(order.requirementLines)
      ? order.requirementLines
      : [];
  const usages = [];

  for (let index = 0; index < requirementLines.length; index += 1) {
    const line = requirementLines[index] || {};
    const sourceType = normalizeSourceType(line.itemType || line.sourceType || "raw_material");
    const sourceId = normalizeText(line.itemId || line.sourceId);
    const quantity = toPositiveInteger(
      line.actualQty ?? line.requiredQty ?? line.qtyRequired ?? line.totalRequiredQty ?? 0,
    );
    if (!sourceId || quantity <= 0) continue;

    const variantKey = normalizeText(line.resolvedVariantKey || line.variantKey || "");
    const { payload: item } = await loadSourceItem(db, sourceType, sourceId);
    const costSnapshot = getMaterialUnitCost({ sourceType, item, variantKey });
    const mutation = await commitStockMutation(db, {
      sourceType,
      sourceId,
      deltaCurrent: -quantity,
      variantKey,
      referenceNumber: `${workNumber}-${String(index + 1).padStart(2, "0")}-MATERIAL-OUT`,
      reason: "production_material_usage",
      notes: `Material usage ${workNumber}`,
      actor,
      transactionType: "production_material_out",
      transactionPayload: {
        productionOrderId: order.id,
        productionOrderCode: order.code || "",
        workNumber,
        lineId: line.id || `usage-${index + 1}`,
      },
    });

    usages.push({
      ...line,
      id: line.id || `usage-${index + 1}`,
      itemType: sourceType,
      sourceType,
      itemId: sourceId,
      actualQty: quantity,
      plannedQty: quantity,
      resolvedVariantKey: variantKey,
      stockSourceType: variantKey ? "variant" : "master",
      costPerUnitSnapshot: costSnapshot.unitCost,
      totalCostSnapshot: quantity * costSnapshot.unitCost,
      costSource: costSnapshot.costSource,
      stockDeducted: true,
      stockDeductedAt: nowIso(),
      stockMutationReference: mutation.referenceNumber,
      stockBefore: mutation.beforeStock,
      stockAfter: mutation.afterStock,
    });
  }

  return usages;
};

const startProductionOrder = async ({ orderId, payload = {}, actor = "system" } = {}) => runProductionTransaction(async (db) => {
  const order = await getRecord(db, "production_orders", orderId, "Production Order");
  const status = normalizeLower(order.status);
  if (status === "completed") fail("Production Order yang sudah selesai tidak dapat dimulai ulang.", "PRODUCTION_ORDER_COMPLETED", 409);
  if (order.workLogId || status === "in_production") {
    fail("Production Order ini sudah memiliki Work Log aktif.", "PRODUCTION_ORDER_ALREADY_STARTED", 409);
  }

  const existingWorkLogs = await listRecords(db, "production_work_logs");
  if (existingWorkLogs.some((row) => row.productionOrderId === order.id)) {
    fail("Production Order ini sudah memiliki Work Log. Start ulang diblokir agar stok tidak terpotong dua kali.", "PRODUCTION_ORDER_WORK_LOG_EXISTS", 409);
  }

  const bom = await getRecord(db, "production_boms", order.bomId, "BOM produksi");
  const workNumber = normalizeUpper(payload.workNumber || payload.code || payload.referenceNumber)
    || await generateNextCode(db, "production_work_logs", "JOB");
  const stepLines = Array.isArray(bom.stepLines) ? bom.stepLines : [];
  const requestedStepId = normalizeText(payload.stepId || "");
  const requestedStep = requestedStepId
    ? stepLines.find((step) => normalizeText(step.stepId) === requestedStepId)
    : null;
  if (requestedStepId && stepLines.length > 0 && !requestedStep) {
    fail("Tahapan produksi yang dipilih tidak terdaftar pada Resep Produksi/BOM.", "PRODUCTION_STEP_NOT_IN_BOM", 409);
  }
  const chosenStep = requestedStep || stepLines[0] || {};
  const plannedQty = toPositiveNumber(order.batchCount || order.orderQty || order.targetQty || 0);
  const materialUsages = await buildWorkLogMaterialUsages(db, order, actor, workNumber);
  const materialCostActual = materialUsages.reduce((sum, line) => sum + toPositiveNumber(line.totalCostSnapshot), 0);
  const overheadCostActual = toPositiveNumber(
    payload.overheadCostActual ?? order.overheadCostActual ?? (toPositiveNumber(bom.overheadCostEstimate) * Math.max(1, plannedQty)),
  );
  const workLogId = normalizeText(payload.id || workNumber || crypto.randomUUID());
  const startedAt = nowIso();
  const output = {
    id: `output-${workLogId}-1`,
    outputType: normalizeSourceType(order.targetType || bom.targetType || "product"),
    outputIdRef: order.targetId || bom.targetId || "",
    outputCode: order.targetCode || bom.targetCode || "",
    outputName: order.targetName || bom.targetName || "",
    unit: order.targetUnit || bom.targetUnit || "pcs",
    goodQty: 0,
    rejectQty: 0,
    reworkQty: 0,
    outputHasVariants: order.targetHasVariants === true,
    outputVariantKey: order.targetVariantKey || "",
    outputVariantLabel: order.targetVariantLabel || "",
    stockSourceType: order.targetVariantKey ? "variant" : "master",
    stockAdded: false,
    stockAddedAt: null,
    costPerUnit: 0,
  };
  const workLog = {
    ...payload,
    id: workLogId,
    code: workNumber,
    workNumber,
    referenceNumber: workNumber,
    name: payload.name || `Work Log ${workNumber}`,
    workDate: payload.workDate || startedAt,
    transactionDate: payload.workDate || startedAt,
    status: "in_progress",
    sourceType: "production_order",
    productionOrderId: order.id,
    productionOrderCode: order.code || "",
    productionOrderStatusSnapshot: order.status || "",
    bomId: bom.id,
    bomCode: bom.code || "",
    bomName: bom.name || "",
    bomVersion: bom.version ?? null,
    targetType: order.targetType || bom.targetType || "product",
    targetId: order.targetId || bom.targetId || "",
    targetCode: order.targetCode || bom.targetCode || "",
    targetName: order.targetName || bom.targetName || "",
    targetUnit: order.targetUnit || bom.targetUnit || "pcs",
    targetHasVariants: order.targetHasVariants === true,
    targetVariantKey: order.targetVariantKey || "",
    targetVariantLabel: order.targetVariantLabel || "",
    stepId: chosenStep.stepId || payload.stepId || "",
    stepCode: chosenStep.stepCode || payload.stepCode || "",
    stepName: chosenStep.stepName || payload.stepName || "",
    sequenceNo: toPositiveInteger(chosenStep.sequenceNo || payload.sequenceNo || 1),
    stepProcessType: chosenStep.processType || "",
    stepPayrollMode: chosenStep.payrollMode || "per_qty",
    stepPayrollRate: toPositiveNumber(chosenStep.payrollRate),
    stepPayrollQtyBase: Math.max(1, toPositiveNumber(chosenStep.payrollQtyBase || 1)),
    stepPayrollOutputBasis: chosenStep.payrollOutputBasis || "good_qty",
    stepPayrollClassification: chosenStep.payrollClassification || "direct_labor",
    stepPayrollIncludeInHpp: chosenStep.includePayrollInHpp !== false,
    plannedQty,
    theoreticalOutputQty: toPositiveNumber(order.expectedOutputQty || (toPositiveNumber(order.batchOutputQty) * plannedQty)),
    actualOutputQty: 0,
    goodQty: 0,
    rejectQty: 0,
    reworkQty: 0,
    scrapQty: 0,
    materialUsages,
    outputs: [output],
    materialCostActual,
    laborCostActual: 0,
    overheadCostActual,
    totalCostActual: materialCostActual + overheadCostActual,
    costPerGoodUnit: 0,
    stockConsumptionStatus: "completed",
    stockOutputStatus: "pending",
    payrollCalculated: false,
    payrollCalculationStatus: "pending",
    startedAt,
    createdAt: startedAt,
    createdBy: actor,
    updatedAt: startedAt,
    updatedBy: actor,
  };

  const savedWorkLog = await upsertJsonRecord(db, "production_work_logs", workLog);
  const savedOrder = await upsertJsonRecord(db, "production_orders", {
    ...order,
    status: "in_production",
    workLogId: savedWorkLog.id,
    workNumber: savedWorkLog.workNumber,
    startedAt,
    updatedAt: startedAt,
    updatedBy: actor,
  });

  await createAuditLog({
    module: "production",
    action: "start_production",
    entityType: "production_order",
    entityId: order.id,
    actor,
    description: `Production Order ${order.code || order.id} dimulai dan Work Log ${savedWorkLog.workNumber} dibuat`,
    metadata: { workLogId: savedWorkLog.id, materialLineCount: materialUsages.length },
  });

  return { order: savedOrder, workLog: savedWorkLog };
});

const getPayrollRule = async (db, workLog = {}) => {
  let step = null;
  if (workLog.stepId) {
    const row = await db.get("SELECT * FROM production_steps WHERE id = ? AND status != 'deleted'", [workLog.stepId]);
    if (row) step = toRecord(row);
  }
  const payrollClassification = step?.payrollClassification
    || workLog.stepPayrollClassification
    || ((step?.processType || workLog.stepProcessType) === "support_process" ? "support_fulfillment" : "direct_labor");
  return {
    step,
    payrollMode: (step?.payrollMode || workLog.stepPayrollMode) === "per_batch" ? "per_batch" : "per_qty",
    payrollRate: toPositiveNumber(step?.payrollRate ?? workLog.stepPayrollRate ?? 0),
    payrollQtyBase: Math.max(1, toPositiveNumber(step?.payrollQtyBase ?? workLog.stepPayrollQtyBase ?? 1)),
    payrollOutputBasis: (step?.payrollOutputBasis || workLog.stepPayrollOutputBasis) === "actual_output_qty" ? "actual_output_qty" : "good_qty",
    payrollClassification,
    includePayrollInHpp: typeof step?.includePayrollInHpp === "boolean"
      ? step.includePayrollInHpp
      : typeof workLog.stepPayrollIncludeInHpp === "boolean"
        ? workLog.stepPayrollIncludeInHpp
        : payrollClassification === "direct_labor",
  };
};

const getWorkersForWorkLog = async (db, workLog = {}) => {
  const ids = Array.isArray(workLog.workerIds) ? workLog.workerIds.filter(Boolean) : [];
  const names = Array.isArray(workLog.workerNames) ? workLog.workerNames.filter(Boolean) : [];
  const codes = Array.isArray(workLog.workerCodes) ? workLog.workerCodes.filter(Boolean) : [];
  const employeeRows = await listRecords(db, "production_employees");
  const workers = [];

  ids.forEach((id, index) => {
    const employee = employeeRows.find((row) => row.id === id);
    workers.push({
      id,
      code: employee?.code || codes[index] || "",
      name: employee?.name || names[index] || id,
    });
  });

  if (!workers.length) {
    names.forEach((name, index) => workers.push({
      id: `name:${normalizeLower(name)}`,
      code: codes[index] || "",
      name,
    }));
  }

  return workers;
};

const calculatePayrollLineAmounts = ({ workLog, rule } = {}) => {
  const goodQty = toPositiveNumber(workLog.goodQty);
  const actualOutputQty = toPositiveNumber(workLog.actualOutputQty || goodQty);
  const outputQtyUsed = rule.payrollOutputBasis === "actual_output_qty" ? actualOutputQty : goodQty;
  const workedQty = rule.payrollMode === "per_batch" ? toPositiveNumber(workLog.plannedQty) : outputQtyUsed;
  const payableQtyFactor = rule.payrollMode === "per_batch"
    ? workedQty
    : (rule.payrollQtyBase > 0 ? outputQtyUsed / rule.payrollQtyBase : 0);
  const amountCalculated = Math.max(0, payableQtyFactor * rule.payrollRate);
  return {
    outputQtyUsed,
    workedQty,
    payableQtyFactor,
    amountCalculated,
    finalAmount: Math.round(amountCalculated),
  };
};

const generatePayrollLinesInTransaction = async (db, {
  workLog,
  actor = "system",
} = {}) => {
  if (normalizeLower(workLog.status) !== "completed") {
    fail("Payroll hanya dapat dibuat dari Work Log completed.", "PRODUCTION_WORK_LOG_NOT_COMPLETED", 409);
  }

  const rule = await getPayrollRule(db, workLog);
  const workers = await getWorkersForWorkLog(db, workLog);
  if (rule.includePayrollInHpp && workers.length === 0) {
    fail("Operator produksi wajib dipilih sebelum Work Log diselesaikan.", "PRODUCTION_WORKER_REQUIRED");
  }
  if (workers.length > 0 && rule.payrollRate <= 0) {
    fail("Tarif payroll Tahapan Produksi masih 0.", "PRODUCTION_PAYROLL_RATE_INVALID");
  }
  if (workers.length > 0 && toPositiveNumber(workLog.goodQty) <= 0 && rule.payrollMode === "per_qty") {
    fail("Good Qty harus lebih dari 0 untuk payroll per qty.", "PRODUCTION_GOOD_QTY_INVALID");
  }

  const existingPayrolls = await listRecords(db, "production_payrolls");
  const amounts = calculatePayrollLineAmounts({ workLog, rule });
  const created = [];
  const skipped = [];

  for (const worker of workers) {
    const existing = existingPayrolls.find((row) => (
      row.workLogId === workLog.id
      && normalizeText(row.workerId) === normalizeText(worker.id)
      && normalizeText(row.stepId) === normalizeText(workLog.stepId)
    ));
    if (existing) {
      skipped.push(existing);
      continue;
    }

    const payrollNumber = await generateNextCode(db, "production_payrolls", "PAY");
    const payroll = {
      id: payrollNumber,
      code: payrollNumber,
      payrollNumber,
      referenceNumber: payrollNumber,
      name: worker.name || payrollNumber,
      payrollDate: nowIso(),
      transactionDate: nowIso(),
      workLogId: workLog.id,
      workNumber: workLog.workNumber || workLog.code || "",
      bomId: workLog.bomId || "",
      bomCode: workLog.bomCode || "",
      targetType: workLog.targetType || "",
      targetId: workLog.targetId || "",
      targetCode: workLog.targetCode || "",
      targetName: workLog.targetName || "",
      stepId: workLog.stepId || "",
      stepCode: workLog.stepCode || "",
      stepName: workLog.stepName || "",
      workerLineKey: `${workLog.id}:${workLog.stepId || "step"}:${worker.id}`,
      workerId: worker.id,
      workerCode: worker.code,
      workerName: worker.name,
      payrollMode: rule.payrollMode,
      payrollRate: rule.payrollRate,
      payrollQtyBase: rule.payrollQtyBase,
      payrollOutputBasis: rule.payrollOutputBasis,
      payrollClassification: rule.payrollClassification,
      includePayrollInHpp: rule.includePayrollInHpp,
      totalWorkLogOutputQty: toPositiveNumber(workLog.goodQty),
      outputQtyUsed: amounts.outputQtyUsed,
      workedQty: amounts.workedQty,
      payableQtyFactor: amounts.payableQtyFactor,
      amountCalculated: amounts.amountCalculated,
      bonusAmount: 0,
      deductionAmount: 0,
      finalAmount: amounts.finalAmount,
      totalAmount: amounts.finalAmount,
      status: "draft",
      paymentStatus: "unpaid",
      payrollRuleSource: rule.step?.id ? "production_step_master" : "work_log_step_snapshot",
      createdAt: nowIso(),
      createdBy: actor,
      updatedAt: nowIso(),
      updatedBy: actor,
    };
    created.push(await upsertJsonRecord(db, "production_payrolls", payroll));
  }

  return {
    created,
    skipped,
    createdCount: created.length,
    skippedCount: skipped.length,
    payrollIds: [...created, ...skipped].map((row) => row.id),
    accruedLaborAmount: workers.length * amounts.finalAmount,
    accruedLaborHppAmount: rule.includePayrollInHpp ? workers.length * amounts.finalAmount : 0,
    rule,
  };
};

const reconcileAverageUnitCost = ({
  currentStock = 0,
  currentUnitCost = 0,
  affectedQty = 0,
  previousUnitCost = 0,
  nextUnitCost = 0,
} = {}) => {
  const stock = toPositiveNumber(currentStock);
  const currentCost = toPositiveNumber(currentUnitCost);
  const qty = toPositiveNumber(affectedQty);
  const previousCost = toPositiveNumber(previousUnitCost);
  const nextCost = toPositiveNumber(nextUnitCost);
  if (nextCost <= 0) return currentCost;
  if (stock <= 0 || stock <= qty || currentCost <= 0) return nextCost;
  return Math.max(0, currentCost + ((qty * (nextCost - previousCost)) / stock));
};

const calculateWeightedVariantCost = (variants = [], field) => {
  const active = (Array.isArray(variants) ? variants : []).filter((variant) => variant?.isArchived !== true && variant?.isActive !== false);
  const weighted = active.reduce((acc, variant) => {
    const stock = toPositiveNumber(variant.currentStock ?? variant.stock ?? 0);
    const cost = toPositiveNumber(variant[field]);
    if (stock > 0 && cost > 0) {
      acc.qty += stock;
      acc.total += stock * cost;
    }
    return acc;
  }, { qty: 0, total: 0 });
  return weighted.qty > 0 ? weighted.total / weighted.qty : 0;
};

const reconcileOutputCost = async (db, {
  sourceType,
  sourceId,
  variantKey = "",
  affectedQty,
  previousUnitCost,
  nextUnitCost,
} = {}) => {
  const normalizedType = normalizeSourceType(sourceType);
  const { tableName, payload: item } = await loadSourceItem(db, normalizedType, sourceId);
  const field = tableName === "products" ? "hppPerUnit" : "averageCostPerUnit";
  const variant = findVariant(item, variantKey);
  let nextItem = { ...item };

  if (variantKey) {
    if (!variant) fail("Varian output produksi tidak ditemukan.", "PRODUCTION_OUTPUT_VARIANT_NOT_FOUND", 409);
    const variants = resolveInventoryVariantCollection(item).variants.map((row) => {
      if (row !== variant) return row;
      return {
        ...row,
        [field]: reconcileAverageUnitCost({
          currentStock: row.currentStock ?? row.stock ?? 0,
          currentUnitCost: row[field] || 0,
          affectedQty,
          previousUnitCost,
          nextUnitCost,
        }),
      };
    });
    nextItem = {
      ...nextItem,
      variants,
      variantOptions: Array.isArray(item.variantOptions) ? variants : item.variantOptions,
      [field]: calculateWeightedVariantCost(variants, field),
    };
  } else {
    nextItem[field] = reconcileAverageUnitCost({
      currentStock: item.currentStock ?? item.stock ?? 0,
      currentUnitCost: item[field] || 0,
      affectedQty,
      previousUnitCost,
      nextUnitCost,
    });
  }

  if (tableName === "semi_finished_materials") {
    nextItem.lastProductionCostPerUnit = toPositiveNumber(nextUnitCost);
  }
  const saved = await upsertJsonRecord(db, tableName, nextItem);
  await upsertStockReadModel(db, saved, {
    sourceCollection: tableName,
    sourceType: normalizedType,
    lastSyncedFrom: "production_hpp_reconcile",
  });
  return saved;
};

const getMaterialCostTotal = (workLog = {}) => (Array.isArray(workLog.materialUsages) ? workLog.materialUsages : [])
  .reduce((sum, line) => sum + toPositiveNumber(
    line.totalCostSnapshot || (toPositiveNumber(line.actualQty) * toPositiveNumber(line.costPerUnitSnapshot)),
  ), 0);

const ensureLegacyMaterialsConsumed = async (db, workLog, actor) => {
  const lines = Array.isArray(workLog.materialUsages) ? workLog.materialUsages : [];
  const nextLines = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] || {};
    if (line.stockDeducted === true) {
      nextLines.push(line);
      continue;
    }
    const sourceType = normalizeSourceType(line.itemType || line.sourceType || "raw_material");
    const sourceId = normalizeText(line.itemId || line.sourceId);
    const quantity = toPositiveInteger(line.actualQty || line.plannedQty || 0);
    if (!sourceId || quantity <= 0) {
      nextLines.push(line);
      continue;
    }
    const variantKey = normalizeText(line.resolvedVariantKey || line.variantKey || "");
    const { payload: item } = await loadSourceItem(db, sourceType, sourceId);
    const cost = getMaterialUnitCost({ sourceType, item, variantKey });
    const mutation = await commitStockMutation(db, {
      sourceType,
      sourceId,
      deltaCurrent: -quantity,
      variantKey,
      referenceNumber: `${workLog.workNumber || workLog.code || workLog.id}-${String(index + 1).padStart(2, "0")}-LEGACY-MATERIAL-OUT`,
      reason: "production_material_usage",
      notes: `Legacy material completion ${workLog.workNumber || workLog.id}`,
      actor,
      transactionType: "production_material_out",
      transactionPayload: { workLogId: workLog.id, productionOrderId: workLog.productionOrderId || "" },
    });
    nextLines.push({
      ...line,
      itemType: sourceType,
      actualQty: quantity,
      costPerUnitSnapshot: toPositiveNumber(line.costPerUnitSnapshot) || cost.unitCost,
      totalCostSnapshot: toPositiveNumber(line.totalCostSnapshot) || (quantity * cost.unitCost),
      costSource: line.costSource || cost.costSource,
      stockDeducted: true,
      stockDeductedAt: nowIso(),
      stockMutationReference: mutation.referenceNumber,
    });
  }
  return nextLines;
};

const completeProductionWorkLog = async ({ workLogId, payload = {}, actor = "system" } = {}) => runProductionTransaction(async (db) => {
  const current = await getRecord(db, "production_work_logs", workLogId, "Work Log produksi");
  if (normalizeLower(current.status) === "completed") {
    fail("Work Log sudah completed dan tidak dapat diselesaikan ulang.", "PRODUCTION_WORK_LOG_ALREADY_COMPLETED", 409);
  }

  const completionPayload = payload || {};
  const workLog = {
    ...current,
    goodQty: completionPayload.goodQty ?? current.goodQty ?? 0,
    actualOutputQty: completionPayload.actualOutputQty
      ?? completionPayload.goodQty
      ?? current.actualOutputQty
      ?? current.goodQty
      ?? 0,
    rejectQty: completionPayload.rejectQty ?? current.rejectQty ?? 0,
    reworkQty: completionPayload.reworkQty ?? current.reworkQty ?? 0,
    scrapQty: completionPayload.scrapQty ?? current.scrapQty ?? 0,
    workerIds: Array.isArray(completionPayload.workerIds) ? completionPayload.workerIds : current.workerIds,
    workerNames: Array.isArray(completionPayload.workerNames) ? completionPayload.workerNames : current.workerNames,
    workerCodes: Array.isArray(completionPayload.workerCodes) ? completionPayload.workerCodes : current.workerCodes,
    workerCount: Array.isArray(completionPayload.workerIds)
      ? completionPayload.workerIds.length
      : current.workerCount,
    notes: Object.prototype.hasOwnProperty.call(completionPayload, "notes")
      ? completionPayload.notes
      : current.notes,
    id: current.id,
    code: current.code,
    workNumber: current.workNumber || current.code,
    productionOrderId: current.productionOrderId,
    status: "completed",
  };
  workLog.goodQty = toPositiveInteger(workLog.goodQty || 0);
  workLog.actualOutputQty = toPositiveInteger(workLog.actualOutputQty || workLog.goodQty);
  if (workLog.goodQty <= 0) fail("Good Qty wajib lebih dari 0 sebelum Work Log diselesaikan.", "PRODUCTION_GOOD_QTY_INVALID");

  workLog.materialUsages = await ensureLegacyMaterialsConsumed(db, workLog, actor);
  const materialCostActual = getMaterialCostTotal(workLog);
  const completedAt = nowIso();

  const temporaryCompleted = {
    ...workLog,
    status: "completed",
    completedAt,
    materialCostActual,
  };
  const payrollResult = await generatePayrollLinesInTransaction(db, { workLog: temporaryCompleted, actor });
  const laborCostActual = payrollResult.accruedLaborHppAmount;
  const overheadCostActual = toPositiveNumber(workLog.overheadCostActual);
  const totalCostActual = materialCostActual + laborCostActual + overheadCostActual;
  const costPerGoodUnit = workLog.goodQty > 0 ? totalCostActual / workLog.goodQty : 0;

  const sourceOutputs = Array.isArray(workLog.outputs) && workLog.outputs.length
    ? workLog.outputs
    : [{
      outputType: workLog.targetType,
      outputIdRef: workLog.targetId,
      outputCode: workLog.targetCode,
      outputName: workLog.targetName,
      outputVariantKey: workLog.targetVariantKey,
      outputVariantLabel: workLog.targetVariantLabel,
    }];
  const outputs = [];

  for (let index = 0; index < sourceOutputs.length; index += 1) {
    const line = sourceOutputs[index] || {};
    if (line.stockAdded === true) {
      outputs.push(line);
      continue;
    }
    const sourceType = normalizeSourceType(line.outputType || line.sourceType || workLog.targetType || "product");
    const sourceId = normalizeText(line.outputIdRef || line.itemId || workLog.targetId);
    const quantity = toPositiveInteger(line.goodQty || (sourceOutputs.length === 1 ? workLog.goodQty : 0));
    if (!sourceId || quantity <= 0) continue;
    const variantKey = normalizeText(line.outputVariantKey || line.variantKey || workLog.targetVariantKey || "");
    const mutation = await commitStockMutation(db, {
      sourceType,
      sourceId,
      deltaCurrent: quantity,
      variantKey,
      referenceNumber: `${workLog.workNumber || workLog.id}-${String(index + 1).padStart(2, "0")}-OUTPUT-IN`,
      reason: "production_output",
      notes: `Output produksi ${workLog.workNumber || workLog.id}`,
      actor,
      transactionType: "production_output_in",
      transactionPayload: { workLogId: workLog.id, productionOrderId: workLog.productionOrderId || "" },
    });
    await reconcileOutputCost(db, {
      sourceType,
      sourceId,
      variantKey,
      affectedQty: quantity,
      previousUnitCost: 0,
      nextUnitCost: costPerGoodUnit,
    });
    outputs.push({
      ...line,
      outputType: sourceType,
      outputIdRef: sourceId,
      goodQty: quantity,
      outputVariantKey: variantKey,
      stockSourceType: variantKey ? "variant" : "master",
      costPerUnit: costPerGoodUnit,
      stockAdded: true,
      stockAddedAt: completedAt,
      stockMutationReference: mutation.referenceNumber,
      stockBefore: mutation.beforeStock,
      stockAfter: mutation.afterStock,
    });
  }

  if (!outputs.some((line) => line.stockAdded === true)) {
    fail("Output Work Log tidak valid atau qty output masih 0.", "PRODUCTION_OUTPUT_INVALID");
  }

  const savedWorkLog = await upsertJsonRecord(db, "production_work_logs", {
    ...workLog,
    materialUsages: workLog.materialUsages,
    outputs,
    status: "completed",
    completedAt,
    materialCostActual,
    laborCostActual,
    overheadCostActual,
    totalCostActual,
    costPerGoodUnit,
    stockConsumptionStatus: "completed",
    stockOutputStatus: "completed",
    payrollCalculated: true,
    payrollCalculationStatus: "generated",
    payrollIds: payrollResult.payrollIds,
    updatedAt: completedAt,
    updatedBy: actor,
  });

  let savedOrder = null;
  if (workLog.productionOrderId) {
    const order = await getRecord(db, "production_orders", workLog.productionOrderId, "Production Order");
    savedOrder = await upsertJsonRecord(db, "production_orders", {
      ...order,
      status: "completed",
      completedAt,
      workLogId: savedWorkLog.id,
      workNumber: savedWorkLog.workNumber,
      updatedAt: completedAt,
      updatedBy: actor,
    });
  }

  await createAuditLog({
    module: "production",
    action: "complete_work_log",
    entityType: "production_work_log",
    entityId: savedWorkLog.id,
    actor,
    description: `Work Log ${savedWorkLog.workNumber || savedWorkLog.id} completed secara atomic`,
    metadata: {
      productionOrderId: savedWorkLog.productionOrderId || null,
      goodQty: savedWorkLog.goodQty,
      outputCount: outputs.length,
      payrollCreatedCount: payrollResult.createdCount,
      payrollSkippedCount: payrollResult.skippedCount,
      totalCostActual,
      costPerGoodUnit,
    },
  });

  return {
    workLog: savedWorkLog,
    order: savedOrder,
    payroll: {
      createdCount: payrollResult.createdCount,
      skippedCount: payrollResult.skippedCount,
      payrollIds: payrollResult.payrollIds,
    },
  };
});

const generatePayrollLines = async ({ workLogId, actor = "system" } = {}) => runProductionTransaction(async (db) => {
  const workLog = await getRecord(db, "production_work_logs", workLogId, "Work Log produksi");
  const result = await generatePayrollLinesInTransaction(db, { workLog, actor });
  const savedWorkLog = await upsertJsonRecord(db, "production_work_logs", {
    ...workLog,
    payrollCalculated: true,
    payrollCalculationStatus: "generated",
    payrollIds: result.payrollIds,
    updatedAt: nowIso(),
    updatedBy: actor,
  });
  await createAuditLog({
    module: "production",
    action: "generate_payroll",
    entityType: "production_work_log",
    entityId: workLog.id,
    actor,
    description: `Payroll Work Log ${workLog.workNumber || workLog.id} diproses secara atomic`,
    metadata: { createdCount: result.createdCount, skippedCount: result.skippedCount },
  });
  return {
    workLog: savedWorkLog,
    createdCount: result.createdCount,
    skippedCount: result.skippedCount,
    payrollIds: result.payrollIds,
  };
});

const getEffectiveLaborCost = (payrolls = []) => payrolls.reduce((sum, payroll) => {
  if (payroll.includePayrollInHpp === false) return sum;
  const isFinal = ["confirmed", "paid"].includes(normalizeLower(payroll.status))
    || normalizeLower(payroll.paymentStatus) === "paid";
  const amount = isFinal
    ? toPositiveNumber(payroll.finalAmount)
    : toPositiveNumber(payroll.amountCalculated ?? payroll.finalAmount);
  return sum + amount;
}, 0);

const reconcileWorkLogHppFromPayroll = async (db, workLogId, actor) => {
  if (!workLogId) return null;
  const workLog = await getRecord(db, "production_work_logs", workLogId, "Work Log produksi");
  const payrolls = (await listRecords(db, "production_payrolls")).filter((row) => row.workLogId === workLog.id);
  const previousUnitCost = toPositiveNumber(workLog.costPerGoodUnit);
  const laborCostActual = getEffectiveLaborCost(payrolls);
  const materialCostActual = getMaterialCostTotal(workLog);
  const overheadCostActual = toPositiveNumber(workLog.overheadCostActual);
  const totalCostActual = materialCostActual + laborCostActual + overheadCostActual;
  const goodQty = toPositiveNumber(workLog.goodQty);
  const nextUnitCost = goodQty > 0 ? totalCostActual / goodQty : 0;
  const outputs = [];

  for (const line of Array.isArray(workLog.outputs) ? workLog.outputs : []) {
    const quantity = toPositiveNumber(line.goodQty);
    const sourceId = normalizeText(line.outputIdRef || line.itemId);
    if (line.stockAdded === true && sourceId && quantity > 0) {
      await reconcileOutputCost(db, {
        sourceType: line.outputType || line.sourceType || workLog.targetType,
        sourceId,
        variantKey: line.outputVariantKey || line.variantKey || "",
        affectedQty: quantity,
        previousUnitCost,
        nextUnitCost,
      });
    }
    outputs.push({ ...line, costPerUnit: nextUnitCost });
  }

  const saved = await upsertJsonRecord(db, "production_work_logs", {
    ...workLog,
    outputs,
    materialCostActual,
    laborCostActual,
    overheadCostActual,
    totalCostActual,
    costPerGoodUnit: nextUnitCost,
    hppReconciledAt: nowIso(),
    hppReconciledBy: actor,
    updatedAt: nowIso(),
    updatedBy: actor,
  });
  return saved;
};

const finalizeProductionPayroll = async ({ payrollId, payload = {}, actor = "system" } = {}) => runProductionTransaction(async (db) => {
  const current = await getRecord(db, "production_payrolls", payrollId, "Payroll produksi");
  if (normalizeLower(current.paymentStatus) === "paid") {
    fail("Payroll yang sudah paid tidak dapat di-finalisasi ulang.", "PRODUCTION_PAYROLL_ALREADY_PAID", 409);
  }
  const savedPayroll = await upsertJsonRecord(db, "production_payrolls", {
    ...current,
    ...(payload || {}),
    id: current.id,
    code: current.code,
    payrollNumber: current.payrollNumber || current.code,
    status: "confirmed",
    confirmedAt: payload.confirmedAt || current.confirmedAt || nowIso(),
    updatedAt: nowIso(),
    updatedBy: actor,
  });
  const workLog = await reconcileWorkLogHppFromPayroll(db, savedPayroll.workLogId, actor);
  await createAuditLog({
    module: "production",
    action: "confirm_payroll",
    entityType: "production_payroll",
    entityId: savedPayroll.id,
    actor,
    description: `Payroll ${savedPayroll.payrollNumber || savedPayroll.id} dikonfirmasi dan HPP direconcile`,
    metadata: { workLogId: savedPayroll.workLogId || null, finalAmount: savedPayroll.finalAmount },
  });
  return { payroll: savedPayroll, workLog };
});

const markProductionPayrollPaid = async ({ payrollId, payload = {}, actor = "system" } = {}) => runProductionTransaction(async (db) => {
  const current = await getRecord(db, "production_payrolls", payrollId, "Payroll produksi");
  const finalAmount = Math.round(toNumber(payload.finalAmount ?? current.finalAmount ?? current.amountCalculated ?? 0));
  const paidAt = payload.paidAt || current.paidAt || nowIso();
  const expenseId = `production_payroll_expense_${current.id}`;
  const existingExpense = await db.get(
    `SELECT id
     FROM expenses
     WHERE status != 'deleted'
       AND (
         id = ?
         OR (
           source_id = ?
           AND (
             source_type IN ('production_payroll', 'production_payrolls', 'auto_production_payroll')
             OR json_extract(payload_json, '$.sourceModule') IN ('production_payroll', 'production_payrolls')
           )
         )
       )
     LIMIT 1`,
    [expenseId, current.id],
  );
  let financeResult = null;
  let expenseSyncStatus = existingExpense ? "already_exists" : "skipped_zero_amount";

  if (finalAmount > 0 && !existingExpense) {
    financeResult = await createFinanceMovement(db, {
      direction: "out",
      actor,
      sourceModule: "production_payroll",
      sourceId: current.id,
      sourceRef: current.payrollNumber || current.code || current.id,
      description: `Payroll produksi ${current.payrollNumber || current.code || current.id}`,
      payload: {
        id: expenseId,
        referenceNumber: `CSH-OUT-${current.payrollNumber || current.code || current.id}`,
        type: "Payroll Produksi",
        amount: finalAmount,
        totalAmount: finalAmount,
        transactionDate: paidAt,
        sourceModule: "production_payroll",
        sourceType: "auto_production_payroll",
        sourceId: current.id,
        sourceRef: current.payrollNumber || current.code || current.id,
        relatedPayrollId: current.id,
        status: "Tercatat",
        description: `Payroll produksi ${current.payrollNumber || current.code || current.id}`,
      },
    });
    expenseSyncStatus = "created";
  }

  const savedPayroll = await upsertJsonRecord(db, "production_payrolls", {
    ...current,
    ...(payload || {}),
    id: current.id,
    code: current.code,
    payrollNumber: current.payrollNumber || current.code,
    finalAmount,
    totalAmount: finalAmount,
    status: "paid",
    paymentStatus: "paid",
    paidAt,
    financeExpenseId: expenseId,
    expenseSyncStatus,
    financeResult: financeResult ? {
      movementId: financeResult.movement?.id || expenseId,
      ledgerId: financeResult.ledger?.id || `ledger_${expenseId}`,
    } : current.financeResult || null,
    updatedAt: nowIso(),
    updatedBy: actor,
  });
  const workLog = await reconcileWorkLogHppFromPayroll(db, savedPayroll.workLogId, actor);

  await createAuditLog({
    module: "production",
    action: "payroll_paid",
    entityType: "production_payroll",
    entityId: savedPayroll.id,
    actor,
    description: `Payroll ${savedPayroll.payrollNumber || savedPayroll.id} ditandai paid secara atomic`,
    metadata: {
      workLogId: savedPayroll.workLogId || null,
      finalAmount,
      expenseId,
      expenseSyncStatus,
    },
  });

  return { payroll: savedPayroll, workLog, financeResult, expenseSyncStatus };
});

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
  ProductionError,
  assertDirectCreateAllowed,
  assertDirectUpdateAllowed,
  cancelProductionPlan,
  completeProductionWorkLog,
  createOrderCommit,
  createOrderFromPlan,
  finalizeProductionPayroll,
  generatePayrollLines,
  getProductionRouterDefinitions,
  markProductionPayrollPaid,
  refreshOrderRequirements,
  runProductionTransaction,
  startProductionOrder,
};
