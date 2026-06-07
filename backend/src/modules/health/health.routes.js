const express = require("express");
const { success } = require("../../utils/response");

const router = express.Router();

router.get("/", (_req, res) => success(res, "IMS layanan lokal aktif", {
  service: "Layanan lokal IMS",
  active: true,
  serverTime: new Date().toISOString(),
}));

module.exports = router;
