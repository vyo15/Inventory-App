import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import {
  calculateBomCostSummary,
  hydrateBomMaterialLinesWithLiveCost,
} from "../../utils/produksi/productionBomCostHelpers";

const SAMPLE_LIMIT = 10;
const BOM_COST_COMPARE_TOLERANCE = 1;

const KNOWN_BUSINESS_PREFIXES = [
  "ORD",
  "SAL",
  "PUR",
  "RET",
  "CSH-IN",
  "CSH-OUT",
  "CIN",
  "COUT",
  "PP",
  "PO-PRD",
  "PO-SFP",
  "STK-ADJ",
  "JOB",
  "WL",
  "PAY",
  "BOM",
  "STP",
  "STEP",
  "PRD",
  "RAW",
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

const getUniqueReferenceKeys = (values = []) => Array.from(
  new Set(values.map((value) => safeTrim(value)).filter(Boolean)),
);

const getSalesIdentityKeys = (data = {}, docId = "") => getUniqueReferenceKeys([
  docId,
  data.saleNumber,
  data.code,
  data.referenceNumber,
  data.sourceRef,
  data.referenceCode,
]);

const getSalesLinkedKeys = (data = {}, docId = "") => getUniqueReferenceKeys([
  docId,
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

const pushUniqueMapRecord = (map, key, record) => {
  const normalizedKey = safeTrim(key);
  if (!normalizedKey) return;

  const existingRecords = map.get(normalizedKey) || [];
  if (!existingRecords.some((item) => item.id === record.id)) {
    existingRecords.push(record);
  }
  map.set(normalizedKey, existingRecords);
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
    label: "Sales/Order tanpa kode ORD",
    recommendation: "Aman dibuat ulang jika data test",
  },
  {
    key: "purchases_missing_pur",
    label: "Purchase tanpa kode PUR",
    recommendation: "Aman dibuat ulang jika data test",
  },
  {
    key: "sales_cancel_stock_revert_conflict",
    label: "Sales cancel/revert stok tidak sinkron",
    recommendation: "Perlu cek manual sebelum lanjut transaksi",
  },
  {
    key: "sales_cancel_income_conflict",
    label: "Sales dibatalkan masih punya income",
    recommendation: "Perlu cek manual sebelum laporan final",
  },
  {
    key: "sales_pending_income_conflict",
    label: "Sales belum selesai sudah punya income",
    recommendation: "Perlu cek manual sebelum laporan final",
  },
  {
    key: "sales_completed_income_missing",
    label: "Sales selesai belum punya income",
    recommendation: "Perlu cek manual sebelum laporan final",
  },
  {
    key: "returns_missing_ret",
    label: "Return tanpa kode RET",
    recommendation: "Aman dibuat ulang jika data test",
  },
  {
    key: "cash_missing_cin_cout",
    label: "Cash In/Out tanpa kode CSH-IN/CSH-OUT",
    recommendation: "Perlu cek manual",
  },
  {
    key: "work_logs_missing_wl",
    label: "Work Log tanpa kode JOB",
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
    key: "work_logs_legacy_status",
    label: "Work Log status legacy",
    recommendation: "Perlu cek manual; flow aktif hanya in_progress/completed",
  },
  {
    key: "work_logs_payroll_pending",
    label: "Work Log menunggu payroll final",
    recommendation: "Finalkan payroll sebelum angka HPP dipakai sebagai final",
  },
  {
    key: "work_logs_payroll_cost_mismatch",
    label: "Work Log payroll/cost tidak sinkron",
    recommendation: "Perlu cek payroll final dan ringkasan cost Work Log",
  },
  {
    key: "work_logs_output_hpp_reconcile_needed",
    label: "Output HPP perlu reconcile",
    recommendation: "Payroll sync baru sudah auto reconcile; untuk data lama jalankan review/backfill guarded dengan preview terlebih dahulu",
  },
  {
    key: "work_logs_output_cost_stale",
    label: "Output line HPP stale",
    recommendation: "Cek Work Log completed; output line cost harus sama dengan HPP final Work Log setelah payroll final",
  },
  {
    key: "work_logs_master_hpp_stale",
    label: "Master HPP output stale",
    recommendation: "Cek master Product/Semi Finished; HPP/average cost master terlihat belum sinkron dengan output final",
  },
  {
    key: "work_logs_variant_hpp_stale",
    label: "Variant output HPP stale",
    recommendation: "Cek varian output produksi; HPP/average cost varian terlihat belum sinkron dengan output final",
  },
  {
    key: "semi_finished_missing_flower_group",
    label: "Semi Finished tanpa jenis bunga",
    recommendation: "Lengkapi flowerGroup agar BOM/PO/filter produksi tidak fallback diam-diam",
  },
  {
    key: "production_boms_stale_cost_estimate",
    label: "BOM estimate stale terhadap master cost",
    recommendation: "Perlu cek BOM/Reset HPP; audit ini read-only dan tidak auto-fix",
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
    key: "master_missing_code",
    label: "Master data tanpa kode otomatis",
    recommendation: "Aman dibuat ulang jika data test",
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

const getWorkLogIdentityKeys = (data = {}, docId = "") => getUniqueReferenceKeys([
  docId,
  data.id,
  data.workLogId,
  data.workNumber,
  data.code,
  data.referenceNumber,
  data.sourceRef,
]);

const isPayrollIncludedInHpp = (data = {}) => normalizeType(data.status) !== "cancelled" && data.includePayrollInHpp !== false;

const isPayrollFinalForHpp = (data = {}) => {
  if (!isPayrollIncludedInHpp(data)) return false;
  const status = normalizeType(data.status);
  const paymentStatus = normalizeType(data.paymentStatus);
  if (status === "confirmed" || status === "paid" || paymentStatus === "paid") return true;
  return !status && !paymentStatus && getPayrollFinalAmount(data) > 0;
};

const getPayrollFinalAmount = (data = {}) => toNumber(data.finalAmount ?? data.amountCalculated ?? data.totalAmount);

const isNumberClose = (left, right, tolerance = 1) => Math.abs(toNumber(left) - toNumber(right)) <= tolerance;

/*
=====================================================
SECTION: Audit stale estimate BOM — AKTIF / GUARDED
Fungsi:
- Menghitung ulang estimasi BOM secara read-only dari master Raw Material dan Semi Finished terbaru.

Dipakai oleh:
- getDataQualityAudit untuk kategori production_boms_stale_cost_estimate.

Alasan perubahan:
- Reset HPP/modal bisa membuat master cost 0, sementara BOM lama masih menyimpan cost snapshot/estimate lama. Audit harus bisa menandai mismatch tanpa menulis data.

Catatan cleanup:
- Jika Data Quality Audit makin besar, helper ini bisa dipindah ke service khusus audit produksi.

Risiko:
- Jangan menjadikan hasil audit ini auto-fix; update BOM/HPP harus tetap lewat reset/edit guarded agar history transaksi tidak berubah diam-diam.
=====================================================
*/
const buildBomCostReferenceData = (collectionMap = {}) => ({
  hasReadError: Boolean(collectionMap.raw_materials?.error || collectionMap.semi_finished_materials?.error),
  rawMaterials: (collectionMap.raw_materials?.docs || []).map((itemDoc) => ({
    id: itemDoc.id,
    ...itemDoc.data(),
  })),
  semiFinishedMaterials: (collectionMap.semi_finished_materials?.docs || []).map((itemDoc) => ({
    id: itemDoc.id,
    ...itemDoc.data(),
  })),
});

const buildLiveBomCostEstimate = (data = {}, referenceData = {}) => {
  const materialLines = hydrateBomMaterialLinesWithLiveCost({
    materialLines: Array.isArray(data.materialLines) ? data.materialLines : [],
    referenceData,
  });
  const stepLines = Array.isArray(data.stepLines) ? data.stepLines : [];
  const summary = calculateBomCostSummary({
    materialLines,
    stepLines,
    header: data,
  });

  return {
    materialLines,
    ...summary,
  };
};

const getBomStaleCostIssueText = (data = {}, liveEstimate = {}) => {
  const storedMaterial = toNumber(data.materialCostEstimate);
  const storedTotal = toNumber(data.totalCostEstimate);
  const liveMaterial = toNumber(liveEstimate.materialCostEstimate);
  const liveTotal = toNumber(liveEstimate.totalCostEstimate);

  return [
    !isNumberClose(storedMaterial, liveMaterial, BOM_COST_COMPARE_TOLERANCE)
      ? `Material tersimpan ${storedMaterial}, live ${liveMaterial}`
      : "",
    !isNumberClose(storedTotal, liveTotal, BOM_COST_COMPARE_TOLERANCE)
      ? `Total tersimpan ${storedTotal}, live ${liveTotal}`
      : "",
  ].filter(Boolean).join("; ") || "Snapshot material BOM tidak sama dengan master cost terbaru.";
};

const hasStaleBomCostEstimate = (data = {}, liveEstimate = {}) => {
  const materialLines = Array.isArray(data.materialLines) ? data.materialLines : [];
  const liveLines = Array.isArray(liveEstimate.materialLines) ? liveEstimate.materialLines : [];
  const hasLineMismatch = materialLines.some((line = {}, index) => {
    const liveLine = liveLines[index] || {};
    return (
      !isNumberClose(line.costPerUnitSnapshot, liveLine.costPerUnitSnapshot, BOM_COST_COMPARE_TOLERANCE) ||
      !isNumberClose(line.totalCostSnapshot, liveLine.totalCostSnapshot, BOM_COST_COMPARE_TOLERANCE)
    );
  });

  return (
    hasLineMismatch ||
    !isNumberClose(data.materialCostEstimate, liveEstimate.materialCostEstimate, BOM_COST_COMPARE_TOLERANCE) ||
    !isNumberClose(data.totalCostEstimate, liveEstimate.totalCostEstimate, BOM_COST_COMPARE_TOLERANCE)
  );
};

const getOutputCollectionName = (outputType = "") => {
  const normalized = normalizeType(outputType);
  if (normalized === "product") return "products";
  if (normalized === "semi_finished_material" || normalized === "semi_finished") return "semi_finished_materials";
  return "";
};

const buildDocDataMap = (docs = []) => docs.reduce((acc, itemDoc) => {
  acc.set(itemDoc.id, {
    id: itemDoc.id,
    ...itemDoc.data(),
  });
  return acc;
}, new Map());

const getVariantIdentity = (variant = {}) => safeTrim(
  variant.variantKey ||
    variant.id ||
    variant.variantId ||
    variant.name ||
    variant.color ||
    variant.code ||
    variant.sku,
).toLowerCase();

const getLineVariantKey = (line = {}) => safeTrim(
  line.outputVariantKey ||
    line.variantKey ||
    line.resolvedVariantKey ||
    line.targetVariantKey ||
    line.details?.variantKey,
).toLowerCase();

const findOutputVariant = (stockItem = {}, line = {}) => {
  const lineVariantKey = getLineVariantKey(line);
  if (!lineVariantKey || !Array.isArray(stockItem.variants)) return null;
  return stockItem.variants.find((variant) => getVariantIdentity(variant) === lineVariantKey) || null;
};

const getOutputCostField = (collectionName = "") => (
  collectionName === "products" ? "hppPerUnit" : "averageCostPerUnit"
);

const buildOutputHppReconcileIssues = (data = {}, finalPayrollAmount = 0, masterRefs = {}) => {
  const outputs = Array.isArray(data.outputs) ? data.outputs : [];
  const goodQty = toNumber(data.goodQty ?? data.outputGoodQty ?? data.completedQty ?? data.actualOutputQty);
  const result = {
    hasOutputLineIssue: false,
    hasMasterCostIssue: false,
    hasVariantCostIssue: false,
    issueText: "",
  };

  if (!outputs.length || goodQty <= 0 || finalPayrollAmount <= 0) return result;

  const materialCost = toNumber(data.materialCostActual ?? data.materialCost ?? data.materialTotalCost);
  const overheadCost = toNumber(data.overheadCostActual ?? data.overheadCost ?? data.overheadTotalCost);
  const expectedFinalTotal = materialCost + overheadCost + finalPayrollAmount;
  const expectedCostPerGoodUnit = goodQty > 0 ? expectedFinalTotal / goodQty : 0;

  if (expectedCostPerGoodUnit <= 0) return result;

  const issueParts = [];

  outputs.forEach((line = {}) => {
    const outputGoodQty = toNumber(line.goodQty ?? line.outputQty ?? line.qty ?? line.quantity);
    if (outputGoodQty <= 0 || line.stockAdded !== true) return;

    const outputUnitCost = toNumber(line.costPerUnit ?? line.costPerUnitSnapshot ?? line.hppPerUnit);
    const collectionName = getOutputCollectionName(line.outputType);
    const outputId = safeTrim(line.outputIdRef || line.outputId || line.itemId);

    if (outputUnitCost <= 0 || !isNumberClose(outputUnitCost, expectedCostPerGoodUnit, BOM_COST_COMPARE_TOLERANCE)) {
      result.hasOutputLineIssue = true;
      issueParts.push(`output line ${safeTrim(line.outputName) || outputId || "-"} ${outputUnitCost}, final ${expectedCostPerGoodUnit}`);
    }

    const stockItem = collectionName === "products"
      ? masterRefs.productsById?.get(outputId)
      : masterRefs.semiFinishedById?.get(outputId);
    if (!stockItem) return;

    const costField = getOutputCostField(collectionName);
    const outputVariant = findOutputVariant(stockItem, line);
    const lineVariantKey = getLineVariantKey(line);

    if (lineVariantKey) {
      const variantCost = toNumber(outputVariant?.[costField] || 0);
      const variantStock = toNumber(outputVariant?.currentStock ?? outputVariant?.stock ?? 0);
      if (!outputVariant || variantCost <= 0 || (variantStock <= outputGoodQty && !isNumberClose(variantCost, expectedCostPerGoodUnit, BOM_COST_COMPARE_TOLERANCE))) {
        result.hasVariantCostIssue = true;
        issueParts.push(`variant ${safeTrim(line.outputVariantLabel) || lineVariantKey} ${variantCost || 0}, final ${expectedCostPerGoodUnit}`);
      }
      return;
    }

    const masterCost = toNumber(stockItem?.[costField] || 0);
    const masterStock = toNumber(stockItem?.currentStock ?? stockItem?.stock ?? 0);
    if (masterCost <= 0 || (masterStock <= outputGoodQty && !isNumberClose(masterCost, expectedCostPerGoodUnit, BOM_COST_COMPARE_TOLERANCE))) {
      result.hasMasterCostIssue = true;
      issueParts.push(`master ${safeTrim(line.outputName) || outputId || "-"} ${masterCost}, final ${expectedCostPerGoodUnit}`);
    }
  });

  result.issueText = issueParts.join("; ");
  return result;
};

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

const buildSalesStockBucketKey = (line = {}) => (
  `${safeTrim(line.collectionName || line.details?.collectionName)}::${safeTrim(line.itemId || line.details?.itemId)}::${safeTrim(line.variantKey || line.details?.variantKey || "master")}`
);

const sumQuantityBySalesStockBucket = (lines = [], quantityGetter = (line) => line.quantity) => {
  const quantityByBucket = new Map();

  lines.forEach((line = {}) => {
    const bucketKey = buildSalesStockBucketKey(line);
    const quantity = Math.abs(toNumber(quantityGetter(line)));
    quantityByBucket.set(bucketKey, toNumber(quantityByBucket.get(bucketKey)) + quantity);
  });

  return quantityByBucket;
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
    "stock_adjustments",
    "inventory_logs",
    "products",
    "raw_materials",
    "semi_finished_materials",
    "production_boms",
    "supplierPurchases",
    "customers",
  ];

  const collectionResults = await Promise.all(collectionNames.map(readCollectionSafe));
  const collectionMap = collectionResults.reduce((acc, item) => {
    acc[item.collectionName] = item;
    return acc;
  }, {});

  const bomCostReferenceData = buildBomCostReferenceData(collectionMap);
  const productionHppMasterRefs = {
    productsById: buildDocDataMap(collectionMap.products?.docs || []),
    semiFinishedById: buildDocDataMap(collectionMap.semi_finished_materials?.docs || []),
  };

  const payrollsByWorkLogKey = new Map();
  (collectionMap.production_payrolls?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const payrollRecord = { id: itemDoc.id, ...data };
    getWorkLogIdentityKeys({
      id: data.workLogId,
      workLogId: data.workLogId,
      workNumber: data.workNumber,
      code: data.workLogCode,
      referenceNumber: data.referenceNumber,
      sourceRef: data.sourceRef,
    }, data.workLogId).forEach((key) => pushUniqueMapRecord(payrollsByWorkLogKey, key, payrollRecord));
  });

  const incomeSaleKeys = new Set();
  (collectionMap.incomes?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const deterministicSaleId = itemDoc.id.startsWith("income_")
      ? safeTrim(itemDoc.id.replace(/^income_/, ""))
      : "";

    getSalesLinkedKeys(data, deterministicSaleId).forEach((saleKey) => {
      incomeSaleKeys.add(saleKey);
    });
  });

  const cancelRevertLogsBySaleKey = new Map();
  (collectionMap.inventory_logs?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const logType = normalizeType(data.type || data.details?.type);

    if (logType !== "sale_cancel_revert") return;

    const logRecord = { id: itemDoc.id, ...data };
    getSalesLinkedKeys(data, "").forEach((saleKey) => {
      pushUniqueMapRecord(cancelRevertLogsBySaleKey, saleKey, logRecord);
    });
  });

  (collectionMap.sales?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const status = safeTrim(data.status);
    const saleItems = Array.isArray(data.items) ? data.items : [];
    const saleIdentityKeys = getSalesIdentityKeys(data, itemDoc.id);
    const hasSaleIncome = saleIdentityKeys.some((saleKey) => incomeSaleKeys.has(saleKey));
    const cancelRevertLogs = getUniqueMapRecordsByKeys(cancelRevertLogsBySaleKey, saleIdentityKeys);

    if (!hasPrefix(data, ["ORD"], ["saleNumber", "code", "referenceNumber", "sourceRef"])) {
      addIssue(categories, "sales_missing_sal", toSample({
        collectionName: "sales",
        itemDoc,
        issue: "Belum punya kode Order format ORD.",
        recommendation: categories.sales_missing_sal.recommendation,
      }));
    }

    if (["Diproses", "Dikirim", "Selesai"].includes(status) && (data.stockRevertedAt || data.cancelledAt || cancelRevertLogs.length > 0)) {
      addIssue(categories, "sales_cancel_stock_revert_conflict", toSample({
        collectionName: "sales",
        itemDoc,
        issue: "Sales masih aktif/selesai tetapi sudah punya marker/log cancel revert stok.",
        recommendation: categories.sales_cancel_stock_revert_conflict.recommendation,
      }));
    }

    if (["Diproses", "Dikirim"].includes(status) && hasSaleIncome) {
      addIssue(categories, "sales_pending_income_conflict", toSample({
        collectionName: "sales",
        itemDoc,
        issue: "Sales belum Selesai tetapi sudah memiliki income resmi.",
        recommendation: categories.sales_pending_income_conflict.recommendation,
      }));
    }

    if (status === "Selesai" && toNumber(data.total) > 0 && !hasSaleIncome) {
      addIssue(categories, "sales_completed_income_missing", toSample({
        collectionName: "sales",
        itemDoc,
        issue: "Sales Selesai bernilai lebih dari 0 tetapi belum punya income resmi.",
        recommendation: categories.sales_completed_income_missing.recommendation,
      }));
    }

    if (status === "Dibatalkan" && hasSaleIncome) {
      addIssue(categories, "sales_cancel_income_conflict", toSample({
        collectionName: "sales",
        itemDoc,
        issue: "Sales berstatus Dibatalkan tetapi masih memiliki income resmi.",
        recommendation: categories.sales_cancel_income_conflict.recommendation,
      }));
    }

    if (status === "Dibatalkan" && saleItems.length > 0 && !data.stockRevertedAt && cancelRevertLogs.length === 0) {
      addIssue(categories, "sales_cancel_stock_revert_conflict", toSample({
        collectionName: "sales",
        itemDoc,
        issue: "Sales Dibatalkan tidak punya marker stockRevertedAt dan tidak ditemukan log cancel revert. Ada risiko stok belum dikembalikan atau data dibuat lewat flow lama.",
        recommendation: categories.sales_cancel_stock_revert_conflict.recommendation,
      }));
    }

    if (status === "Dibatalkan" && data.stockRevertedAt && cancelRevertLogs.length === 0) {
      addIssue(categories, "sales_cancel_stock_revert_conflict", toSample({
        collectionName: "sales",
        itemDoc,
        issue: "Sales punya marker stockRevertedAt tetapi tidak ditemukan log cancel revert stok.",
        recommendation: categories.sales_cancel_stock_revert_conflict.recommendation,
      }));
    }

    if (status === "Dibatalkan" && saleItems.length > 0 && cancelRevertLogs.length > saleItems.length) {
      addIssue(categories, "sales_cancel_stock_revert_conflict", toSample({
        collectionName: "sales",
        itemDoc,
        issue: "Jumlah log cancel revert lebih banyak dari jumlah item sale. Ada indikasi stok pernah direvert dobel.",
        recommendation: categories.sales_cancel_stock_revert_conflict.recommendation,
      }));
    }

    if (status === "Dibatalkan" && saleItems.length > 0 && cancelRevertLogs.length > 0) {
      const saleQuantityByBucket = sumQuantityBySalesStockBucket(saleItems);
      const cancelQuantityByBucket = sumQuantityBySalesStockBucket(
        cancelRevertLogs,
        (line) => line.quantityChange ?? line.quantity ?? line.details?.quantityChange ?? line.details?.quantity,
      );
      const hasOverRevertedBucket = Array.from(cancelQuantityByBucket.entries()).some(([bucketKey, revertedQty]) => (
        revertedQty > toNumber(saleQuantityByBucket.get(bucketKey))
      ));

      if (hasOverRevertedBucket) {
        addIssue(categories, "sales_cancel_stock_revert_conflict", toSample({
          collectionName: "sales",
          itemDoc,
          issue: "Qty log cancel revert lebih besar dari qty sale pada salah satu item/varian. Ada indikasi stok pernah direvert dobel.",
          recommendation: categories.sales_cancel_stock_revert_conflict.recommendation,
        }));
      }
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
    if (isManualCashInRevenue(data) && !hasPrefix(data, ["CSH-IN"], ["cashInNumber", "code", "referenceNumber", "sourceRef"])) {
      addIssue(categories, "cash_missing_cin_cout", toSample({
        collectionName: "revenues",
        itemDoc,
        issue: "Cash In manual belum punya kode CSH-IN.",
        recommendation: categories.cash_missing_cin_cout.recommendation,
      }));
    }
  });

  (collectionMap.expenses?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (isManualCashOutExpense(data) && !hasPrefix(data, ["CSH-OUT"], ["cashOutNumber", "code", "referenceNumber", "sourceRef"])) {
      addIssue(categories, "cash_missing_cin_cout", toSample({
        collectionName: "expenses",
        itemDoc,
        issue: "Cash Out manual belum punya kode CSH-OUT.",
        recommendation: categories.cash_missing_cin_cout.recommendation,
      }));
    }
  });

  (collectionMap.production_work_logs?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (!hasPrefix(data, ["JOB"], ["workNumber", "code", "referenceNumber", "sourceRef"])) {
      addIssue(categories, "work_logs_missing_wl", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: "Work Log belum punya workNumber format JOB.",
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

    if (["draft", "cancelled", "canceled"].includes(status)) {
      addIssue(categories, "work_logs_legacy_status", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: `Work Log memakai status legacy ${status || "-"}.`,
        recommendation: categories.work_logs_legacy_status.recommendation,
      }));
    }

    const relatedPayrolls = getUniqueMapRecordsByKeys(payrollsByWorkLogKey, getWorkLogIdentityKeys(data, itemDoc.id));
    const finalPayrollAmount = relatedPayrolls
      .filter(isPayrollFinalForHpp)
      .reduce((sum, line) => sum + getPayrollFinalAmount(line), 0);
    const activePayrollCount = relatedPayrolls.filter(isPayrollIncludedInHpp).length;

    if ((status === "completed" || goodQty > 0) && activePayrollCount > 0 && finalPayrollAmount <= 0) {
      addIssue(categories, "work_logs_payroll_pending", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: "Work Log completed punya payroll aktif tetapi belum ada payroll final untuk HPP.",
        recommendation: categories.work_logs_payroll_pending.recommendation,
      }));
    }

    if ((status === "completed" || goodQty > 0) && finalPayrollAmount > 0 && !isNumberClose(data.laborCostActual, finalPayrollAmount)) {
      addIssue(categories, "work_logs_payroll_cost_mismatch", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: "laborCostActual Work Log tidak sama dengan total payroll final HPP.",
        recommendation: categories.work_logs_payroll_cost_mismatch.recommendation,
      }));
    }

    const outputHppIssues = buildOutputHppReconcileIssues(data, finalPayrollAmount, productionHppMasterRefs);
    if ((status === "completed" || goodQty > 0) && (
      outputHppIssues.hasOutputLineIssue ||
      outputHppIssues.hasMasterCostIssue ||
      outputHppIssues.hasVariantCostIssue
    )) {
      addIssue(categories, "work_logs_output_hpp_reconcile_needed", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: outputHppIssues.issueText || "Output/master HPP terlihat belum ikut final payroll; data lama perlu review/backfill guarded agar master HPP/average cost sinkron.",
        recommendation: categories.work_logs_output_hpp_reconcile_needed.recommendation,
      }));
    }

    if ((status === "completed" || goodQty > 0) && outputHppIssues.hasOutputLineIssue) {
      addIssue(categories, "work_logs_output_cost_stale", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: outputHppIssues.issueText || "Output line cost Work Log belum sama dengan HPP final payroll.",
        recommendation: categories.work_logs_output_cost_stale.recommendation,
      }));
    }

    if ((status === "completed" || goodQty > 0) && outputHppIssues.hasMasterCostIssue) {
      addIssue(categories, "work_logs_master_hpp_stale", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: outputHppIssues.issueText || "Master HPP/average cost output terlihat belum sinkron dengan HPP final payroll.",
        recommendation: categories.work_logs_master_hpp_stale.recommendation,
      }));
    }

    if ((status === "completed" || goodQty > 0) && outputHppIssues.hasVariantCostIssue) {
      addIssue(categories, "work_logs_variant_hpp_stale", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: outputHppIssues.issueText || "Variant HPP/average cost output terlihat belum sinkron dengan HPP final payroll.",
        recommendation: categories.work_logs_variant_hpp_stale.recommendation,
      }));
    }
  });


  (collectionMap.stock_adjustments?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (!hasPrefix(data, ["STK-ADJ"], ["adjustmentNumber", "code", "referenceNumber", "sourceRef"])) {
      addIssue(categories, "master_missing_code", toSample({
        collectionName: "stock_adjustments",
        itemDoc,
        issue: "Stock Adjustment belum punya kode STK-ADJ.",
        recommendation: categories.master_missing_code.recommendation,
      }));
    }
  });

  (collectionMap.production_payrolls?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const hasPayrollNumber = hasPrefix(data, ["PAY"], ["payrollNumber", "code", "referenceNumber", "sourceRef"]);
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
    if (isRelevant && !hasPrefix(data, ["PRD"], ["code", "productCode"])) {
      addIssue(categories, "master_missing_code", toSample({
        collectionName: "products",
        itemDoc,
        issue: "Produk belum punya kode PRD.",
        recommendation: categories.master_missing_code.recommendation,
      }));
    }
  });

  (collectionMap.raw_materials?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const isRelevant = data.isActive !== false && data.active !== false;
    if (isRelevant && !hasPrefix(data, ["RAW"], ["code", "materialCode"])) {
      addIssue(categories, "master_missing_code", toSample({
        collectionName: "raw_materials",
        itemDoc,
        issue: "Raw Material belum punya kode RAW.",
        recommendation: categories.master_missing_code.recommendation,
      }));
    }
  });

  (collectionMap.semi_finished_materials?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const isRelevant = data.isActive !== false && data.active !== false;
    if (isRelevant && !hasPrefix(data, ["SFP"], ["code", "itemCode"])) {
      addIssue(categories, "master_missing_code", toSample({
        collectionName: "semi_finished_materials",
        itemDoc,
        issue: "Semi Finished belum punya kode SFP.",
        recommendation: categories.master_missing_code.recommendation,
      }));
    }

    if (isRelevant && !safeTrim(data.flowerGroup)) {
      addIssue(categories, "semi_finished_missing_flower_group", toSample({
        collectionName: "semi_finished_materials",
        itemDoc,
        issue: "Semi Finished aktif belum punya flowerGroup eksplisit.",
        recommendation: categories.semi_finished_missing_flower_group.recommendation,
      }));
    }
  });

  (collectionMap.production_boms?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (!hasPrefix(data, ["BOM-PRD", "BOM-SFP", "BOM"], ["code", "bomCode"])) {
      addIssue(categories, "master_missing_code", toSample({
        collectionName: "production_boms",
        itemDoc,
        issue: "BOM belum punya kode BOM otomatis.",
        recommendation: categories.master_missing_code.recommendation,
      }));
    }

    if (!bomCostReferenceData.hasReadError) {
      const liveEstimate = buildLiveBomCostEstimate(data, bomCostReferenceData);
      if (hasStaleBomCostEstimate(data, liveEstimate)) {
        addIssue(categories, "production_boms_stale_cost_estimate", toSample({
          collectionName: "production_boms",
          itemDoc,
          issue: getBomStaleCostIssueText(data, liveEstimate),
          recommendation: categories.production_boms_stale_cost_estimate.recommendation,
        }));
      }
    }
  });

  (collectionMap.supplierPurchases?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (!hasPrefix(data, ["SUP"], ["code", "supplierCode"])) {
      addIssue(categories, "master_missing_code", toSample({
        collectionName: "supplierPurchases",
        itemDoc,
        issue: "Supplier belum punya kode SUP.",
        recommendation: categories.master_missing_code.recommendation,
      }));
    }
  });

  (collectionMap.customers?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (!hasPrefix(data, ["CUS"], ["code", "customerCode"])) {
      addIssue(categories, "master_missing_code", toSample({
        collectionName: "customers",
        itemDoc,
        issue: "Customer belum punya kode CUS.",
        recommendation: categories.master_missing_code.recommendation,
      }));
    }
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
