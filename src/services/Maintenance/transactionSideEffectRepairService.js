import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  buildInventoryLogPayload,
  INVENTORY_LOG_COLLECTION,
} from "../Inventory/inventoryLogService";
import { buildSaleIncomePayload } from "../Transaksi/salesService";
import {
  buildPurchaseExpenseDocumentId,
  buildPurchaseExpensePayload,
  getPurchaseSavingMeta,
} from "../Transaksi/purchasesService";

const BATCH_LIMIT = 350;
const SIDE_EFFECT_REPAIR_SOURCE = "transaction_side_effect_repair";
const ACTIVE_SALES_STATUSES = new Set(["Diproses", "Dikirim", "Selesai"]);

const safeTrim = (value) => String(value ?? "").trim();
const normalizeType = (value) => safeTrim(value).toLowerCase();
const toNumber = (value) => {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const readCollectionDocs = async (collectionName) => {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map((itemDoc) => ({
    id: itemDoc.id,
    ref: itemDoc.ref,
    ...itemDoc.data(),
  }));
};

const sanitizeDocIdPart = (value, fallback = "record") => {
  const normalized = safeTrim(value || fallback).replace(/[^a-zA-Z0-9_-]/g, "_");
  return normalized || fallback;
};

const getUniqueReferenceKeys = (values = []) => Array.from(
  new Set(values.map((value) => safeTrim(value)).filter(Boolean)),
);

const getSalesIdentityKeys = (data = {}, docId = "") => getUniqueReferenceKeys([
  docId,
  data.id,
  data.relatedId,
  data.saleId,
  data.referenceId,
  data.sourceId,
  data.sourceRef,
  data.referenceCode,
  data.referenceNumber,
  data.saleNumber,
  data.code,
  data.details?.relatedId,
  data.details?.saleId,
  data.details?.referenceId,
  data.details?.sourceId,
  data.details?.sourceRef,
  data.details?.referenceCode,
  data.details?.referenceNumber,
  data.details?.saleNumber,
]);

const getPurchaseIdentityKeys = (data = {}, docId = "") => getUniqueReferenceKeys([
  docId,
  data.id,
  data.relatedId,
  data.purchaseId,
  data.relatedPurchaseId,
  data.referenceId,
  data.sourceId,
  data.sourceRef,
  data.referenceCode,
  data.referenceNumber,
  data.purchaseNumber,
  data.code,
  data.details?.relatedId,
  data.details?.purchaseId,
  data.details?.relatedPurchaseId,
  data.details?.referenceId,
  data.details?.sourceId,
  data.details?.sourceRef,
  data.details?.referenceCode,
  data.details?.referenceNumber,
  data.details?.purchaseNumber,
]);

const getReturnIdentityKeys = (data = {}, docId = "") => getUniqueReferenceKeys([
  docId,
  data.id,
  data.relatedId,
  data.returnId,
  data.referenceId,
  data.sourceId,
  data.sourceRef,
  data.referenceCode,
  data.referenceNumber,
  data.returnNumber,
  data.code,
  data.details?.relatedId,
  data.details?.returnId,
  data.details?.referenceId,
  data.details?.sourceId,
  data.details?.sourceRef,
  data.details?.referenceCode,
  data.details?.referenceNumber,
  data.details?.returnNumber,
]);

const pushUniqueMapRecord = (map, key, record) => {
  const normalizedKey = safeTrim(key);
  if (!normalizedKey) return;

  const records = map.get(normalizedKey) || [];
  if (!records.some((item) => item.id === record.id)) {
    records.push(record);
  }
  map.set(normalizedKey, records);
};

const getUniqueMapRecordsByKeys = (map, keys = []) => {
  const seenIds = new Set();
  const records = [];

  keys.forEach((key) => {
    (map.get(key) || []).forEach((record) => {
      if (seenIds.has(record.id)) return;
      seenIds.add(record.id);
      records.push(record);
    });
  });

  return records;
};

const getTransactionDate = (data = {}) => {
  const rawDate = data.date || data.createdAt || data.timestamp;
  return rawDate?.toDate ? rawDate : Timestamp.now();
};

const getDisplayReference = (data = {}, fallback = "") => (
  safeTrim(data.saleNumber)
  || safeTrim(data.purchaseNumber)
  || safeTrim(data.returnNumber)
  || safeTrim(data.code)
  || safeTrim(data.referenceNumber)
  || safeTrim(data.sourceRef)
  || safeTrim(fallback)
);

const getStockCollectionName = (type = "") => (type === "product" ? "products" : "raw_materials");

const getLineStockCollectionName = (line = {}, fallbackType = "") => (
  safeTrim(line.collectionName)
  || safeTrim(line.sourceCollection)
  || getStockCollectionName(safeTrim(line.type) || fallbackType)
);

const getLineQuantity = (line = {}) => toNumber(line.quantity ?? line.qty ?? line.totalStockIn ?? line.finalQuantity);

const getPurchaseStockQuantity = (purchase = {}) => toNumber(
  purchase.totalStockIn ?? purchase.finalQuantity ?? purchase.stockInQty ?? purchase.quantity,
);

const isPurchaseExpenseRecord = (data = {}) => {
  const sourceModule = normalizeType(data.sourceModule || data.module || data.sourceType || data.type);
  return Boolean(
    safeTrim(data.relatedPurchaseId)
    || safeTrim(data.purchaseId)
    || safeTrim(data.details?.purchaseId)
    || sourceModule.includes("purchase")
    || sourceModule.includes("pembelian")
  );
};

const buildSideEffectMaps = ({ incomes = [], expenses = [], inventoryLogs = [] } = {}) => {
  const incomeSaleKeys = new Set();
  const purchaseExpenseKeys = new Set();
  const saleInventoryLogsByKey = new Map();
  const purchaseInventoryLogsByKey = new Map();
  const returnInventoryLogsByKey = new Map();

  incomes.forEach((income) => {
    const deterministicSaleId = income.id.startsWith("income_")
      ? safeTrim(income.id.replace(/^income_/, ""))
      : "";

    getSalesIdentityKeys(income, deterministicSaleId).forEach((key) => incomeSaleKeys.add(key));
  });

  expenses.forEach((expense) => {
    if (!isPurchaseExpenseRecord(expense)) return;
    const deterministicPurchaseId = expense.id.includes("__")
      ? safeTrim(expense.id.split("__").slice(1).join("__"))
      : "";

    getPurchaseIdentityKeys(expense, deterministicPurchaseId).forEach((key) => purchaseExpenseKeys.add(key));
  });

  inventoryLogs.forEach((log) => {
    const logType = normalizeType(log.type || log.details?.type);
    if (logType === "sale") {
      getSalesIdentityKeys(log).forEach((key) => pushUniqueMapRecord(saleInventoryLogsByKey, key, log));
      return;
    }
    if (logType === "purchase_in") {
      getPurchaseIdentityKeys(log).forEach((key) => pushUniqueMapRecord(purchaseInventoryLogsByKey, key, log));
      return;
    }
    if (logType === "return_in") {
      getReturnIdentityKeys(log).forEach((key) => pushUniqueMapRecord(returnInventoryLogsByKey, key, log));
    }
  });

  return {
    incomeSaleKeys,
    purchaseExpenseKeys,
    saleInventoryLogsByKey,
    purchaseInventoryLogsByKey,
    returnInventoryLogsByKey,
  };
};

const addRepairRow = (rows, row) => {
  rows.push({
    category: "safe_repair",
    recommendation: "Aman repair lewat menu Reset Maintenance setelah konfirmasi keyword; tidak mengubah stok fisik/master dan tidak menghapus data.",
    ...row,
  });
};

const addManualRow = (rows, row) => {
  rows.push({
    category: "manual",
    executable: false,
    recommendation: "Perlu review manual; repair otomatis tidak membuat rollback/delete side-effect transaksi.",
    ...row,
  });
};

const buildSaleInventoryLogPayload = ({ sale = {}, line = {}, index = 0 }) => {
  const saleReference = getDisplayReference(sale, sale.id);
  const quantity = getLineQuantity(line);
  const itemName = safeTrim(line.itemName || line.name || `Item ${index + 1}`);
  const salesChannel = safeTrim(sale.salesChannel);

  return buildInventoryLogPayload({
    itemId: safeTrim(line.itemId || line.id),
    itemName,
    quantityChange: -Math.abs(quantity),
    type: "sale",
    collectionName: getLineStockCollectionName(line, line.type),
    timestamp: getTransactionDate(sale),
    extraData: {
      customerName: sale.customerName || "",
      saleId: sale.id,
      saleNumber: saleReference,
      referenceId: sale.id,
      referenceCode: saleReference,
      sourceRef: saleReference,
      referenceNumber: saleReference,
      referenceType: "sale",
      note: salesChannel ? `Repair log penjualan via ${salesChannel}` : "Repair log penjualan",
      subtotal: toNumber(line.subtotal),
      unit: line.unit || "",
      stockUnit: line.stockUnit || line.unit || "",
      variantKey: line.variantKey || "",
      variantLabel: line.variantLabel || "",
      stockSourceType: line.stockSourceType || (line.variantKey ? "variant" : "master"),
      repairedByMaintenance: true,
      repairSource: SIDE_EFFECT_REPAIR_SOURCE,
    },
  });
};

const buildPurchaseInventoryLogPayload = ({ purchase = {} }) => {
  const purchaseReference = getDisplayReference(purchase, purchase.id);
  const collectionName = getStockCollectionName(purchase.type);
  const quantity = getPurchaseStockQuantity(purchase);
  const stockUnit = purchase.stockUnit || purchase.unit || purchase.purchaseUnit || "";

  return buildInventoryLogPayload({
    itemId: purchase.itemId || "",
    itemName: purchase.itemName || "Item pembelian",
    quantityChange: quantity,
    type: "purchase_in",
    collectionName,
    timestamp: getTransactionDate(purchase),
    extraData: {
      purchaseId: purchase.id,
      purchaseNumber: purchaseReference,
      referenceId: purchase.id,
      referenceNumber: purchaseReference,
      referenceCode: purchaseReference,
      sourceRef: purchaseReference,
      referenceType: "purchase",
      supplierName: purchase.supplierName || "",
      unit: stockUnit,
      stockUnit,
      purchaseUnit: purchase.purchaseUnit || "",
      variantKey: purchase.variantKey || purchase.materialVariantId || "",
      variantLabel: purchase.variantLabel || purchase.materialVariantName || "",
      stockSourceType: purchase.stockSourceType || ((purchase.variantKey || purchase.materialVariantId) ? "variant" : "master"),
      materialVariantId: purchase.materialVariantId || null,
      materialVariantName: purchase.materialVariantName || purchase.variantLabel || "",
      totalActualPurchase: toNumber(purchase.totalActualPurchase),
      actualUnitCost: toNumber(purchase.actualUnitCost),
      totalReferencePurchase: toNumber(purchase.totalReferencePurchase),
      purchaseSaving: toNumber(purchase.purchaseSaving),
      purchaseSavingStatus: purchase.purchaseSavingStatus || "",
      note: safeTrim(purchase.note || "Repair log pembelian"),
      repairedByMaintenance: true,
      repairSource: SIDE_EFFECT_REPAIR_SOURCE,
    },
  });
};

const buildReturnInventoryLogPayload = ({ returnRecord = {} }) => {
  const returnReference = getDisplayReference(returnRecord, returnRecord.id);
  const collectionName = getStockCollectionName(returnRecord.type);
  const stockUnit = returnRecord.stockUnit || returnRecord.unit || (collectionName === "products" ? "pcs" : "");
  const quantity = toNumber(returnRecord.quantity ?? returnRecord.qty);

  return buildInventoryLogPayload({
    itemId: returnRecord.itemId || "",
    itemName: returnRecord.itemName || "Item retur",
    quantityChange: quantity,
    type: "return_in",
    collectionName,
    timestamp: getTransactionDate(returnRecord),
    extraData: {
      returnId: returnRecord.id,
      returnNumber: returnReference,
      referenceId: returnRecord.id,
      referenceNumber: returnReference,
      referenceCode: returnReference,
      sourceRef: returnReference,
      referenceType: "return",
      unit: stockUnit,
      stockUnit,
      note: safeTrim(returnRecord.note || "Repair log retur"),
      variantKey: returnRecord.variantKey || "",
      variantLabel: returnRecord.variantLabel || "",
      stockSourceType: returnRecord.stockSourceType || (returnRecord.variantKey ? "variant" : "master"),
      repairedByMaintenance: true,
      repairSource: SIDE_EFFECT_REPAIR_SOURCE,
    },
  });
};

const buildPurchaseExpenseRepairPayload = (purchase = {}) => {
  const totalActualPurchase = Math.round(toNumber(purchase.totalActualPurchase ?? purchase.total ?? purchase.amount ?? purchase.subtotalItems));
  const totalReferencePurchase = Math.round(toNumber(purchase.totalReferencePurchase));
  const purchaseSaving = Math.round(toNumber(purchase.purchaseSaving));
  const savingMeta = getPurchaseSavingMeta(purchaseSaving);

  return buildPurchaseExpensePayload({
    date: getTransactionDate(purchase),
    itemId: purchase.itemId || "",
    itemName: purchase.itemName || "Item pembelian",
    itemType: purchase.type || "material",
    purchaseId: purchase.id,
    purchasePayload: purchase,
    resolvedSupplierId: purchase.supplierId || null,
    savingMeta,
    selectedSupplierName: purchase.supplierName || "",
    totalActualPurchase,
    totalReferencePurchase,
    purchaseSaving,
    variantKey: purchase.variantKey || purchase.materialVariantId || "",
    variantLabel: purchase.variantLabel || purchase.materialVariantName || "",
    stockSourceType: purchase.stockSourceType || ((purchase.variantKey || purchase.materialVariantId) ? "variant" : "master"),
  });
};

const buildPublicRow = (row = {}) => {
  const publicRow = { ...row };
  delete publicRow.payload;
  return publicRow;
};

const buildSummary = (rows = [], scannedCount = 0) => {
  const executableRows = rows.filter((row) => row.executable);
  const totalChecked = Number(scannedCount || 0);

  return {
    checkedRecords: totalChecked,
    okCount: Math.max(totalChecked - rows.length, 0),
    issueCount: rows.length,
    manualReviewCount: rows.filter((row) => row.category === "manual").length,
    safeRepairCount: executableRows.length,
    executablePlanCount: executableRows.length,
    incomePlanCount: executableRows.filter((row) => row.targetCollection === "incomes").length,
    expensePlanCount: executableRows.filter((row) => row.targetCollection === "expenses").length,
    inventoryLogPlanCount: executableRows.filter((row) => row.targetCollection === INVENTORY_LOG_COLLECTION).length,
  };
};

const buildTransactionSideEffectPlans = async () => {
  const [sales, purchases, returns, incomes, expenses, inventoryLogs] = await Promise.all([
    readCollectionDocs("sales"),
    readCollectionDocs("purchases"),
    readCollectionDocs("returns"),
    readCollectionDocs("incomes"),
    readCollectionDocs("expenses"),
    readCollectionDocs(INVENTORY_LOG_COLLECTION),
  ]);

  const maps = buildSideEffectMaps({ incomes, expenses, inventoryLogs });
  const rows = [];

  sales.forEach((sale) => {
    const saleReference = getDisplayReference(sale, sale.id);
    const saleKeys = getSalesIdentityKeys(sale, sale.id);
    const hasIncome = saleKeys.some((key) => maps.incomeSaleKeys.has(key));
    const saleLogs = getUniqueMapRecordsByKeys(maps.saleInventoryLogsByKey, saleKeys);
    const saleItems = Array.isArray(sale.items) ? sale.items : [];
    const status = safeTrim(sale.status);
    const amount = toNumber(sale.total);

    if (["Diproses", "Dikirim"].includes(status) && hasIncome) {
      addManualRow(rows, {
        key: `sales-income-conflict:${sale.id}`,
        area: "Sales",
        sideEffect: "Income",
        sourceCollection: "sales",
        sourceId: sale.id,
        sourceRef: saleReference,
        targetCollection: "incomes",
        issue: "Sales belum Selesai sudah punya income. Tidak dihapus otomatis agar laporan bisa direview manual.",
        amount,
      });
    }

    if (status === "Selesai" && amount > 0 && !hasIncome) {
      const targetDocId = `income_${sanitizeDocIdPart(sale.id, saleReference)}`;
      addRepairRow(rows, {
        key: `sales-income-missing:${sale.id}`,
        area: "Sales",
        sideEffect: "Income",
        sourceCollection: "sales",
        sourceId: sale.id,
        sourceRef: saleReference,
        targetCollection: "incomes",
        targetDocId,
        issue: "Sales Selesai belum punya income resmi.",
        amount,
        executable: true,
        payload: {
          collectionName: "incomes",
          docId: targetDocId,
          data: {
            ...buildSaleIncomePayload({ selectedSale: sale, saleId: sale.id, dateValue: getTransactionDate(sale) }),
            repairedByMaintenance: true,
            repairSource: SIDE_EFFECT_REPAIR_SOURCE,
            maintenanceRepairedAt: serverTimestamp(),
          },
        },
      });
    }

    if (ACTIVE_SALES_STATUSES.has(status) && saleItems.length > 0 && saleLogs.length === 0) {
      saleItems.forEach((line, index) => {
        const quantity = getLineQuantity(line);
        if (quantity <= 0) return;
        const targetDocId = `repair_sale_log__${sanitizeDocIdPart(sale.id, saleReference)}__${index + 1}`;
        addRepairRow(rows, {
          key: `sales-log-missing:${sale.id}:${index}`,
          area: "Sales",
          sideEffect: "Inventory Log",
          sourceCollection: "sales",
          sourceId: sale.id,
          sourceRef: saleReference,
          targetCollection: INVENTORY_LOG_COLLECTION,
          targetDocId,
          issue: "Sales aktif/selesai belum punya inventory log sale.",
          quantityChange: -Math.abs(quantity),
          executable: true,
          payload: {
            collectionName: INVENTORY_LOG_COLLECTION,
            docId: targetDocId,
            data: {
              ...buildSaleInventoryLogPayload({ sale, line, index }),
              maintenanceRepairedAt: serverTimestamp(),
            },
          },
        });
      });
    }
  });

  purchases.forEach((purchase) => {
    const purchaseReference = getDisplayReference(purchase, purchase.id);
    const purchaseKeys = getPurchaseIdentityKeys(purchase, purchase.id);
    const hasExpense = purchaseKeys.some((key) => maps.purchaseExpenseKeys.has(key));
    const purchaseLogs = getUniqueMapRecordsByKeys(maps.purchaseInventoryLogsByKey, purchaseKeys);
    const amount = toNumber(purchase.totalActualPurchase ?? purchase.total ?? purchase.amount ?? purchase.subtotalItems);
    const stockIn = getPurchaseStockQuantity(purchase);

    if (amount > 0 && !hasExpense) {
      const targetDocId = buildPurchaseExpenseDocumentId(purchase.id);
      addRepairRow(rows, {
        key: `purchase-expense-missing:${purchase.id}`,
        area: "Purchases",
        sideEffect: "Expense",
        sourceCollection: "purchases",
        sourceId: purchase.id,
        sourceRef: purchaseReference,
        targetCollection: "expenses",
        targetDocId,
        issue: "Purchase bernilai lebih dari 0 belum punya expense otomatis.",
        amount,
        executable: true,
        payload: {
          collectionName: "expenses",
          docId: targetDocId,
          data: {
            ...buildPurchaseExpenseRepairPayload(purchase),
            repairedByMaintenance: true,
            repairSource: SIDE_EFFECT_REPAIR_SOURCE,
            maintenanceRepairedAt: serverTimestamp(),
          },
        },
      });
    }

    if (stockIn > 0 && purchaseLogs.length === 0) {
      const targetDocId = `repair_purchase_log__${sanitizeDocIdPart(purchase.id, purchaseReference)}`;
      addRepairRow(rows, {
        key: `purchase-log-missing:${purchase.id}`,
        area: "Purchases",
        sideEffect: "Inventory Log",
        sourceCollection: "purchases",
        sourceId: purchase.id,
        sourceRef: purchaseReference,
        targetCollection: INVENTORY_LOG_COLLECTION,
        targetDocId,
        issue: "Purchase punya stok masuk tetapi belum punya inventory log purchase_in.",
        quantityChange: stockIn,
        executable: true,
        payload: {
          collectionName: INVENTORY_LOG_COLLECTION,
          docId: targetDocId,
          data: {
            ...buildPurchaseInventoryLogPayload({ purchase }),
            maintenanceRepairedAt: serverTimestamp(),
          },
        },
      });
    }
  });

  returns.forEach((returnRecord) => {
    const returnReference = getDisplayReference(returnRecord, returnRecord.id);
    const returnKeys = getReturnIdentityKeys(returnRecord, returnRecord.id);
    const returnLogs = getUniqueMapRecordsByKeys(maps.returnInventoryLogsByKey, returnKeys);
    const quantity = toNumber(returnRecord.quantity ?? returnRecord.qty);

    if (quantity > 0 && returnLogs.length === 0) {
      const targetDocId = `repair_return_log__${sanitizeDocIdPart(returnRecord.id, returnReference)}`;
      addRepairRow(rows, {
        key: `return-log-missing:${returnRecord.id}`,
        area: "Returns",
        sideEffect: "Inventory Log",
        sourceCollection: "returns",
        sourceId: returnRecord.id,
        sourceRef: returnReference,
        targetCollection: INVENTORY_LOG_COLLECTION,
        targetDocId,
        issue: "Return punya stok masuk tetapi belum punya inventory log return_in.",
        quantityChange: quantity,
        executable: true,
        payload: {
          collectionName: INVENTORY_LOG_COLLECTION,
          docId: targetDocId,
          data: {
            ...buildReturnInventoryLogPayload({ returnRecord }),
            maintenanceRepairedAt: serverTimestamp(),
          },
        },
      });
    }
  });

  return {
    rows,
    scannedCount: sales.length + purchases.length + returns.length + incomes.length + expenses.length + inventoryLogs.length,
  };
};

export const getTransactionSideEffectRepairAudit = async () => {
  const { rows, scannedCount } = await buildTransactionSideEffectPlans();

  return {
    generatedAt: new Date().toISOString(),
    rows: rows.map(buildPublicRow),
    summary: buildSummary(rows, scannedCount),
    affectedCollections: ["sales", "purchases", "returns", "incomes", "expenses", INVENTORY_LOG_COLLECTION],
  };
};

export const repairTransactionSideEffects = async () => {
  const { rows, scannedCount } = await buildTransactionSideEffectPlans();
  const plans = rows.filter((row) => row.executable && row.payload);
  let batch = writeBatch(db);
  let operationCount = 0;
  let createdCount = 0;

  for (const plan of plans) {
    batch.set(doc(db, plan.payload.collectionName, plan.payload.docId), plan.payload.data);
    operationCount += 1;
    createdCount += 1;

    if (operationCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
  }

  if (operationCount > 0) await batch.commit();

  return {
    message: `Repair side-effect transaksi selesai. ${createdCount} dokumen audit/finance dibuat tanpa mengubah stok master atau dokumen transaksi utama.`,
    updatedCount: createdCount,
    createdCount,
    skippedCount: rows.length - createdCount,
    summary: buildSummary(rows, scannedCount),
    affectedCollections: ["incomes", "expenses", INVENTORY_LOG_COLLECTION],
  };
};
