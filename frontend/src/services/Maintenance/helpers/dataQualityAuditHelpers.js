// =====================================================
// Data Quality Audit Helpers — GUARDED / READ-ONLY
//
// Helper ini hanya berisi normalizer, reference detector, accumulator,
// dan formatter sample yang pure. Jangan menaruh database read/write,
// repair mutation, reset destructive, atau business side-effect di file ini.
// =====================================================

export const SAMPLE_LIMIT = 10;
export const BOM_COST_COMPARE_TOLERANCE = 1;

export const KNOWN_BUSINESS_PREFIXES = [
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
- Membaca collection lama secara read-only, mengenali kode bisnis manusiawi, dan membedakan reference teknis legacy random ID dari reference operasional.

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
export const safeTrim = (value) => String(value ?? "").trim();
export const normalizeType = (value) => safeTrim(value).toLowerCase();
export const toNumber = (value) => {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

export const isPlainObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));

export const getNestedValue = (data = {}, path = "") => {
  if (!path) return "";
  return path.split(".").reduce((current, key) => (isPlainObject(current) ? current[key] : undefined), data);
};

export const getFirstReferenceValue = (data = {}, fieldNames = []) => {
  for (const fieldName of fieldNames) {
    const value = getNestedValue(data, fieldName);
    if (safeTrim(value)) return safeTrim(value);
  }
  return "";
};

export const hasKnownBusinessPrefix = (value) => {
  const ref = safeTrim(value).toUpperCase();
  if (!ref) return false;
  return KNOWN_BUSINESS_PREFIXES.some((prefix) => ref === prefix || ref.startsWith(`${prefix}-`));
};

