const { getDb } = require("../../db/connection");
const { enrichBackupLogs } = require("./backup");

const listRestoreLogs = async () => {
  const db = await getDb();
  return db.all("SELECT * FROM restore_logs ORDER BY id DESC LIMIT 50");
};

const listBackups = async () => {
  const db = await getDb();
  const rows = await db.all(
    "SELECT * FROM backup_logs WHERE status != 'retention_deleted' ORDER BY created_at DESC, id DESC LIMIT 500"
  );
  return enrichBackupLogs(rows);
};


module.exports = { listBackups, listRestoreLogs };
