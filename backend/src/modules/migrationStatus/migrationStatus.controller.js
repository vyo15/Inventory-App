const { success } = require("../../utils/response");
const { getMigrationStatus } = require("./migrationStatus.service");

const getMigrationStatusController = async (_req, res, next) => {
  try {
    const status = await getMigrationStatus();
    return success(res, "Status modul aplikasi berhasil dimuat", status);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getMigrationStatusController,
};
