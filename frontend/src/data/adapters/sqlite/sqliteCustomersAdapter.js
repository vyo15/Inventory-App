import { requestSqliteApi } from "./sqliteApiClient";

const normalizeCustomerPayload = (values = {}) => ({
  code: values.code || values.customerCode || "",
  customerCode: values.customerCode || values.code || "",
  name: String(values.name || "").trim(),
  contact: values.contact || values.phone || "",
  phone: values.phone || values.contact || "",
  address: values.address || "",
  note: values.note || values.notes || "",
  notes: values.notes || values.note || "",
});

export const listCustomers = async () => {
  const result = await requestSqliteApi("/api/customers");
  return result?.data || [];
};

export const getCustomerById = async (customerId) => {
  if (!customerId) return null;
  const result = await requestSqliteApi(`/api/customers/${encodeURIComponent(customerId)}`);
  return result?.data || null;
};

export const generateCustomerCode = async () => {
  const result = await requestSqliteApi("/api/customers/generate-code");
  return result?.data?.code || result?.data?.customerCode || "";
};

export const createCustomer = async (values = {}) => {
  const result = await requestSqliteApi("/api/customers", {
    method: "POST",
    body: JSON.stringify(normalizeCustomerPayload(values)),
  });
  return result?.data || null;
};

export const updateCustomer = async (customerId, values = {}) => {
  if (!customerId) {
    throw new Error("Customer yang akan diubah tidak valid.");
  }

  const result = await requestSqliteApi(`/api/customers/${encodeURIComponent(customerId)}`, {
    method: "PUT",
    body: JSON.stringify(normalizeCustomerPayload(values)),
  });
  return result?.data || null;
};

export const deleteCustomer = async (customerId) => {
  if (!customerId) {
    throw new Error("Customer yang akan dihapus tidak valid.");
  }

  const result = await requestSqliteApi(`/api/customers/${encodeURIComponent(customerId)}`, {
    method: "DELETE",
  });
  return result?.data || { id: customerId, deleted: true };
};
