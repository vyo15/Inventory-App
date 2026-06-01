import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { inferHasVariants } from "../../utils/variants/variantStockHelpers";

// -----------------------------------------------------------------------------
// Legacy Data Maintenance Service
// ACTIVE / FINAL FOUNDATION untuk Batch 3 cleanup data legacy.
// Service ini hanya melakukan dry run/audit data lama agar admin bisa memilih
// repair aman atau reset scoped dari menu Reset & Maintenance Data. Tidak ada
// mutasi stok, kas, payroll, HPP, atau delete data di service ini.
// -----------------------------------------------------------------------------

const COLLECTIONS = {
  productions: "productions",
  productionBoms: "production_boms",
  productionOrders: "production_orders",
  productionWorkLogs: "production_work_logs",
  inventoryLogs: "inventory_logs",
  sales: "sales",
  returns: "returns",
  stockAdjustments: "stock_adjustments",
  purchases: "purchases",
  incomes: "incomes",
  expenses: "expenses",
  rawMaterials: "raw_materials",
  semiFinishedMaterials: "semi_finished_materials",
  products: "products",
};

const safeTrim = (value) => String(value || "").trim();
const normalize = (value) => safeTrim(value).toLowerCase();

const buildDocItem = (itemDoc) => ({
  id: itemDoc.id,
  ref: itemDoc.ref,
  ...itemDoc.data(),
});

const readCollectionDocs = async (collectionName) => {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map(buildDocItem);
};

const buildMap = (items = []) => new Map(items.map((item) => [safeTrim(item.id), item]));

const getCollectionNameByItemType = (itemType = "") => {
  const type = normalize(itemType);
  if (["raw_material", "raw_materials", "material"].includes(type)) return COLLECTIONS.rawMaterials;
  if (["semi_finished_material", "semi_finished_materials", "semi_finished"].includes(type)) return COLLECTIONS.semiFinishedMaterials;
  if (["product", "products", "finished_product"].includes(type)) return COLLECTIONS.products;
  return "";
};

const getMasterItem = ({ masterMaps = {}, itemType = "", collectionName = "", itemId = "" }) => {
  const resolvedCollection = collectionName || getCollectionNameByItemType(itemType);
  if (!resolvedCollection || !itemId) return null;
  return masterMaps[resolvedCollection]?.get(safeTrim(itemId)) || null;
};

const hasVariantIdentity = (...values) => values.some((value) => Boolean(safeTrim(value)));

const isProductionLog = (log = {}) => {
  const type = normalize(log.type || log.actionType);
  return (
    type.includes("production") ||
    hasVariantIdentity(
      log.productionOrderId,
      log.details?.productionOrderId,
      log.workLogRefId,
      log.workLogId,
      log.details?.workLogRefId,
      log.details?.workLogId,
    )
  );
};

const buildRow = ({
  scope,
  code,
  status = "legacy",
  category = "manual",
  issue,
  recommendation,
  resetScope = "",
}) => ({
  key: `${scope}-${code}-${issue}`,
  scope,
  code: safeTrim(code) || "-",
  status: safeTrim(status) || "legacy",
  category,
  issue,
  recommendation,
  resetScope,
});

const buildSummary = ({ rows = [], checkedRecords = 0 }) => ({
  checkedRecords,
  okCount: Math.max(checkedRecords - rows.length, 0),
  safeRepairCount: rows.filter((row) => row.category === "safe_repair").length,
  displayRepairCount: rows.filter((row) => row.category === "display_repair").length,
  scopedResetCount: rows.filter((row) => row.category === "scoped_reset").length,
  manualReviewCount: rows.filter((row) => row.category === "manual").length,
  resetManualCount: rows.filter((row) => ["scoped_reset", "manual"].includes(row.category)).length,
  executablePlanCount: rows.filter((row) => ["safe_repair", "display_repair", "scoped_reset"].includes(row.category)).length,
});

const auditProductionsLegacy = ({ productions = [] }) => {
  return productions.map((item) => buildRow({
    scope: "productions legacy",
    code: item.code || item.productionCode || item.id,
    status: item.status || "legacy",
    category: "scoped_reset",
    issue: "Collection productions adalah flow produksi lama dan tidak lagi menjadi source of truth final.",
    recommendation: "Aman dibersihkan lewat Reset Produksi scoped setelah preview; jangan edit manual di Firestore.",
    resetScope: "production",
  }));
};

