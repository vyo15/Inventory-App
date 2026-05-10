import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";

const SAMPLE_LIMIT = 10;

const KNOWN_BUSINESS_PREFIXES = [
  "SAL",
  "PUR",
  "RET",
  "CIN",
  "COUT",
  "PP",
  "PO-PRD",
  "PO-SFP",
  "WL",
  "PAY",
  "BOM",
  "STEP",
  "PRD",
  "RM",
  "SFP",
  "SUP",
  "CUS",
];

/*
=====================================================
SECTION: Helper audit data lama — LEGACY-COMPAT
Fungsi:
- Membaca collection lama secara read-only, mengenali kode bisnis manusiawi, dan membedakan reference teknis Firestore ID random dari reference operasional.

Dipakai oleh:
- getDataQualityAudit di dataQualityAuditService.js dan section Data Quality Audit di ResetMaintenanceData.jsx.

Alasan perubahan:
- Project masih tahap membangun sehingga data lama perlu dipetakan dulu sebelum reset/recreate, tanpa migration, backfill, delete, atau write otomatis.

Catatan cleanup:
- Jika standar kode bisnis sudah stabil penuh, daftar prefix bisa dipindah ke shared reference helper agar sama dengan generator kode baru.

Risiko:
- Jika helper ini dibuat terlalu longgar, data random ID bisa dianggap aman; jika terlalu ketat, data lama valid bisa masuk daftar perlu cek manual.
=====================================================
*/
const safeTrim = (value) => String(value ?? "").trim();
const normalizeType = (value) => safeTrim(value).toLowerCase();
const toNumber = (value) => {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const isPlainObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));

const getNestedValue = (data = {}, path = "") => {
  if (!path) return "";
  return path.split(".").reduce((current, key) => (isPlainObject(current) ? current[key] : undefined), data);
};

const getFirstReferenceValue = (data = {}, fieldNames = []) => {
  for (const fieldName of fieldNames) {
    const value = getNestedValue(data, fieldName);
    if (safeTrim(value)) return safeTrim(value);
  }
  return "";
};

const hasKnownBusinessPrefix = (value) => {
  const ref = safeTrim(value).toUpperCase();
  if (!ref) return false;
  return KNOWN_BUSINESS_PREFIXES.some((prefix) => ref === prefix || ref.startsWith(`${prefix}-`));
};

