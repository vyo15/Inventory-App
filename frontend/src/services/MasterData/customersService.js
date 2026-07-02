import { normalizeTruthyText as safeTrim } from "../../utils/text/textNormalization";
import * as sqliteCustomersAdapter from "../../data/adapters/sqlite/sqliteCustomersAdapter";

export const CUSTOMERS_COLLECTION = "customers";
export const getCustomers = async () => sqliteCustomersAdapter.listCustomers();
export const generateCustomerCode = async () => sqliteCustomersAdapter.generateCustomerCode();
export const assertCustomerCodeAvailable = async (code = "", editingId = null) => {
  const normalized = safeTrim(code).toUpperCase();
  if (!normalized) return;
  const duplicate = (await getCustomers()).some((item) => safeTrim(item.code || item.customerCode).toUpperCase() === normalized && String(item.id) !== String(editingId || ""));
  if (duplicate) throw new Error("Kode customer sudah digunakan.");
};
export const resolveCustomerCode = async (values = {}, excludeId = null) => {
  const code = safeTrim(values.code || values.customerCode).toUpperCase() || await generateCustomerCode(values, excludeId);
  await assertCustomerCodeAvailable(code, excludeId);
  return code;
};
export const createCustomer = async (values = {}) => {
  const code = await resolveCustomerCode(values);
  return sqliteCustomersAdapter.createCustomer({ ...values, code, customerCode: code });
};
export const updateCustomer = async (customerId, values = {}) => {
  const code = await resolveCustomerCode(values, customerId);
  return sqliteCustomersAdapter.updateCustomer(customerId, { ...values, code, customerCode: code });
};
export const deleteCustomer = async (customerId) => sqliteCustomersAdapter.deleteCustomer(customerId);
