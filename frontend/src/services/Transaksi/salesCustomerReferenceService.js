import { getCustomers } from "../MasterData/customersService";

const toSalesCustomerReference = (customer = {}) => ({
  ...customer,
  id: customer.id,
  name: customer.name || "",
  code: customer.code || customer.customerCode || customer.id || "",
  customerCode: customer.customerCode || customer.code || customer.id || "",
  source: "local_database_service",
});

/* =====================================================
SECTION: Sales customer references — AKTIF / GUARDED
Fungsi:
- Dropdown Customer di Sales membaca customer dari service master data lokal.

Alasan:
- Sales transaction write sudah diarahkan ke commit flow layanan database lokal.
- Reference customer tetap read-only di halaman Sales dan tidak boleh membuat mutasi stok/finance dari UI.

Risiko:
- Jangan mengganti service ini menjadi akses langsung file database; semua data wajib lewat service resmi.
===================================================== */
export const getSalesCustomerReferences = async () => {
  const customers = await getCustomers();
  return (customers || []).map(toSalesCustomerReference);
};

export const resolveSalesCustomerReference = (customers = [], customerId = "") => {
  if (!customerId) return null;
  return (customers || []).find((customer) => String(customer.id) === String(customerId)) || null;
};
