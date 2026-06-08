const { success } = require("../../utils/response");
const { getAppSettings } = require("./settings.service");

const getAppSettingsController = async (_req, res, next) => {
  try {
    const result = await getAppSettings();
    return success(
      res,
      "Settings layanan database lokal berhasil dimuat",
      result.settings,
      { rows: result.rows },
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getAppSettingsController,
};
