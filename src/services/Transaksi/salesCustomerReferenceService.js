import { getCustomers } from "../MasterData/customersService";

const toSalesCustomerReference = (customer = {}) => ({
  ...customer,
  id: customer.id,
  name: customer.name || "",
  code: customer.code || customer.customerCode || customer.id || "",
  customerCode: customer.customerCode || customer.code || customer.id || "",
  source: "firebase_primary",
});

/* =====================================================
SECTION: Sales customer references — AKTIF / GUARDED
Fungsi:
- Memaksa dropdown Customer di Sales membaca customer dari Firebase-primary.

Alasan:
- Sales transaction write masih Firebase. Customer offline-local yang belum sync tidak boleh dipakai sebagai foreign reference transaksi.

Risiko:
- Jangan mengganti service ini ke customersRepository runtime mode sebelum Sales transaction, stock, income, dan audit flow punya kontrak offline sendiri.
===================================================== */
export const getSalesCustomerReferences = async () => {
  const customers = await getCustomers();
  return (customers || []).map(toSalesCustomerReference);
};

export const resolveSalesCustomerReference = (customers = [], customerId = "") => {
  if (!customerId) return null;
  return (customers || []).find((customer) => String(customer.id) === String(customerId)) || null;
};
