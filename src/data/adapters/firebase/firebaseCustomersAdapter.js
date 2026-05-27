import {
  createCustomer as createFirebaseCustomer,
  deleteCustomer as deleteFirebaseCustomer,
  getCustomers,
  updateCustomer as updateFirebaseCustomer,
} from "../../../services/MasterData/customersService";

export const listCustomers = () => getCustomers();

export const getCustomerById = async (customerId) => {
  if (!customerId) return null;
  const customers = await getCustomers();
  return customers.find((customer) => customer.id === customerId) || null;
};

export const createCustomer = (values = {}) => createFirebaseCustomer(values);

export const updateCustomer = (customerId, values = {}) =>
  updateFirebaseCustomer(customerId, values);

export const deleteCustomer = (customerId) => deleteFirebaseCustomer(customerId);