const auditProductionOrders = ({ orders = [], bomMap = new Map() }) => {
  return orders.flatMap((order) => {
    const rows = [];
    const bomId = safeTrim(order.bomId);
    const requirementLines = Array.isArray(order.materialRequirementLines) ? order.materialRequirementLines : [];
    const hasUnresolvedVariantLine = requirementLines.some((line) => (
      line.materialHasVariants === true &&
      normalize(line.materialVariantStrategy || "inherit") !== "none" &&
      !hasVariantIdentity(line.resolvedVariantKey, line.resolvedVariantLabel)
    ));

    if (!bomId || !bomMap.has(bomId)) {
      rows.push(buildRow({
        scope: "production_orders",
        code: order.code || order.orderNumber || order.id,
        status: order.status || "draft",
        category: "manual",
        issue: "Production Order lama tidak punya BOM aktif/source BOM sudah hilang.",
        recommendation: "Lebih aman reset scoped produksi atau review manual karena requirement tidak bisa direbuild dari source final.",
        resetScope: "production",
      }));
    }

    if (hasUnresolvedVariantLine) {
      rows.push(buildRow({
        scope: "production_orders",
        code: order.code || order.orderNumber || order.id,
        status: order.status || "draft",
        category: "safe_repair",
        issue: "Requirement material bervarian belum punya resolvedVariantKey/resolvedVariantLabel final.",
        recommendation: "Jalankan Repair Aman Produksi agar field requirement disinkronkan tanpa posting stok ulang.",
        resetScope: "production_variant_repair",
      }));
    }

    return rows;
  });
};

const auditProductionWorkLogs = ({ workLogs = [], orderMap = new Map(), bomMap = new Map() }) => {
  return workLogs.flatMap((workLog) => {
    const rows = [];
    const sourceType = normalize(workLog.sourceType || "manual");
    const productionOrderId = safeTrim(workLog.productionOrderId);
    const bomId = safeTrim(workLog.bomId);
    const isCompleted = normalize(workLog.status) === "completed";
    const outputs = Array.isArray(workLog.outputs) ? workLog.outputs : [];
    const outputMissingVariant = outputs.some((line) => (
      hasVariantIdentity(workLog.targetVariantKey, workLog.targetVariantLabel) &&
      !hasVariantIdentity(line.outputVariantKey, line.outputVariantLabel)
    ));

    if (sourceType === "production_order" && (!productionOrderId || !orderMap.has(productionOrderId))) {
      rows.push(buildRow({
        scope: "production_work_logs",
        code: workLog.workNumber || workLog.code || workLog.id,
        status: workLog.status || sourceType,
        category: isCompleted ? "manual" : "scoped_reset",
        issue: "Work Log linked PO tetapi source Production Order tidak ditemukan.",
        recommendation: isCompleted
          ? "Completed record jangan diubah otomatis; lakukan review manual atau reset scoped jika data testing."
          : "Aman reset scoped produksi jika record ini data testing/transisi.",
        resetScope: "production",
      }));
    }

    if (sourceType === "planned" && bomId && !bomMap.has(bomId)) {
      rows.push(buildRow({
        scope: "production_work_logs",
        code: workLog.workNumber || workLog.code || workLog.id,
        status: workLog.status || sourceType,
        category: isCompleted ? "manual" : "scoped_reset",
        issue: "Work Log planned memakai BOM yang sudah tidak ditemukan.",
        recommendation: "Lebih aman reset scoped produksi untuk data testing; completed production perlu review manual.",
        resetScope: "production",
      }));
    }

    if (outputMissingVariant) {
      rows.push(buildRow({
        scope: "production_work_logs",
        code: workLog.workNumber || workLog.code || workLog.id,
        status: workLog.status || sourceType,
        category: "display_repair",
        issue: "Output Work Log belum sinkron dengan target variant snapshot.",
        recommendation: "Jalankan Repair Aman Produksi; completed record hanya akan display/snapshot repair, tidak posting stok ulang.",
        resetScope: "production_variant_repair",
      }));
    }

    return rows;
  });
};

