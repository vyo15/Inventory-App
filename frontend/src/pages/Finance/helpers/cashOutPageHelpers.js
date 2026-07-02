import { getSavingPresentation } from "../../../utils/finance/savingPresentation";

const EXPENSE_SOURCE_META = {
  cash_out_manual: { label: "Manual", color: "default", deletable: true },
  purchases: { label: "Pembelian", color: "blue", deletable: false },
  production_payroll: { label: "Payroll Produksi", color: "purple", deletable: false },
};

export const resolveExpenseSourceMeta = (record = {}) => {
  const key = String(record.sourceModule || "").trim();
  return EXPENSE_SOURCE_META[key] || {
    label: key || "Manual",
    color: "default",
    deletable: key === "",
  };
};

export const getSavingMeta = getSavingPresentation;
