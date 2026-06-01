import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import { toNumber } from "../../utils/stock/stockHelpers";
import {
  inferHasVariants,
  resolveVariantSelection,
} from "../../utils/variants/variantStockHelpers";

// -----------------------------------------------------------------------------
// Production Variant Maintenance Service
// Status: ACTIVE / FINAL untuk menu Reset & Maintenance Data.
// Tujuan:
// - memisahkan audit/repair data lama dari service operasional produksi aktif;
// - menjalankan dry run dan repair field turunan tanpa posting stok ulang;
// - menjaga flow produksi final tetap BOM -> PO -> Work Log -> Payroll -> HPP.
// Catatan:
// - service ini tidak boleh mengurangi/menambah stok, kas, payroll, atau HPP;
// - completed record hanya boleh display/snapshot repair dari data yang sudah ada.
// -----------------------------------------------------------------------------

const BATCH_LIMIT = 400;

const COLLECTIONS = {
  boms: "production_boms",
  orders: "production_orders",
  workLogs: "production_work_logs",
  inventoryLogs: "inventory_logs",
  rawMaterials: "raw_materials",
  semiFinishedMaterials: "semi_finished_materials",
  products: "products",
};

const safeTrim = (value) => String(value || "").trim();

const buildDocItem = (itemDoc) => ({
  id: itemDoc.id,
  ...itemDoc.data(),
});

const getCollectionNameByItemType = (itemType = "") => {
  const normalized = safeTrim(itemType).toLowerCase();
  if (["raw_material", "raw_materials", "material"].includes(normalized)) {
    return COLLECTIONS.rawMaterials;
  }
  if (["semi_finished_material", "semi_finished_materials", "semi_finished"].includes(normalized)) {
    return COLLECTIONS.semiFinishedMaterials;
  }
  if (["product", "products", "finished_product"].includes(normalized)) {
    return COLLECTIONS.products;
  }
  return "";
};

const readCollectionDocs = async (collectionName) => {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map(buildDocItem);
};

const readCollectionMap = async (collectionName) => {
  const items = await readCollectionDocs(collectionName);
  return new Map(items.map((item) => [item.id, item]));
};

const getReferenceItem = (masterMaps = {}, itemType = "", itemId = "") => {
  const collectionName = getCollectionNameByItemType(itemType);
  if (!collectionName || !itemId) return null;
  return masterMaps[collectionName]?.get(itemId) || null;
};

const isFinishedRecord = (record = {}) => {
  const normalizedStatus = safeTrim(record.status).toLowerCase();
  return ["completed", "done", "closed", "cancelled", "canceled"].includes(normalizedStatus);
};

const isWorkLogStockApplied = (workLog = {}) => {
  const materialUsages = Array.isArray(workLog.materialUsages) ? workLog.materialUsages : [];
  const outputs = Array.isArray(workLog.outputs) ? workLog.outputs : [];
  return (
    safeTrim(workLog.status).toLowerCase() === "completed" ||
    workLog.stockConsumptionStatus === "applied" ||
    workLog.stockOutputStatus === "applied" ||
    materialUsages.some((line) => line.stockDeducted === true) ||
    outputs.some((line) => line.stockAdded === true)
  );
};

const hasVariantIdentity = (key = "", label = "") => Boolean(safeTrim(key) || safeTrim(label));

const summarizeIssues = (issues = []) => issues.filter(Boolean).join("; ");

const buildLineKey = (line = {}) => [
  safeTrim(line.itemType || line.outputType),
  safeTrim(line.itemId || line.outputIdRef),
  safeTrim(line.resolvedVariantKey || line.outputVariantKey),
].join("::");

