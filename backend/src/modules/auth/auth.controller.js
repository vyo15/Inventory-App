const { failure, success } = require("../../utils/response");
const authService = require("./auth.service");

const handleAuthError = (res, next, error) => {
  if (error?.code && error?.statusCode) {
    return failure(res, error.message, error.code, error.statusCode);
  }
  return next(error);
};

const getStatus = async (req, res, next) => {
  try {
    const status = await authService.getAuthStatus();
    return success(res, "Status akses lokal berhasil dimuat", status);
  } catch (error) {
    return next(error);
  }
};

const bootstrapAdmin = async (req, res, next) => {
  try {
    const user = await authService.bootstrapAdmin(req.body);
    return success(res, "Administrator lokal berhasil dibuat", user, undefined, 201);
  } catch (error) {
    return handleAuthError(res, next, error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body, {
      userAgent: req.get("user-agent") || "",
      ipAddress: req.ip || "",
    });
    return success(res, "Login lokal berhasil", result);
  } catch (error) {
    return handleAuthError(res, next, error);
  }
};

const me = async (req, res) => success(res, "Session lokal aktif", { user: req.localAuth.user });

const logout = async (req, res, next) => {
  try {
    const result = await authService.logout({
      sessionId: req.localAuth.sessionId,
      user: req.localAuth.user,
    });
    return success(res, "Logout lokal berhasil", result);
  } catch (error) {
    return next(error);
  }
};

const listUsers = async (req, res, next) => {
  try {
    const users = await authService.listUsers();
    return success(res, "Daftar user lokal berhasil dimuat", users);
  } catch (error) {
    return next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const user = await authService.createUser(req.body, req.localAuth.user);
    return success(res, "User lokal berhasil dibuat", user, undefined, 201);
  } catch (error) {
    return handleAuthError(res, next, error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const user = await authService.updateUser(req.params.id, req.body, req.localAuth.user);
    return success(res, "User lokal berhasil diubah", user);
  } catch (error) {
    return handleAuthError(res, next, error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const result = await authService.deleteUser(req.params.id, req.localAuth.user);
    return success(res, "User lokal berhasil dihapus", result);
  } catch (error) {
    return handleAuthError(res, next, error);
  }
};

module.exports = {
  bootstrapAdmin,
  createUser,
  deleteUser,
  getStatus,
  listUsers,
  login,
  logout,
  me,
  updateUser,
};
