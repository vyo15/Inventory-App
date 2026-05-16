import formatCurrency from "../utils/formatters/currencyId";

// =====================================================
// Production Step Options
// Master enum dan helper label untuk menu Tahapan Produksi.
// Step fokus ke proses kerja nyata + aturan upah operator.
// =====================================================

export const PRODUCTION_STEP_PROCESS_TYPES = [
  { value: "raw_to_semi", label: "Raw -> Semi Finished" },
  { value: "semi_to_semi", label: "Semi Finished -> Semi Finished" },
  { value: "semi_to_product", label: "Semi Finished -> Finished Good" },
  { value: "support_process", label: "Packing / Support" },
];

export const PRODUCTION_STEP_BASIS_TYPES = [
  { value: "per_meter", label: "Per Meter Bahan" },
  { value: "per_rod_40cm", label: "Per Kawat" },
  { value: "per_qty", label: "Per Qty" },
  { value: "per_batch", label: "Per Batch" },
];

export const PRODUCTION_STEP_PAYROLL_MODES = [
  { value: "per_qty", label: "Per Qty" },
  { value: "per_batch", label: "Per Batch" },
];

export const toOptionMap = (options = []) =>
  options.reduce((acc, item) => {
    acc[item.value] = item.label;
    return acc;
  }, {});

export const PROCESS_TYPE_MAP = toOptionMap(PRODUCTION_STEP_PROCESS_TYPES);
export const BASIS_TYPE_MAP = toOptionMap(PRODUCTION_STEP_BASIS_TYPES);
export const PAYROLL_MODE_MAP = toOptionMap(PRODUCTION_STEP_PAYROLL_MODES);
export const DEFAULT_PRODUCTION_STEP_FORM = {
  code: "",
  name: "",
  description: "",
  processType: "raw_to_semi",
  basisType: "per_batch",
  payrollMode: "per_qty",
  payrollRate: 0,
  payrollOutputBasis: "good_qty",
  isActive: true,
};

export const getProductionStepPayrollClassification = (processType = "") =>
  processType === "support_process" ? "support_fulfillment" : "direct_labor";

export const shouldIncludeProductionStepPayrollInHpp = (processType = "") =>
  getProductionStepPayrollClassification(processType) === "direct_labor";

export const formatProductionStepPayrollPreview = (step = {}) => {
  const mode = step?.payrollMode === "per_batch" ? "per_batch" : "per_qty";
  const rateText = formatCurrency(Number(step?.payrollRate || 0));

  if (mode === "per_batch") {
    return `${rateText} per batch`;
  }

  return `${rateText} per qty`;
};
