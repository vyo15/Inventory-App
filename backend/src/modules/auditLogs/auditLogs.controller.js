const { success } = require("../../utils/response");
const { listAuditLogs } = require("./auditLogs.service");

const listAuditLogsController = async (req, res, next) => {
  try {
    const result = await listAuditLogs(req.query || {});
    return success(
      res,
      "Audit log layanan database lokal berhasil dimuat",
      result.rows,
      result.meta,
    );
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listAuditLogsController,
};
