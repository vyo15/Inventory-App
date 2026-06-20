const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const { runMigrations } = require("./db/migrate");
const { getDbPath } = require("./db/connection");
const { ensureDailyBackupForToday } = require("./utils/sqliteBackup");
const requestLogger = require("./middlewares/requestLogger");
const { createCorsOptionsDelegate, enforceTrustedOrigin } = require("./middlewares/corsOptions");
const { errorHandler, notFoundHandler } = require("./middlewares/errorHandler");
const { success } = require("./utils/response");
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
const authService = require("./modules/auth/auth.service");
const { getBootstrapCodeForConsole } = require("./modules/auth/authBootstrapGuard");

const app = express();
app.disable("x-powered-by");

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
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/audit-logs", auditLogsRoutes);
app.use("/api/module-runtime-status", migrationStatusRoutes);
app.use("/api/migration-status", migrationStatusRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  await runMigrations();

  const authStatus = await authService.getAuthStatus();
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
      console.log(`Auto backup harian dibuat: ${dailyBackup.backup.filename}`);
    }
  } catch (error) {
    console.warn("Auto backup harian gagal dibuat. Jalankan backup manual dari UI.", error.message);
  }

  app.listen(env.port, env.host, () => {
    console.log(`IMS layanan lokal jalan di http://localhost:${env.port}`);
    console.log(`Lokasi database lokal: ${getDbPath()}`);
    console.log("Mode: database lokal primary. Modul guarded wajib lewat endpoint layanan resmi.");
  });
}

startServer().catch((error) => {
  console.error("Gagal menjalankan IMS layanan lokal:", error);
  process.exit(1);
});
