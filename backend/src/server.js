const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const { runMigrations } = require("./db/migrate");
const { closeDb, getDbPath } = require("./db/connection");
const { ensureDailyBackupForToday } = require("./utils/sqliteBackup");
const requestLogger = require("./middlewares/requestLogger");
const securityHeaders = require("./middlewares/securityHeaders");
const { createCorsOptionsDelegate, enforceTrustedOrigin } = require("./middlewares/corsOptions");
const { errorHandler, notFoundHandler } = require("./middlewares/errorHandler");
const { success } = require("./utils/response");
const logger = require("./utils/logger");
const healthRoutes = require("./modules/health/health.routes");
const settingsRoutes = require("./modules/settings/settings.routes");
const authRoutes = require("./modules/auth/auth.routes");
const customersRoutes = require("./modules/customers/customers.routes");
const categoriesRoutes = require("./modules/categories/categories.routes");
const suppliersRoutes = require("./modules/suppliers/suppliers.routes");
const pricingRulesRoutes = require("./modules/pricingRules/pricingRules.routes");
const maintenanceRoutes = require("./modules/maintenance/maintenance.routes");
const auditLogsRoutes = require("./modules/auditLogs/auditLogs.routes");
const migrationStatusRoutes = require("./modules/migrationStatus/migrationStatus.routes");
const productsRoutes = require("./modules/products/products.routes");
const rawMaterialsRoutes = require("./modules/rawMaterials/rawMaterials.routes");
const semiFinishedMaterialsRoutes = require("./modules/semiFinishedMaterials/semiFinishedMaterials.routes");
const stockReadModelsRoutes = require("./modules/stockReadModels/stockReadModels.routes");
const stockRoutes = require("./modules/stock/stock.routes");
const stockAdjustmentsRoutes = require("./modules/stockAdjustments/stockAdjustments.routes");
const transactionsRoutes = require("./modules/transactions/transactions.routes");
const financeRoutes = require("./modules/finance/finance.routes");
const productionRoutes = require("./modules/production/production.routes");
const reportsRoutes = require("./modules/reports/reports.routes");
const openApiRoutes = require("./modules/openApi/openApi.routes");
const authService = require("./modules/auth/auth.service");
const { getBootstrapCodeForConsole } = require("./modules/auth/authBootstrapGuard");

const app = express();
app.disable("x-powered-by");

app.use(securityHeaders);
app.use(enforceTrustedOrigin);
app.use(cors(createCorsOptionsDelegate));
app.use(express.json({ limit: "1mb" }));
app.use(requestLogger);

app.get("/api", (_req, res) => success(res, "IMS layanan lokal API aktif", {
  service: "IMS local API",
  active: true,
  publicEndpoints: [
    "GET /health",
    "GET /api/auth/status",
    "POST /api/auth/bootstrap-admin (setup awal dengan kode terminal)",
    "POST /api/auth/login",
  ],
  note: "Detail operasional hanya tersedia setelah login melalui aplikasi.",
  serverTime: new Date().toISOString(),
}));

