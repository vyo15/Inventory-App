// =====================================================
// Production Employee Options
// Master enum dan helper untuk Karyawan Produksi
// =====================================================

export const PRODUCTION_EMPLOYEE_GENDERS = [
  { value: "male", label: "Laki-laki" },
  { value: "female", label: "Perempuan" },
  { value: "other", label: "Lainnya" },
];

export const PRODUCTION_EMPLOYEE_EMPLOYMENT_TYPES = [
  { value: "borongan", label: "Borongan" },
  { value: "harian", label: "Harian" },
  { value: "tetap", label: "Tetap" },
  { value: "freelance", label: "Freelance" },
];

export const PRODUCTION_EMPLOYEE_ROLES = [
  { value: "operator", label: "Operator" },
  { value: "perakit", label: "Perakit" },
  { value: "qc", label: "QC" },
  { value: "finishing", label: "Finishing" },
  { value: "helper", label: "Helper" },
  { value: "lainnya", label: "Lainnya" },
];

export const PRODUCTION_EMPLOYEE_CUSTOM_PAYROLL_MODES = [
  { value: "per_qty", label: "Per Qty" },
  { value: "per_batch", label: "Per Batch" },
  { value: "fixed", label: "Fixed" },
];

export const PRODUCTION_EMPLOYEE_PAYROLL_OUTPUT_BASIS = [
  { value: "good_qty", label: "Good Qty" },
  { value: "actual_output_qty", label: "Actual Output Qty" },
];

export const toOptionMap = (options = []) =>
  options.reduce((acc, item) => {
    acc[item.value] = item.label;
    return acc;
  }, {});

export const EMPLOYEE_GENDER_MAP = toOptionMap(PRODUCTION_EMPLOYEE_GENDERS);
export const EMPLOYEE_TYPE_MAP = toOptionMap(
  PRODUCTION_EMPLOYEE_EMPLOYMENT_TYPES,
);
export const EMPLOYEE_ROLE_MAP = toOptionMap(PRODUCTION_EMPLOYEE_ROLES);
export const EMPLOYEE_PAYROLL_MODE_MAP = toOptionMap(
  PRODUCTION_EMPLOYEE_CUSTOM_PAYROLL_MODES,
);
export const EMPLOYEE_PAYROLL_OUTPUT_BASIS_MAP = toOptionMap(
  PRODUCTION_EMPLOYEE_PAYROLL_OUTPUT_BASIS,
);

export const DEFAULT_PRODUCTION_EMPLOYEE_FORM = {
  code: "",
  name: "",
  gender: "female",
  phone: "",
  address: "",
  joinDate: null,

  employmentType: "borongan",
  role: "operator",

  assignedStepIds: [],
  assignedStepCodes: [],
  assignedStepNames: [],

  useCustomPayrollRate: false,
  customPayrollMode: "",
  customPayrollRate: 0,
  customPayrollQtyBase: 1,
  customPayrollOutputBasis: "good_qty",
  payrollNotes: "",

  skillTags: [],
  notes: "",

  isActive: true,
};

export const formatEmployeePayrollPreview = (employee = {}) => {
  if (!employee?.useCustomPayrollRate) {
    return "Aktif: mengikuti rule payroll Tahapan Produksi";
  }

  return "Legacy/deprecated: custom payroll karyawan tidak lagi dipakai dalam flow payroll final. Nilai ini hanya dipertahankan untuk referensi historis.";
};
