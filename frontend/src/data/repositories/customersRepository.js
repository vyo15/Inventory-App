import * as firebaseCustomersAdapter from "../adapters/firebase/firebaseCustomersAdapter";
import * as sqliteCustomersAdapter from "../adapters/sqlite/sqliteCustomersAdapter";
import {
  REPOSITORY_MODES,
  resolveRepositoryMode,
} from "./repositoryMode";

const getCustomersAdapter = (options = {}) => {
  const mode = resolveRepositoryMode(options);

  if (mode === REPOSITORY_MODES.FIREBASE_PRIMARY) {
    return firebaseCustomersAdapter;
  }

  return sqliteCustomersAdapter;
};

export const listCustomers = (options = {}) =>
  getCustomersAdapter(options).listCustomers(options);

export const getCustomerById = (customerId, options = {}) =>
  getCustomersAdapter(options).getCustomerById(customerId, options);

export const generateCustomerCode = (values = {}, options = {}) =>
  getCustomersAdapter(options).generateCustomerCode(values, options?.excludeId || null);

export const createCustomer = (values = {}, options = {}) =>
  getCustomersAdapter(options).createCustomer(values, options);

export const updateCustomer = (customerId, values = {}, options = {}) =>
  getCustomersAdapter(options).updateCustomer(customerId, values, options);

export const deleteCustomer = (customerId, options = {}) =>
  getCustomersAdapter(options).deleteCustomer(customerId, options);