const resolveTargetVariantForMaintenance = ({ order = {}, targetItem = null }) => {
  const targetHasVariants =
    inferHasVariants(targetItem || {}) ||
    order.targetHasVariants === true ||
    hasVariantIdentity(order.targetVariantKey, order.targetVariantLabel);

  if (!targetHasVariants) {
    return {
      targetHasVariants: false,
      targetVariantKey: "",
      targetVariantLabel: "",
    };
  }

  if (!targetItem) {
    throw new Error("Master target PO tidak ditemukan untuk validasi varian.");
  }

  const resolution = resolveVariantSelection({
    item: targetItem,
    materialVariantStrategy: "fixed",
    targetVariantKey: order.targetVariantKey || "",
    targetVariantLabel: order.targetVariantLabel || "",
    fixedVariantKey: order.targetVariantKey || "",
    fixedVariantLabel: order.targetVariantLabel || "",
    allowMasterFallback: false,
    contextLabel: `Varian target PO ${order.code || order.id || "produksi"}`,
  });

  return {
    targetHasVariants: true,
    targetVariantKey: resolution.resolvedVariantKey || safeTrim(order.targetVariantKey),
    targetVariantLabel: resolution.resolvedVariantLabel || safeTrim(order.targetVariantLabel),
  };
};

const buildRequirementLineForMaintenance = ({
  line = {},
  stockItem = null,
  batchCount = 0,
  index = 0,
  targetVariantKey = "",
  targetVariantLabel = "",
} = {}) => {
  const qtyPerBatch = toNumber(line.qtyPerBatch || line.quantityPerBatch || line.qty || 0);
  const wastageQty = toNumber(line.wastageQty || 0);
  const qtyRequired = Math.ceil((qtyPerBatch + wastageQty) * toNumber(batchCount || 0));
  const effectiveMaterialHasVariants = line.materialHasVariants === true || inferHasVariants(stockItem || {});
  const effectiveStrategy = effectiveMaterialHasVariants ? line.materialVariantStrategy || "inherit" : "none";

  const stockResolution = resolveVariantSelection({
    item: stockItem || {},
    materialVariantStrategy: effectiveStrategy,
    targetVariantKey,
    targetVariantLabel,
    fixedVariantKey: line.fixedVariantKey || "",
    fixedVariantLabel: line.fixedVariantLabel || "",
    // ACTIVE / FINAL: repair requirement PO mengikuti rule final produksi.
    // Jika material bervarian tidak bisa resolve, audit harus menandai manual/reset,
    // bukan fallback diam-diam ke master.
    allowMasterFallback: !(effectiveMaterialHasVariants && effectiveStrategy !== "none"),
    contextLabel: `Varian requirement ${line.itemName || stockItem?.name || "produksi"}`,
  });

  const currentStockSnapshot = toNumber(stockResolution.currentStock || 0);
  const reservedStockSnapshot = toNumber(stockResolution.reservedStock || 0);
  const availableStockSnapshot = toNumber(stockResolution.availableStock || 0);
  const shortageQty = Math.max(qtyRequired - availableStockSnapshot, 0);

  return {
    id: line.id || `req-maintenance-${Date.now()}-${index}`,
    itemType: line.itemType || "raw_material",
    itemId: line.itemId || "",
    itemCode: safeTrim(line.itemCode || stockItem?.code),
    itemName: safeTrim(line.itemName || stockItem?.name),
    unit: safeTrim(line.unit || stockItem?.unit) || "pcs",
    qtyPerBatch,
    wastageQty,
    qtyRequired,
    materialHasVariants: effectiveMaterialHasVariants,
    materialVariantStrategy: stockResolution.materialVariantStrategy || effectiveStrategy,
    fixedVariantKey: safeTrim(line.fixedVariantKey),
    fixedVariantLabel: safeTrim(line.fixedVariantLabel),
    stockSourceType: stockResolution.stockSourceType,
    resolvedVariantKey: stockResolution.resolvedVariantKey || "",
    resolvedVariantLabel: stockResolution.resolvedVariantLabel || "",
    currentStockSnapshot,
    reservedStockSnapshot,
    availableStockSnapshot,
    shortageQty,
    isSufficient: shortageQty <= 0,
  };
};

