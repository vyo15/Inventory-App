import { Space, Typography } from "antd";

const hasValue = (value) => String(value || "").trim() !== "";

const getDateMillis = (...candidates) => {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const rawDate = candidate?.toDate?.() || candidate;
    const parsedDate = new Date(rawDate);
    const time = parsedDate.getTime();
    if (!Number.isNaN(time)) return time;
  }
  return 0;
};

export const matchesEmployeePayrollLine = (employee = {}, payroll = {}) => {
  const employeeId = String(employee.id || "").trim();
  const employeeCode = String(employee.code || "").trim().toLowerCase();
  const employeeName = String(employee.name || "").trim().toLowerCase();
  const workerId = String(payroll.workerId || "").trim();
  const workerCode = String(payroll.workerCode || "").trim().toLowerCase();
  const workerName = String(payroll.workerName || "").trim().toLowerCase();

  if (employeeId && workerId && employeeId === workerId) return true;
  if (employeeCode && workerCode && employeeCode === workerCode) return true;
  return Boolean(employeeName && workerName && employeeName === workerName);
};

export const matchesEmployeeWorkLog = (employee = {}, workLog = {}) => {
  const employeeId = String(employee.id || "").trim();
  const employeeCode = String(employee.code || "").trim().toLowerCase();
  const employeeName = String(employee.name || "").trim().toLowerCase();
  const workerIds = Array.isArray(workLog.workerIds)
    ? workLog.workerIds.map((item) => String(item || "").trim())
    : [];
  const workerCodes = Array.isArray(workLog.workerCodes)
    ? workLog.workerCodes.map((item) => String(item || "").trim().toLowerCase())
    : [];
  const workerNames = Array.isArray(workLog.workerNames)
    ? workLog.workerNames.map((item) => String(item || "").trim().toLowerCase())
    : [];

  if (employeeId && workerIds.includes(employeeId)) return true;
  if (employeeCode && workerCodes.includes(employeeCode)) return true;
  return Boolean(employeeName && workerNames.includes(employeeName));
};

export const buildEmployeeSummaryMap = ({ employees = [], payrolls = [], workLogs = [] } = {}) => {
  return employees.reduce((acc, employee) => {
    const employeePayrolls = payrolls.filter((item) => matchesEmployeePayrollLine(employee, item));
    const employeeWorkLogs = workLogs.filter((item) => matchesEmployeeWorkLog(employee, item));
    const stepCounter = {};

    employeePayrolls.forEach((item) => {
      if (item.stepName) stepCounter[item.stepName] = (stepCounter[item.stepName] || 0) + 1;
    });
    employeeWorkLogs.forEach((item) => {
      if (item.stepName) stepCounter[item.stepName] = (stepCounter[item.stepName] || 0) + 1;
    });

    const favoriteStep = Object.entries(stepCounter).sort((left, right) => right[1] - left[1])[0]?.[0] || "-";
    const recentPayrolls = [...employeePayrolls]
      .sort((left, right) => getDateMillis(right.payrollDate) - getDateMillis(left.payrollDate))
      .slice(0, 3);
    const recentWorkLogs = [...employeeWorkLogs]
      .sort(
        (left, right) =>
          getDateMillis(right.completedAt, right.workDate) - getDateMillis(left.completedAt, left.workDate),
      )
      .slice(0, 3);

    acc[employee.id] = {
      totalWorkLogs: employeeWorkLogs.length,
      totalPayrollLines: employeePayrolls.length,
      totalDraft: employeePayrolls.filter((item) => item.status === "draft").length,
      totalConfirmed: employeePayrolls.filter((item) => item.status === "confirmed").length,
      totalPaid: employeePayrolls.filter((item) => item.status === "paid").length,
      totalCancelled: employeePayrolls.filter((item) => item.status === "cancelled").length,
      totalPaidAmount: employeePayrolls
        .filter((item) => item.status === "paid" && item.paymentStatus === "paid")
        .reduce((sum, item) => sum + Number(item.finalAmount || 0), 0),
      totalConfirmedAmount: employeePayrolls
        .filter((item) => item.status === "confirmed")
        .reduce((sum, item) => sum + Number(item.finalAmount || 0), 0),
      favoriteStep,
      recentPayrolls,
      recentWorkLogs,
    };

    return acc;
  }, {});
};

export const buildEmployeeActivitySummary = (selectedEmployeeSummary) => {
  if (!selectedEmployeeSummary) {
    return {
      totalWorkLogs: 0,
      payrollPending: 0,
      totalPaid: 0,
      totalPaidAmount: 0,
      recentPayrolls: [],
      recentWorkLogs: [],
    };
  }

  return {
    totalWorkLogs: selectedEmployeeSummary.totalWorkLogs || 0,
    payrollPending:
      Number(selectedEmployeeSummary.totalDraft || 0) + Number(selectedEmployeeSummary.totalConfirmed || 0),
    totalPaid: selectedEmployeeSummary.totalPaid || 0,
    totalPaidAmount: selectedEmployeeSummary.totalPaidAmount || 0,
    recentPayrolls: selectedEmployeeSummary.recentPayrolls || [],
    recentWorkLogs: selectedEmployeeSummary.recentWorkLogs || [],
  };
};

export const hasAdditionalEmployeeInfo = (employee = {}) => {
  return Boolean(
    hasValue(employee.gender) ||
      hasValue(employee.phone) ||
      hasValue(employee.address) ||
      (Array.isArray(employee.skillTags) && employee.skillTags.length > 0) ||
      hasValue(employee.notes),
  );
};

export const hasArchivedPayrollInfo = (employee = {}) => {
  const customModeActive = employee.useCustomPayrollRate && hasValue(employee.customPayrollMode);
  const customOutputActive = employee.useCustomPayrollRate && hasValue(employee.customPayrollOutputBasis);
  const customQtyActive = employee.useCustomPayrollRate && Number(employee.customPayrollQtyBase || 0) > 0;

  return Boolean(
    employee.useCustomPayrollRate ||
      customModeActive ||
      Number(employee.customPayrollRate || 0) > 0 ||
      customQtyActive ||
      customOutputActive ||
      hasValue(employee.payrollNotes),
  );
};

export const formatEmployeeShortDate = (value) => {
  const rawDate = value?.toDate?.() || value;
  if (!rawDate) return "-";

  const parsedDate = new Date(rawDate);
  if (Number.isNaN(parsedDate.getTime())) return "-";

  return parsedDate.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const renderEmployeeCompactInfo = (label, value) => (
  <Space direction="vertical" size={0} style={{ width: "100%" }}>
    <Typography.Text type="secondary" className="ims-cell-meta">
      {label}
    </Typography.Text>
    <Typography.Text strong>{value || "-"}</Typography.Text>
  </Space>
);
