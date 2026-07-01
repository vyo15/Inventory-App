import * as sqliteCustomersAdapter from "../adapters/sqlite/sqliteCustomersAdapter";


export const listCustomers = (options = {}) => sqliteCustomersAdapter.listCustomers(options);
export const getCustomerById = (customerId, options = {}) => sqliteCustomersAdapter.getCustomerById(customerId, options);
export const generateCustomerCode = (values = {}, options = {}) => sqliteCustomersAdapter.generateCustomerCode(values, options?.excludeId || null);
export const createCustomer = (values = {}, options = {}) => sqliteCustomersAdapter.createCustomer(values, options);
export const updateCustomer = (customerId, values = {}, options = {}) => sqliteCustomersAdapter.updateCustomer(customerId, values, options);
export const deleteCustomer = (customerId, options = {}) => sqliteCustomersAdapter.deleteCustomer(customerId, options);
