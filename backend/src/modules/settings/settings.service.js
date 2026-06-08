const { getDb } = require("../../db/connection");

const getAppSettings = async () => {
  const db = await getDb();
  const rows = await db.all("SELECT key, value, updated_at FROM app_settings ORDER BY key ASC");
  const settings = rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});

  return { settings, rows };
};

module.exports = {
  getAppSettings,
};
