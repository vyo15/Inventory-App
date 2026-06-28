const { runInTransaction, runSerializedDbOperation } = require("../../../db/connection");

const runWriteOperation = async (_db, useWriteTransaction, callback) => (
  useWriteTransaction
    ? runInTransaction(callback)
    : runSerializedDbOperation(callback)
);

module.exports = { runWriteOperation };
