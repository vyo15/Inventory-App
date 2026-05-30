import * as dexieCustomersAdapter from "../adapters/dexie/dexieCustomersAdapter";
import * as firebaseCustomersAdapter from "../adapters/firebase/firebaseCustomersAdapter";
import {
  REPOSITORY_MODES,
  resolveRepositoryMode,
} from "./repositoryMode";

const getCustomersAdapter = (options = {}) => {
  const mode = resolveRepositoryMode(options);

  if (mode === REPOSITORY_MODES.OFFLINE_LOCAL) {
    return dexieCustomersAdapter;
  }

  return firebaseCustomersAdapter;
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