const buildRequirementRepairPayload = ({ order = {}, bom = {}, masterMaps = {} }) => {
  const targetItem = getReferenceItem(masterMaps, order.targetType || bom.targetType || "product", order.targetId || bom.targetId);
  const targetVariant = resolveTargetVariantForMaintenance({ order, targetItem });
  const batchCount = toNumber(order.batchCount || order.orderQty || 0);
  const materialLines = Array.isArray(bom.materialLines) ? bom.materialLines : [];

  const materialRequirementLines = materialLines.map((line, index) => {
    const stockItem = getReferenceItem(masterMaps, line.itemType || "raw_material", line.itemId);
    if (!stockItem && line.itemId) {
      throw new Error(`Master material ${line.itemName || line.itemId} tidak ditemukan.`);
    }
    return buildRequirementLineForMaintenance({
      line,
      stockItem,
      batchCount,
      index,
      targetVariantKey: targetVariant.targetVariantKey,
      targetVariantLabel: targetVariant.targetVariantLabel,
    });
  });

  const shortageLines = materialRequirementLines.filter((line) => !line.isSufficient).length;
  const sufficientLines = materialRequirementLines.length - shortageLines;

  return {
    ...targetVariant,
    materialRequirementLines,
    reservationSummary: {
      totalLines: materialRequirementLines.length,
      sufficientLines,
      shortageLines,
      canReserveFully: shortageLines === 0,
    },
    status: shortageLines === 0 ? "ready" : "shortage",
  };
};

const buildRequirementLineMap = (requirementLines = []) => {
  const map = new Map();
  requirementLines.forEach((line) => {
    const baseKey = [safeTrim(line.itemType), safeTrim(line.itemId)].join("::");
    if (!map.has(baseKey)) map.set(baseKey, line);
    map.set(buildLineKey(line), line);
  });
  return map;
};

const findOutputLogVariant = ({ inventoryLogs = [], workLog = {}, outputLine = {} }) => {
  const match = inventoryLogs.find((log) => {
    const type = safeTrim(log.type).toLowerCase();
    return (
      type === "production_output_in" &&
      safeTrim(log.workLogRefId || log.workLogId || log.details?.workLogRefId || log.details?.workLogId) === safeTrim(workLog.id) &&
      safeTrim(log.itemId) === safeTrim(outputLine.outputIdRef)
    );
  });

  return {
    variantKey: safeTrim(match?.variantKey || match?.details?.variantKey),
    variantLabel: safeTrim(match?.variantLabel || match?.details?.variantLabel),
  };
};

const findMaterialLogVariant = ({ inventoryLogs = [], workLog = {}, materialLine = {} }) => {
  const match = inventoryLogs.find((log) => {
    const type = safeTrim(log.type).toLowerCase();
    return (
      type === "production_material_out" &&
      safeTrim(log.workLogRefId || log.workLogId || log.details?.workLogRefId || log.details?.workLogId) === safeTrim(workLog.id) &&
      safeTrim(log.itemId) === safeTrim(materialLine.itemId)
    );
  });

  return {
    variantKey: safeTrim(match?.variantKey || match?.details?.variantKey),
    variantLabel: safeTrim(match?.variantLabel || match?.details?.variantLabel),
  };
};

