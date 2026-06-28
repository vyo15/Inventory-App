const express = require("express");
const { requireLocalAuth } = require("../../middlewares/localAuth");
const { success } = require("../../utils/response");
const {
  getRealtimeRuntimeStatus,
  registerRealtimeClient,
} = require("./realtime.service");

const router = express.Router();

router.get("/status", requireLocalAuth, (req, res) => {
  const runtime = getRealtimeRuntimeStatus({ role: req.localAuth?.user?.role || "" });
  return success(res, "Status sinkronisasi realtime berhasil dimuat", {
    contractVersion: runtime.contractVersion,
    enabled: runtime.enabled,
    transport: runtime.transport,
    revision: runtime.revision,
  });
});
router.get("/events", requireLocalAuth, registerRealtimeClient);

module.exports = router;
