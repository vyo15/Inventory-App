import Dexie from "dexie";

import { LOCAL_DB_NAME, LOCAL_DB_SCHEMA, getLocalDbTableNames } from "./localDbSchema";

let localDbInstance = null;

export const createImsLocalDb = () => {
  const db = new Dexie(LOCAL_DB_NAME);
  db.version(LOCAL_DB_SCHEMA.version).stores(LOCAL_DB_SCHEMA.stores);
  return db;
};

export const getImsLocalDb = () => {
  if (!localDbInstance) {
    localDbInstance = createImsLocalDb();
  }

  return localDbInstance;
};

export const closeImsLocalDb = () => {
  if (localDbInstance) {
    localDbInstance.close();
    localDbInstance = null;
  }
};

export const getImsLocalDbTableNames = () => getLocalDbTableNames();