const buildWorkLogRepairPayload = ({ workLog = {}, order = null, inventoryLogs = [] }) => {
  if (!order) return null;

  const stockAlreadyApplied = isWorkLogStockApplied(workLog);
  const requirementMap = buildRequirementLineMap(order.materialRequirementLines || []);
  const targetVariantKey = safeTrim(order.targetVariantKey || workLog.targetVariantKey);
  const targetVariantLabel = safeTrim(order.targetVariantLabel || workLog.targetVariantLabel);
  const targetHasVariants =
    order.targetHasVariants === true ||
    workLog.targetHasVariants === true ||
    hasVariantIdentity(targetVariantKey, targetVariantLabel);

  const materialUsages = Array.isArray(workLog.materialUsages) ? workLog.materialUsages : [];
  const outputs = Array.isArray(workLog.outputs) ? workLog.outputs : [];

  const nextMaterialUsages = materialUsages.map((line) => {
    const baseKey = [safeTrim(line.itemType), safeTrim(line.itemId)].join("::");
    const requirementLine = requirementMap.get(buildLineKey(line)) || requirementMap.get(baseKey);

    if (!requirementLine) {
      const logVariant = findMaterialLogVariant({ inventoryLogs, workLog, materialLine: line });
      return {
        ...line,
        resolvedVariantKey: safeTrim(line.resolvedVariantKey || logVariant.variantKey),
        resolvedVariantLabel: safeTrim(line.resolvedVariantLabel || logVariant.variantLabel),
        stockSourceType: safeTrim(line.resolvedVariantKey || logVariant.variantKey) ? "variant" : line.stockSourceType || "master",
      };
    }

    // ACTIVE / FINAL:
    // - sebelum stok berjalan, usage boleh disinkronkan dari requirement PO;
    // - setelah stok sudah applied/completed, hanya lengkapi display/snapshot dari
    //   key yang sudah ada atau inventory log, tanpa mengubah histori mutasi stok.
    if (!stockAlreadyApplied && line.stockDeducted !== true) {
      return {
        ...line,
        materialHasVariants: requirementLine.materialHasVariants === true,
        materialVariantStrategy: requirementLine.materialVariantStrategy || line.materialVariantStrategy || "none",
        resolvedVariantKey: requirementLine.resolvedVariantKey || "",
        resolvedVariantLabel: requirementLine.resolvedVariantLabel || "",
        stockSourceType: requirementLine.stockSourceType || (requirementLine.resolvedVariantKey ? "variant" : "master"),
      };
    }

    const logVariant = findMaterialLogVariant({ inventoryLogs, workLog, materialLine: line });
    return {
      ...line,
      materialHasVariants: line.materialHasVariants === true || requirementLine.materialHasVariants === true,
      materialVariantStrategy: line.materialVariantStrategy || requirementLine.materialVariantStrategy || "none",
      resolvedVariantKey: safeTrim(line.resolvedVariantKey || logVariant.variantKey),
      resolvedVariantLabel: safeTrim(line.resolvedVariantLabel || logVariant.variantLabel || requirementLine.resolvedVariantLabel),
      stockSourceType: safeTrim(line.resolvedVariantKey || logVariant.variantKey) ? "variant" : line.stockSourceType || "master",
    };
  });

  const nextOutputs = outputs.map((line, index) => {
    const logVariant = findOutputLogVariant({ inventoryLogs, workLog, outputLine: line });
    const sourceVariantKey = safeTrim(line.outputVariantKey || logVariant.variantKey || (!stockAlreadyApplied ? targetVariantKey : ""));
    const sourceVariantLabel = safeTrim(line.outputVariantLabel || logVariant.variantLabel || (!stockAlreadyApplied ? targetVariantLabel : ""));

    if (index === 0) {
      return {
        ...line,
        outputHasVariants: line.outputHasVariants === true || targetHasVariants,
        outputVariantKey: sourceVariantKey,
        outputVariantLabel: sourceVariantLabel,
        stockSourceType: sourceVariantKey ? "variant" : line.stockSourceType || "master",
      };
    }

    return {
      ...line,
      outputVariantKey: safeTrim(line.outputVariantKey || logVariant.variantKey),
      outputVariantLabel: safeTrim(line.outputVariantLabel || logVariant.variantLabel),
      stockSourceType: safeTrim(line.outputVariantKey || logVariant.variantKey) ? "variant" : line.stockSourceType || "master",
    };
  });

  return {
    targetHasVariants,
    targetVariantKey,
    targetVariantLabel,
    materialUsages: nextMaterialUsages,
    outputs: nextOutputs,
  };
};

const buildInventoryLogRepairPayload = ({ log = {}, workLogsById = new Map() }) => {
  const type = safeTrim(log.type).toLowerCase();
  if (!type.startsWith("production_")) return null;
  if (hasVariantIdentity(log.variantKey || log.details?.variantKey, log.variantLabel || log.details?.variantLabel)) {
    return null;
  }

  const workLogId = safeTrim(log.workLogRefId || log.workLogId || log.details?.workLogRefId || log.details?.workLogId);
  const workLog = workLogsById.get(workLogId);
  if (!workLog) return null;

  if (type === "production_output_in") {
    const output = (workLog.outputs || []).find((line) => safeTrim(line.outputIdRef) === safeTrim(log.itemId));
    if (hasVariantIdentity(output?.outputVariantKey, output?.outputVariantLabel)) {
      return {
        variantKey: safeTrim(output.outputVariantKey),
        variantLabel: safeTrim(output.outputVariantLabel),
      };
    }
  }

  if (type === "production_material_out") {
    const usage = (workLog.materialUsages || []).find((line) => safeTrim(line.itemId) === safeTrim(log.itemId));
    if (hasVariantIdentity(usage?.resolvedVariantKey, usage?.resolvedVariantLabel)) {
      return {
        variantKey: safeTrim(usage.resolvedVariantKey),
        variantLabel: safeTrim(usage.resolvedVariantLabel),
      };
    }
  }

  return null;
};

