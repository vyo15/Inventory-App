export const CUSTOMER_CODE_PREFIX = "CUS";
export const CUSTOMER_CODE_PATTERN = /^CUS-\d{8}-\d{3,}$/;

const padNumber = (value, length = 2) => String(value).padStart(length, "0");

export const normalizeCustomerCode = (value = "") =>
  String(value || "").trim().toUpperCase();

export const isValidCustomerCodeFormat = (code = "") =>
  CUSTOMER_CODE_PATTERN.test(normalizeCustomerCode(code));

export const formatCustomerCodeDate = (date = new Date()) => {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime())
    ? date
    : new Date();

  return [
    padNumber(safeDate.getDate()),
    padNumber(safeDate.getMonth() + 1),
    safeDate.getFullYear(),
  ].join("");
};

export const buildCustomerCode = ({
  date = new Date(),
  sequence = 1,
  sequenceLength = 3,
} = {}) => {
  const safeSequence = Math.max(1, Number(sequence || 1));
  return `${CUSTOMER_CODE_PREFIX}-${formatCustomerCodeDate(date)}-${padNumber(
    safeSequence,
    sequenceLength
  )}`;
};