const auditInventoryLogs = ({ inventoryLogs = [], orderMap = new Map(), workLogMap = new Map(), salesMap = new Map(), purchaseMap = new Map(), returnMap = new Map(), adjustmentMap = new Map() }) => {
  return inventoryLogs.flatMap((log) => {
    const rows = [];
    const type = normalize(log.type || log.actionType);
    const orderId = safeTrim(log.productionOrderId || log.details?.productionOrderId);
    const workLogId = safeTrim(log.workLogRefId || log.workLogId || log.details?.workLogRefId || log.details?.workLogId);
    const saleId = safeTrim(log.saleId || log.details?.saleId);
    const purchaseId = safeTrim(log.purchaseId || log.details?.purchaseId);
    const returnId = safeTrim(log.returnId || log.details?.returnId);
    const adjustmentId = safeTrim(log.adjustmentId || log.details?.adjustmentId);

    if (isProductionLog(log) && ((orderId && !orderMap.has(orderId)) || (workLogId && !workLogMap.has(workLogId)))) {
      rows.push(buildRow({
        scope: "inventory_logs",
        code: log.id,
        status: log.type || "production_log",
        category: "scoped_reset",
        issue: "Inventory log produksi orphan karena PO/Work Log source tidak ditemukan.",
        recommendation: "Aman dibersihkan lewat Reset Produksi scoped jika data lama/testing.",
        resetScope: "production_inventory_log",
      }));
    }

    if (type.includes("sale") && saleId && !salesMap.has(saleId)) {
      rows.push(buildRow({
        scope: "inventory_logs",
        code: log.id,
        status: log.type || "sale_log",
        category: "scoped_reset",
        issue: "Inventory log penjualan orphan karena sales source tidak ditemukan.",
        recommendation: "Aman dibersihkan lewat Reset Sales scoped jika data testing.",
        resetScope: "sales_inventory_log",
      }));
    }

    if (type.includes("purchase") && purchaseId && !purchaseMap.has(purchaseId)) {
      rows.push(buildRow({
        scope: "inventory_logs",
        code: log.id,
        status: log.type || "purchase_log",
        category: "scoped_reset",
        issue: "Inventory log pembelian orphan karena purchase source tidak ditemukan.",
        recommendation: "Aman dibersihkan lewat Reset Purchases scoped jika data testing.",
        resetScope: "purchase_inventory_log",
      }));
    }

    if (type.includes("return") && returnId && !returnMap.has(returnId)) {
      rows.push(buildRow({
        scope: "inventory_logs",
        code: log.id,
        status: log.type || "return_log",
        category: "scoped_reset",
        issue: "Inventory log retur orphan karena return source tidak ditemukan.",
        recommendation: "Aman dibersihkan lewat Reset Returns scoped jika data testing.",
        resetScope: "return_inventory_log",
      }));
    }

    if (type.includes("adjustment") && adjustmentId && !adjustmentMap.has(adjustmentId)) {
      rows.push(buildRow({
        scope: "inventory_logs",
        code: log.id,
        status: log.type || "adjustment_log",
        category: "scoped_reset",
        issue: "Inventory log adjustment orphan karena stock_adjustment source tidak ditemukan.",
        recommendation: "Aman dibersihkan lewat Reset Adjustment scoped jika data testing.",
        resetScope: "adjustment_inventory_log",
      }));
    }

    return rows;
  });
};

const lineItemNeedsVariantSnapshot = ({ line = {}, masterMaps = {} }) => {
  const item = getMasterItem({
    masterMaps,
    itemType: line.itemType || line.type,
    collectionName: line.collectionName,
    itemId: line.itemId,
  });
  return inferHasVariants(item || {}) && !hasVariantIdentity(line.variantKey, line.variantLabel, line.materialVariantId, line.materialVariantName, line.productVariantKey);
};

const auditSales = ({ sales = [], masterMaps = {} }) => sales.flatMap((sale) => {
  const items = Array.isArray(sale.items) ? sale.items : [];
  const missingVariantCount = items.filter((line) => lineItemNeedsVariantSnapshot({ line, masterMaps })).length;
  if (!missingVariantCount) return [];

  return [buildRow({
    scope: "sales",
    code: sale.referenceNumber || sale.id,
    status: sale.status || "sales",
    category: "manual",
    issue: `${missingVariantCount} item bervarian pada sales lama belum punya variantKey/variantLabel snapshot.`,
    recommendation: "Tidak aman ditebak otomatis. Gunakan Reset Sales scoped untuk data testing atau review manual jika data historis final.",
    resetScope: "sales",
  })];
});

