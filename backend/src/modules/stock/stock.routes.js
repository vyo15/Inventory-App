const express = require("express");
const { getDb } = require("../../db/connection");
const { requireLocalAuth, requireLocalOperationalUser } = require("../../middlewares/localAuth");
const { failure, success } = require("../../utils/response");
const { commitStockMutation, insertEventRecord } = require("../../utils/sqliteStockEngine");

const router = express.Router();

router.post("/adjustments/commit", requireLocalAuth, requireLocalOperationalUser, async (req, res, next) => {
  const db = await getDb();
  try {
    await db.run("BEGIN IMMEDIATE TRANSACTION");
    const body = req.body || {};
    const result = await commitStockMutation(db, {
      sourceType: body.sourceType || body.itemType || body.type,
      sourceId: body.sourceId || body.itemId,
      deltaCurrent: body.deltaCurrent ?? body.quantityChange ?? body.quantity,
      variantKey: body.variantKey || "",
      referenceNumber: body.referenceNumber || body.code,
      reason: body.reason || "manual_adjustment",
      notes: body.notes || body.note || "",
      actor: req.localAuth.user.username,
      transactionType: "stock_adjustment",
      transactionPayload: body,
    });
    await insertEventRecord(db, "stock_adjustments", {
      ...body,
      id: result.referenceNumber,
      referenceNumber: result.referenceNumber,
      code: result.referenceNumber,
      name: `Penyesuaian ${result?.item?.name || body.sourceId || body.itemId}`,
      totalAmount: 0,
      sourceType: body.sourceType || body.itemType || body.type,
      sourceId: body.sourceId || body.itemId,
    });
    await db.run("COMMIT");
    return success(res, "Penyesuaian stok berhasil disimpan", result, undefined, 201);
  } catch (error) {
    await db.run("ROLLBACK").catch(() => {});
    return next(error);
  }
});

router.use((_req, res) => failure(res, "Endpoint stok tidak ditemukan", "NOT_FOUND", 404));

module.exports = router;