app.use("/health", healthRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/pricing-rules", pricingRulesRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/raw-materials", rawMaterialsRoutes);
app.use("/api/semi-finished-materials", semiFinishedMaterialsRoutes);
app.use("/api/stock-read-models", stockReadModelsRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/stock-adjustments", stockAdjustmentsRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/openapi.json", openApiRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/audit-logs", auditLogsRoutes);
app.use("/api/module-runtime-status", migrationStatusRoutes);
app.use("/api/migration-status", migrationStatusRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const SHUTDOWN_TIMEOUT_MS = 10_000;
const IPC_MESSAGES = Object.freeze({
  READY: "IMS_BACKEND_READY",
  SHUTDOWN_REQUEST: "IMS_SHUTDOWN_REQUEST",
  SHUTDOWN_COMPLETED: "IMS_SHUTDOWN_COMPLETED",
});
let httpServer = null;
let startupPromise = null;
let shutdownPromise = null;
let shutdownRequested = false;
let processShutdownHandlersInstalled = false;

const listenForRequests = () => new Promise((resolve, reject) => {
  const server = app.listen(env.port, env.host);
  httpServer = server;

  const handleError = (error) => {
    server.off("listening", handleListening);
    if (httpServer === server) httpServer = null;
    reject(error);
  };
  const handleListening = () => {
    server.off("error", handleError);
    resolve(server);
  };

  server.once("error", handleError);
  server.once("listening", handleListening);
});

const closeHttpServer = () => new Promise((resolve, reject) => {
  if (!httpServer) return resolve();
  const server = httpServer;

  const closeListeningServer = () => {
    server.close((error) => {
      httpServer = null;
      if (error) reject(error);
      else resolve();
    });
    server.closeIdleConnections?.();
  };

  if (server.listening) {
    closeListeningServer();
    return;
  }

  const handleListening = () => {
    server.off("error", handleError);
    closeListeningServer();
  };
  const handleError = (error) => {
    server.off("listening", handleListening);
    httpServer = null;
    reject(error);
  };

  server.once("listening", handleListening);
  server.once("error", handleError);
});

const performStartup = async () => {
  await runMigrations();
  if (shutdownRequested) return null;

  const authStatus = await authService.getAuthStatus();
  if (shutdownRequested) return null;

  if (authStatus.bootstrapRequired) {
    console.warn("============================================================");
    console.warn("SETUP ADMIN PERTAMA IMS");
    console.warn(`Kode setup lokal: ${getBootstrapCodeForConsole()}`);
    console.warn("Masukkan kode ini pada form setup administrator di browser.");
    console.warn("Kode tidak dikirim melalui endpoint status dan berubah saat backend restart.");
    console.warn("============================================================");
  }

  try {
    const dailyBackup = await ensureDailyBackupForToday();
    if (dailyBackup.created) {
      logger.info("daily_backup_created", { filename: dailyBackup.backup.filename });
    }
  } catch (error) {
    logger.warn("daily_backup_failed", { error });
  }

  if (shutdownRequested) return null;

  const server = await listenForRequests();
  const address = server.address();
  const activePort = typeof address === "object" && address ? address.port : env.port;
  logger.info("ims_local_server_started", {
    address: `http://localhost:${activePort}`,
    databasePath: getDbPath(),
    mode: "sqlite_primary_guarded",
  });
  return server;
};

function startServer() {
  if (httpServer?.listening) return Promise.resolve(httpServer);
  if (startupPromise) return startupPromise;
  if (shutdownRequested) return Promise.resolve(null);

  const pendingStartup = performStartup();
  startupPromise = pendingStartup;
  const clearStartupPromise = () => {
    if (startupPromise === pendingStartup) startupPromise = null;
  };
  pendingStartup.then(clearStartupPromise, clearStartupPromise);
  return pendingStartup;
}

const shutdownServer = ({ reason = "manual", exitCode = 0, exitProcess = false } = {}) => {
  if (shutdownPromise) return shutdownPromise;
  shutdownRequested = true;

  shutdownPromise = (async () => {
    logger.info("ims_local_server_shutdown_started", { reason });
    let finalExitCode = exitCode;
    let forceTimer = null;

    if (exitProcess) {
      forceTimer = setTimeout(() => {
        logger.error("ims_local_server_shutdown_timeout", {
          reason,
          timeoutMs: SHUTDOWN_TIMEOUT_MS,
        });
        httpServer?.closeAllConnections?.();
        process.exit(1);
      }, SHUTDOWN_TIMEOUT_MS);
      forceTimer.unref();
    }

    if (startupPromise) {
      try {
        await startupPromise;
      } catch (error) {
        logger.warn("ims_local_startup_settled_during_shutdown", { reason, error });
      }
    }

    try {
      await closeHttpServer();
    } catch (error) {
      finalExitCode = 1;
      logger.error("ims_local_http_server_close_failed", { reason, error });
      httpServer?.closeAllConnections?.();
      httpServer = null;
    }

    try {
      await closeDb();
    } catch (error) {
      finalExitCode = 1;
      logger.error("ims_local_database_close_failed", { reason, error });
    }

    if (forceTimer) clearTimeout(forceTimer);
    logger.info("ims_local_server_shutdown_completed", {
      reason,
      exitCode: finalExitCode,
    });

    if (exitProcess) process.exit(finalExitCode);
    return { exitCode: finalExitCode };
  })();

  return shutdownPromise;
};

const sendIpcMessage = (message, callback) => {
  if (typeof process.send !== "function" || !process.connected) return false;

  try {
    process.send(message, (error) => {
      if (error) logger.warn("ims_local_server_ipc_send_failed", { error, type: message.type });
      callback?.(error);
    });
    return true;
  } catch (error) {
    logger.warn("ims_local_server_ipc_send_failed", { error, type: message.type });
    return false;
  }
};

const exitAfterControlledShutdown = async (reason) => {
  try {
    const result = await shutdownServer({ reason, exitCode: 0, exitProcess: false });
    let exited = false;
    const finish = () => {
      if (exited) return;
      exited = true;
      process.exit(result.exitCode);
    };
    const fallback = setTimeout(finish, 1_000);
    fallback.unref();

    const sent = sendIpcMessage({
      type: IPC_MESSAGES.SHUTDOWN_COMPLETED,
      reason,
      exitCode: result.exitCode,
    }, () => {
      clearTimeout(fallback);
      finish();
    });

    if (!sent) {
      clearTimeout(fallback);
      finish();
    }
  } catch (error) {
    logger.error("ims_local_server_controlled_shutdown_failed", { reason, error });
    process.exit(1);
  }
};

const installProcessShutdownHandlers = () => {
  if (processShutdownHandlersInstalled) return;
  processShutdownHandlersInstalled = true;

  process.on("message", (message) => {
    if (message?.type !== IPC_MESSAGES.SHUTDOWN_REQUEST) return;
    const reason = String(message.reason || "parent_request");
    void exitAfterControlledShutdown(reason);
  });

  process.once("disconnect", () => {
    if (shutdownRequested) return;
    void shutdownServer({ reason: "parent_disconnect", exitCode: 1, exitProcess: true });
  });

  process.once("SIGINT", () => {
    void shutdownServer({ reason: "SIGINT", exitCode: 0, exitProcess: true });
  });
  process.once("SIGTERM", () => {
    void shutdownServer({ reason: "SIGTERM", exitCode: 0, exitProcess: true });
  });
  process.once("SIGHUP", () => {
    void shutdownServer({ reason: "SIGHUP", exitCode: 0, exitProcess: true });
  });
  if (process.platform === "win32") {
    process.once("SIGBREAK", () => {
      void shutdownServer({ reason: "SIGBREAK", exitCode: 0, exitProcess: true });
    });
  }
  process.once("uncaughtException", (error) => {
    logger.error("ims_local_server_uncaught_exception", { error });
    void shutdownServer({ reason: "uncaughtException", exitCode: 1, exitProcess: true });
  });
  process.once("unhandledRejection", (reason) => {
    logger.error("ims_local_server_unhandled_rejection", { reason });
    void shutdownServer({ reason: "unhandledRejection", exitCode: 1, exitProcess: true });
  });
  process.once("SIGUSR2", () => {
    void shutdownServer({ reason: "SIGUSR2", exitCode: 0, exitProcess: false })
      .finally(() => process.kill(process.pid, "SIGUSR2"));
  });
};

if (require.main === module) {
  installProcessShutdownHandlers();
  startServer()
    .then((server) => {
      if (!server) return;
      const address = server.address();
      const activePort = typeof address === "object" && address ? address.port : env.port;
      sendIpcMessage({
        type: IPC_MESSAGES.READY,
        address: `http://localhost:${activePort}`,
      });
    })
    .catch((error) => {
      logger.error("ims_local_server_start_failed", { error });
      void shutdownServer({ reason: "startup_failure", exitCode: 1, exitProcess: true });
    });
}

module.exports = {
  IPC_MESSAGES,
  app,
  installProcessShutdownHandlers,
  shutdownServer,
  startServer,
};