const auditReturns = ({ returns = [], masterMaps = {} }) => returns.flatMap((record) => {
  const item = getMasterItem({
    masterMaps,
    itemType: record.type,
    collectionName: record.collectionName || (normalize(record.type) === "product" ? COLLECTIONS.products : COLLECTIONS.rawMaterials),
    itemId: record.itemId,
  });

  if (!inferHasVariants(item || {}) || hasVariantIdentity(record.variantKey, record.variantLabel)) return [];

  return [buildRow({
    scope: "returns",
    code: record.id,
    status: record.type || "return",
    category: "manual",
    issue: "Retur lama untuk item bervarian belum punya variant snapshot.",
    recommendation: "Lebih aman reset scoped retur untuk data testing; data final perlu review manual karena variant tidak bisa ditebak.",
    resetScope: "returns",
  })];
});

const auditStockAdjustments = ({ adjustments = [], masterMaps = {} }) => adjustments.flatMap((record) => {
  const item = getMasterItem({
    masterMaps,
    itemType: record.itemType,
    collectionName: record.collectionName,
    itemId: record.itemId,
  });

  if (!inferHasVariants(item || {}) || hasVariantIdentity(record.variantKey, record.variantLabel)) return [];

  return [buildRow({
    scope: "stock_adjustments",
    code: record.id,
    status: record.adjustmentType || "adjustment",
    category: "manual",
    issue: "Stock adjustment lama untuk item bervarian belum punya variant snapshot.",
    recommendation: "Lebih aman reset scoped adjustment/log untuk data testing; data final perlu review manual.",
    resetScope: "stock_adjustment_and_logs",
  })];
});

const auditPurchases = ({ purchases = [], masterMaps = {} }) => purchases.flatMap((purchase) => {
  const collectionName = normalize(purchase.type) === "product" ? COLLECTIONS.products : COLLECTIONS.rawMaterials;
  const item = getMasterItem({
    masterMaps,
    collectionName,
    itemId: purchase.itemId,
  });

  if (!inferHasVariants(item || {})) return [];

  const hasSnapshot = hasVariantIdentity(
    purchase.variantKey,
    purchase.variantLabel,
    purchase.materialVariantId,
    purchase.materialVariantName,
    purchase.productVariantKey,
  );

  if (hasSnapshot) return [];

  return [buildRow({
    scope: "purchases",
    code: purchase.invoiceNumber || purchase.id,
    status: purchase.type || "purchase",
    category: "manual",
    issue: "Purchase lama untuk item bervarian belum punya variant snapshot final.",
    recommendation: "Lebih aman reset scoped purchases untuk data testing; data final perlu review manual karena expense/stok sudah ter-posting.",
    resetScope: "purchases",
  })];
});

const auditCashReferences = ({ incomes = [], expenses = [], salesMap = new Map(), purchaseMap = new Map() }) => {
  const incomeRows = incomes.flatMap((income) => {
    const isSalesIncome = normalize(income.type).includes("penjualan") || normalize(income.sourceModule) === "sales" || hasVariantIdentity(income.salesChannel, income.saleId, income.relatedId);
    const saleId = safeTrim(income.saleId || income.relatedId);
    if (!isSalesIncome) return [];
    if (!saleId) {
      return [buildRow({
        scope: "incomes",
        code: income.id,
        status: income.type || "income",
        category: "manual",
        issue: "Income penjualan lama tidak punya relatedId/saleId yang cukup jelas.",
        recommendation: "Jangan hapus otomatis kecuali reset kas penuh atau review manual.",
        resetScope: "cash_review",
      })];
    }
    if (!salesMap.has(saleId)) {
      return [buildRow({
        scope: "incomes",
        code: income.id,
        status: income.type || "income",
        category: "scoped_reset",
        issue: "Income penjualan orphan karena sales source tidak ditemukan.",
        recommendation: "Aman dibersihkan lewat Reset Sales scoped jika data testing.",
        resetScope: "sales_income",
      })];
    }
    return [];
  });

  const expenseRows = expenses.flatMap((expense) => {
    const isPurchaseExpense = normalize(expense.sourceModule) === "purchases" || normalize(expense.type).includes("pembelian") || hasVariantIdentity(expense.relatedPurchaseId);
    const purchaseId = safeTrim(expense.relatedPurchaseId || expense.purchaseId);
    if (!isPurchaseExpense) return [];
    if (!purchaseId) {
      return [buildRow({
        scope: "expenses",
        code: expense.id,
        status: expense.type || "expense",
        category: "manual",
        issue: "Expense pembelian lama tidak punya relatedPurchaseId yang cukup jelas.",
        recommendation: "Jangan hapus otomatis kecuali reset kas penuh atau review manual.",
        resetScope: "cash_review",
      })];
    }
    if (!purchaseMap.has(purchaseId)) {
      return [buildRow({
        scope: "expenses",
        code: expense.id,
        status: expense.type || "expense",
        category: "scoped_reset",
        issue: "Expense pembelian orphan karena purchase source tidak ditemukan.",
        recommendation: "Aman dibersihkan lewat Reset Purchases scoped jika data testing.",
        resetScope: "purchase_expense",
      })];
    }
    return [];
  });

  return [...incomeRows, ...expenseRows];
};

