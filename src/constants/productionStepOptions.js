// =====================================================
// Production Step Options
// Master enum dan helper label untuk menu Tahapan Produksi
// Versi disederhanakan agar fokus ke proses nyata.
// QC tidak dijadikan step utama, tetapi nanti menempel di work log.
// =====================================================

export const PRODUCTION_STEP_PROCESS_TYPES = [
  { value: "raw_to_semi", label: "Raw -> Semi Finished" },
  { value: "semi_to_semi", label: "Semi Finished -> Semi Finished" },
  { value: "semi_to_product", label: "Semi Finished -> Finished Good" },
  { value: "support_process", label: "Packing / Support" },
];

// Map tambahan untuk kompatibilitas data lama yang mungkin masih tersimpan.
const LEGACY_PROCESS_TYPES = [
  { value: "raw_to_product", label: "Raw -> Finished Good" },
  { value: "finishing", label: "Finishing" },
  { value: "qc", label: "QC" },
];

export const PRODUCTION_STEP_INPUT_POLICIES = [
  { value: "raw_only", label: "Raw Material Only" },
  { value: "semi_only", label: "Semi Finished Only" },
  { value: "mixed", label: "Mixed" },
  { value: "none", label: "No Input" },
];

export const PRODUCTION_STEP_OUTPUT_TYPES = [
  { value: "semi_finished_material", label: "Semi Finished Material" },
  { value: "product", label: "Finished Good" },
  { value: "none", label: "No Stock Output" },
];



export const PRODUCTION_STEP_BASIS_TYPES = [
  { value: "per_meter", label: "Per Meter" },
  { value: "per_rod_40cm", label: "Per Batang 40 cm" },
  { value: "per_finished_unit", label: "Per Bunga Jadi" },
  { value: "per_batch", label: "Per Batch" },
];

export const PRODUCTION_STEP_MONITORING_MODES = [
  { value: "capacity_primary", label: "Kapasitas Utama" },
  { value: "leftover_control", label: "Kontrol Sisa" },
  { value: "finished_output", label: "Output Jadi" },
  { value: "none", label: "Tanpa Monitoring" },
];

export const PRODUCTION_STEP_PAYROLL_MODES = [
  { value: "per_qty", label: "Per Qty" },
  { value: "per_batch", label: "Per Batch" },
  { value: "fixed", label: "Fixed" },
];

export const PRODUCTION_STEP_PAYROLL_OUTPUT_BASIS = [
  { value: "good_qty", label: "Good Qty" },
  { value: "actual_output_qty", label: "Actual Output Qty" },
];

export const toOptionMap = (options = []) =>
  options.reduce((acc, item) => {
    acc[item.value] = item.label;
    return acc;
  }, {});

export const PROCESS_TYPE_MAP = toOptionMap([
  ...PRODUCTION_STEP_PROCESS_TYPES,
  ...LEGACY_PROCESS_TYPES,
]);
export const INPUT_POLICY_MAP = toOptionMap(PRODUCTION_STEP_INPUT_POLICIES);
export const OUTPUT_TYPE_MAP = toOptionMap(PRODUCTION_STEP_OUTPUT_TYPES);
export const BASIS_TYPE_MAP = toOptionMap(PRODUCTION_STEP_BASIS_TYPES);
export const MONITORING_MODE_MAP = toOptionMap(PRODUCTION_STEP_MONITORING_MODES);
export const PAYROLL_MODE_MAP = toOptionMap(PRODUCTION_STEP_PAYROLL_MODES);
export const PAYROLL_OUTPUT_BASIS_MAP = toOptionMap(
  PRODUCTION_STEP_PAYROLL_OUTPUT_BASIS,
);

export const DEFAULT_PRODUCTION_STEP_FORM = {
  code: "",
  name: "",
  description: "",
  processType: "raw_to_semi",
  basisType: "per_meter",
  monitoringMode: "capacity_primary",
  payrollMode: "per_qty",
  payrollRate: 0,
  payrollQtyBase: 1,
  payrollOutputBasis: "good_qty",
  isActive: true,
};

export const formatProductionStepPayrollPreview = (step = {}) => {
  const mode = step?.payrollMode || "per_qty";
  const rate = Number(step?.payrollRate || 0);
  const qtyBase = Number(step?.payrollQtyBase || 1);
  const outputBasis = step?.payrollOutputBasis || "good_qty";
  const outputUnit = step?.outputUnit || "pcs";

  const rateText = new Intl.NumberFormat("id-ID").format(rate);

  if (mode === "fixed") {
    return `Rp${rateText} per step selesai`;
  }

  if (mode === "per_batch") {
    return `Rp${rateText} per batch`;
  }

  return `Rp${rateText} per ${new Intl.NumberFormat("id-ID").format(
    qtyBase,
  )} ${outputUnit} (${outputBasis})`;
};
