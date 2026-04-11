// =====================================================
// Production Payroll Options
// =====================================================

export const PRODUCTION_PAYROLL_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "confirmed", label: "Confirmed" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

export const PRODUCTION_PAYROLL_PAYMENT_STATUSES = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
];

export const PRODUCTION_PAYROLL_MODES = [
  { value: "per_qty", label: "Per Qty" },
  { value: "per_batch", label: "Per Batch" },
  { value: "fixed", label: "Fixed" },
];

export const PRODUCTION_PAYROLL_OUTPUT_BASIS = [
  { value: "good_qty", label: "Good Qty" },
  { value: "actual_output_qty", label: "Actual Output Qty" },
];

export const toOptionMap = (options = []) =>
  options.reduce((acc, item) => {
    acc[item.value] = item.label;
    return acc;
  }, {});

export const PAYROLL_STATUS_MAP = toOptionMap(PRODUCTION_PAYROLL_STATUSES);
export const PAYROLL_PAYMENT_STATUS_MAP = toOptionMap(
  PRODUCTION_PAYROLL_PAYMENT_STATUSES,
);
export const PAYROLL_MODE_MAP = toOptionMap(PRODUCTION_PAYROLL_MODES);
export const PAYROLL_OUTPUT_BASIS_MAP = toOptionMap(
  PRODUCTION_PAYROLL_OUTPUT_BASIS,
);

export const DEFAULT_PRODUCTION_PAYROLL_FORM = {
  payrollNumber: "",
  payrollDate: null,

  workLogId: "",
  workNumber: "",

  bomId: "",
  bomCode: "",

  targetType: "",
  targetId: "",
  targetCode: "",
  targetName: "",

  stepId: "",
  stepCode: "",
  stepName: "",
  sequenceNo: 1,

  workerId: "",
  workerCode: "",
  workerName: "",

  payrollMode: "per_qty",
  payrollRate: 0,
  payrollQtyBase: 1,
  payrollOutputBasis: "good_qty",

  totalWorkLogOutputQty: 0,
  workedQty: 0,
  outputQtyUsed: 0,
  payableQtyFactor: 0,

  amountCalculated: 0,
  bonusAmount: 0,
  deductionAmount: 0,
  finalAmount: 0,

  sharedWorkLog: false,
  teamWorkerCount: 1,

  status: "draft",
  paymentStatus: "unpaid",
  paidAt: null,

  notes: "",
  calculationNotes: "",
};

export const calculatePayrollAmounts = (values = {}) => {
  const payrollMode = values.payrollMode || "per_qty";
  const payrollRate = Number(values.payrollRate || 0);
  const payrollQtyBase = Number(values.payrollQtyBase || 1);
  const outputQtyUsed = Number(values.outputQtyUsed || 0);
  const bonusAmount = Number(values.bonusAmount || 0);
  const deductionAmount = Number(values.deductionAmount || 0);

  let amountCalculated = 0;
  let payableQtyFactor = 0;

  if (payrollMode === "fixed") {
    amountCalculated = payrollRate;
    payableQtyFactor = 1;
  } else if (payrollMode === "per_batch") {
    amountCalculated = payrollRate;
    payableQtyFactor = 1;
  } else {
    payableQtyFactor = payrollQtyBase > 0 ? outputQtyUsed / payrollQtyBase : 0;
    amountCalculated = payableQtyFactor * payrollRate;
  }

  const finalAmount = amountCalculated + bonusAmount - deductionAmount;

  return {
    payableQtyFactor,
    amountCalculated,
    finalAmount,
  };
};