export const hasPrefix = (data = {}, prefixes = [], fields = []) => {
  const upperPrefixes = prefixes.map((prefix) => safeTrim(prefix).toUpperCase()).filter(Boolean);
  return fields.some((fieldName) => {
    const value = safeTrim(getNestedValue(data, fieldName)).toUpperCase();
    return value && upperPrefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}-`));
  });
};

export const looksLikeTechnicalId = (value) => {
  const ref = safeTrim(value);
  if (!ref || hasKnownBusinessPrefix(ref)) return false;
  if (ref.includes("-") || ref.includes("/")) return false;
  return /^[A-Za-z0-9_]{16,}$/.test(ref);
};

export const isHumanReference = (value) => {
  const ref = safeTrim(value);
  if (!ref) return false;
  if (hasKnownBusinessPrefix(ref)) return true;
  if (looksLikeTechnicalId(ref)) return false;
  return /[A-Za-z]/.test(ref) && /[-_/\s]/.test(ref) && ref.length >= 4;
};

export const getDisplayName = (data = {}, fallback = "-") => (
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

export const getBestReference = (data = {}, docId = "") => (
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

export const getUniqueReferenceKeys = (values = []) => Array.from(
  new Set(values.map((value) => safeTrim(value)).filter(Boolean)),
);

export const getSalesIdentityKeys = (data = {}, docId = "") => getUniqueReferenceKeys([
  docId,
  data.saleNumber,
  data.code,
  data.referenceNumber,
  data.sourceRef,
  data.referenceCode,
]);

export const getSalesLinkedKeys = (data = {}, docId = "") => getUniqueReferenceKeys([
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

export const getPurchaseIdentityKeys = (data = {}, docId = "") => getUniqueReferenceKeys([
  docId,
  data.id,
  data.purchaseId,
  data.relatedPurchaseId,
  data.referenceId,
  data.sourceId,
  data.sourceRef,
  data.referenceCode,
  data.referenceNumber,
  data.purchaseNumber,
  data.code,
]);

export const getPurchaseLinkedKeys = (data = {}, docId = "") => getUniqueReferenceKeys([
  docId,
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

export const getReturnIdentityKeys = (data = {}, docId = "") => getUniqueReferenceKeys([
  docId,
  data.id,
  data.returnId,
  data.referenceId,
  data.sourceId,
  data.sourceRef,
  data.referenceCode,
  data.referenceNumber,
  data.returnNumber,
  data.code,
]);

export const getReturnLinkedKeys = (data = {}, docId = "") => getUniqueReferenceKeys([
  docId,
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

export const hasPositiveTransactionQuantity = (data = {}) => (
  toNumber(data.quantity ?? data.qty ?? data.totalStockIn ?? data.finalQuantity ?? data.stockInQty) > 0 ||
  (Array.isArray(data.items) && data.items.some((line) => toNumber(line.quantity ?? line.qty) > 0))
);

export const hasPositiveTransactionAmount = (data = {}) => toNumber(
  data.totalActualPurchase ?? data.total ?? data.amount ?? data.grandTotal ?? data.subtotalItems,
) > 0;

export const isPurchaseExpenseRecord = (data = {}) => {
  const sourceModule = normalizeType(data.sourceModule || data.module || data.sourceType || data.type);
  return Boolean(
    safeTrim(data.relatedPurchaseId) ||
    safeTrim(data.purchaseId) ||
    safeTrim(data.details?.purchaseId) ||
    sourceModule.includes("purchase") ||
    sourceModule.includes("pembelian")
  );
};

export const pushUniqueMapRecord = (map, key, record) => {
  const normalizedKey = safeTrim(key);
  if (!normalizedKey) return;

  const existingRecords = map.get(normalizedKey) || [];
  if (!existingRecords.some((item) => item.id === record.id)) {
    existingRecords.push(record);
  }
  map.set(normalizedKey, existingRecords);
};

export const getUniqueMapRecordsByKeys = (map, keys = []) => {
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

export const toSample = ({ collectionName, itemDoc, issue, recommendation }) => {
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
export const CATEGORY_CONFIGS = [
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
    key: "purchases_expense_missing",
    label: "Purchase belum punya expense otomatis",
    recommendation: "Perlu cek manual sebelum laporan kas/profit final",
  },
  {
    key: "purchases_inventory_log_missing",
    label: "Purchase belum punya inventory log purchase_in",
    recommendation: "Perlu cek manual sebelum audit stok final",
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
    key: "sales_inventory_log_missing",
    label: "Sales belum punya inventory log sale",
    recommendation: "Perlu cek manual sebelum audit stok final",
  },
  {
    key: "returns_missing_ret",
    label: "Return tanpa kode RET",
    recommendation: "Aman dibuat ulang jika data test",
  },
  {
    key: "returns_inventory_log_missing",
    label: "Return belum punya inventory log return_in",
    recommendation: "Perlu cek manual sebelum audit stok final",
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
  {
    key: "cost_zero_with_stock",
    label: "Cost/HPP 0 padahal stok ada",
    recommendation: "Isi baseline modal/HPP sebelum transaksi baru agar average cost tidak terdilusi modal 0",
  },
];

export const createCategoryAccumulator = () => CATEGORY_CONFIGS.reduce((acc, item) => {
  acc[item.key] = {
    ...item,
    count: 0,
    samples: [],
  };
  return acc;
}, {});

export const addIssue = (categories, categoryKey, sample) => {
  const category = categories[categoryKey];
  if (!category) return;
  category.count += 1;
  if (category.samples.length < SAMPLE_LIMIT) {
    category.samples.push(sample);
  }
};

export const hasClearHumanSourceReference = (data = {}, fields = []) => fields.some((fieldName) => {
  const value = getNestedValue(data, fieldName);
  return isHumanReference(value);
});

export const getWorkLogIdentityKeys = (data = {}, docId = "") => getUniqueReferenceKeys([
  docId,
  data.id,
  data.workLogId,
  data.workNumber,
  data.code,
  data.referenceNumber,
  data.sourceRef,
]);

export const isPayrollIncludedInHpp = (data = {}) => normalizeType(data.status) !== "cancelled" && data.includePayrollInHpp !== false;

export const isPayrollFinalForHpp = (data = {}) => {
  if (!isPayrollIncludedInHpp(data)) return false;
  const status = normalizeType(data.status);
  const paymentStatus = normalizeType(data.paymentStatus);
  if (status === "confirmed" || status === "paid" || paymentStatus === "paid") return true;
  return !status && !paymentStatus && getPayrollFinalAmount(data) > 0;
};

export const getPayrollFinalAmount = (data = {}) => toNumber(data.finalAmount ?? data.amountCalculated ?? data.totalAmount);

export const isNumberClose = (left, right, tolerance = 1) => Math.abs(toNumber(left) - toNumber(right)) <= tolerance;