const buildAuditContext = async () => {
  const [
    boms,
    orders,
    workLogs,
    inventoryLogs,
    rawMaterialMap,
    semiFinishedMap,
    productMap,
  ] = await Promise.all([
    readCollectionDocs(COLLECTIONS.boms),
    readCollectionDocs(COLLECTIONS.orders),
    readCollectionDocs(COLLECTIONS.workLogs),
    readCollectionDocs(COLLECTIONS.inventoryLogs),
    readCollectionMap(COLLECTIONS.rawMaterials),
    readCollectionMap(COLLECTIONS.semiFinishedMaterials),
    readCollectionMap(COLLECTIONS.products),
  ]);

  const bomMap = new Map(boms.map((item) => [item.id, item]));
  const orderMap = new Map(orders.map((item) => [item.id, item]));
  const workLogsById = new Map(workLogs.map((item) => [item.id, item]));
  const workLogsByOrderId = new Map();

  workLogs.forEach((workLog) => {
    const orderId = safeTrim(workLog.productionOrderId);
    if (!orderId) return;
    const existing = workLogsByOrderId.get(orderId) || [];
    existing.push(workLog);
    workLogsByOrderId.set(orderId, existing);
  });

  return {
    boms,
    orders,
    workLogs,
    inventoryLogs,
    bomMap,
    orderMap,
    workLogsById,
    workLogsByOrderId,
    masterMaps: {
      [COLLECTIONS.rawMaterials]: rawMaterialMap,
      [COLLECTIONS.semiFinishedMaterials]: semiFinishedMap,
      [COLLECTIONS.products]: productMap,
    },
  };
};

const pushAuditRow = (rows, row) => {
  rows.push({
    key: `${row.scope}-${row.recordId}-${rows.length}`,
    scope: row.scope,
    recordId: row.recordId || "",
    code: row.code || "-",
    status: row.status || "-",
    category: row.category || "ok",
    recommendation: row.recommendation || "Data sudah sesuai.",
    issue: summarizeIssues(row.issues || []),
  });
};

