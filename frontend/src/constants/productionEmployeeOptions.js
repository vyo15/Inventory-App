// =====================================================
// Production Employee Options
// Master enum dan helper untuk Karyawan Produksi
// =====================================================

import { toOptionMap } from "../utils/options/optionMap";
export { toOptionMap };

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

// ACTIVE ROLE OPTIONS
// Role quality/reject lama tidak ditawarkan untuk data baru karena belum menjadi workflow aktif.
// Label legacy tetap disimpan di map agar data lama masih bisa dibaca tanpa migrasi schema.
export const PRODUCTION_EMPLOYEE_ROLES = [
  { value: "operator", label: "Operator" },
  { value: "perakit", label: "Perakit" },
  { value: "finishing", label: "Finishing" },
  { value: "helper", label: "Helper" },
  { value: "lainnya", label: "Lainnya" },
];

const PRODUCTION_EMPLOYEE_ROLE_LABELS = [
  ...PRODUCTION_EMPLOYEE_ROLES,
  { value: "qc", label: "Legacy role" },
];

export const PRODUCTION_EMPLOYEE_CUSTOM_PAYROLL_MODES = [
  { value: "per_qty", label: "Per Qty" },
  { value: "per_batch", label: "Per Batch" },
];

export const PRODUCTION_EMPLOYEE_PAYROLL_OUTPUT_BASIS = [
  { value: "good_qty", label: "Good Qty" },
  { value: "actual_output_qty", label: "Actual Output Qty" },
];

export const EMPLOYEE_GENDER_MAP = toOptionMap(PRODUCTION_EMPLOYEE_GENDERS);
export const EMPLOYEE_TYPE_MAP = toOptionMap(
  PRODUCTION_EMPLOYEE_EMPLOYMENT_TYPES,
);
export const EMPLOYEE_ROLE_MAP = toOptionMap(PRODUCTION_EMPLOYEE_ROLE_LABELS);
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
