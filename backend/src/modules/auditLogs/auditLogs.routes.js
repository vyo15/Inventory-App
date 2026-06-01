const express = require("express");
const { getDb } = require("../../db/connection");
const { success } = require("../../utils/response");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const db = await getDb();
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const moduleName = req.query.module ? String(req.query.module) : null;

    const rows = moduleName
      ? await db.all(
        "SELECT * FROM audit_logs WHERE module = ? ORDER BY id DESC LIMIT ?",
        [moduleName, limit]
      )
      : await db.all("SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?", [limit]);

    return success(res, "Audit log SQLite sidecar berhasil dimuat", rows, { limit, module: moduleName });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
