import { listCustomers } from "../../data/repositories/customersRepository";
import { REPOSITORY_MODES } from "../../data/repositories/repositoryMode";

export const SALES_CUSTOMER_REPOSITORY_OPTIONS = Object.freeze({
  mode: REPOSITORY_MODES.FIREBASE_PRIMARY,
});

const sortSalesCustomers = (customers = []) =>
  [...customers].sort((first, second) =>
    String(first?.name || "").localeCompare(String(second?.name || ""), "id", {
      sensitivity: "base",
    })
  );

export const listSalesCustomerOptions = async () => {
  const customers = await listCustomers(SALES_CUSTOMER_REPOSITORY_OPTIONS);
  return sortSalesCustomers(customers).filter((customer) => !customer?._deleted);
};

export const resolveSalesCustomerSnapshot = (customers = [], customerId = null) => {
  if (!customerId) return null;

  const selectedCustomer = customers.find((customer) => customer.id === customerId);

  if (!selectedCustomer) {
    throw new Error(
      "Customer yang dipilih tidak ditemukan di sumber Firebase Sales. Muat ulang daftar pelanggan sebelum menyimpan penjualan."
    );
  }

  return {
    id: selectedCustomer.id,
    code: selectedCustomer.code || selectedCustomer.customerCode || selectedCustomer.id,
    customerCode: selectedCustomer.customerCode || selectedCustomer.code || selectedCustomer.id,
    name: selectedCustomer.name || "",
    contact: selectedCustomer.contact || "",
    address: selectedCustomer.address || "",
  };
};
