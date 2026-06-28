const crypto = require("crypto");
const { createAuditLog } = require("../../utils/auditLog");
const {
  commitStockMutation,
  loadSourceItem,
  upsertJsonRecord,
} = require("../stock/engine");
const {
  calculateRequirementLines,
  normalizeSourceType,
  toPositiveInteger,
  toPositiveNumber,
} = require("./production.calculations");
const {
  fail,
  getMaterialUnitCost,
  getRecord,
  listRecords,
  normalizeLower,
  normalizeText,
  normalizeUpper,
  nowIso,
  resolveProductionCode,
  runProductionTransaction,
} = require("./production.shared");

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

  const code = await resolveProductionCode(
    db,
    "production_orders",
    "PO",
    values.code || values.orderCode || values.referenceNumber,
  );
  const requestedOrderCode = normalizeUpper(
    values.code || values.orderCode || values.referenceNumber,
  );
  const requestedOrderId = normalizeText(values.id || "");
  const id = normalizeText(
    !requestedOrderId || normalizeUpper(requestedOrderId) === requestedOrderCode
      ? code
      : requestedOrderId,
  ) || crypto.randomUUID();
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
  const workNumber = await resolveProductionCode(
    db,
    "production_work_logs",
    "JOB",
    payload.workNumber || payload.code || payload.referenceNumber,
  );
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
  const requestedWorkCode = normalizeUpper(
    payload.workNumber || payload.code || payload.referenceNumber,
  );
  const requestedWorkId = normalizeText(payload.id || "");
  const workLogId = normalizeText(
    !requestedWorkId || normalizeUpper(requestedWorkId) === requestedWorkCode
      ? workNumber
      : requestedWorkId,
  ) || crypto.randomUUID();
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


module.exports = {
  cancelProductionPlan,
  createOrderCommit,
  createOrderFromPlan,
  refreshOrderRequirements,
  startProductionOrder,
};
