const PAYROLL_STATUS_HELP = {
  draft: "Payroll belum final dan masih perlu dicek sebelum dibayar.",
  confirmed: "Payroll sudah disetujui tetapi belum ditandai dibayar.",
  paid: "Payroll sudah ditandai dibayar dan akan membuat Cash Out otomatis bila nominal > 0.",
  cancelled: "Payroll dibatalkan dan tidak dipakai sebagai pembayaran aktif.",
};

const PAYROLL_PAYMENT_STATUS_HELP = {
  unpaid: "Belum dibayar secara internal payroll.",
  partial: "Sebagian pembayaran sudah dicatat secara internal payroll.",
  paid: "Sudah dibayar; Cash Out otomatis dibuat dengan source Payroll Produksi jika nominal > 0.",
};

export const isEditableProductionPayroll = (record = {}) => record.paymentStatus !== "paid";

export const getCompactPayrollStatusHelp = (record = {}) => {
  const statusHelp = PAYROLL_STATUS_HELP[record.status];
  const paymentHelp = PAYROLL_PAYMENT_STATUS_HELP[record.paymentStatus];

  if (record.status && record.paymentStatus && record.status === record.paymentStatus) {
    return statusHelp || paymentHelp || "Status payroll.";
  }

  return [statusHelp, paymentHelp].filter(Boolean).join(" ")
    || "Status payroll dan pembayaran internal line payroll.";
};
