import businessCodeContract from "../../../../shared/businessCodeContract.json";
import { formatBusinessCodeDateStamp } from "./businessCodeDate";

const CUSTOMER_CODE_PREFIX = businessCodeContract.customer.prefix;
const CUSTOMER_CODE_PATTERN = new RegExp(businessCodeContract.customer.pattern);

export { CUSTOMER_CODE_PREFIX, CUSTOMER_CODE_PATTERN };

export const normalizeCustomerCode = (value = "") =>
  String(value || "").trim().toUpperCase();

export const isValidCustomerCodeFormat = (code = "") =>
  CUSTOMER_CODE_PATTERN.test(normalizeCustomerCode(code));

export const resolveCustomerDisplayCode = (record = {}) =>
  normalizeCustomerCode(record.code || record.customerCode) || "Perlu repair kode";

export const resolveCustomerFormCode = (record = {}) =>
  normalizeCustomerCode(record.code || record.customerCode);

export const getCustomerCodeDateStamp = formatBusinessCodeDateStamp;

export const buildCustomerCode = ({ date = new Date(), sequence = 1 } = {}) =>
  `${CUSTOMER_CODE_PREFIX}-${getCustomerCodeDateStamp(date)}-${String(sequence).padStart(3, "0")}`;

export const getCustomerCodeSequence = (code = "", date = new Date()) => {
  const normalizedCode = normalizeCustomerCode(code);
  const expectedPrefix = `${CUSTOMER_CODE_PREFIX}-${getCustomerCodeDateStamp(date)}-`;
  if (!normalizedCode.startsWith(expectedPrefix)) return 0;

  const sequence = Number(normalizedCode.slice(expectedPrefix.length));
  return Number.isFinite(sequence) ? sequence : 0;
};
