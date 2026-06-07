import { getCustomers } from "../MasterData/customersService";

const toSalesCustomerReference = (customer = {}) => ({
  ...customer,
  id: customer.id,
  name: customer.name || "",
  code: customer.code || customer.customerCode || customer.id || "",
  customerCode: customer.customerCode || customer.code || customer.id || "",
  source: "sqlite_backend",
});

/* =====================================================
SECTION: Sales customer references — AKTIF / GUARDED
Fungsi:
- Dropdown Customer di Sales membaca customer dari service master data SQLite.

Alasan:
- Sales transaction write sudah diarahkan ke backend SQLite commit flow.
- Reference customer tetap read-only di halaman Sales dan tidak boleh membuat mutasi stok/finance dari UI.

Risiko:
- Jangan mengganti service ini menjadi akses langsung file SQLite; semua data wajib lewat backend service.
===================================================== */
export const getSalesCustomerReferences = async () => {
  const customers = await getCustomers();
  return (customers || []).map(toSalesCustomerReference);
};

export const resolveSalesCustomerReference = (customers = [], customerId = "") => {
  if (!customerId) return null;
  return (customers || []).find((customer) => String(customer.id) === String(customerId)) || null;
};