const buildProductionVariantPlans = (context) => {
  const rows = [];
  const plans = [];

  context.orders.forEach((order) => {
    const bom = context.bomMap.get(order.bomId);
    const relatedWorkLogs = context.workLogsByOrderId.get(order.id) || [];
    const hasRelatedWorkLog = relatedWorkLogs.length > 0;

    if (!bom) {
      pushAuditRow(rows, {
        scope: "Production Order",
        recordId: order.id,
        code: order.code,
        status: order.status,
        category: "manual",
        recommendation: "BOM PO tidak ditemukan. Lebih aman reset/buat ulang PO.",
        issues: ["BOM hilang"],
      });
      return;
    }

    try {
      const payload = buildRequirementRepairPayload({
        order,
        bom,
        masterMaps: context.masterMaps,
      });
      const existingLines = Array.isArray(order.materialRequirementLines) ? order.materialRequirementLines : [];
      const hasTargetMismatch =
        order.targetHasVariants !== payload.targetHasVariants ||
        safeTrim(order.targetVariantKey) !== safeTrim(payload.targetVariantKey) ||
        safeTrim(order.targetVariantLabel) !== safeTrim(payload.targetVariantLabel);
      const hasRequirementMismatch =
        existingLines.length !== payload.materialRequirementLines.length ||
        payload.materialRequirementLines.some((line, index) => {
          const current = existingLines[index] || {};
          return (
            safeTrim(current.resolvedVariantKey) !== safeTrim(line.resolvedVariantKey) ||
            safeTrim(current.resolvedVariantLabel) !== safeTrim(line.resolvedVariantLabel) ||
            safeTrim(current.stockSourceType) !== safeTrim(line.stockSourceType) ||
            current.materialHasVariants !== line.materialHasVariants
          );
        });

      if (!hasTargetMismatch && !hasRequirementMismatch) {
        pushAuditRow(rows, {
          scope: "Production Order",
          recordId: order.id,
          code: order.code,
          status: order.status,
          category: "ok",
          recommendation: "PO sudah sinkron dengan source of truth varian.",
        });
        return;
      }

      if (!hasRelatedWorkLog && !isFinishedRecord(order)) {
        plans.push({ type: "order_safe_repair", orderId: order.id, payload });
        pushAuditRow(rows, {
          scope: "Production Order",
          recordId: order.id,
          code: order.code,
          status: order.status,
          category: "safe_repair",
          recommendation: "Aman direbuild karena belum punya Work Log.",
          issues: [hasTargetMismatch && "target variant stale", hasRequirementMismatch && "requirement variant stale"],
        });
      } else {
        plans.push({
          type: "order_display_repair",
          orderId: order.id,
          payload: {
            targetHasVariants: payload.targetHasVariants,
            targetVariantKey: payload.targetVariantKey,
            targetVariantLabel: payload.targetVariantLabel,
          },
        });
        pushAuditRow(rows, {
          scope: "Production Order",
          recordId: order.id,
          code: order.code,
          status: order.status,
          category: "display_repair",
          recommendation: "Sudah punya Work Log/selesai. Hanya snapshot target yang aman diperbaiki.",
          issues: [hasTargetMismatch && "target variant stale", hasRequirementMismatch && "requirement tidak di-rebuild karena sudah ada histori"],
        });
      }
    } catch (error) {
      pushAuditRow(rows, {
        scope: "Production Order",
        recordId: order.id,
        code: order.code,
        status: order.status,
        category: "manual",
        recommendation: "Tidak aman auto repair. Perlu reset terarah atau koreksi master/BOM.",
        issues: [error?.message || "Gagal resolve variant"],
      });
    }
  });

  context.workLogs.forEach((workLog) => {
    const order = context.orderMap.get(workLog.productionOrderId);
    if (!order) {
      pushAuditRow(rows, {
        scope: "Work Log",
        recordId: workLog.id,
        code: workLog.workNumber,
        status: workLog.status,
        category: workLog.sourceType === "production_order" ? "manual" : "legacy",
        recommendation:
          workLog.sourceType === "production_order"
            ? "Linked PO tidak ditemukan. Lebih aman reset/manual review."
            : "Work Log manual/BOM adalah transisi, tidak diubah oleh sync PO variant.",
        issues: [workLog.sourceType === "production_order" ? "PO tidak ditemukan" : "flow manual/transisi"],
      });
      return;
    }

    const payload = buildWorkLogRepairPayload({
      workLog,
      order,
      inventoryLogs: context.inventoryLogs,
    });
    if (!payload) return;

    const hasRootMismatch =
      workLog.targetHasVariants !== payload.targetHasVariants ||
      safeTrim(workLog.targetVariantKey) !== safeTrim(payload.targetVariantKey) ||
      safeTrim(workLog.targetVariantLabel) !== safeTrim(payload.targetVariantLabel);
    const hasOutputMismatch = JSON.stringify(workLog.outputs || []) !== JSON.stringify(payload.outputs || []);
    const hasMaterialMismatch = JSON.stringify(workLog.materialUsages || []) !== JSON.stringify(payload.materialUsages || []);

    if (!hasRootMismatch && !hasOutputMismatch && !hasMaterialMismatch) {
      pushAuditRow(rows, {
        scope: "Work Log",
        recordId: workLog.id,
        code: workLog.workNumber,
        status: workLog.status,
        category: "ok",
        recommendation: "Work Log sudah sinkron.",
      });
      return;
    }

    const category = isWorkLogStockApplied(workLog) ? "display_repair" : "safe_repair";
    plans.push({ type: "worklog_repair", workLogId: workLog.id, payload, category });
    // ACTIVE / FINAL: inventory log repair di bawah memakai snapshot work log
    // terbaru dari plan ini supaya satu kali Repair Aman bisa ikut melengkapi
    // variantKey/variantLabel log tanpa perlu klik repair dua kali.
    context.workLogsById.set(workLog.id, { ...workLog, ...payload });
    pushAuditRow(rows, {
      scope: "Work Log",
      recordId: workLog.id,
      code: workLog.workNumber,
      status: workLog.status,
      category,
      recommendation:
        category === "display_repair"
          ? "Stok sudah applied/completed. Repair dibatasi ke snapshot/display."
          : "Belum applied. Aman sinkronkan usage/output dari PO.",
      issues: [hasRootMismatch && "target snapshot stale", hasMaterialMismatch && "material usage stale", hasOutputMismatch && "output snapshot stale"],
    });
  });

  context.inventoryLogs.forEach((log) => {
    const payload = buildInventoryLogRepairPayload({ log, workLogsById: context.workLogsById });
    if (!payload) return;
    plans.push({ type: "inventory_log_display_repair", logId: log.id, payload });
    pushAuditRow(rows, {
      scope: "Inventory Log",
      recordId: log.id,
      code: log.type,
      status: "log",
      category: "display_repair",
      recommendation: "Aman melengkapi label varian log tanpa mutasi stok ulang.",
      issues: ["variantKey/variantLabel log kosong"],
    });
  });

  return { rows, plans };
};

