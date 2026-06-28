export const createEmptyPayrollStatusTally = () => ({
  totalDraft: 0,
  totalConfirmed: 0,
  totalPaid: 0,
  totalCancelled: 0,
  totalNominal: 0,
});

export const tallyPayrollStatus = (items = []) => (Array.isArray(items) ? items : []).reduce(
  (totals, item = {}) => {
    const amount = Number(item.finalAmount || 0);
    if (item.status === "draft") totals.totalDraft += 1;
    if (item.status === "confirmed") totals.totalConfirmed += 1;
    if (item.status === "paid") totals.totalPaid += 1;
    if (item.status === "cancelled") totals.totalCancelled += 1;
    if (item.status !== "cancelled") totals.totalNominal += amount;
    return totals;
  },
  createEmptyPayrollStatusTally(),
);
