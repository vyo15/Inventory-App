const express = require("express");
const { getDb } = require("../../db/connection");
const { success } = require("../../utils/response");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const db = await getDb();
    const rows = await db.all("SELECT key, value, updated_at FROM app_settings ORDER BY key ASC");
    const settings = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    return success(res, "Settings SQLite sidecar berhasil dimuat", settings, { rows });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
