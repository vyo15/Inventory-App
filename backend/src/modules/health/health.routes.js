const express = require("express");
const { success } = require("../../utils/response");
const { getDb, getDbPath } = require("../../db/connection");
const { SCHEMA_VERSION } = require("../../db/schema");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const db = await getDb();
    const dbNow = await db.get("SELECT CURRENT_TIMESTAMP AS now");
    return success(res, "IMS layanan lokal aktif", {
      service: "Layanan lokal IMS",
      phase: "database-local-active",
      dbPath: getDbPath(),
      schemaVersion: SCHEMA_VERSION,
      dbTime: dbNow?.now,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
