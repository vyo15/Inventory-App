import * as sqliteCustomersAdapter from "../adapters/sqlite/sqliteCustomersAdapter";

const getCustomersAdapter = () => sqliteCustomersAdapter;

export const listCustomers = (options = {}) => getCustomersAdapter().listCustomers(options);
export const getCustomerById = (customerId, options = {}) => getCustomersAdapter().getCustomerById(customerId, options);
export const generateCustomerCode = (values = {}, options = {}) => getCustomersAdapter().generateCustomerCode(values, options?.excludeId || null);
export const createCustomer = (values = {}, options = {}) => getCustomersAdapter().createCustomer(values, options);
export const updateCustomer = (customerId, values = {}, options = {}) => getCustomersAdapter().updateCustomer(customerId, values, options);
export const deleteCustomer = (customerId, options = {}) => getCustomersAdapter().deleteCustomer(customerId, options);
