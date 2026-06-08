const { success } = require("../../utils/response");
const { getHealthStatus } = require("./health.service");

const getHealthStatusController = (_req, res) => success(
  res,
  "IMS layanan lokal aktif",
  getHealthStatus(),
);

module.exports = {
  getHealthStatusController,
};