export const getLegacyDataMaintenanceAudit = async () => {
  const [
    productions,
    productionBoms,
    productionOrders,
    productionWorkLogs,
    inventoryLogs,
    sales,
    returns,
    stockAdjustments,
    purchases,
    incomes,
    expenses,
    rawMaterials,
    semiFinishedMaterials,
    products,
  ] = await Promise.all([
    readCollectionDocs(COLLECTIONS.productions),
    readCollectionDocs(COLLECTIONS.productionBoms),
    readCollectionDocs(COLLECTIONS.productionOrders),
    readCollectionDocs(COLLECTIONS.productionWorkLogs),
    readCollectionDocs(COLLECTIONS.inventoryLogs),
    readCollectionDocs(COLLECTIONS.sales),
    readCollectionDocs(COLLECTIONS.returns),
    readCollectionDocs(COLLECTIONS.stockAdjustments),
    readCollectionDocs(COLLECTIONS.purchases),
    readCollectionDocs(COLLECTIONS.incomes),
    readCollectionDocs(COLLECTIONS.expenses),
    readCollectionDocs(COLLECTIONS.rawMaterials),
    readCollectionDocs(COLLECTIONS.semiFinishedMaterials),
    readCollectionDocs(COLLECTIONS.products),
  ]);

  const masterMaps = {
    [COLLECTIONS.rawMaterials]: buildMap(rawMaterials),
    [COLLECTIONS.semiFinishedMaterials]: buildMap(semiFinishedMaterials),
    [COLLECTIONS.products]: buildMap(products),
  };
  const bomMap = buildMap(productionBoms);
  const orderMap = buildMap(productionOrders);
  const workLogMap = buildMap(productionWorkLogs);
  const salesMap = buildMap(sales);
  const purchaseMap = buildMap(purchases);
  const returnMap = buildMap(returns);
  const adjustmentMap = buildMap(stockAdjustments);

  const rows = [
    ...auditProductionsLegacy({ productions }),
    ...auditProductionOrders({ orders: productionOrders, bomMap }),
    ...auditProductionWorkLogs({ workLogs: productionWorkLogs, orderMap, bomMap }),
    ...auditInventoryLogs({ inventoryLogs, orderMap, workLogMap, salesMap, purchaseMap, returnMap, adjustmentMap }),
    ...auditSales({ sales, masterMaps }),
    ...auditReturns({ returns, masterMaps }),
    ...auditStockAdjustments({ adjustments: stockAdjustments, masterMaps }),
    ...auditPurchases({ purchases, masterMaps }),
    ...auditCashReferences({ incomes, expenses, salesMap, purchaseMap }),
  ];

  const checkedRecords = [
    productions,
    productionOrders,
    productionWorkLogs,
    inventoryLogs,
    sales,
    returns,
    stockAdjustments,
    purchases,
    incomes,
    expenses,
  ].reduce((sum, items) => sum + items.length, 0);

  return {
    generatedAt: new Date().toISOString(),
    rows,
    summary: buildSummary({ rows, checkedRecords }),
  };
};