const hasPrefix = (data = {}, prefixes = [], fields = []) => {
  const upperPrefixes = prefixes.map((prefix) => safeTrim(prefix).toUpperCase()).filter(Boolean);
  return fields.some((fieldName) => {
    const value = safeTrim(getNestedValue(data, fieldName)).toUpperCase();
    return value && upperPrefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}-`));
  });
};

const looksLikeFirestoreId = (value) => {
  const ref = safeTrim(value);
  if (!ref || hasKnownBusinessPrefix(ref)) return false;
  if (ref.includes("-") || ref.includes("/")) return false;
  return /^[A-Za-z0-9_]{16,}$/.test(ref);
};

const isHumanReference = (value) => {
  const ref = safeTrim(value);
  if (!ref) return false;
  if (hasKnownBusinessPrefix(ref)) return true;
  if (looksLikeFirestoreId(ref)) return false;
  return /[A-Za-z]/.test(ref) && /[-_/\s]/.test(ref) && ref.length >= 4;
};

const getDisplayName = (data = {}, fallback = "-") => (
  safeTrim(data.name) ||
  safeTrim(data.productName) ||
  safeTrim(data.materialName) ||
  safeTrim(data.itemName) ||
  safeTrim(data.customerName) ||
  safeTrim(data.supplierName) ||
  safeTrim(data.description) ||
  safeTrim(data.notes) ||
  fallback
);

const getBestReference = (data = {}, docId = "") => (
  getFirstReferenceValue(data, [
    "saleNumber",
    "purchaseNumber",
    "returnNumber",
    "cashInNumber",
    "cashOutNumber",
    "code",
    "planCode",
    "workNumber",
    "payrollNumber",
    "sourceRef",
    "referenceCode",
    "referenceNumber",
    "productionOrderCode",
    "bomCode",
  ]) || docId
);

const toSample = ({ collectionName, itemDoc, issue, recommendation }) => {
  const data = itemDoc.data();
  const reference = getBestReference(data, itemDoc.id);
  return {
    key: `${collectionName}:${itemDoc.id}:${issue}`,
    collectionName,
    id: itemDoc.id,
    reference,
    name: getDisplayName(data, reference),
    issue,
    recommendation,
  };
};

const readCollectionSafe = async (collectionName) => {
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    return { collectionName, docs: snapshot.docs, error: "" };
  } catch (error) {
    console.error(error);
    return {
      collectionName,
      docs: [],
      error: error?.message || `Collection ${collectionName} tidak bisa dibaca.`,
    };
  }
};

/*
=====================================================
SECTION: Kategori masalah data — LEGACY-COMPAT
Fungsi:
- Menetapkan kategori audit, label summary, rekomendasi, dan batas sample yang tampil untuk data lama yang belum sesuai standar kode/reference baru.

Dipakai oleh:
- getDataQualityAudit dan tabel Data Quality Audit di ResetMaintenanceData.jsx.

Alasan perubahan:
- Admin butuh daftar data yang perlu dibuat ulang setelah reset testing, bukan migration/backfill massal yang berisiko menumpuk data legacy.

Catatan cleanup:
- Kategori bisa dipisah menjadi config docs jika standar audit data lama makin banyak.

Risiko:
- Salah rekomendasi kategori dapat membuat data asli dianggap aman direset; karena itu label tetap memakai “jika data test” dan “perlu cek manual”.
=====================================================
*/
const CATEGORY_CONFIGS = [
  {
    key: "sales_missing_sal",
    label: "Sales tanpa kode SAL",
    recommendation: "Aman dibuat ulang jika data test",
  },
  {
    key: "purchases_missing_pur",
    label: "Purchase tanpa kode PUR",
    recommendation: "Aman dibuat ulang jika data test",
  },
  {
    key: "returns_missing_ret",
    label: "Return tanpa kode RET",
    recommendation: "Aman dibuat ulang jika data test",
  },
  {
    key: "cash_missing_cin_cout",
    label: "Cash In/Out tanpa kode CIN/COUT",
    recommendation: "Perlu cek manual",
  },
  {
    key: "work_logs_missing_wl",
    label: "Work Log tanpa workNumber manusiawi",
    recommendation: "Aman dibuat ulang jika data test",
  },
  {
    key: "work_logs_zero_cost",
    label: "Work Log cost 0",
    recommendation: "Aman dibuat ulang jika data test",
  },
  {
    key: "work_logs_empty_material_snapshot",
    label: "Work Log material snapshot kosong",
    recommendation: "Aman dibuat ulang jika data test",
  },
  {
    key: "payroll_unclear_reference",
    label: "Payroll tanpa payrollNumber/sourceRef jelas",
    recommendation: "Perlu cek manual",
  },
  {
    key: "inventory_log_random_reference",
    label: "Inventory Log reference masih ID random",
    recommendation: "Aman dibuat ulang jika data test",
  },
  {
    key: "cash_source_unclear",
    label: "Expense/Income source tidak jelas",
    recommendation: "Perlu cek manual",
  },
  {
    key: "hpp_zero_master",
    label: "HPP produk/semi finished 0",
    recommendation: "Jangan reset jika data asli",
  },
];

const createCategoryAccumulator = () => CATEGORY_CONFIGS.reduce((acc, item) => {
  acc[item.key] = {
    ...item,
    count: 0,
    samples: [],
  };
  return acc;
}, {});

const addIssue = (categories, categoryKey, sample) => {
  const category = categories[categoryKey];
  if (!category) return;
  category.count += 1;
  if (category.samples.length < SAMPLE_LIMIT) {
    category.samples.push(sample);
  }
};

const hasClearHumanSourceReference = (data = {}, fields = []) => fields.some((fieldName) => {
  const value = getNestedValue(data, fieldName);
  return isHumanReference(value);
});

const isManualCashOutExpense = (data = {}) => {
  const sourceModule = normalizeType(data.sourceModule || data.module || data.sourceType || data.type);
  const hasPurchaseLink = Boolean(
    safeTrim(data.relatedPurchaseId) ||
    safeTrim(data.purchaseId) ||
    safeTrim(data.details?.purchaseId)
  );
  const hasPayrollLink = Boolean(
    safeTrim(data.payrollId) ||
    safeTrim(data.productionPayrollId) ||
    safeTrim(data.relatedPayrollId) ||
    sourceModule.includes("payroll")
  );

  if (hasPurchaseLink || hasPayrollLink) return false;
  if (!sourceModule) return true;
  return sourceModule.includes("cash") || sourceModule.includes("manual") || sourceModule.includes("expense");
};

const isManualCashInRevenue = (data = {}) => {
  const sourceModule = normalizeType(data.sourceModule || data.module || data.sourceType || data.type);
  if (sourceModule.includes("sales") || sourceModule.includes("penjualan")) return false;
  return true;
};

const hasMaterialSnapshotIssue = (data = {}) => {
  const materialUsages = Array.isArray(data.materialUsages)
    ? data.materialUsages
    : Array.isArray(data.materials)
      ? data.materials
      : [];

  if (!materialUsages.length) return true;

  return materialUsages.some((line = {}) => {
    const qty = toNumber(line.actualQty ?? line.qty ?? line.quantity ?? line.plannedQty);
    if (qty <= 0) return false;
    const unitCost = toNumber(line.costPerUnitSnapshot ?? line.unitCostSnapshot ?? line.actualUnitCost ?? line.costPerUnit);
    const totalCost = toNumber(line.totalCostSnapshot ?? line.totalCostActual ?? line.totalCost);
    return unitCost <= 0 && totalCost <= 0;
  });
};

const hasUnclearSource = (data = {}) => {
  const sourceModule = safeTrim(data.sourceModule || data.module || data.sourceType || data.type);
  const sourceRef = getFirstReferenceValue(data, [
    "sourceRef",
    "referenceCode",
    "referenceNumber",
    "cashInNumber",
    "cashOutNumber",
    "saleNumber",
    "purchaseNumber",
    "payrollNumber",
  ]);
  const technicalRef = getFirstReferenceValue(data, [
    "sourceId",
    "relatedId",
    "referenceId",
    "saleId",
    "purchaseId",
    "payrollId",
  ]);

  if (sourceModule && isHumanReference(sourceRef)) return false;
  if (sourceModule && sourceRef && !looksLikeFirestoreId(sourceRef)) return false;
  if (sourceModule && technicalRef && !looksLikeFirestoreId(technicalRef)) return false;

  return !sourceModule || !sourceRef || looksLikeFirestoreId(sourceRef) || looksLikeFirestoreId(technicalRef);
};

export const getDataQualityAudit = async () => {
  const categories = createCategoryAccumulator();
  const collectionNames = [
    "sales",
    "purchases",
    "returns",
    "revenues",
    "expenses",
    "incomes",
    "production_work_logs",
    "production_payrolls",
    "inventory_logs",
    "products",
    "semi_finished_materials",
  ];

  const collectionResults = await Promise.all(collectionNames.map(readCollectionSafe));
  const collectionMap = collectionResults.reduce((acc, item) => {
    acc[item.collectionName] = item;
    return acc;
  }, {});

  (collectionMap.sales?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (!hasPrefix(data, ["SAL"], ["saleNumber", "code", "referenceNumber", "sourceRef"])) {
      addIssue(categories, "sales_missing_sal", toSample({
        collectionName: "sales",
        itemDoc,
        issue: "Belum punya kode Sales format SAL.",
        recommendation: categories.sales_missing_sal.recommendation,
      }));
    }
  });

  (collectionMap.purchases?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (!hasPrefix(data, ["PUR"], ["purchaseNumber", "code", "referenceNumber", "sourceRef"])) {
      addIssue(categories, "purchases_missing_pur", toSample({
        collectionName: "purchases",
        itemDoc,
        issue: "Belum punya kode Purchase format PUR.",
        recommendation: categories.purchases_missing_pur.recommendation,
      }));
    }
  });

  (collectionMap.returns?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (!hasPrefix(data, ["RET"], ["returnNumber", "code", "referenceNumber", "sourceRef"])) {
      addIssue(categories, "returns_missing_ret", toSample({
        collectionName: "returns",
        itemDoc,
        issue: "Belum punya kode Return format RET.",
        recommendation: categories.returns_missing_ret.recommendation,
      }));
    }
  });

  (collectionMap.revenues?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (isManualCashInRevenue(data) && !hasPrefix(data, ["CIN"], ["cashInNumber", "code", "referenceNumber", "sourceRef"])) {
      addIssue(categories, "cash_missing_cin_cout", toSample({
        collectionName: "revenues",
        itemDoc,
        issue: "Cash In manual belum punya kode CIN.",
        recommendation: categories.cash_missing_cin_cout.recommendation,
      }));
    }
  });

  (collectionMap.expenses?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (isManualCashOutExpense(data) && !hasPrefix(data, ["COUT"], ["cashOutNumber", "code", "referenceNumber", "sourceRef"])) {
      addIssue(categories, "cash_missing_cin_cout", toSample({
        collectionName: "expenses",
        itemDoc,
        issue: "Cash Out manual belum punya kode COUT.",
        recommendation: categories.cash_missing_cin_cout.recommendation,
      }));
    }
  });

  (collectionMap.production_work_logs?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (!hasPrefix(data, ["WL"], ["workNumber", "code", "referenceNumber", "sourceRef"])) {
      addIssue(categories, "work_logs_missing_wl", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: "Work Log belum punya workNumber format WL.",
        recommendation: categories.work_logs_missing_wl.recommendation,
      }));
    }

    const status = normalizeType(data.status);
    const goodQty = toNumber(data.goodQty ?? data.outputGoodQty ?? data.completedQty ?? data.actualOutputQty);
    const totalCost = toNumber(data.totalCostActual ?? data.totalActualCost ?? data.costTotalActual);
    if ((status === "completed" || goodQty > 0) && totalCost <= 0) {
      addIssue(categories, "work_logs_zero_cost", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: "Work Log completed/good qty punya total cost 0.",
        recommendation: categories.work_logs_zero_cost.recommendation,
      }));
    }

    const materialUsageLines = Array.isArray(data.materialUsages)
      ? data.materialUsages
      : Array.isArray(data.materials)
        ? data.materials
        : [];
    if ((status === "completed" || materialUsageLines.length > 0) && hasMaterialSnapshotIssue(data)) {
      addIssue(categories, "work_logs_empty_material_snapshot", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: "Material usage belum punya snapshot cost yang jelas.",
        recommendation: categories.work_logs_empty_material_snapshot.recommendation,
      }));
    }
  });

  (collectionMap.production_payrolls?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const hasPayrollNumber = hasPrefix(data, ["WL", "PAY"], ["payrollNumber", "code", "referenceNumber"]);
    const hasSourceRef = hasClearHumanSourceReference(data, ["sourceRef", "workNumber", "workLogNumber", "referenceCode", "workLogRef"]);
    if (!hasPayrollNumber || !hasSourceRef) {
      addIssue(categories, "payroll_unclear_reference", toSample({
        collectionName: "production_payrolls",
        itemDoc,
        issue: "Payroll belum punya payrollNumber/sourceRef manusiawi yang jelas.",
        recommendation: categories.payroll_unclear_reference.recommendation,
      }));
    }
  });

  (collectionMap.inventory_logs?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const humanRef = getFirstReferenceValue(data, [
      "sourceRef",
      "referenceCode",
      "referenceNumber",
      "displayReference",
      "auditReference",
      "details.sourceRef",
      "details.referenceCode",
      "details.referenceNumber",
    ]);
    const technicalRef = getFirstReferenceValue(data, [
      "referenceId",
      "sourceId",
      "relatedId",
      "workLogId",
      "purchaseId",
      "saleId",
      "returnId",
      "details.referenceId",
      "details.sourceId",
      "details.workLogId",
    ]);

    if (!isHumanReference(humanRef) && (looksLikeFirestoreId(technicalRef) || !safeTrim(humanRef))) {
      addIssue(categories, "inventory_log_random_reference", toSample({
        collectionName: "inventory_logs",
        itemDoc,
        issue: "Inventory Log belum punya reference manusiawi; masih kosong atau ID teknis.",
        recommendation: categories.inventory_log_random_reference.recommendation,
      }));
    }
  });

  ["expenses", "incomes", "revenues"].forEach((collectionName) => {
    (collectionMap[collectionName]?.docs || []).forEach((itemDoc) => {
      const data = itemDoc.data();
      if (hasUnclearSource(data)) {
        addIssue(categories, "cash_source_unclear", toSample({
          collectionName,
          itemDoc,
          issue: "Source/sourceRef income atau expense belum jelas.",
          recommendation: categories.cash_source_unclear.recommendation,
        }));
      }
    });
  });

  (collectionMap.products?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const isRelevant = data.isActive !== false && data.active !== false;
    if (isRelevant && toNumber(data.hppPerUnit ?? data.hpp ?? data.costPerUnit) <= 0) {
      addIssue(categories, "hpp_zero_master", toSample({
        collectionName: "products",
        itemDoc,
        issue: "HPP produk jadi masih 0.",
        recommendation: categories.hpp_zero_master.recommendation,
      }));
    }
  });

  (collectionMap.semi_finished_materials?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const isRelevant = data.isActive !== false && data.active !== false;
    if (isRelevant && toNumber(data.averageCostPerUnit ?? data.hppPerUnit ?? data.costPerUnit) <= 0) {
      addIssue(categories, "hpp_zero_master", toSample({
        collectionName: "semi_finished_materials",
        itemDoc,
        issue: "Average cost semi finished masih 0.",
        recommendation: categories.hpp_zero_master.recommendation,
      }));
    }
  });

  const categoriesResult = CATEGORY_CONFIGS.map((config) => categories[config.key]);
  const skippedCollections = collectionResults
    .filter((item) => item.error)
    .map((item) => ({ key: item.collectionName, error: item.error }));
  const checkedRecords = collectionResults.reduce((sum, item) => sum + item.docs.length, 0);
  const totalIssueRecords = categoriesResult.reduce((sum, item) => sum + item.count, 0);

  return {
    generatedAt: new Date().toISOString(),
    sampleLimit: SAMPLE_LIMIT,
    summary: {
      checkedRecords,
      totalIssueRecords,
      totalCategoriesWithIssues: categoriesResult.filter((item) => item.count > 0).length,
      skippedCollections: skippedCollections.length,
    },
    skippedCollections,
    categories: categoriesResult,
  };
};

export default getDataQualityAudit;