const buildSummary = ({ context, rows, plans }) => {
  const countByCategory = (category) => rows.filter((row) => row.category === category).length;
  return {
    checkedRecords:
      context.orders.length + context.workLogs.length + context.inventoryLogs.length,
    productionOrders: context.orders.length,
    workLogs: context.workLogs.length,
    inventoryLogs: context.inventoryLogs.length,
    okCount: countByCategory("ok"),
    safeRepairCount: countByCategory("safe_repair"),
    displayRepairCount: countByCategory("display_repair"),
    resetManualCount: countByCategory("manual") + countByCategory("legacy"),
    executablePlanCount: plans.length,
  };
};

export const getProductionVariantMaintenanceAudit = async () => {
  const context = await buildAuditContext();
  const { rows, plans } = buildProductionVariantPlans(context);

  return {
    generatedAt: new Date().toISOString(),
    rows,
    summary: buildSummary({ context, rows, plans }),
  };
};

const commitPlanBatch = async (plans = [], currentUser = null) => {
  let batch = writeBatch(db);
  let operationCount = 0;
  let updatedCount = 0;
  const actor = currentUser?.email || currentUser?.displayName || currentUser?.uid || "maintenance";

  const commitIfNeeded = async (force = false) => {
    if (!force && operationCount < BATCH_LIMIT) return;
    if (operationCount <= 0) return;
    await batch.commit();
    batch = writeBatch(db);
    operationCount = 0;
  };

  for (const plan of plans) {
    if (plan.type === "order_safe_repair") {
      const ref = doc(db, COLLECTIONS.orders, plan.orderId);
      batch.update(ref, {
        targetHasVariants: plan.payload.targetHasVariants,
        targetVariantKey: plan.payload.targetVariantKey,
        targetVariantLabel: plan.payload.targetVariantLabel,
        materialRequirementLines: plan.payload.materialRequirementLines,
        reservationSummary: plan.payload.reservationSummary,
        status: plan.payload.status,
        maintenanceSyncedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: actor,
      });
    } else if (plan.type === "order_display_repair") {
      const ref = doc(db, COLLECTIONS.orders, plan.orderId);
      batch.update(ref, {
        ...plan.payload,
        maintenanceSyncedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: actor,
      });
    } else if (plan.type === "worklog_repair") {
      const ref = doc(db, COLLECTIONS.workLogs, plan.workLogId);
      batch.update(ref, {
        ...plan.payload,
        maintenanceRepairMode: plan.category,
        maintenanceSyncedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: actor,
      });
    } else if (plan.type === "inventory_log_display_repair") {
      const ref = doc(db, COLLECTIONS.inventoryLogs, plan.logId);
      batch.update(ref, {
        ...plan.payload,
        maintenanceSyncedAt: serverTimestamp(),
      });
    } else {
      continue;
    }

    operationCount += 1;
    updatedCount += 1;
    await commitIfNeeded(false);
  }

  await commitIfNeeded(true);
  return updatedCount;
};

export const repairProductionVariantMaintenance = async (currentUser = null) => {
  const context = await buildAuditContext();
  const { rows, plans } = buildProductionVariantPlans(context);
  const updatedCount = await commitPlanBatch(plans, currentUser);

  return {
    message: `Repair varian produksi selesai. ${updatedCount} dokumen diperbarui tanpa posting stok ulang.`,
    updatedCount,
    summary: buildSummary({ context, rows, plans }),
  };
};
