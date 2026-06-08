const express = require("express");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");
const authController = require("./auth.controller");

const router = express.Router();

router.get("/status", authController.getStatus);
router.post("/bootstrap-admin", authController.bootstrapAdmin);
router.post("/login", authController.login);
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
