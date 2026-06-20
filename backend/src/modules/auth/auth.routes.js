const express = require("express");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");
const { bootstrapRateLimiter, loginRateLimiter } = require("../../middlewares/authRateLimit");
const authController = require("./auth.controller");

const router = express.Router();

router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  return next();
});

router.get("/status", authController.getStatus);
router.post("/bootstrap-admin", bootstrapRateLimiter, authController.bootstrapAdmin);
router.post("/login", loginRateLimiter, authController.login);
router.get("/me", requireLocalAuth, authController.me);
router.post("/logout", requireLocalAuth, authController.logout);

router.get(
  "/users",
  requireLocalAuth,
  requireLocalAdministrator,
  authController.listUsers
);

router.post(
  "/users",
  requireLocalAuth,
  requireLocalAdministrator,
  authController.createUser
);

router.put(
  "/users/:id",
  requireLocalAuth,
  requireLocalAdministrator,
  authController.updateUser
);

router.delete(
  "/users/:id",
  requireLocalAuth,
  requireLocalAdministrator,
  authController.deleteUser
);

module.exports = router;
